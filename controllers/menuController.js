
// controllers/menuController.js
const MenuItem = require("../models/MenuItem");


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
    const newItem = new MenuItem(req.body);
    console.log("newItem", newItem)
    await newItem.save();newItem
    res.status(201).json(newItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


// OWNER
exports.updateMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
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

