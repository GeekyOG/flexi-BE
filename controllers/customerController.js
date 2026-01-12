const {
  Customer,
  CustomerAddress,
  Sale,
  Kyc,
  Cart,
  Wishlist,
  Product,
} = require("../models");
const { getPagination, getPagingData } = require("../utils/pagination");
const { generateToken } = require("../middleware/auth");
const { Op } = require("sequelize");

// Register Customer
exports.registerCustomer = async (req, res) => {
  try {
    const { name, phone, email, password, nin } = req.body;

    const existingCustomer = await Customer.findOne({ where: { email } });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const customer = await Customer.create({
      name,
      phone,
      email,
      password,
      nin,
    });

    const token = generateToken(customer.id, "customer");

    res.status(201).json({
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        kycStatus: customer.kycStatus,
      },
      token: token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Login Customer
exports.loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ where: { email } });
    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await customer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(customer.id, "customer");

    res.status(200).json({
      success: true,
      data: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        kycStatus: customer.kycStatus,
      },
      token: token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Customers
exports.getAllCustomers = async (req, res) => {
  try {
    const { page = 1, size, search, kycStatus } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }

    if (kycStatus) {
      whereCondition.kycStatus = kycStatus;
    }

    const data = await Customer.findAndCountAll({
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

// Get Single Customer
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [
        { model: CustomerAddress, as: "addresses" },
        { model: Sale, as: "sales" },
      ],
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Customer
exports.updateCustomer = async (req, res) => {
  try {
    const customerId =
      req.userType === "customer" ? req.user.id : req.params.id;

    const customer = await Customer.findByPk(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Prevent customers from updating their own KYC status
    if (req.userType === "customer") {
      delete req.body.kycStatus;
    }

    const updatedCustomer = await customer.update(req.body);

    res.status(200).json({
      success: true,
      data: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        kycStatus: updatedCustomer.kycStatus,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Customer
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    await customer.destroy();

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Customer Profile
exports.getCustomerProfile = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
      include: [
        { model: CustomerAddress, as: "addresses" },
        {
          model: Cart,
          as: "cart",
          include: [{ model: Product, as: "product" }],
        },
        {
          model: Wishlist,
          as: "wishlist",
          include: [{ model: Product, as: "product" }],
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Add Customer Address
exports.addAddress = async (req, res) => {
  try {
    const { address, city, state, postalCode, isDefault } = req.body;
    const customerId = req.user.id;

    // If this is set as default, unset other defaults
    if (isDefault) {
      await CustomerAddress.update(
        { isDefault: false },
        { where: { customerId } }
      );
    }

    const newAddress = await CustomerAddress.create({
      customerId,
      address,
      city,
      state,
      postalCode,
      isDefault: isDefault || false,
    });

    res.status(201).json({
      success: true,
      data: newAddress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Customer Addresses
exports.getAddresses = async (req, res) => {
  try {
    const addresses = await CustomerAddress.findAll({
      where: { customerId: req.user.id },
      order: [
        ["isDefault", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    res.status(200).json({
      success: true,
      data: addresses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Address
exports.updateAddress = async (req, res) => {
  try {
    const address = await CustomerAddress.findOne({
      where: {
        id: req.params.id,
        customerId: req.user.id,
      },
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If setting as default, unset other defaults
    if (req.body.isDefault) {
      await CustomerAddress.update(
        { isDefault: false },
        { where: { customerId: req.user.id } }
      );
    }

    const updatedAddress = await address.update(req.body);

    res.status(200).json({
      success: true,
      data: updatedAddress,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Address
exports.deleteAddress = async (req, res) => {
  try {
    const address = await CustomerAddress.findOne({
      where: {
        id: req.params.id,
        customerId: req.user.id,
      },
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    await address.destroy();

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
