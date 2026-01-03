const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserProfile,
} = require("../controllers/userKycController");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes
router.get("/", protect(["user"]), authorize("admin", "manager"), getAllUsers);
router.get("/me/profile", protect(["user"]), getUserProfile);
router.get("/:id", protect(["user"]), authorize("admin", "manager"), getUser);
router.put(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager"),
  updateUser
);
router.delete("/:id", protect(["user"]), authorize("admin"), deleteUser);

module.exports = router;
