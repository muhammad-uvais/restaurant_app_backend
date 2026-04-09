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

    // ✅ Fetch ALL admin users (no skipping)
    const users = await User.find({
      role: "admin",
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } }
      ]
    });

    console.log("🧠 Users Found:", users.map(u => u.email));

    const logoPath = path.join(__dirname, "../assets/logo.jpeg");

    for (const user of users) {
      try {
        console.log(`🔄 Processing: ${user.email}`);

        // ✅ If missing data → just clean user QR
        if (!user.restaurantId || !user.domain) {
          console.log("⏭️ Skipping (missing data)");

          await User.findByIdAndUpdate(
            user._id,
            { $unset: { qrCode: "" } }
          );

          continue;
        }

        const restaurant = await Restaurant.findById(user.restaurantId);

        if (!restaurant) {
          console.log("⏭️ Restaurant not found");

          await User.findByIdAndUpdate(
            user._id,
            { $unset: { qrCode: "" } }
          );

          continue;
        }

        // 🔥 Generate QR (Cloudinary)
        const qrData = await generateAndUploadQR(user.domain, logoPath);

        // ✅ Save ONLY in Restaurant
        restaurant.qrCode = {
          url: qrData.url,
          public_id: qrData.public_id,
        };

        await restaurant.save();

        // ❌ REMOVE from User (strict cleanup)
        await User.findByIdAndUpdate(
          user._id,
          { $unset: { qrCode: "" } }
        );

        console.log(`✅ Migrated & Cleaned: ${user.email}`);
      } catch (err) {
        console.error(`❌ Failed for ${user.email}:`, err.message);
      }
    }

    // 🔥 FINAL FORCE CLEANUP (VERY IMPORTANT)
    await User.updateMany(
      { qrCode: { $exists: true } },
      { $unset: { qrCode: "" } }
    );

    console.log("🧹 All user QR codes removed (final cleanup)");

    console.log("🎉 Migration completed!");
    process.exit();
  } catch (err) {
    console.error("❌ Script error:", err);
    process.exit(1);
  }
};

migrateQR();