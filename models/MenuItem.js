// models/MenuItem.js
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    image: {
      url: { type: String, required: true },
      public_id: { type: String, required: true },
    },
    category: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // reference to the User model (admin/restaurant owner)
      required: true
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);
