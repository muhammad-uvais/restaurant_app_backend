// models/MenuItem.js
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  image: {
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  },
  category: { type: String, required: true },
  available: { type: Boolean, default: true }
});

module.exports = mongoose.model("MenuItem", menuItemSchema);