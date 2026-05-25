// routes/restaurantRoutes.js

const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const getTenant = require("../middleware/tenantMiddleware");
const { authenticate } = require("../middleware/authMiddleware");
const upload = require("../middleware/multer");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// Public: Get restaurant details using tenant context (QR / domain based)
router.get("/public", getTenant, restaurantController.getRestaurantDetails);

// Admin/Staff: Get own restaurant details
router.get("/admin", authenticate, authorizeRoles("admin", "staff"), restaurantController.getMyRestaurantDetails);

// Admin: Update restaurant details (supports file upload)
router.put("/", authenticate, upload.single("file"), authorizeRoles("admin"), restaurantController.updateRestaurantDetails);

// Admin: Update GST configuration
router.patch("/gst", authenticate, authorizeRoles("admin"), restaurantController.updateGstSettings);

// Admin: Toggle restaurant open/close status
router.patch("/status", authenticate, authorizeRoles("admin"), restaurantController.updateRestaurantStatus);

// Super Admin: Soft delete restaurant
router.delete("/", authenticate, authorizeRoles("superadmin"), restaurantController.deleteRestaurant);

// Admin: Reorder menu categories
router.post("/reorder-categories", authenticate, authorizeRoles("admin"), restaurantController.reorderCategories);

// Admin: Create sections and units (tables/rooms)
router.post("/units", authenticate, authorizeRoles("admin"), restaurantController.addUnits);

// Admin: Book a room (initialize stay)
router.post("/book", authenticate, authorizeRoles("admin"), restaurantController.bookRoom);

// Admin/Staff: Get live unit occupancy status (tables/rooms)
router.get("/units/live-status", authenticate, authorizeRoles("admin", "staff"), restaurantController.getLiveUnitStatus);

module.exports = router;