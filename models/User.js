// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    domain: { type: String, required: true },  // add domain
    restaurant: { type: String, required: true, unique: true},
    qrCode: { type: String },                  // base64 QR code for the domain
    // Future: role (owner/user)
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

