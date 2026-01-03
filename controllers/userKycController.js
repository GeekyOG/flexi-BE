const { User, Kyc, Customer } = require("../models");
const { getPagination, getPagingData } = require("../utils/pagination");
const { generateToken } = require("../middleware/auth");
const { Op } = require("sequelize");

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, address, phone, email, password, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const user = await User.create({
      name,
      address,
      phone,
      email,
      password,
      role: role || "staff",
    });

    const token = generateToken(user.id, "user");

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user.id, "user");

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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

// Get All Users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, size, search, role } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    if (role) {
      whereCondition.role = role;
    }

    const data = await User.findAndCountAll({
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

// Get Single User
exports.getUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update User
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only admin can change roles
    if (req.user.role !== "admin" && req.body.role) {
      delete req.body.role;
    }

    const updatedUser = await user.update(req.body);

    res.status(200).json({
      success: true,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============= KYC CONTROLLERS =============

// Submit KYC
exports.submitKyc = async (req, res) => {
  try {
    const { doc, docType } = req.body;
    const customerId = req.user.id;

    // Check if KYC already submitted
    const existingKyc = await Kyc.findOne({
      where: {
        customerId,
        status: { [Op.in]: ["pending", "approved"] },
      },
    });

    if (existingKyc) {
      return res.status(400).json({
        success: false,
        message:
          "KYC already submitted and pending approval or already approved",
      });
    }

    const kyc = await Kyc.create({
      customerId,
      doc,
      docType,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All KYCs
exports.getAllKycs = async (req, res) => {
  try {
    const { page = 1, size, search, status } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    if (status) {
      whereCondition.status = status;
    }

    const data = await Kyc.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email", "phone", "nin", "kycStatus"],
          where: search
            ? {
                [Op.or]: [
                  { name: { [Op.like]: `%${search}%` } },
                  { email: { [Op.like]: `%${search}%` } },
                ],
              }
            : undefined,
        },
      ],
      order: [["createdAt", "DESC"]],
      distinct: true,
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

// Get Single KYC
exports.getKyc = async (req, res) => {
  try {
    const kyc = await Kyc.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email", "phone", "nin"],
        },
      ],
    });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found",
      });
    }

    res.status(200).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve KYC
exports.approveKyc = async (req, res) => {
  try {
    const kyc = await Kyc.findByPk(req.params.id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found",
      });
    }

    await kyc.update({ status: "approved" });

    // Update customer KYC status
    await Customer.update(
      { kycStatus: "verified" },
      { where: { id: kyc.customerId } }
    );

    res.status(200).json({
      success: true,
      message: "KYC approved successfully",
      data: kyc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reject KYC
exports.rejectKyc = async (req, res) => {
  try {
    const kyc = await Kyc.findByPk(req.params.id);

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC not found",
      });
    }

    await kyc.update({ status: "rejected" });

    // Update customer KYC status
    await Customer.update(
      { kycStatus: "rejected" },
      { where: { id: kyc.customerId } }
    );

    res.status(200).json({
      success: true,
      message: "KYC rejected",
      data: kyc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Customer's KYC
exports.getMyKyc = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({
      where: { customerId: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "No KYC submission found",
      });
    }

    res.status(200).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
