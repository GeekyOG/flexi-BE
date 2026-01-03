const express = require("express");
const router = express.Router();
const {
  createCategory,
  getAllCategories,
  getCategoryTree,
  getCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.get("/", getAllCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategory);

// Protected routes (Admin only)
router.post(
  "/",
  protect(["user"]),
  authorize("admin", "manager"),
  createCategory
);
router.put(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager"),
  updateCategory
);
router.delete(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager"),
  deleteCategory
);

module.exports = router;
