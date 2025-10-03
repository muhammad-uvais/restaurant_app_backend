// routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const upload = require("../middleware/multer")
const { authenticate } = require("../middleware/authMiddleware")
const getTenant = require("../middleware/tenantMiddleware")


router.get("/public/:restaurant", menuController.getMenuByDomain)
router.get("/public", getTenant, menuController.getMenuByTenant)
router.get("/", authenticate, menuController.getMenuItems);
router.post("/", authenticate, upload.single('file'), menuController.addMenuItem);
router.put("/:id", upload.single('file'), menuController.updateMenuItem);
router.delete("/:id", menuController.deleteMenuItem);
router.patch("/:id/toggle", menuController.toggleAvailability); //  Toggle menu item availability


module.exports = router;
