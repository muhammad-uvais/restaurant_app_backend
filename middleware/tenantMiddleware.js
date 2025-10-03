// middleware/userTenantMiddleware.js
const User = require("../models/User");

module.exports = async function getTenant(req, res, next) {
  try {
    // 1️⃣ Extract host from headers or hostname
    let host = req.headers.host || req.hostname;
    if (!host) {
      return res.status(400).json({ message: "Host header missing" });
    }

    // 2️⃣ Remove port if present
    host = host.split(":")[0];

    // 3️⃣ Remove 'www.' prefix if present
    host = host.replace(/^www\./i, "");

    // 4️⃣ Query User/Admin by domain
    const user = await User.findOne({ domain: host });
    if (!user) {
      return res.status(404).json({ message: "Tenant admin not found." });
    }

    // 5️⃣ Attach relevant info to req
    req.tenantAdminId = user._id;       // User ID for queries
    req.tenantHost = host;    // Normalized host
    req.tenantRestaurantName = user.restaurantName;

    next();
  } catch (err) {
    console.error("Tenant middleware error:", err);
    res.status(500).json({ message: "Server error in tenant middleware", error: err.message });
  }
};
