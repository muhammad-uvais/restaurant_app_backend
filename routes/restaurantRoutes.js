const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const getTenant = require("../middleware/tenantMiddleware"); 
const { authenticate } = require("../middleware/authMiddleware")
const upload = require("../middleware/multer")


// ============================
// Client Routes (public, tenant-based)
// ============================

// Get restaurant details for client (tenant middleware)
router.get("/public", getTenant, restaurantController.getRestaurantDetails);


// ============================
// Admin Routes (JWT protected)
// ============================

// Get logged-in admin's restaurant details
router.get("/admin", authenticate, restaurantController.getAdminRestaurantDetails);
// Create/Add restaurant details
router.post("/details", authenticate, upload.single("file"), restaurantController.addRestaurantDetails);
// Update restaurant details
router.put("/", authenticate, upload.single("file"), restaurantController.updateRestaurantDetails);
// Delete restaurant (soft delete)
router.delete("/", authenticate, restaurantController.deleteRestaurant)

module.exports = router;
