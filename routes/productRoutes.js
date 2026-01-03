const express = require("express");
const router = express.Router();
const {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getTopSellingProducts,
  getMostViewedProducts,
} = require("../controllers/productController");
const { protect, authorize, verifiedVendor } = require("../middleware/auth");

// Public routes
router.get("/", getAllProducts);
router.get("/top-selling", getTopSellingProducts);
router.get("/most-viewed", getMostViewedProducts);
router.get("/:id", getProduct);

// Protected routes
router.post("/", protect(["user", "vendor"]), verifiedVendor, createProduct);
router.put("/:id", protect(["user", "vendor"]), updateProduct);
router.delete(
  "/:id",
  protect(["user", "vendor"]),
  authorize("admin", "manager"),
  deleteProduct
);

module.exports = router;
