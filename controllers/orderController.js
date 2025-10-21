// controllers/orderController.js
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");

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

    // Calculate subtotal
    const subtotal = items.reduce((acc, item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      return acc + itemTotal;
    }, 0);

    // Fetch restaurant GST settings
    const restaurant = await Restaurant.findOne({ user: tenantAdminId, deleted: false });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    let gstRate = 0;
    let gstAmount = 0;

    // Apply GST only if enabled
    if (restaurant.gstEnabled && restaurant.gstRate > 0) {
      gstRate = restaurant.gstRate;
      gstAmount = (subtotal * gstRate) / 100;
    }

    const totalAmount = subtotal + gstAmount;

    // Create order
    const order = new Order({
      user: tenantAdminId,
      customerName,
      customerPhone,
      items,
      subtotal,
      gstRate,
      gstAmount,
      totalAmount,
      tableId,
      orderType,
    });

    await order.save();

    res.status(201).json({
      message: `Order placed successfully for the Restaurant: ${restaurant?.restaurantName}`,
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
