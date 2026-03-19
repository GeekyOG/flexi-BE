const express = require("express");
const router = express.Router();
const multer = require("multer");

const {
  submitKyc,
  updateMyKyc,
  getAllKycs,
  getKyc,
  approveKyc,
  rejectKyc,
  getMyKyc,
  getMyKycImage,
  getKycImage,
} = require("../controllers/kycController");
const { protect, authorize } = require("../middleware/auth");

// ── Multer config (memory storage – buffer saved to DB) ──────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 5 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Allowed: JPEG, PNG, WEBP, PDF"), false);
    }
  },
});

// Multer error handler (must be used after upload middleware)
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 2 MB",
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// ── Customer routes ──────────────────────────────────────────

// Submit new KYC
router.post(
  "/",
  protect(["customer"]),
  upload.single("image"), // field name must be "image" in the form-data
  handleUploadError,
  submitKyc,
);

// Update / re-submit rejected KYC
router.put(
  "/me",
  protect(["customer"]),
  upload.single("image"),
  handleUploadError,
  updateMyKyc,
);

// Get own KYC record
router.get("/me", protect(["customer"]), getMyKyc);

// Get own KYC image (serves raw image)
router.get("/me/image", getMyKycImage);

// ── Admin / Staff routes ─────────────────────────────────────

// List all KYCs (supports ?status=pending|approved|rejected&page=1&limit=20)
router.get(
  "/",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getAllKycs,
);

// Get single KYC record (supports ?includeImageData=true)
router.get(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getKyc,
);

// Get KYC image (serves raw image)
router.get(
  "/:id/image",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getKycImage,
);

// Approve KYC
router.patch(
  "/:id/approve",
  protect(["user"]),
  authorize("admin", "manager"),
  approveKyc,
);

// Reject KYC
router.patch(
  "/:id/reject",
  protect(["user"]),
  authorize("admin", "manager"),
  rejectKyc,
);

module.exports = router;
