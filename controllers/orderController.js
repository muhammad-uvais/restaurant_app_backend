// controllers/orderController.js
const Order = require("../models/Order");


// Customer
exports.createOrder = async (req, res) => {
  try {
    const { tableId, items } = req.body;
    const newOrder = await Order.create({ tableId, items });
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


//Restaurant Owner
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate("items.menuItem");
    res.status(200).json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//Restaurant Owner - Not confirm yet
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    res.status(200).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
