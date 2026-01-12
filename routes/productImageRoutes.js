const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  uploadProductImages,
  getProductImages,
  getProductImage,
  getDisplayImage,
  setDisplayImage,
  updateImageOrder,
  deleteProductImage,
  deleteAllProductImages,
} = require("../controllers/productImageController");
const { protect, authorize, verifiedVendor } = require("../middleware/auth");

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Public routes - Get images
router.get("/product/:productId", getProductImages);
router.get("/product/:productId/display", getDisplayImage);
router.get("/:imageId", getProductImage);

// Protected routes - Upload, Update, Delete
router.post(
  "/product/:productId",
  protect(["user", "vendor"]),
  verifiedVendor,
  upload.array("images", 10), // Max 10 images at once
  uploadProductImages
);

router.patch("/:imageId/display", protect(["user", "vendor"]), setDisplayImage);

router.patch("/:imageId/order", protect(["user", "vendor"]), updateImageOrder);

router.delete("/:imageId", protect(["user", "vendor"]), deleteProductImage);

router.delete(
  "/product/:productId/all",
  protect(["user", "vendor"]),
  deleteAllProductImages
);

module.exports = router;
