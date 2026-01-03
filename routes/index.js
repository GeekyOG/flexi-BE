const express = require("express");
const router = express.Router();

const productRoutes = require("./productRoutes");
const categoryRoutes = require("./categoryRoutes");
const vendorRoutes = require("./vendorRoutes");
const customerRoutes = require("./customerRoutes");
const userRoutes = require("./userRoutes");
const saleRoutes = require("./saleRoutes");
const cartRoutes = require("./cartRoutes");
const wishlistRoutes = require("./wishlistRoutes");
const kycRoutes = require("./kycRoutes");

router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/vendors", vendorRoutes);
router.use("/customers", customerRoutes);
router.use("/users", userRoutes);
router.use("/sales", saleRoutes);
router.use("/cart", cartRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/kyc", kycRoutes);

module.exports = router;
