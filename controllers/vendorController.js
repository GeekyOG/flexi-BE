const { Vendor, Product } = require("../models");
const { getPagination, getPagingData } = require("../utils/pagination");
const { generateToken } = require("../middleware/auth");
const { Op } = require("sequelize");

// Register Vendor
exports.registerVendor = async (req, res) => {
  try {
    const { name, businessName, address, phone, email, password } = req.body;

    const existingVendor = await Vendor.findOne({ where: { email } });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const vendor = await Vendor.create({
      name,
      businessName,
      address,
      phone,
      email,
      password,
    });

    const token = generateToken(vendor.id, "vendor");

    res.status(201).json({
      success: true,
      data: {
        id: vendor.id,
        name: vendor.name,
        businessName: vendor.businessName,
        email: vendor.email,
        isVerified: vendor.isVerified,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Login Vendor
exports.loginVendor = async (req, res) => {
  try {
    const { email, password } = req.body;

    const vendor = await Vendor.findOne({ where: { email } });
    if (!vendor) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await vendor.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(vendor.id, "vendor");

    res.status(200).json({
      success: true,
      data: {
        id: vendor.id,
        name: vendor.name,
        businessName: vendor.businessName,
        email: vendor.email,
        isVerified: vendor.isVerified,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Vendors
exports.getAllVendors = async (req, res) => {
  try {
    const { page = 1, size, search, isVerified } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { businessName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (isVerified !== undefined) {
      whereCondition.isVerified = isVerified === "true";
    }

    const data = await Vendor.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });

    const response = getPagingData(data, page, limit);

    res.status(200).json({
      success: true,
      ...response,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Vendor
exports.getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Product,
          as: "products",
          attributes: ["id", "name", "price", "quantity"],
        },
      ],
    });

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Vendor
exports.updateVendor = async (req, res) => {
  try {
    const vendorId = req.userType === "vendor" ? req.user.id : req.params.id;

    const vendor = await Vendor.findByPk(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Prevent vendors from updating their own verification status
    if (req.userType === "vendor") {
      delete req.body.isVerified;
    }

    const updatedVendor = await vendor.update(req.body);

    res.status(200).json({
      success: true,
      data: {
        id: updatedVendor.id,
        name: updatedVendor.name,
        businessName: updatedVendor.businessName,
        email: updatedVendor.email,
        isVerified: updatedVendor.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Vendor
exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    await vendor.destroy();

    res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Verify Vendor (Admin only)
exports.verifyVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    vendor.isVerified = true;
    await vendor.save();

    res.status(200).json({
      success: true,
      message: "Vendor verified successfully",
      data: {
        id: vendor.id,
        name: vendor.name,
        businessName: vendor.businessName,
        isVerified: vendor.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Vendor Profile
exports.getVendorProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: Product,
          as: "products",
          attributes: [
            "id",
            "name",
            "price",
            "quantity",
            "salesCount",
            "viewCount",
          ],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
