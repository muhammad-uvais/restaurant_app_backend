// controllers/menuController.js
const MenuItem = require("../models/MenuItem")
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary")


// Get Menu details (Client, via tenant middleware)
exports.getMenuByTenant = async (req, res) => {
  try {
    const { tenantAdminId, tenantRestaurantName } = req;

    if (!tenantAdminId) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const menuItems = await MenuItem.find({ user: tenantAdminId, deleted: false });

    res.status(200).json({
      message: `Menu Items from restaurant: ${tenantRestaurantName}`,
      menu: menuItems,
    });
  } catch (err) {
    console.error("Get menu items error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get Menu details (Admin, JWT protected)
exports.getMenuItems = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    const menuItems = await MenuItem.find({ user: user._id, deleted: false });
    res.status(200).json({
      message: `Menu Items fetched successfully`,
      menu: menuItems,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add Menu details (Admin, JWT protected)
exports.addMenuItem = async (req, res) => {
  try {
    const { name, description, price, type, category, available } = req.body;
    let image = null;

    // Upload to Cloudinary if image is present
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    // Make sure req.user is available
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Unauthorized: User not found in request" });
    }

    const newItem = new MenuItem({
      name,
      description,
      price,
      type,
      category,
      available,
      image,
      user: req.user._id,
    });

    await newItem.save();
    res.status(201).json({ message: 'Menu item created.', item: newItem });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update Menu details (Admin, JWT protected)
exports.updateMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the existing menu item
    const item = await MenuItem.findById(id);
    if (!item) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    // Prepare the update data
    const updateData = { ...(req.body || {}), modifiedAt: new Date() };

    if (req.file) {
      // Delete old image if it exists
      if (item.image?.public_id) {
        await deleteFromCloudinary(item.image.public_id).catch(console.warn);
      }

      // Upload the new image
      const result = await uploadToCloudinary(req.file.buffer);
      updateData.image = {
        url: result.secure_url,
        public_id: result.public_id
      };
    }

    // Update the menu item in the database
    const updatedItem = await MenuItem.findByIdAndUpdate(id, updateData, { new: true });

    return res.status(200).json({ message: 'Menu item updated.', item: updatedItem });

  } catch (err) {
    console.error('Update error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Delete (Soft) Menu details (Admin, JWT protected)
exports.deleteMenuItem = async (req, res) => {
  const { id } = req.params

  try {
    const item = await MenuItem.findById(id);

    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    // Soft delete instead of removing from DB
    item.deleted = true;
    await item.save();

    res.status(200).json({ message: "Menu item soft deleted successfully" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: err.message });
  }
};


