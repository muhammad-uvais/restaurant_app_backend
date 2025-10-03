const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        name: { type: String },
        restaurantName: {
            type: String,
        },
        domain: { type: String },
        logo: {
            url: { type: String },
            public_id: { type: String },
        },
        qrCode: { type: String },
        categories: [String],
        tableNumbers: { type: Number },
        phoneNumber: { type: Number },
        deleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);
