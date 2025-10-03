// middleware/userTenantMiddleware.js
const User = require("../models/User");

module.exports = async function getTenant(req, res, next) {
  try {
    // 1️⃣ Get frontend origin (from headers)
    let frontendHost = req.get("origin") || req.get("referer");
    if (!frontendHost) {
      return res.status(400).json({ message: "Frontend host not found in headers" });
    }

    // 2️⃣ Extract hostname from full URL
    try {
      const url = new URL(frontendHost);
      frontendHost = url.hostname;
    } catch (err) {
      console.error("Invalid origin/referer URL:", frontendHost);
      return res.status(400).json({ message: "Invalid frontend host" });
    }

    // 3️⃣ Remove "www." if present
    frontendHost = frontendHost.replace(/^www\./i, "");

    // 4️⃣ Lookup User by domain
    const user = await User.findOne({ domain: frontendHost }).lean();
    if (!user) {
      return res.status(404).json({ message: "No user found for this domain" });
    }

    // 5️⃣ Attach to request
    req.tenantAdminId = user._id;
    req.tenantRestaurantName = user.restaurantName;
    req.frontendHost = frontendHost;

    console.log("Tenant resolved:", {
      frontendHost,
      userId: user._id,
      restaurant: user.restaurantName,
    });

    next();
  } catch (error) {
    console.error("Tenant middleware error:", error);
    res.status(500).json({
      message: "Server error in tenant middleware",
      error: error.message,
    });
  }
};
