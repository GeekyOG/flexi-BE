const {
  Sale,
  Payment,
  Product,
  Customer,
  CustomerAddress,
} = require("../models");
const { getPagination, getPagingData } = require("../utils/pagination");
const axios = require("axios");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");

// Initialize Payment (Paystack)
exports.initializePayment = async (req, res) => {
  try {
    const { productId, quantity, addressId, partialPayment } = req.body;
    const customerId = req.user.id;

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient product quantity",
      });
    }

    const customer = await Customer.findByPk(customerId);
    const totalAmount = parseFloat(product.price) * quantity;

    // Check if partial payment is requested
    let paymentAmount = totalAmount;
    if (partialPayment) {
      if (customer.kycStatus !== "verified") {
        return res.status(403).json({
          success: false,
          message: "Part payment is only available for verified customers",
        });
      }

      if (partialPayment < totalAmount * 0.3) {
        return res.status(400).json({
          success: false,
          message: "Minimum partial payment is 30% of total amount",
        });
      }

      paymentAmount = parseFloat(partialPayment);
    }

    // Create sale record
    const sale = await Sale.create({
      price: product.price,
      amount: totalAmount,
      paid: 0,
      balance: totalAmount,
      quantity,
      customerId,
      productId,
      addressId,
      status: "pending",
    });

    // Initialize Paystack payment
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: customer.email,
        amount: Math.round(paymentAmount * 100), // Convert to kobo
        metadata: {
          saleId: sale.id,
          customerId: customer.id,
          productId: product.id,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!paystackResponse.data.status) {
      await sale.destroy();
      return res.status(400).json({
        success: false,
        message: "Failed to initialize payment",
      });
    }

    // Create payment record
    await Payment.create({
      saleId: sale.id,
      amount: paymentAmount,
      paymentReference: paystackResponse.data.data.reference,
      status: "pending",
    });

    // Update sale with payment reference
    await sale.update({
      paymentReference: paystackResponse.data.data.reference,
    });

    res.status(200).json({
      success: true,
      data: {
        saleId: sale.id,
        authorizationUrl: paystackResponse.data.data.authorization_url,
        reference: paystackResponse.data.data.reference,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Verify Payment (Paystack Webhook/Callback)
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Verify with Paystack
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!paystackResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const paymentData = paystackResponse.data.data;

    if (paymentData.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
      });
    }

    const t = await sequelize.transaction();

    try {
      // Update payment record
      const payment = await Payment.findOne({
        where: { paymentReference: reference },
      });
      if (!payment) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Payment record not found",
        });
      }

      await payment.update({ status: "success" }, { transaction: t });

      // Update sale record
      const sale = await Sale.findByPk(payment.saleId, { transaction: t });
      const newPaidAmount = parseFloat(sale.paid) + parseFloat(payment.amount);
      const newBalance = parseFloat(sale.amount) - newPaidAmount;

      let newStatus = "pending";
      if (newBalance <= 0) {
        newStatus = "completed";

        // Update product quantity and sales count
        const product = await Product.findByPk(sale.productId, {
          transaction: t,
        });
        await product.update(
          {
            quantity: product.quantity - sale.quantity,
            salesCount: product.salesCount + sale.quantity,
          },
          { transaction: t }
        );
      } else {
        newStatus = "partial";
      }

      await sale.update(
        {
          paid: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
        { transaction: t }
      );

      await t.commit();

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          saleId: sale.id,
          paid: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        },
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Make Additional Payment on Existing Sale
exports.makeAdditionalPayment = async (req, res) => {
  try {
    const { saleId, amount } = req.body;
    const customerId = req.user.id;

    const sale = await Sale.findOne({
      where: {
        id: saleId,
        customerId,
        status: { [Op.in]: ["pending", "partial"] },
      },
      include: [{ model: Customer, as: "customer" }],
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found or already completed",
      });
    }

    const remainingBalance = parseFloat(sale.balance);
    const paymentAmount = parseFloat(amount);

    if (paymentAmount > remainingBalance) {
      return res.status(400).json({
        success: false,
        message: "Payment amount exceeds remaining balance",
      });
    }

    // Initialize Paystack payment
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: sale.customer.email,
        amount: Math.round(paymentAmount * 100),
        metadata: {
          saleId: sale.id,
          customerId: sale.customerId,
          isAdditionalPayment: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!paystackResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: "Failed to initialize payment",
      });
    }

    // Create payment record
    await Payment.create({
      saleId: sale.id,
      amount: paymentAmount,
      paymentReference: paystackResponse.data.data.reference,
      status: "pending",
    });

    res.status(200).json({
      success: true,
      data: {
        saleId: sale.id,
        authorizationUrl: paystackResponse.data.data.authorization_url,
        reference: paystackResponse.data.data.reference,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Sales
exports.getAllSales = async (req, res) => {
  try {
    const { page = 1, size, search, status, customerId, productId } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    if (status) {
      whereCondition.status = status;
    }

    if (customerId) {
      whereCondition.customerId = customerId;
    }

    if (productId) {
      whereCondition.productId = productId;
    }

    // If vendor is logged in, show only their products' sales
    let productFilter = null;
    if (req.userType === "vendor") {
      productFilter = { vendorId: req.user.id };
    }

    const data = await Sale.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email", "phone"],
          where: search
            ? {
                [Op.or]: [
                  { name: { [Op.like]: `%${search}%` } },
                  { email: { [Op.like]: `%${search}%` } },
                ],
              }
            : undefined,
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "price"],
          where: productFilter,
        },
        { model: CustomerAddress, as: "address" },
        { model: Payment, as: "payments" },
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

// Get Single Sale
exports.getSale = async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id, {
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email", "phone"],
        },
        { model: Product, as: "product" },
        { model: CustomerAddress, as: "address" },
        { model: Payment, as: "payments" },
      ],
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Check authorization
    if (req.userType === "customer" && sale.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this sale",
      });
    }

    res.status(200).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cancel Sale
exports.cancelSale = async (req, res) => {
  try {
    const sale = await Sale.findByPk(req.params.id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Only pending sales can be cancelled
    if (sale.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed sales cannot be cancelled",
      });
    }

    // Check authorization
    if (req.userType === "customer" && sale.customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this sale",
      });
    }

    await sale.update({ status: "cancelled" });

    res.status(200).json({
      success: true,
      message: "Sale cancelled successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
