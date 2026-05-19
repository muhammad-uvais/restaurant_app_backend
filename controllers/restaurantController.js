const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const User = require("../models/User")
const Order = require("../models/Order")
const mongoose = require("mongoose");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary");
const generateAndUploadQR = require("../utils/generateQR")
const path = require("path");
const logoPath = path.join(__dirname, "../assets/logo.jpeg");

// Retrieve restaurant details for clients based on domain (tenant middleware)
exports.getRestaurantDetails = async (req, res) => {
  try {
    const host = req.frontendHost; // from middleware

    // Lookup restaurant by domain
    const restaurant = await Restaurant.findOne({
      domain: host,
      deleted: false,
    })
      .select("-qrCode -__v -createdAt -updatedAt")
      .lean();

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Sort categories by displayOrder if present
    if (Array.isArray(restaurant.categories)) {
      restaurant.categories = [...restaurant.categories].sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
      );
    }

    res.status(200).json({
      restaurant,
    });
  } catch (err) {
    console.error("Get restaurant details error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Retrieve restaurant details for logged-in admin or staff (JWT protected)
exports.getMyRestaurantDetails = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { role, _id, restaurantId } = req.user;

    let restaurant;

    if (role === "admin") {
      restaurant = await Restaurant.findOne({
        user: _id,
        deleted: false,
      });
    } else if (role === "staff") {
      if (!restaurantId) {
        return res
          .status(400)
          .json({ message: "Staff not linked to restaurant" });
      }

      restaurant = await Restaurant.findOne({
        _id: restaurantId,
        deleted: false,
      });
    }

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Sort categories by displayOrder if present
    if (Array.isArray(restaurant.categories)) {
      restaurant.categories = [...restaurant.categories].sort(
        (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
      );
    }

    res.json({ success: true, data: restaurant });
  } catch (error) {
    console.error("Get restaurant error 👉", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update restaurant details (Admin, JWT protected)
exports.updateRestaurantDetails = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const restaurant = await Restaurant.findOne({ user: user._id });
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found." });

    const updateData = { ...req.body, updatedAt: new Date() };

    // ✅ ADD THIS BLOCK (Sections handling)
    if (req.body.sections !== undefined) {
      const sections = req.body.sections;

      updateData.sections = {
        indoor: {
          tables:
            sections.indoor?.tables !== undefined
              ? Number(sections.indoor.tables)
              : restaurant.sections?.indoor?.tables || 0,
        },
        outdoor: {
          tables:
            sections.outdoor?.tables !== undefined
              ? Number(sections.outdoor.tables)
              : restaurant.sections?.outdoor?.tables || 0,
        },
        rooftop: {
          tables:
            sections.rooftop?.tables !== undefined
              ? Number(sections.rooftop.tables)
              : restaurant.sections?.rooftop?.tables || 0,
        },
        rooms: {
          rooms:
            sections.rooms?.rooms !== undefined
              ? Number(sections.rooms.rooms)
              : restaurant.sections?.rooms?.rooms || 0,
        },
      };

      // Validation (same as before)
      if (
        updateData.sections.indoor.tables < 0 ||
        updateData.sections.outdoor.tables < 0 ||
        updateData.sections.rooftop.tables < 0 ||
        updateData.sections.rooms.rooms < 0
      ) {
        return res.status(400).json({
          message: "Section counts cannot be negative",
        });
      }
    }

    // Existing categories logic (UNCHANGED)
    if (req.body.categories !== undefined) {
      let categories = req.body.categories;

      if (!Array.isArray(categories)) {
        categories = [categories];
      }

      updateData.categories = categories
        .filter((cat) => cat && cat !== "")
        .map((cat, index) => {
          if (typeof cat === "string") {
            return { name: cat, displayOrder: index };
          }
          return {
            name: cat.name || "",
            displayOrder: cat.displayOrder ?? index,
          };
        });
    }

    // Existing logo logic (UNCHANGED)
    if (req.file) {
      if (restaurant.logo?.public_id) {
        await deleteFromCloudinary(restaurant.logo.public_id).catch(
          console.warn
        );
      }
      const result = await uploadToCloudinary(req.file.buffer);
      updateData.logo = { url: result.secure_url, public_id: result.public_id };
    }

    // Existing category comparison logic (UNCHANGED)
    const oldCategories = restaurant.categories.map((cat) => cat.name);
    const newCategories = Array.isArray(updateData.categories)
      ? updateData.categories.map((cat) => cat.name)
      : oldCategories;

    const removedCategories = oldCategories.filter(
      (cat) => !newCategories.includes(cat)
    );

    console.log("Old categories:", oldCategories);
    console.log("New categories:", newCategories);
    console.log("Removed categories:", removedCategories);

    // Update restaurant
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      restaurant._id,
      updateData,
      { new: true }
    );

    // Existing menu item deletion logic (UNCHANGED)
    let extraMessage = "";
    if (removedCategories.length > 0) {
      const regexCategories = removedCategories.map(
        (cat) => new RegExp(`^${cat}$`, "i")
      );

      const itemsToDelete = await MenuItem.find({
        user: user._id,
        category: { $in: regexCategories },
        deleted: false,
      });
      console.log("Menu items to be deleted:", itemsToDelete);

      await MenuItem.updateMany(
        { user: user._id, category: { $in: regexCategories }, deleted: false },
        { $set: { deleted: true } }
      );

      extraMessage = ` Categories [${removedCategories.join(
        ", "
      )}] and their related menu items have also been deleted.`;
    }

    res.status(200).json({
      message: "Restaurant details updated successfully." + extraMessage,
      restaurant: updatedRestaurant,
    });
  } catch (err) {
    console.error("Update restaurant error:", err);
    res.status(500).json({
      message: "Internal server error.",
      error: err.message,
    });
  }
};

// Delete restaurant (soft delete, Admin, JWT protected)
exports.deleteRestaurant = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const restaurant = await Restaurant.findOne({ user: user._id });
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    // Soft delete
    restaurant.deleted = true;
    await restaurant.save();

    res.status(200).json({ message: "Restaurant soft-deleted successfully" });
  } catch (err) {
    console.error("Soft delete restaurant error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update GST settings (Admin, JWT protected)
exports.updateGstSettings = async (req, res) => {
  try {
    const { gstEnabled, gstRate } = req.body || {};

    if (gstEnabled === undefined && gstRate === undefined) {
      return res.status(400).json({ message: "No GST settings provided" });
    }

    const userId = req.user._id;
    const restaurant = await Restaurant.findOne({
      user: userId,
      deleted: false,
    });
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    // Update gstEnabled if provided
    if (gstEnabled !== undefined) {
      restaurant.gstEnabled = gstEnabled === true || gstEnabled === "true";
    }

    // Update gstRate only if provided
    if (gstRate !== undefined) {
      const rate = Number(gstRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res
          .status(400)
          .json({ message: "Invalid GST rate. Must be 0-100." });
      }
      restaurant.gstRate = rate;
    }

    await restaurant.save();

    res.status(200).json({
      message: "GST settings updated successfully",
      gstEnabled: restaurant.gstEnabled,
      gstRate: restaurant.gstRate,
    });
  } catch (err) {
    console.error("Error updating GST settings:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update restaurant open status (Admin, JWT protected)
exports.updateRestaurantStatus = async (req, res) => {
  try {
    const user = req.user; // Logged-in user (from JWT middleware)
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // Find the restaurant linked to this user
    const restaurant = await Restaurant.findOne({ user: user._id });
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found." });

    const { isOpen } = req.body;

    // Validate input
    if (typeof isOpen !== "boolean") {
      return res.status(400).json({
        message: "Invalid value for isOpen. It must be true or false.",
      });
    }

    // Update only the isOpen field (partial update)
    restaurant.isOpen = isOpen;
    restaurant.updatedAt = new Date();
    await restaurant.save();

    res.status(200).json({
      message: `Restaurant is now ${isOpen ? "open" : "closed"}.`,
      restaurant,
    });
  } catch (err) {
    console.error("Update restaurant status error:", err);
    res
      .status(500)
      .json({ message: "Internal server error.", error: err.message });
  }
};

// Reorder categories (Admin, JWT protected)
exports.reorderCategories = async (req, res) => {
  try {
    const { orderedCategoryNames } = req.body;
    const userId = req.user._id;

    if (
      !Array.isArray(orderedCategoryNames) ||
      orderedCategoryNames.length === 0 ||
      new Set(orderedCategoryNames).size !== orderedCategoryNames.length
    ) {
      return res
        .status(400)
        .json({ error: "Invalid or duplicate category names." });
    }

    const restaurant = await Restaurant.findOne({
      user: userId,
      deleted: false,
    });
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    const categoryNames = restaurant.categories.map((cat) => cat.name);
    if (
      orderedCategoryNames.length !== categoryNames.length ||
      !orderedCategoryNames.every((name) => categoryNames.includes(name))
    ) {
      return res
        .status(400)
        .json({ error: "Some category names are invalid." });
    }

    restaurant.categories.sort(
      (a, b) =>
        orderedCategoryNames.indexOf(a.name) -
        orderedCategoryNames.indexOf(b.name),
    );
    restaurant.categories.forEach((cat, idx) => {
      cat.displayOrder = idx + 1;
    });

    await restaurant.save();
    res.json({
      message: "Categories reordered successfully",
      categories: restaurant.categories,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addUnits = async (req, res) => {
  try {
    const userId = req.user._id;
    const { sectionName, type, count, units } = req.body;

    if (!sectionName || !type) {
      return res.status(400).json({
        message: "sectionName and type are required",
      });
    }

    if (!["TABLE", "ROOM"].includes(type)) {
      return res.status(400).json({
        message: "Invalid type (TABLE or ROOM only)",
      });
    }

    const restaurant = await Restaurant.findOne({
      user: userId,
      deleted: false,
    });

    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found for this user",
      });
    }

    if (!restaurant.domain) {
      return res.status(400).json({
        message: "Restaurant domain not configured",
      });
    }

    const domain = restaurant.domain;

    let section = restaurant.sections.find(s => s.name === sectionName);

    if (!section) {
      restaurant.sections.push({ name: sectionName, units: [] });
      section = restaurant.sections[restaurant.sections.length - 1];
    }

    const existingNames = new Set(section.units.map(u => u.name));
    const newUnits = [];

    // =====================================================
    // CUSTOM UNITS MODE
    // =====================================================
    if (Array.isArray(units) && units.length > 0) {
      for (const u of units) {
        if (!u.name) {
          return res.status(400).json({
            message: "Each unit must have a name",
          });
        }

        if (existingNames.has(u.name)) {
          return res.status(400).json({
            message: `Duplicate unit name: ${u.name}`,
          });
        }

        const unitId = new mongoose.Types.ObjectId();

        const qr = await generateAndUploadQR(
          `${domain}/order?unitId=${unitId}`,
          logoPath
        );

        newUnits.push({
          _id: unitId,
          type,
          name: u.name,
          status: "AVAILABLE",
          currentOrderId: null,

          roomCategory:
            type === "ROOM" ? u.roomCategory || null : undefined,

          // ✅ FIXED: occupancy always exists
          occupancy: {
            checkInTime: null,
            checkOutTime: null,
          },

          qrCode: {
            url: qr.url,
            code: qr.public_id,
          },

          isActive: true,
        });

        existingNames.add(u.name);
      }
    }

    // =====================================================
    // BULK COUNT MODE
    // =====================================================
    else if (count && count > 0) {
      const existingUnits = section.units.filter(u => u.type === type);
      let startIndex = existingUnits.length + 1;

      for (let i = 0; i < count; i++) {
        const unitId = new mongoose.Types.ObjectId();

        const qr = await generateAndUploadQR(
          `${domain}/order?unitId=${unitId}`,
          logoPath
        );

        let name;

        if (type === "TABLE") {
          name = `T${startIndex + i}`;
        } else {
          name = `${100 + startIndex + i}`;
        }

        if (existingNames.has(name)) continue;

        newUnits.push({
          _id: unitId,
          type,
          name,
          status: "AVAILABLE",
          currentOrderId: null,

          // ✅ FIXED: occupancy added here too
          occupancy: {
            checkInTime: null,
            checkOutTime: null,
          },

          qrCode: {
            url: qr.url,
            code: qr.public_id,
          },

          isActive: true,
        });

        existingNames.add(name);
      }
    }

    else {
      return res.status(400).json({
        message: "Provide either 'count' or 'units[]'",
      });
    }

    section.units.push(...newUnits);
    await restaurant.save();

    return res.status(201).json({
      message: `${newUnits.length} ${type}(s) added successfully`,
      units: newUnits,
    });

  } catch (error) {
    console.error("Add units error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.bookRoom = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      unitId,
      customerName,
      customerPhone,
    } = req.body;

    if (!unitId) {
      return res.status(400).json({
        message: "unitId is required",
      });
    }

    const restaurant = await Restaurant.findOne({
      user: userId,
      deleted: false,
    });

    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
      });
    }

    let resolvedUnit = null;
    let resolvedSection = null;

    // 🔍 FIND ROOM
    for (const section of restaurant.sections) {
      const unit = section.units.id(unitId);

      if (unit && unit.type === "ROOM") {
        resolvedUnit = unit;
        resolvedSection = section.name;
        break;
      }
    }

    if (!resolvedUnit) {
      return res.status(404).json({
        message: "Room not found",
      });
    }

    // ❌ Already booked
    if (resolvedUnit.status === "OCCUPIED") {
      return res.status(400).json({
        message: "Room already booked",
      });
    }

    // ❌ ROOM CONFIG REQUIRED
    if (!resolvedUnit.roomCategory) {
      return res.status(400).json({
        message: "Room category not configured",
      });
    }

    const pricingModel =
      resolvedUnit.roomCategory.pricingModel || "PER_NIGHT";

    const pricePerNight =
      resolvedUnit.roomCategory.priceConfig?.pricePerNight || 0;

    // 🔥 CREATE ORDER (ROOM BOOKING)
    const order = await Order.create({
      user: userId,
      createdBy: userId,
      createdByRole: "admin",

      fingerPrint: null, // will be set on first food order

      customerName,
      customerPhone,

      items: [],

      subtotal: 0,
      gstRate: 0,
      gstAmount: 0,
      deliveryCharges: 0,
      totalAmount: 0,

      orderType: "Eat Here",

      source: {
        restaurantId: restaurant._id,
        unitId: resolvedUnit._id,
        sectionName: resolvedSection,
        unitName: resolvedUnit.name,
        type: "ROOM",
      },

      // ✅ PERFECT ALIGNMENT WITH RESTAURANT SCHEMA
      stay: {
        enabled: true,
        checkInTime: new Date(),
        checkOutTime: null,

        category: {
          name: resolvedUnit.roomCategory.name,
        },

        pricing: {
          model: pricingModel,
          rate: pricePerNight,
        },

        duration: {
          nights: 0,
        },

        roomCharge: 0,
      },
    });

    // ✅ MARK ROOM OCCUPIED
    resolvedUnit.status = "OCCUPIED";
    resolvedUnit.currentOrderId = order._id;

    // optional but useful
    resolvedUnit.occupancy = {
      checkInTime: new Date(),
      checkOutTime: null,
    };

    await restaurant.save();

    return res.status(201).json({
      message: "Room booked successfully",
      order,
    });

  } catch (error) {
    console.error("Book room error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

exports.getLiveUnitStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const restaurant = await Restaurant.findOne({
      user: userId,
      deleted: false,
    }).lean();

    if (!restaurant) {
      return res.status(404).json({
        message: "Restaurant not found",
      });
    }

    const sections = restaurant.sections.map((section) => ({
      sectionId: section._id,
      name: section.name,

      units: section.units.map((unit) => ({
        unitId: unit._id,
        name: unit.name,
        type: unit.type,
        status: unit.status,
        currentOrderId: unit.currentOrderId || null,
        occupiedSince: unit.occupancy?.checkInTime || null,

        roomCategory:
          unit.type === "ROOM"
            ? {
                name: unit.roomCategory?.name || null,
                pricingModel: unit.roomCategory?.pricingModel || null,
                pricePerNight:
                  unit.roomCategory?.priceConfig?.pricePerNight || null,
              }
            : null,
      })),
    }));

    return res.status(200).json({
      message: "Live unit status fetched successfully",
      sections,
    });

  } catch (error) {
    console.error("Live unit error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
