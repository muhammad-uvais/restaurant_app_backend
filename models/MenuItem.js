// models/MenuItem.js
const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    pricingType: {
      type: String,
      enum: ["single", "variant"],
      required: true,
    },
    price: { type: Number, default: null },
    variantRates: {
      quarter: { type: Number, default: null },
      half: { type: Number, default: null },
      full: { type: Number, default: null },
    },
    description: String,
    image: {
      url: { type: String },
      public_id: { type: String },
    },
    type: {
      type: String,
      enum: ["veg", "non-veg"],
      required: false
    },
    category: String,
    available: {
      type: Boolean,
      default: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MenuItem", menuItemSchema);