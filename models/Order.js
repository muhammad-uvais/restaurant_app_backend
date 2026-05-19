const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    /* -------------------- USER INFO -------------------- */
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

    address: String,

    /* -------------------- SOURCE (TABLE / ROOM) -------------------- */
    source: {
      restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true,
      },

      sectionName: String,

      unitId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },

      unitName: String,

      type: {
        type: String,
        enum: ["TABLE", "ROOM", "NONE"],
        default: "NONE",
      },
    },

    /* -------------------- ROOM STAY (ONLY FOR ROOMS) -------------------- */
    stay: {
      type: {
        enabled: {
          type: Boolean,
          default: false,
        },

        checkInTime: Date,
        checkOutTime: Date,

        category: {
          name: String,
        },

        pricing: {
          model: {
            type: String,
            enum: ["PER_NIGHT"],
          },
          rate: Number,
        },

        duration: {
          nights: Number,
        },

        roomCharge: {
          type: Number,
          default: 0,
        },
      },
      default: undefined, // 🔥 KEY FIX
    },

    /* -------------------- FOOD ITEMS -------------------- */
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

        variant: String,

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

    /* -------------------- ORDER STATUS -------------------- */
    status: {
      type: String,
      enum: ["pending", "preparing", "ready", "completed", "cancelled"],
      default: "pending",
    },

    orderType: {
      type: String,
      enum: ["Eat Here", "Take Away", "Delivery", "ROOM_BOOKING"], // 🔥 ADDED
      required: true,
    },

    /* -------------------- BILLING -------------------- */
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

    roomCharge: {
      type: Number,
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    /* -------------------- OPTIONAL (FUTURE) -------------------- */
    completedAt: Date,
  },
  { timestamps: true }
);

/* -------------------- INDEXES (IMPORTANT) -------------------- */
orderSchema.index({ "source.unitId": 1, status: 1 });
orderSchema.index({ fingerPrint: 1, "source.unitId": 1 });

module.exports = mongoose.model("Order", orderSchema);