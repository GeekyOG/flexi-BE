const { Review, Customer, Product, Sale } = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const { getPagination, getPagingData } = require("../utils/pagination");

// ── Helpers ───────────────────────────────────────────────────

const reviewAttributes = [
  "id",
  "customerId",
  "productId",
  "rating",
  "comment",
  "createdAt",
  "updatedAt",
];

const customerAttributes = ["id", "name"];

// ── Create Review ─────────────────────────────────────────────
// POST /reviews
// Customer only. Must have a completed sale for the product.
exports.createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const customerId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // Product must exist
    const product = await Product.findByPk(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Customer must have a completed purchase of this product
    const hasPurchased = await Sale.findOne({
      where: { customerId, productId, status: "completed" },
    });
    if (!hasPurchased) {
      return res.status(403).json({
        success: false,
        message: "You can only review products you have purchased",
      });
    }

    // One review per customer per product (unique index handles DB-level,
    // this gives a clean error message)
    const existing = await Review.findOne({ where: { customerId, productId } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    const review = await Review.create({
      customerId,
      productId,
      rating: parseInt(rating),
      comment: comment?.trim() || null,
    });

    // Re-fetch with customer association for response
    const full = await Review.findByPk(review.id, {
      attributes: reviewAttributes,
      include: [
        { model: Customer, as: "customer", attributes: customerAttributes },
      ],
    });

    res.status(201).json({ success: true, data: full });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Reviews for a Product ─────────────────────────────────
// GET /reviews/product/:productId
// Public.
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, size = 20, rating } = req.query;
    const { limit, offset } = getPagination(page, size);

    const where = { productId };
    if (rating) where.rating = parseInt(rating);

    const data = await Review.findAndCountAll({
      where,
      attributes: reviewAttributes,
      include: [
        { model: Customer, as: "customer", attributes: customerAttributes },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Rating summary (always across all reviews, not just this page)
    const summary = await Review.findOne({
      where: { productId },
      attributes: [
        [fn("COUNT", col("id")), "totalReviews"],
        [fn("AVG", col("rating")), "averageRating"],
        [fn("SUM", literal("CASE WHEN rating = 5 THEN 1 ELSE 0 END")), "five"],
        [fn("SUM", literal("CASE WHEN rating = 4 THEN 1 ELSE 0 END")), "four"],
        [fn("SUM", literal("CASE WHEN rating = 3 THEN 1 ELSE 0 END")), "three"],
        [fn("SUM", literal("CASE WHEN rating = 2 THEN 1 ELSE 0 END")), "two"],
        [fn("SUM", literal("CASE WHEN rating = 1 THEN 1 ELSE 0 END")), "one"],
      ],
      raw: true,
    });

    const paged = getPagingData(data, page, limit);

    res.status(200).json({
      success: true,
      summary: {
        totalReviews: parseInt(summary.totalReviews) || 0,
        averageRating: summary.averageRating
          ? parseFloat(parseFloat(summary.averageRating).toFixed(1))
          : 0,
        distribution: {
          5: parseInt(summary.five) || 0,
          4: parseInt(summary.four) || 0,
          3: parseInt(summary.three) || 0,
          2: parseInt(summary.two) || 0,
          1: parseInt(summary.one) || 0,
        },
      },
      ...paged,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get My Reviews ────────────────────────────────────────────
// GET /reviews/me
// Customer only.
exports.getMyReviews = async (req, res) => {
  try {
    const { page = 1, size = 20 } = req.query;
    const { limit, offset } = getPagination(page, size);

    const data = await Review.findAndCountAll({
      where: { customerId: req.user.id },
      attributes: reviewAttributes,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "price"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res
      .status(200)
      .json({ success: true, ...getPagingData(data, page, limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get All Reviews (Admin) ───────────────────────────────────
// GET /reviews
// Admin / manager only.
exports.getAllReviews = async (req, res) => {
  try {
    const { page = 1, size = 20, productId, customerId, rating } = req.query;
    const { limit, offset } = getPagination(page, size);

    const where = {};
    if (productId) where.productId = productId;
    if (customerId) where.customerId = customerId;
    if (rating) where.rating = parseInt(rating);

    const data = await Review.findAndCountAll({
      where,
      attributes: reviewAttributes,
      include: [
        { model: Customer, as: "customer", attributes: customerAttributes },
        { model: Product, as: "product", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    res
      .status(200)
      .json({ success: true, ...getPagingData(data, page, limit) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Single Review ─────────────────────────────────────────
// GET /reviews/:id
exports.getReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id, {
      attributes: reviewAttributes,
      include: [
        { model: Customer, as: "customer", attributes: customerAttributes },
        { model: Product, as: "product", attributes: ["id", "name"] },
      ],
    });

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Update Review ─────────────────────────────────────────────
// PUT /reviews/:id
// Customer can only update their own review.
exports.updateReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    // Only the owner can edit
    if (review.customerId !== req.user.id) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    await review.update({
      rating: rating ? parseInt(rating) : review.rating,
      comment: comment !== undefined ? comment?.trim() || null : review.comment,
    });

    const updated = await Review.findByPk(review.id, {
      attributes: reviewAttributes,
      include: [
        { model: Customer, as: "customer", attributes: customerAttributes },
      ],
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Delete Review ─────────────────────────────────────────────
// DELETE /reviews/:id
// Customer deletes their own; admin can delete any.
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    const isAdmin = req.userType === "user"; // staff/admin/manager
    const isOwner =
      req.userType === "customer" && review.customerId === req.user.id;

    if (!isAdmin && !isOwner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    await review.destroy();

    res
      .status(200)
      .json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
