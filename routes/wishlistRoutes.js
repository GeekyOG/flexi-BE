const express = require("express");
const router = express.Router();
const {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  moveToCart,
} = require("../controllers/cartWishlistController");
const { protect } = require("../middleware/auth");

// All routes protected (Customer only)
router.post("/", protect(["customer"]), addToWishlist);
router.get("/", protect(["customer"]), getWishlist);
router.delete("/:id", protect(["customer"]), removeFromWishlist);
router.post("/:id/move-to-cart", protect(["customer"]), moveToCart);

module.exports = router;
