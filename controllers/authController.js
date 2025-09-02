const User = require("../models/User");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/generateToken");
const QRCode = require("qrcode");
const { uploadToCloudinary } = require("../utils/cloudinary")

// US
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, domain, restaurant } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate QR code from domain (as base64)
    const qrData = `http://${domain}/api/menu/public/${restaurant}`;
    const qrCode = await QRCode.toDataURL(qrData);

    let logo = null;

    // Upload to Cloudinary if image is present
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      logo = {
        url: result.secure_url,
        public_id: result.public_id,
      };
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      domain,
      restaurant,
      logo,
      qrCode,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      domain: user.domain,
      restaurant: user.restaurant,
      logo: user.logo,
      qrCode: user.qrCode, // base64 image string
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
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

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      domain: user.domain,         
      restaurant: user.restaurant,  
      logo: user.logo,              
      qrCode: user.qrCode,
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  res.json(req.user);
};

