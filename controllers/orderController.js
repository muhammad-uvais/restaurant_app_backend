// controllers/orderController.js
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const orderEmitter = require("../events/orderEvents");
const calculateDiscountedPrice = require("../utils/calculateDiscountedPrice");
const normalizeDiscount = require("../utils/normalizeDiscount");


// Create Order ( Client via tenant middleware)
exports.createOrder = async (req, res) => {
  try {
    const { tenantAdminId } = req;

    const {
      fingerPrint,
      customerName,
      customerPhone,
      items,
      orderType,
      address,
      createdBy,
      createdByRole = "user",
    } = req.body;

    const unitId = req.query.unitId || req.body?.source?.unitId;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items required" });
    }

    const restaurant = await Restaurant.findOne({
      user: tenantAdminId,
      deleted: false,
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    let resolvedUnit = null;
    let resolvedSection = null;

    // ================= FIND UNIT =================
    for (const section of restaurant.sections) {
      const unit = section.units.id(unitId);
      if (unit) {
        resolvedUnit = unit;
        resolvedSection = section.name;
        break;
      }
    }

    if (!resolvedUnit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    // ================= ROOM RULE =================
    if (resolvedUnit.type === "ROOM") {
      if (resolvedUnit.status !== "OCCUPIED") {
        return res.status(400).json({
          message: "Room is not booked by admin",
        });
      }
    }

    // ================= FIND ACTIVE ORDER =================
    let existingOrder = null;

    if (resolvedUnit.currentOrderId) {
      // ✅ Trust the unit's currentOrderId — ignores all legacy/orphaned orders
      existingOrder = await Order.findOne({
        _id: resolvedUnit.currentOrderId,
        status: { $ne: "completed" },
      });
    }

    // =====================================================
    // CREATE NEW ORDER
    // =====================================================
    if (!existingOrder) {
      existingOrder = await Order.create({
        user: tenantAdminId,
        createdBy: createdBy || null,
        createdByRole,

        fingerPrint,
        customerName,
        customerPhone,

        items: [],
        subtotal: 0,
        gstRate: restaurant.gstEnabled ? restaurant.gstRate : 0,
        gstAmount: 0,
        deliveryCharges:
          orderType === "Delivery" ? restaurant.deliveryCharges || 0 : 0,
        totalAmount: 0,

        source: {
          restaurantId: restaurant._id,
          unitId,
          sectionName: resolvedSection,
          unitName: resolvedUnit?.name,
          type: resolvedUnit?.type || "TABLE",
        },

        orderType,
        address: orderType === "Delivery" ? address : null,
      });
    }

    // ================= STRICT FINGERPRINT RULE =================
    if (existingOrder.fingerPrint && existingOrder.fingerPrint !== fingerPrint) {
      return res.status(403).json({
        message: "This table/room is already occupied by another customer",
      });
    }

    // assign fingerprint if first time
    if (!existingOrder.fingerPrint) {
      existingOrder.fingerPrint = fingerPrint;
    }

    // ================= MENU FETCH =================
    const menuItems = await MenuItem.find({
      _id: { $in: items.map((i) => i.menuItemId) },
    });

    const menuMap = {};
    menuItems.forEach((m) => {
      menuMap[m._id.toString()] = m;
    });

    let addSubtotal = 0;

    // ================= PROPER MERGE LOGIC =================
    for (const item of items) {
      const menuItem = menuMap[item.menuItemId];
      if (!menuItem) continue;

      const qty = Number(item.quantity) || 1;

      let basePrice = 0;
      let discountedPrice = 0;
      let discountSnapshot = { type: null, value: 0 };

      if (menuItem.pricingType === "single") {
        basePrice = menuItem.price;
        const discountObj = normalizeDiscount(menuItem.discount);
        discountedPrice = calculateDiscountedPrice(basePrice, discountObj);
        discountSnapshot = discountObj;
      } else if (menuItem.pricingType === "variant") {
        const key = item.variant?.toLowerCase();
        const variantData = menuItem.variantRates?.[key];

        if (!variantData) continue;

        basePrice = variantData.price;
        const discountObj = normalizeDiscount(variantData.discount);
        discountedPrice = calculateDiscountedPrice(basePrice, discountObj);
        discountSnapshot = discountObj;
      } else {
        basePrice = menuItem.comboPrice;
        discountedPrice = basePrice;
      }

      // 🔥 CHECK IF ITEM EXISTS
      const existingItem = existingOrder.items.find(
        (i) =>
          i.menuItemId.toString() === item.menuItemId &&
          (i.variant || null) === (item.variant || null)
      );

      if (existingItem) {
        existingItem.quantity += qty;
        existingItem.discountedPrice = discountedPrice;
      } else {
        existingOrder.items.push({
          menuItemId: menuItem._id,
          name: menuItem.name,
          quantity: qty,
          price: basePrice,
          discountedPrice,
          discountApplied: discountSnapshot,
          variant: item.variant || null,
          customizations: item.customizations || "",
        });
      }

      addSubtotal += discountedPrice * qty;
    }

    // ================= UPDATE BILL =================
    existingOrder.subtotal += addSubtotal;

    existingOrder.gstAmount =
      (existingOrder.subtotal * existingOrder.gstRate) / 100;

    existingOrder.totalAmount =
      existingOrder.subtotal +
      existingOrder.gstAmount +
      existingOrder.deliveryCharges;

    await existingOrder.save();

    // ================= OCCUPANCY =================
    if (resolvedUnit.type === "TABLE") {
      resolvedUnit.status = "OCCUPIED";

      if (!resolvedUnit.occupancy?.checkInTime) {
        resolvedUnit.occupancy = {
          checkInTime: new Date(),
          checkOutTime: null,
        };
      }

      resolvedUnit.currentOrderId = existingOrder._id;
      await restaurant.save();

    } else if (resolvedUnit.type === "ROOM") {
      // Status + checkInTime already set by admin at booking
      // Just attach the order reference
      resolvedUnit.currentOrderId = existingOrder._id;
      await restaurant.save();
    }

    return res.status(200).json({
      message: "Order processed successfully",
      order: existingOrder,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.createOrderByAdminOrStaff = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { _id: creatorId, role, createdBy } = req.user;

    // ✅ Resolve restaurant owner (adminId)
    const tenantAdminId =
      role === "admin" ? creatorId : createdBy;

    if (!tenantAdminId) {
      return res.status(400).json({
        message: "Restaurant/admin mapping not found",
      });
    }

    // ✅ VALIDATION (NEW)
    if (req.body.orderType === "Eat Here") {
      if (!req.body.source || req.body.source.type === "NONE") {
        return res.status(400).json({
          message: "Table/Room selection is required for Eat Here orders",
        });
      }
    }

    // ✅ SANITIZE SOURCE (NEW)
    const source = {
      section: req.body.source?.section || null,
      number: req.body.source?.number || null,
      type: req.body.source?.type || "NONE",
    };

    // ✅ Prepare payload
    const payload = {
      tenantAdminId,
      ...req.body,
      source, // ✅ override with clean source
      createdBy: creatorId,
      createdByRole: role,
    };

    // ❌ Remove fingerprint (only for public users)
    if (payload.fingerPrint) {
      delete payload.fingerPrint;
    }

    const order = await createOrderService(payload);

    orderEmitter.emit("orderCreated", order);

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("Admin/Staff order error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Get All Orders ( Admin, JWT Protected)
exports.getAllOrders = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { role, _id, createdBy } = req.user;
    const { status, range = "all", page = 1, limit = 10 } = req.query;

    let ownerAdminId;

    if (role === "admin") {
      ownerAdminId = _id;
    }

    if (role === "staff") {
      ownerAdminId = createdBy;
    }

    // Validate status
    const allowedStatus = ["pending", "preparing", "ready", "completed", "cancelled"];
    if (!status || !allowedStatus.includes(status.toLowerCase())) {
      return res.status(400).json({
        message: "Status must be pending, preparing, ready, completed, or cancelled",
      });
    }

    // Date range
    const now = new Date();
    let fromDate;

    switch (range) {
      case "24h":
        fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "2d":
        fromDate = new Date(now.getTime() - 2 * 86400000);
        break;
      case "7d":
        fromDate = new Date(now.getTime() - 7 * 86400000);
        break;
      case "15d":
        fromDate = new Date(now.getTime() - 15 * 86400000);
        break;
      case "30d":
        fromDate = new Date(now.getTime() - 30 * 86400000);
        break;
      default:
        fromDate = new Date(0);
    }

    // FINAL FILTER (single source of truth)
    const filter = {
      user: ownerAdminId, // admin id ALWAYS
      status: status.toLowerCase(),
      createdAt: { $gte: fromDate, $lte: now },
    };

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalOrders = await Order.countDocuments(filter);

    res.status(200).json({
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: Number(page),
      ordersPerPage: Number(limit),
      ordersInPage: orders.length,
      from: fromDate,
      to: now,
      orders,
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Orders by fingerprint
exports.getLatestOrdersByFingerPrint = async (req, res) => {
  try {
    const { fingerPrint } = req.query;
    const { tenantAdminId } = req;

    if (!fingerPrint) {
      return res.status(400).json({ message: "fingerPrint is required" });
    }

    if (!tenantAdminId) {
      return res.status(400).json({ message: "Tenant not found" });
    }

    // 👇 get last 2 orders
    const orders = await Order.find({
      fingerPrint,
      user: tenantAdminId,
    })
      .sort({ createdAt: -1 }) // newest first
      .limit(2)
      .lean();

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        message: "No orders found for this fingerprint",
      });
    }

    res.status(200).json({ orders });
  } catch (error) {
    console.error("Get orders by fingerprint error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update an Order using id from params, Admin
exports.updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    const ALLOWED_ORDER_TYPES = [
      "Eat Here",
      "Take Away",
      "Delivery",
    ];

    const SIMPLE_FIELDS = ["address", "orderType"];

    const makeItemKey = (item) => {
      return `${item.menuItemId}_${item.variant || "default"}_${item.customizations || ""
        }`;
    };

    // =====================================================
    // FETCH ORDER
    // =====================================================

    const existingOrder = await Order.findById(orderId);

    if (!existingOrder) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // =====================================================
    // HARD LOCK
    // =====================================================

    if (
      ["completed", "cancelled"].includes(existingOrder.status)
    ) {
      return res.status(400).json({
        message: `Cannot modify ${existingOrder.status} order`,
      });
    }

    const updatePayload = {};

    // =====================================================
    // VALIDATE ORDER TYPE
    // =====================================================

    if (
      updates.orderType &&
      !ALLOWED_ORDER_TYPES.includes(updates.orderType)
    ) {
      return res.status(400).json({
        message: "Invalid orderType",
      });
    }

    SIMPLE_FIELDS.forEach((field) => {
      if (updates[field] !== undefined) {
        updatePayload[field] = updates[field];
      }
    });

    // =====================================================
    // SOURCE UPDATE
    // =====================================================

    if (updates.source !== undefined) {
      updatePayload.source = {
        section:
          updates.source.section !== undefined
            ? updates.source.section
            : existingOrder.source?.section,

        number:
          updates.source.number !== undefined
            ? updates.source.number
            : existingOrder.source?.number,

        type:
          updates.source.type !== undefined
            ? updates.source.type
            : existingOrder.source?.type || "NONE",
      };
    }

    // =====================================================
    // ORDER TYPE RULES
    // =====================================================

    const finalOrderType =
      updates.orderType || existingOrder.orderType;

    if (
      finalOrderType === "Delivery" &&
      !(
        updates.address ||
        existingOrder.address ||
        updatePayload.address
      )
    ) {
      return res.status(400).json({
        message: "Address required for Delivery",
      });
    }

    if (finalOrderType === "Eat Here") {
      const sourceToCheck =
        updatePayload.source ||
        updates.source ||
        existingOrder.source;

      if (
        !sourceToCheck ||
        sourceToCheck.type === "NONE"
      ) {
        return res.status(400).json({
          message: "Table/Room required for Eat Here",
        });
      }
    }

    if (finalOrderType === "Take Away") {
      updatePayload.source = {
        section: null,
        number: null,
        type: "NONE",
      };

      updatePayload.address = null;
    }

    if (finalOrderType === "Delivery") {
      updatePayload.source = {
        section: null,
        number: null,
        type: "NONE",
      };
    }

    // =====================================================
    // BASE ITEMS
    // =====================================================

    let baseItems = existingOrder.items.map((item) =>
      item.toObject()
    );

    // =====================================================
    // REMOVE ITEMS
    // =====================================================

    if (
      Array.isArray(updates.removeItemIds) &&
      updates.removeItemIds.length
    ) {
      baseItems = baseItems.filter(
        (item) =>
          !updates.removeItemIds.includes(
            item._id.toString()
          )
      );
    }

    // =====================================================
    // UPDATE ITEM QUANTITIES
    // =====================================================

    if (
      Array.isArray(updates.updateQuantities) &&
      updates.updateQuantities.length
    ) {
      for (const qtyUpdate of updates.updateQuantities) {
        const itemIndex = baseItems.findIndex(
          (item) =>
            item._id.toString() === qtyUpdate.itemId
        );

        if (itemIndex === -1) {
          return res.status(400).json({
            message: `Item not found: ${qtyUpdate.itemId}`,
          });
        }

        const newQuantity = Number(
          qtyUpdate.quantity
        );

        // =====================================================
        // VALIDATION
        // =====================================================

        if (
          isNaN(newQuantity) ||
          !Number.isInteger(newQuantity)
        ) {
          return res.status(400).json({
            message:
              "Quantity must be a valid integer",
          });
        }

        // =====================================================
        // REMOVE ITEM IF QUANTITY <= 0
        // =====================================================

        if (newQuantity <= 0) {
          baseItems.splice(itemIndex, 1);
          continue;
        }

        // =====================================================
        // UPDATE QUANTITY
        // =====================================================

        baseItems[itemIndex].quantity =
          newQuantity;
      }
    }

    // =====================================================
    // ADD NEW ITEMS ONLY
    // =====================================================

    if (
      Array.isArray(updates.items) &&
      updates.items.length
    ) {
      const menuItems = await MenuItem.find({
        _id: {
          $in: updates.items.map(
            (i) => i.menuItemId
          ),
        },
        deleted: false,
        available: true,
      });

      const menuMap = new Map(
        menuItems.map((m) => [
          m._id.toString(),
          m,
        ])
      );

      for (const item of updates.items) {
        const menuItem = menuMap.get(
          item.menuItemId.toString()
        );

        if (!menuItem) {
          return res.status(400).json({
            message: `Item not available: ${item.menuItemId}`,
          });
        }

        let price = 0;
        let discountedPrice = 0;

        let discountApplied = {
          type: null,
          value: 0,
        };

        let variant = null;

        // =====================================================
        // SINGLE PRICING
        // =====================================================

        if (menuItem.pricingType === "single") {
          price = Number(menuItem.price);

          discountApplied =
            menuItem.discount || {
              type: null,
              value: 0,
            };

          discountedPrice =
            calculateDiscountedPrice(
              price,
              discountApplied
            );
        }

        // =====================================================
        // VARIANT PRICING
        // =====================================================

        if (menuItem.pricingType === "variant") {
          const key =
            item.variant?.toLowerCase();

          const variantData =
            menuItem.variantRates?.[key];

          if (!variantData) {
            return res.status(400).json({
              message: `Invalid variant for ${menuItem.name}`,
            });
          }

          price = Number(variantData.price);

          discountApplied =
            variantData.discount || {
              type: null,
              value: 0,
            };

          discountedPrice =
            calculateDiscountedPrice(
              price,
              discountApplied
            );

          variant = key;
        }

        // =====================================================
        // COMBO PRICING
        // =====================================================

        if (menuItem.pricingType === "combo") {
          price = Number(
            menuItem.comboPrice
          );

          discountApplied =
            menuItem.discount || {
              type: null,
              value: 0,
            };

          discountedPrice =
            calculateDiscountedPrice(
              price,
              discountApplied
            );
        }

        const normalizedItem = {
          menuItemId: menuItem._id,
          name: menuItem.name,
          variant,
          quantity: Number(
            item.quantity || 1
          ),
          price: Number(price),
          discountedPrice: Number(
            discountedPrice
          ),
          discountApplied,
          customizations:
            item.customizations || "",

          // IMPORTANT:
          // New items always start unready
          isReady: false,
        };

        const itemKey =
          makeItemKey(normalizedItem);

        const existingIndex =
          baseItems.findIndex(
            (i) =>
              makeItemKey({
                menuItemId: i.menuItemId,
                variant: i.variant,
                customizations:
                  i.customizations,
              }) === itemKey
          );

        // =====================================================
        // MERGE EXISTING ITEMS
        // =====================================================

        if (existingIndex > -1) {
          baseItems[
            existingIndex
          ].quantity +=
            normalizedItem.quantity;

          // IMPORTANT:
          // Preserve existing isReady
        } else {
          baseItems.push(normalizedItem);
        }
      }
    }

    // =====================================================
    // PREVENT EMPTY ORDER
    // =====================================================

    if (!baseItems.length) {
      return res.status(400).json({
        message:
          "Order must contain at least 1 item",
      });
    }

    // =====================================================
    // STATUS CONTROL
    // =====================================================

    const manualStatus = updates.status;

    if (manualStatus) {
      updatePayload.status = manualStatus;
    } else {
      const totalItems = baseItems.length;

      const readyItems = baseItems.filter(
        (i) => i.isReady
      ).length;

      if (readyItems === 0) {
        updatePayload.status = "pending";
      } else if (readyItems < totalItems) {
        updatePayload.status = "preparing";
      } else {
        updatePayload.status = "ready";
      }
    }

    // =====================================================
    // STATUS ↔ ITEMS SYNC
    // =====================================================

    if (
      ["ready", "completed"].includes(
        updatePayload.status
      )
    ) {
      baseItems = baseItems.map((item) => ({
        ...item,
        isReady: true,
      }));
    }

    if (
      updatePayload.status === "pending"
    ) {
      baseItems = baseItems.map((item) => ({
        ...item,
        isReady: false,
      }));
    }

    // =====================================================
    // TOTAL CALCULATIONS
    // =====================================================

    const subtotal = Number(
      baseItems
        .reduce((sum, item) => {
          const itemPrice = Number(
            item.discountedPrice ??
            item.price ??
            0
          );

          const quantity = Number(
            item.quantity || 1
          );

          return (
            sum + itemPrice * quantity
          );
        }, 0)
        .toFixed(2)
    );

    const restaurant =
      await Restaurant.findOne({
        user: existingOrder.user,
        deleted: false,
      });

    const gstRate =
      restaurant?.gstEnabled
        ? Number(
          restaurant.gstRate || 0
        )
        : 0;

    const gstAmount = Number(
      (
        (subtotal * gstRate) /
        100
      ).toFixed(2)
    );

    let deliveryCharges = 0;

    if (finalOrderType === "Delivery") {
      deliveryCharges = Number(
        restaurant?.deliveryCharges || 0
      );
    }

    const totalAmount = Number(
      (
        subtotal +
        gstAmount +
        deliveryCharges
      ).toFixed(2)
    );

    Object.assign(updatePayload, {
      items: baseItems,
      subtotal,
      gstRate,
      gstAmount,
      deliveryCharges,
      totalAmount,
    });

    // =====================================================
    // FINAL SAFETY
    // =====================================================

    if (
      updatePayload.status ===
      "completed"
    ) {
      const allReady = baseItems.every(
        (i) => i.isReady
      );

      if (!allReady) {
        return res.status(400).json({
          message:
            "Cannot complete order until all items are ready",
        });
      }
    }

    // =====================================================
    // UPDATE DB
    // =====================================================

    const updatedOrder =
      await Order.findByIdAndUpdate(
        orderId,
        {
          $set: updatePayload,
        },
        {
          new: true,
        }
      );

    orderEmitter.emit(
      "orderUpdated",
      updatedOrder
    );

    return res.status(200).json({
      message: "Order updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error(
      "Error updating order:",
      error
    );

    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.toggleItemReady = async (req, res) => {
  const { orderId, itemId } = req.params;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).send("Order not found");

  const item = order.items.find(
    i => i._id.toString() === itemId
  );

  if (!item) {
    return res.status(404).send("Item not found");
  }

  item.isReady = !item.isReady;

  // ensure mongoose detects change
  order.markModified("items");

  // recalc order status
  const allReady = order.items.every(i => i.isReady);
  order.status = allReady ? "ready" : "preparing";

  const updatedOrder = await order.save();

  orderEmitter.emit("orderUpdated", updatedOrder);

  res.json(updatedOrder);
};

// Soft Delete an order using id from params, Admin
exports.cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findByIdAndDelete(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Admin cancelled order successfully" });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.checkoutOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "completed") {
      return res.status(400).json({ message: "Order already completed" });
    }

    // ================= RESTAURANT =================
    const restaurant = await Restaurant.findOne({
      user: order.user,
      deleted: false,
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // ================= FIND UNIT =================
    let resolvedUnit = null;

    for (const section of restaurant.sections) {
      const unit = section.units.id(order.source.unitId);
      if (unit) {
        resolvedUnit = unit;
        break;
      }
    }

    if (!resolvedUnit) {
      return res.status(404).json({ message: "Unit not found" });
    }

    // ================= ROOM LOGIC =================
    let roomCharge = 0;
    let foodSubtotal = order.subtotal;
    let gst = order.gstAmount;
    let delivery = order.deliveryCharges || 0;

    if (order.source.type === "ROOM") {
      if (!order.stay?.enabled) {
        return res.status(400).json({
          message: "Stay not enabled for this room order",
        });
      }

      const checkIn = order.stay.checkInTime
        ? new Date(order.stay.checkInTime)
        : new Date();

      const checkOut = new Date();
      const diffMs = checkOut - checkIn;
      const nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      const rate = order.stay?.pricing?.rate || 0;

      roomCharge = nights * rate;

      order.stay.checkOutTime = checkOut;
      order.stay.duration.nights = nights;
      order.stay.roomCharge = roomCharge;

      // food is already merged into this same order via createOrder
      foodSubtotal = order.subtotal;
      gst = order.gstAmount;
      delivery = order.deliveryCharges || 0;
    }

    // ================= BILL =================
    const totalAmount = foodSubtotal + gst + delivery + roomCharge;

    order.totalAmount = totalAmount;
    order.status = "completed";
    order.completedAt = new Date();

    await order.save();

    // ================= FREE UNIT =================
    resolvedUnit.status = "AVAILABLE";
    resolvedUnit.currentOrderId = null;
    resolvedUnit.occupancy = { checkInTime: null, checkOutTime: null };

    await restaurant.save();

    return res.status(200).json({
      message: "Checkout successful",
      order: {
        orderId: order._id,
        status: order.status,
        source: order.source,
        foodSubtotal,
        gst,
        deliveryCharges: delivery,
        roomCharge,
        totalAmount,
        completedAt: order.completedAt,
      },
    });

  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
