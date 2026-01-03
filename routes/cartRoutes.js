const express = require("express");
const router = express.Router();
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require("../controllers/cartWishlistController");
const { protect } = require("../middleware/auth");

// All routes protected (Customer only)
router.post("/", protect(["customer"]), addToCart);
router.get("/", protect(["customer"]), getCart);
router.put("/:id", protect(["customer"]), updateCartItem);
router.delete("/:id", protect(["customer"]), removeFromCart);
router.delete("/", protect(["customer"]), clearCart);

module.exports = router;
