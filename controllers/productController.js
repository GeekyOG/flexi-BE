const { Product, Vendor, Category, ProductImage } = require("../models");
const {
  getPagination,
  getPagingData,
  getSearchCondition,
} = require("../utils/pagination");
const { Op } = require("sequelize");

// Create Product
exports.createProduct = async (req, res) => {
  try {
    const { name, description, quantity, price, vendorId, categoryId } =
      req.body;

    // If vendor is logged in, use their ID
    const finalVendorId = req.userType === "vendor" ? req.user.id : vendorId;

    const product = await Product.create({
      name,
      description,
      quantity,
      price,
      vendorId: finalVendorId,
      categoryId,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Products with filters, search, and pagination
exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      size,
      search,
      vendorId,
      categoryId,
      minPrice,
      maxPrice,
    } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    // Search
    if (search) {
      whereCondition[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // Filter by vendor
    if (vendorId) {
      whereCondition.vendorId = vendorId;
    }

    // Filter by category (including subcategories)
    if (categoryId) {
      const category = await Category.findByPk(categoryId, {
        include: [{ model: Category, as: "children", attributes: ["id"] }],
      });

      if (category) {
        const categoryIds = [parseInt(categoryId)];
        if (category.children && category.children.length > 0) {
          categoryIds.push(...category.children.map((c) => c.id));
        }
        whereCondition.categoryId = { [Op.in]: categoryIds };
      }
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      whereCondition.price = {};
      if (minPrice) whereCondition.price[Op.gte] = minPrice;
      if (maxPrice) whereCondition.price[Op.lte] = maxPrice;
    }

    const data = await Product.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["id", "name", "businessName"],
        },
        { model: Category, as: "category", attributes: ["id", "name"] },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "isDisplay", "displayOrder", "type"],
          // where: { isDisplay: true },
        },
      ],
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    console.log(data);

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

// Get Single Product
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["id", "name", "businessName", "email", "phone"],
        },
        { model: Category, as: "category", attributes: ["id", "name"] },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "isDisplay", "displayOrder", "type"],
          where: { isDisplay: true },
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Increment view count
    await product.increment("viewCount");

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if vendor owns this product
    if (req.userType === "vendor" && product.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this product",
      });
    }

    const updatedProduct = await product.update(req.body);

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if vendor owns this product
    if (req.userType === "vendor" && product.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this product",
      });
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Top Selling Products
exports.getTopSellingProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.findAll({
      order: [["salesCount", "DESC"]],
      limit: parseInt(limit),
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["id", "name", "businessName"],
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "isDisplay", "displayOrder", "type"],
          where: { isDisplay: true },
        },
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
    });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Most Viewed Products
exports.getMostViewedProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const products = await Product.findAll({
      order: [["viewCount", "DESC"]],
      limit: parseInt(limit),
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["id", "name", "businessName"],
        },
        {
          model: ProductImage,
          as: "images",
          attributes: ["id", "isDisplay", "displayOrder", "type"],
          where: { isDisplay: true },
        },
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
    });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
