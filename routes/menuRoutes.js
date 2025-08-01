// routes/menuRoutes.js
const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const upload = require("../middleware/multer")


router.get("/", menuController.getMenu);
router.post("/", upload.single('file'), menuController.addMenuItem);
router.put("/:id", upload.single('file'), menuController.updateMenuItem);
router.delete("/:id", menuController.deleteMenuItem);
router.patch("/:id/toggle", menuController.toggleAvailability); // ✅ Toggle menu item availability


module.exports = router;
