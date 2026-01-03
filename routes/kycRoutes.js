const express = require("express");
const router = express.Router();
const {
  submitKyc,
  getAllKycs,
  getKyc,
  approveKyc,
  rejectKyc,
  getMyKyc,
} = require("../controllers/userKycController");
const { protect, authorize } = require("../middleware/auth");

// Customer routes
router.post("/", protect(["customer"]), submitKyc);
router.get("/me", protect(["customer"]), getMyKyc);

// Admin routes
router.get(
  "/",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getAllKycs
);
router.get(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getKyc
);
router.patch(
  "/:id/approve",
  protect(["user"]),
  authorize("admin", "manager"),
  approveKyc
);
router.patch(
  "/:id/reject",
  protect(["user"]),
  authorize("admin", "manager"),
  rejectKyc
);

module.exports = router;
