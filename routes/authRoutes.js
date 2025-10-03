// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getProfile } = require("../controllers/authController");
const { authenticate } = require("../middleware/authMiddleware");
const upload = require("../middleware/multer")

router.post("/register", upload.single("file"), registerUser);
router.post("/login", loginUser);

module.exports = router;