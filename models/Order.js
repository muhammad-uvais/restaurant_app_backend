const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  createdByRole: {
    type: String,
    enum: ["admin", "staff", "user"],
    default: "user",
  },

  fingerPrint: {
    type: String,
    required: false,
    index: true,
  },

  customerName: {
    type: String,
    required: true,
  },

  customerPhone: {
    type: String,
    required: true,
  },

  address: {
    type: String,
  },

  source: {
    section: {
      type: String,
    },
    number: {
      type: Number,
    },
    type: {
      type: String,
      enum: ["TABLE", "ROOM", "NONE"],
      default: "NONE",
    },
  },

  items: [
    {
      menuItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      variant: {
        type: String,
      },

      quantity: {
        type: Number,
        required: true,
      },

      price: {
        type: Number,
        required: true,
      },

      discountedPrice: {
        type: Number,
        required: true,
      },

      discountApplied: {
        type: {
          type: String,
          enum: ["percentage", "flat"],
          default: null,
        },
        value: {
          type: Number,
          default: 0,
        },
      },

      customizations: {
        type: String,
        default: "",
      },

      isReady: {
        type: Boolean,
        default: false,
      },
    },
  ],

  status: {
    type: String,
    enum: ["pending", "preparing", "ready", "completed", "cancelled"],
    default: "pending",
  },

  orderType: {
    type: String,
    enum: ["Eat Here", "Take Away", "Delivery"],
    required: true,
  },

  subtotal: {
    type: Number,
    required: true,
  },

  deliveryCharges: {
    type: Number,
    default: 0,
  },

  gstRate: {
    type: Number,
    required: true,
  },

  gstAmount: {
    type: Number,
    required: true,
  },

  totalAmount: {
    type: Number,
    required: true,
  },
},
{ timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);