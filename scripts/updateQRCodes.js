const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const generateAndUploadQR = require("../utils/generateQR");

const MONGO_URI = process.env.MONGO_URL;

const migrateQR = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to DB");

    const users = await User.find({
      role: "admin",
      qrCode: { $exists: true }, // old base64 QR
    });

    const logoPath = path.join(__dirname, "../assets/logo.jpeg");

    for (const user of users) {
      try {
        console.log(`🔄 Processing: ${user.email}`);

        if (!user.restaurantId || !user.domain) {
          console.log("⏭️ Skipping (missing data)");
          continue;
        }

        const restaurant = await Restaurant.findById(user.restaurantId);

        if (!restaurant) {
          console.log("⏭️ Restaurant not found");
          continue;
        }

        // 🔥 Generate new QR (Cloudinary)
        const qrData = await generateAndUploadQR(user.domain, logoPath);

        // ✅ Save in Restaurant
        restaurant.qrCode = {
          url: qrData.url,
          public_id: qrData.public_id,
        };

        await restaurant.save();

        // ❌ Remove old Base64 QR from User
        user.qrCode = undefined;
        await user.save();

        console.log(`✅ Migrated: ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed for ${user.email}`, err.message);
      }
    }

    console.log("🎉 Migration completed!");
    process.exit();
  } catch (err) {
    console.error("❌ Script error:", err);
    process.exit(1);
  }
};

migrateQR();