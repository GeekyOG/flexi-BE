const express = require("express");
const router = express.Router();
const {
  registerVendor,
  loginVendor,
  getAllVendors,
  getVendor,
  updateVendor,
  deleteVendor,
  verifyVendor,
  getVendorProfile,
} = require("../controllers/vendorController");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.post("/register", registerVendor);
router.post("/login", loginVendor);
router.get("/", getAllVendors);
router.get("/:id", getVendor);

// Protected routes
router.get("/me/profile", protect(["vendor"]), getVendorProfile);
router.put("/me", protect(["vendor"]), updateVendor);
router.put(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager"),
  updateVendor
);
router.delete("/:id", protect(["user"]), authorize("admin"), deleteVendor);
router.patch(
  "/:id/verify",
  protect(["user"]),
  authorize("admin", "manager"),
  verifyVendor
);

module.exports = router;
