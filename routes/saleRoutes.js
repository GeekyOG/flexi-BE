const express = require("express");
const router = express.Router();
const {
  initializePayment,
  verifyPayment,
  makeAdditionalPayment,
  getAllSales,
  getSale,
  cancelSale,
} = require("../controllers/saleController");
const { protect, authorize } = require("../middleware/auth");

// Protected routes
router.post("/initialize", protect(["customer"]), initializePayment);
router.get("/verify/:reference", verifyPayment);
router.post(
  "/additional-payment",
  protect(["customer"]),
  makeAdditionalPayment
);
router.get("/", protect(["user", "vendor"]), getAllSales);
router.get("/:id", protect(["user", "vendor", "customer"]), getSale);
router.patch("/:id/cancel", protect(["user", "customer"]), cancelSale);

module.exports = router;
