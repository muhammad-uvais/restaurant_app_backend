// controllers/menuController.js
const MenuItem = require("../models/MenuItem");
const { uploadToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary")


// Customer
exports.getMenu = async (req, res) => {
  try {
    const menu = await MenuItem.find();
    console.log("GET MENU", menu);
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// OWNER
exports.addMenuItem = async (req, res) => {
  try {
    const { name, description, price, category, avaialable } = req.body;
    let image = null;
    // If there's an image file in the request, upload it to Cloudinary
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      image = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }
    const newItem = new MenuItem({ name, description, price, category, avaialable, image: image });
    console.log("newItem", newItem)
    await newItem.save(); newItem
    res.status(201).json({ message: 'Menu item updated.', item: updatedItem });
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

