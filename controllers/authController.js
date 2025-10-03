const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const QRCode = require("qrcode");

// US
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, domain, restaurantName } = req.body;

    // 1️⃣ Check if email or restaurantName already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    // 2️⃣ Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3️⃣ Generate QR code from domain
    const qrData = `https://${domain}`;
    const qrCode = await QRCode.toDataURL(qrData);

    // 4️⃣ Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      domain,
      restaurantName,
      qrCode
    });

    // 5️⃣ Generate JWT token
    const token = generateToken(user._id);

    // 6️⃣ Return response
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      domain: user.domain,
      restaurantName: user.restaurantName,
      qrCode: user.qrCode,
      token
    });
  } catch (err) {
    console.error("User registration error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


// Restaurant Owner
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
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


