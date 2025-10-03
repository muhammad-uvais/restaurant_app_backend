const Restaurant = require("../models/Restaurant");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary")

// ========================
// Get restaurant details (Client, via tenant middleware)
// ========================
exports.getRestaurantDetails = async (req, res) => {
  try {
    const host = req.frontendHost; // from middleware

    // Lookup restaurant by domain
    const restaurant = await Restaurant.findOne({ domain: host, deleted: false }).lean();

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.status(200).json({
      restaurant,
    });
  } catch (err) {
    console.error("Get restaurant details error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// ========================
// Get restaurant details (Admin, JWT protected)
// ========================
exports.getAdminRestaurantDetails = async (req, res) => {
    try {
        const user = req.user; // JWT middleware sets req.user
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // Find restaurant linked to this admin
        const restaurant = await Restaurant.findOne({ user: user._id, deleted: false });
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

        res.status(200).json({
            restaurant,
        });
    } catch (err) {
        console.error("Admin restaurant details error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


// ========================
// Add restaurant details (Admin, JWT protected)
// ========================
exports.addRestaurantDetails = async (req, res) => {
    try {
        // 1️⃣ Get logged-in user from JWT
        const user = req.user; // req.user is populated by your JWT auth middleware

        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const existingRestaurant = await Restaurant.findOne({ user: user._id, deleted: false });
        if (existingRestaurant) {
            return res.status(400).json({
                message: "Restaurant already exists. Please update the existing restaurant instead.",
            });
        }

        const { categories, tableNumbers, phoneNumber } = req.body;
        let logo = null;

        // Upload to Cloudinary if image is present
        if (req.file) {
            const result = await uploadToCloudinary(req.file.buffer);
            logo = {
                url: result.secure_url,
                public_id: result.public_id,
            };
        }

        // 4️⃣ Create new restaurant using info from User + request body
        const restaurant = new Restaurant({
            user: user._id,
            name: user.name,   // from User model
            restaurantName: user.restaurantName,   // from User model
            domain: user.domain,     // from User model
            qrCode: user.qrCode,
            logo,
            categories: categories || [],
            tableNumbers: tableNumbers || [],
            phoneNumber: phoneNumber || "",
        });

        await restaurant.save();

        // Optional: store restaurantId in User for easy populate later
        user.restaurantId = restaurant._id;
        await user.save();

        res.status(201).json({
            message: "Restaurant details added successfully",
            restaurant,
        });
    } catch (err) {
        console.error("Add restaurant error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


// ========================
// Update restaurant details (Admin, JWT protected)
// ========================
exports.updateRestaurantDetails = async (req, res) => {
    try {
        const user = req.user; // logged-in user from JWT
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // Find restaurant linked to this user
        const restaurant = await Restaurant.findOne({ user: user._id });
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

        // Prepare fields to update
        const updateData = { ...req.body, updatedAt: new Date() };

        // Handle logo update
        if (req.file) {
            if (restaurant.logo?.public_id) {
                await deleteFromCloudinary(restaurant.logo.public_id).catch(console.warn);
            }
            const result = await uploadToCloudinary(req.file.buffer);
            updateData.logo = { url: result.secure_url, public_id: result.public_id };
        }

        // Update restaurant
        const updatedRestaurant = await Restaurant.findByIdAndUpdate(restaurant._id, updateData, { new: true });

        res.status(200).json({
            message: "Restaurant details updated successfully.",
            restaurant: updatedRestaurant
        });

    } catch (err) {
        console.error("Update restaurant error:", err);
        res.status(500).json({ message: "Internal server error.", error: err.message });
    }
};


// ========================
// Delete restaurant (Admin, JWT protected)
// ========================
exports.deleteRestaurant = async (req, res) => {
    try {
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const restaurant = await Restaurant.findOne({ user: user._id });
        if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

        // Soft delete
        restaurant.deleted = true;
        await restaurant.save();

        res.status(200).json({ message: "Restaurant soft-deleted successfully" });
    } catch (err) {
        console.error("Soft delete restaurant error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};


