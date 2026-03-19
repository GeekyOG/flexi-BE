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
    const { items, addressId, partialPayment } = req.body;
    // items should be an array of { productId, quantity }
    const customerId = req.user.id;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one product",
      });
    }

    // Fetch customer
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // Validate all products and calculate total
    let totalAmount = 0;
    const productDetails = [];

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity",
        });
      }

      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product with ID ${productId} not found`,
        });
      }

      if (product.quantity < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient quantity for product: ${product.name}`,
        });
      }

      const itemTotal = parseFloat(product.price) * quantity;
      totalAmount += itemTotal;

      productDetails.push({
        product,
        quantity,
        itemTotal,
      });
    }

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

    // Create sales records for each product
    const sales = [];
    for (const detail of productDetails) {
      const sale = await Sale.create({
        price: detail.product.price,
        amount: detail.itemTotal,
        paid: 0,
        balance: detail.itemTotal,
        quantity: detail.quantity,
        customerId,
        productId: detail.product.id,
        addressId,
        status: "pending",
      });
      sales.push(sale);
    }

    // Initialize Paystack payment
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: customer.email,
        amount: Math.round(paymentAmount * 100), // Convert to kobo
        metadata: {
          saleIds: sales.map((s) => s.id), // Array of sale IDs
          customerId: customer.id,
          productIds: productDetails.map((p) => p.product.id),
          totalAmount,
          paymentAmount,
          isPartialPayment: !!partialPayment,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!paystackResponse.data.status) {
      // Rollback: delete all created sales
      for (const sale of sales) {
        await sale.destroy();
      }
      return res.status(400).json({
        success: false,
        message: "Failed to initialize payment",
      });
    }

    const paymentReference = paystackResponse.data.data.reference;

    // Create payment record for the entire transaction
    await Payment.create({
      saleId: sales[0].id, // Primary sale (or you could create a separate order table)
      amount: paymentAmount,
      paymentReference,
      status: "pending",
      metadata: {
        saleIds: sales.map((s) => s.id),
        totalAmount,
      },
    });

    // Update all sales with payment reference
    for (const sale of sales) {
      await sale.update({
        paymentReference,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        saleIds: sales.map((s) => s.id),
        authorizationUrl: paystackResponse.data.data.authorization_url,
        reference: paymentReference,
        totalAmount,
        paymentAmount,
      },
    });
  } catch (error) {
    console.error("Payment initialization error:", error);
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
      },
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

      // Get all sales with this payment reference (could be multiple)
      const sales = await Sale.findAll({
        where: { paymentReference: reference },
        transaction: t,
      });

      if (!sales || sales.length === 0) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Sales records not found",
        });
      }

      // Calculate payment distribution across all sales
      const totalAmount = sales.reduce(
        (sum, sale) => sum + parseFloat(sale.amount),
        0,
      );
      const paymentAmount = parseFloat(payment.amount);

      const salesResults = [];

      for (const sale of sales) {
        // Distribute payment proportionally based on sale amount
        const saleRatio = parseFloat(sale.amount) / totalAmount;
        const salePayment = paymentAmount * saleRatio;

        const newPaidAmount = parseFloat(sale.paid) + salePayment;
        const newBalance = parseFloat(sale.amount) - newPaidAmount;

        let newStatus = "pending";

        if (newBalance <= 0.01) {
          // Allow small rounding errors
          newStatus = "completed";

          // Update product quantity and sales count
          const product = await Product.findByPk(sale.productId, {
            transaction: t,
          });

          if (product) {
            await product.update(
              {
                quantity: product.quantity - sale.quantity,
                salesCount: (product.salesCount || 0) + sale.quantity,
              },
              { transaction: t },
            );
          }
        } else if (newPaidAmount > 0) {
          newStatus = "partial";
        }

        await sale.update(
          {
            paid: newPaidAmount,
            balance: Math.max(0, newBalance), // Ensure balance is never negative
            status: newStatus,
          },
          { transaction: t },
        );

        salesResults.push({
          saleId: sale.id,
          productId: sale.productId,
          paid: newPaidAmount,
          balance: newBalance,
          status: newStatus,
        });
      }

      await t.commit();

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          sales: salesResults,
          totalPaid: paymentAmount,
          reference: reference,
        },
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Make Additional Payment on Existing Sale(s)
exports.makeAdditionalPayment = async (req, res) => {
  try {
    const { saleIds, amount } = req.body; // Now accepts array of saleIds
    const customerId = req.user.id;

    // Handle both single sale and multiple sales
    const saleIdArray = Array.isArray(saleIds) ? saleIds : [saleIds];

    if (!saleIdArray || saleIdArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one sale ID",
      });
    }

    const sales = await Sale.findAll({
      where: {
        id: { [Op.in]: saleIdArray },
        customerId,
        status: { [Op.in]: ["pending", "partial"] },
      },
      include: [{ model: Customer, as: "customer" }],
    });

    if (!sales || sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No valid sales found or all sales are already completed",
      });
    }

    if (sales.length !== saleIdArray.length) {
      return res.status(404).json({
        success: false,
        message: "Some sales not found or already completed",
      });
    }

    // Calculate total remaining balance
    const totalBalance = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.balance),
      0,
    );
    const paymentAmount = parseFloat(amount);

    if (paymentAmount > totalBalance) {
      return res.status(400).json({
        success: false,
        message: "Payment amount exceeds total remaining balance",
      });
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    // Initialize Paystack payment
    const paystackResponse = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: sales[0].customer.email,
        amount: Math.round(paymentAmount * 100),
        metadata: {
          saleIds: sales.map((s) => s.id),
          customerId: customerId,
          isAdditionalPayment: true,
          totalBalance,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!paystackResponse.data.status) {
      return res.status(400).json({
        success: false,
        message: "Failed to initialize payment",
      });
    }

    const paymentReference = paystackResponse.data.data.reference;

    // Create payment record
    await Payment.create({
      saleId: sales[0].id, // Primary sale reference
      amount: paymentAmount,
      paymentReference,
      status: "pending",
      metadata: {
        saleIds: sales.map((s) => s.id),
        totalBalance,
      },
    });

    // Update all sales with the payment reference
    for (const sale of sales) {
      await sale.update({
        paymentReference,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        saleIds: sales.map((s) => s.id),
        authorizationUrl: paystackResponse.data.data.authorization_url,
        reference: paymentReference,
        paymentAmount,
        totalBalance,
      },
    });
  } catch (error) {
    console.error("Additional payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Sales
exports.getAllSales = async (req, res) => {
  try {
    const {
      page = 1,
      size,
      search,
      status,
      customerId,
      productId,
      groupByReference = false, // Optional: group sales by payment reference
    } = req.query;

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
          attributes: ["id", "name", "price", "image"],
          where: productFilter,
        },
        { model: CustomerAddress, as: "address" },
        { model: Payment, as: "payments" },
      ],
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    let response = getPagingData(data, page, limit);

    // Optionally group sales by payment reference
    if (groupByReference === "true") {
      const groupedSales = {};

      response.data.forEach((sale) => {
        const ref = sale.paymentReference || `sale_${sale.id}`;
        if (!groupedSales[ref]) {
          groupedSales[ref] = {
            paymentReference: ref,
            sales: [],
            totalAmount: 0,
            totalPaid: 0,
            totalBalance: 0,
            status: sale.status,
            createdAt: sale.createdAt,
            customer: sale.customer,
          };
        }

        groupedSales[ref].sales.push(sale);
        groupedSales[ref].totalAmount += parseFloat(sale.amount);
        groupedSales[ref].totalPaid += parseFloat(sale.paid);
        groupedSales[ref].totalBalance += parseFloat(sale.balance);

        // Update status to show worst case (pending < partial < completed)
        if (
          sale.status === "pending" ||
          (sale.status === "partial" &&
            groupedSales[ref].status === "completed")
        ) {
          groupedSales[ref].status = sale.status;
        }
      });

      response.data = Object.values(groupedSales);
    }

    res.status(200).json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error("Get sales error:", error);
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

    // Get related sales with same payment reference (if exists)
    let relatedSales = [];
    if (sale.paymentReference) {
      relatedSales = await Sale.findAll({
        where: {
          paymentReference: sale.paymentReference,
          id: { [Op.ne]: sale.id }, // Exclude current sale
        },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "price", "image"],
          },
        ],
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...sale.toJSON(),
        relatedSales,
      },
    });
  } catch (error) {
    console.error("Get sale error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cancel Sale(s)
exports.cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancelRelated = false } = req.body; // Option to cancel all related sales

    const sale = await Sale.findByPk(id);

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

    const t = await sequelize.transaction();

    try {
      await sale.update({ status: "cancelled" }, { transaction: t });

      let cancelledCount = 1;

      // Optionally cancel all related sales with same payment reference
      if (cancelRelated && sale.paymentReference) {
        const relatedSales = await Sale.findAll({
          where: {
            paymentReference: sale.paymentReference,
            id: { [Op.ne]: sale.id },
            status: { [Op.in]: ["pending", "partial"] },
          },
          transaction: t,
        });

        for (const relatedSale of relatedSales) {
          await relatedSale.update({ status: "cancelled" }, { transaction: t });
          cancelledCount++;
        }
      }

      await t.commit();

      res.status(200).json({
        success: true,
        message: `${cancelledCount} sale(s) cancelled successfully`,
        data: {
          cancelledSales: cancelledCount,
        },
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Cancel sale error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Sales by Payment Reference (NEW)
exports.getSalesByReference = async (req, res) => {
  try {
    const { reference } = req.params;

    const sales = await Sale.findAll({
      where: { paymentReference: reference },
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
      order: [["createdAt", "ASC"]],
    });

    if (!sales || sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No sales found for this payment reference",
      });
    }

    // Check authorization for customer
    if (req.userType === "customer" && sales[0].customerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these sales",
      });
    }

    // Calculate totals
    const summary = {
      totalAmount: sales.reduce((sum, s) => sum + parseFloat(s.amount), 0),
      totalPaid: sales.reduce((sum, s) => sum + parseFloat(s.paid), 0),
      totalBalance: sales.reduce((sum, s) => sum + parseFloat(s.balance), 0),
      itemCount: sales.length,
      paymentReference: reference,
    };

    res.status(200).json({
      success: true,
      data: {
        sales,
        summary,
      },
    });
  } catch (error) {
    console.error("Get sales by reference error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
