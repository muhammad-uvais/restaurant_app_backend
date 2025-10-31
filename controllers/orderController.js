// controllers/orderController.js
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem")

// Create Order ( Client, via tenantMiddleware)
exports.createOrder = async (req, res) => {
  try {
    const { tenantAdminId } = req;

    if (!tenantAdminId) {
      return res.status(404).json({ message: "Restaurant/admin not found" });
    }

    const { customerName, customerPhone, items, tableId, orderType, address } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order must contain at least one item." });
    }

    // Fetch all menu items (no callbacks, async/await only)
    const menuItems = await MenuItem.find({
      _id: { $in: items.map((i) => i.menuItemId) },
    });

    // Calculate subtotal and build item list
    let subtotal = 0;
    const enrichedItems = [];

    for (const item of items) {
      const menuItem = menuItems.find(
        (m) => m._id.toString() === item.menuItemId
      );

      if (!menuItem) continue;

      let itemPrice = 0;

      if (menuItem.pricingType === "single") {
        // flat price
        itemPrice = menuItem.price;
      } else if (menuItem.pricingType === "variant") {
        const variantKey = item.variant?.toLowerCase();

        if (!variantKey || !menuItem.variantRates[variantKey]) {
          return res.status(400).json({
            message: `Variant '${item.variant}' not found for ${menuItem.name}`,
          });
        }

        itemPrice = menuItem.variantRates[variantKey];
      }

      subtotal += itemPrice * item.quantity;

      enrichedItems.push({
        menuItemId: menuItem._id,
        name: menuItem.name,
        variant:
          menuItem.pricingType === "variant" ? item.variant : null,
        quantity: item.quantity,
        price: itemPrice,
      });
    }

    // Restaurant GST logic
    const restaurant = await Restaurant.findOne({
      user: tenantAdminId,
      deleted: false,
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    const gstRate = restaurant.gstEnabled ? restaurant.gstRate : 0;
    const gstAmount = (subtotal * gstRate) / 100;
    const totalAmount = subtotal + gstAmount;

    // Create order (modern async style)
    const order = await Order.create({
      user: tenantAdminId,
      customerName,
      customerPhone,
      items: enrichedItems,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      tableId,
      orderType,
      address,
    });

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get All Orders ( Admin, JWT Protected) 
exports.getAllOrders = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const orders = await Order.find({ user: user._id })
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an Order using id from params, Admin
exports.updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    const order = await Order.findByIdAndUpdate(
      orderId,
      updates,
      { new: true } 
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order updated successfully from Admin", order });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Soft Delete an order using id from params, Admin
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByIdAndDelete(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Admin cancelled order successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Server error" });
  }
};
