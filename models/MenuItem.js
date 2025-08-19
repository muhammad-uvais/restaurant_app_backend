// models/MenuItem.js
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    image: {
      url: { type: String },
      public_id: { type: String },
    },
    type: {
      type: String,
      enum: ["veg", "non-veg"],
      required: true
    },
    category: String,
    available: {
      type: Boolean,
      default: true // menu item is available by default
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // reference to the User model (admin/restaurant owner)
      required: false
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);
