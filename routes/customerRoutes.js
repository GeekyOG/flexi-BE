const express = require("express");
const router = express.Router();
const {
  registerCustomer,
  loginCustomer,
  getAllCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerProfile,
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress,
} = require("../controllers/customerController");
const { protect, authorize } = require("../middleware/auth");

// Public routes
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);

// Protected routes
router.get(
  "/",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getAllCustomers
);
router.get("/me/profile", protect(["customer"]), getCustomerProfile);
router.get(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager", "staff"),
  getCustomer
);
router.put("/me", protect(["customer"]), updateCustomer);
router.put(
  "/:id",
  protect(["user"]),
  authorize("admin", "manager"),
  updateCustomer
);
router.delete("/:id", protect(["user"]), authorize("admin"), deleteCustomer);

// Address routes
router.post("/me/addresses", protect(["customer"]), addAddress);
router.get("/me/addresses", protect(["customer"]), getAddresses);
router.put("/me/addresses/:id", protect(["customer"]), updateAddress);
router.delete("/me/addresses/:id", protect(["customer"]), deleteAddress);

module.exports = router;
