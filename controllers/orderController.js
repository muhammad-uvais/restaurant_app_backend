// controllers/orderController.js
const Order = require("../models/Order");


// Public: Place order using restaurant in params
exports.createOrder = async (req, res) => {
  try {
    const { tenantAdminId, tenantRestaurantName } = req;
    console.log(tenantRestaurantName)

    if (!tenantAdminId) {
      return res.status(404).json({ message: "Restaurant/admin not found" });
    }

    const { customerName, customerPhone, items, totalAmount, tableId } = req.body;


    const order = new Order({
      user: tenantAdminId,   // store reference to restaurant's user
      customerName,
      customerPhone,
      items,
      totalAmount,
      tableId
    });

    await order.save();

    res.status(201).json({ message: `Order placed successfully for the Restaurant: ${tenantRestaurantName}`, order });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//Admin
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


exports.updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params; // order id
    const updates = req.body;  // fields to update

    const order = await Order.findByIdAndUpdate(
      orderId,
      updates,
      { new: true } // return updated doc
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

// Delete order admin
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params; // order id

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
