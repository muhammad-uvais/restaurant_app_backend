// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
// const { authenticate } = require("../middleware/authMiddleware")

router.post("/:restaurant", orderController.createOrder);
router.get("/", orderController.getAllOrders);
router.patch("/:orderId", orderController.updateOrderStatus);

module.exports = router;