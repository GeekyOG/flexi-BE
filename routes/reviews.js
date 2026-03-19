// routes/reviews.js
const express = require("express");
const router = express.Router();
const {
  createReview,
  getProductReviews,
  getMyReviews,
  getAllReviews,
  getReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");
const { protect, authorize } = require("../middleware/auth");

// ── Customer ──────────────────────────────────────────────────

// Submit a new review (must have a completed purchase)
router.post("/", protect(["customer"]), createReview);

// Get all of my own reviews
router.get("/me", protect(["customer"]), getMyReviews);

// Edit my review
router.put("/:id", protect(["customer"]), updateReview);

// Delete my review
router.delete("/:id", protect(["customer"]), deleteReview);

// ── Public ────────────────────────────────────────────────────

// Get all reviews for a specific product (with rating summary)
// Supports ?rating=5 to filter by star, and ?page / ?size
router.get("/product/:productId", getProductReviews);

// Get a single review by ID
router.get("/:id", getReview);

// ── Admin ─────────────────────────────────────────────────────

// List all reviews with filters (?productId, ?customerId, ?rating)
router.get(
  "/",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getAllReviews,
);

// Admin can also delete any review
router.delete(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager"),
  deleteReview,
);

module.exports = router;
