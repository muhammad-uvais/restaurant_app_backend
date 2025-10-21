const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  address: { type: String },
  tableId: {
    type: String,
    required: true,
  },

  items: [
    {
      menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
      },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true },
      name: { type: String, required: true }
    },
  ],
  status: {
    type: String,
    enum: ["pending", "completed", "cancelled"],
    default: "pending",
  },
  orderType: {
    type: String,
    enum: ["Eat Here", "Take Away", "Delivery"],
    required: true
  },
  subtotal: { type: Number, required: true },
  gstRate: { type: Number, required: true },
  gstAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
