// controllers/menuController.js
const MenuItem = require("../models/MenuItem");
const User = require("../models/User")
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary")


exports.getMenuByDomain = async (req, res) => {
  const { restaurant } = req.params;

  try {
    // 1. Find the restaurant/admin (user) using the domain
    const user = await User.findOne({ restaurant });
    if (!user) {
      return res.status(404).json({ message: "Restaurant not found." });
    }

    // 2. Find all menu items created by that user
    const menuItems = await MenuItem.find({ user: user._id });
    res.status(200).json(menuItems);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Customer
exports.getMenuItems = async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ user: req.user._id });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// OWNER
exports.addMenuItem = async (req, res) => {
  try {
    const { name, description, price, category, avaialable } = req.body;
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
      category,
      avaialable,
      image,
      user: req.user._id,
    });

    await newItem.save();
    res.status(201).json({ message: 'Menu item created.', item: newItem });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};




// OWNER
exports.updateMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    const item = await MenuItem.findById(id);
    if (!item) return res.status(404).json({ error: 'Menu item not found.' });

    const updateData = { ...req.body, modifiedAt: new Date() };

    if (req.file) {
      // Delete old image if present
      if (item.image?.public_id) await deleteFromCloudinary(item.image.public_id).catch(console.warn);

      // Upload new image
      const result = await uploadToCloudinary(req.file.buffer);
      updateData.image = { url: result.secure_url, public_id: result.public_id };
    }

    const updatedItem = await MenuItem.findByIdAndUpdate(id, updateData, { new: true });
    return res.status(200).json({ message: 'Menu item updated.', item: updatedItem });

  } catch (err) {
    console.error('Update error:', err.message);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};


// OWNER
exports.deleteMenuItem = async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// OWNER
exports.toggleAvailability = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    item.available = !item.available;
    await item.save();
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

