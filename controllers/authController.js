const User = require("../models/User");
const Restaurant = require("../models/Restaurant")
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const QRCode = require("qrcode");

// Super Admin 
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, domain, restaurantName } = req.body;

    //  Validate required fields
    if (!name || !email || !password || !restaurantName || !domain) {
      return res.status(400).json({
        message: "Name, email, password, domain, and restaurantName are required.",
      });
    }

    //  Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    //  Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    //  Generate QR code from domain
    const qrCode = await QRCode.toDataURL(`https://${domain}`);

    //  Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      domain,
      restaurantName,
    });

    //  Create restaurant immediately
    const restaurant = await Restaurant.create({
      user: user._id,
      name: user.name,
      restaurantName: user.restaurantName,
      qrCode,
      domain,
    });

    //  Link restaurantId in user
    user.restaurantId = restaurant._id;
    await user.save();

    //  Generate JWT token
    const token = generateToken(user._id);

    //  Return response
    res.status(201).json({
      message: "User registered successfully with restaurant",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        domain: user.domain,
      },
      restaurant: {
        _id: restaurant._id,
        restaurantName: restaurant.restaurantName,
        qrCode: restaurant.qrCode,
      },
      token,
    });
  } catch (err) {
    console.error("User registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Admin
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: `${user.name} login sucessfully`,
      _id: user._id,
      name: user.name,
      email: user.email,
      qrCode: user.qrCode,
      restaurantName: user.restaurantName,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


