// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
// const { authenticate } = require("../middleware/authMiddleware")

// Create order
router.post("/:restaurant", orderController.createOrder);
// Get order
router.get("/", orderController.getAllOrders);
// Update order
router.put("/:orderId", orderController.updateOrder);
// Cancel order
router.delete("/:orderId", orderController.cancelOrder);


// Update order status
// router.patch("/:orderId", orderController.updateOrderStatus);

module.exports = router;