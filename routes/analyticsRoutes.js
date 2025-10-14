// routes/analytics.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const  analyticsController = require("../controllers/analyticsController");

router.get("/insights", authenticate, analyticsController.getRestaurantInsights);

module.exports = router;
