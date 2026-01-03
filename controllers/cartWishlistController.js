const { Cart, Wishlist, Product, Vendor, Category } = require("../models");

// ============= CART CONTROLLERS =============

// Add to Cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
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

    // Check if item already in cart
    let cartItem = await Cart.findOne({
      where: { customerId, productId },
    });

    if (cartItem) {
      // Update quantity
      const newQuantity = cartItem.quantity + quantity;
      if (product.quantity < newQuantity) {
        return res.status(400).json({
          success: false,
          message: "Insufficient product quantity",
        });
      }
      await cartItem.update({ quantity: newQuantity });
    } else {
      // Create new cart item
      cartItem = await Cart.create({
        customerId,
        productId,
        quantity,
      });
    }

    const fullCartItem = await Cart.findByPk(cartItem.id, {
      include: [{ model: Product, as: "product" }],
    });

    res.status(201).json({
      success: true,
      data: fullCartItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Cart
exports.getCart = async (req, res) => {
  try {
    const customerId = req.user.id;

    const cartItems = await Cart.findAll({
      where: { customerId },
      include: [
        {
          model: Product,
          as: "product",
          include: [
            {
              model: Vendor,
              as: "vendor",
              attributes: ["id", "name", "businessName"],
            },
            { model: Category, as: "category", attributes: ["id", "name"] },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate totals
    const total = cartItems.reduce((sum, item) => {
      return sum + parseFloat(item.product.price) * item.quantity;
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        items: cartItems,
        total,
        itemCount: cartItems.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Cart Item
exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    const customerId = req.user.id;

    const cartItem = await Cart.findOne({
      where: {
        id: req.params.id,
        customerId,
      },
      include: [{ model: Product, as: "product" }],
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    if (cartItem.product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient product quantity",
      });
    }

    await cartItem.update({ quantity });

    res.status(200).json({
      success: true,
      data: cartItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove from Cart
exports.removeFromCart = async (req, res) => {
  try {
    const customerId = req.user.id;

    const cartItem = await Cart.findOne({
      where: {
        id: req.params.id,
        customerId,
      },
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    await cartItem.destroy();

    res.status(200).json({
      success: true,
      message: "Item removed from cart",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Clear Cart
exports.clearCart = async (req, res) => {
  try {
    const customerId = req.user.id;

    await Cart.destroy({
      where: { customerId },
    });

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============= WISHLIST CONTROLLERS =============

// Add to Wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const customerId = req.user.id;

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if already in wishlist
    const existing = await Wishlist.findOne({
      where: { customerId, productId },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Product already in wishlist",
      });
    }

    const wishlistItem = await Wishlist.create({
      customerId,
      productId,
    });

    const fullWishlistItem = await Wishlist.findByPk(wishlistItem.id, {
      include: [{ model: Product, as: "product" }],
    });

    res.status(201).json({
      success: true,
      data: fullWishlistItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Wishlist
exports.getWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;

    const wishlistItems = await Wishlist.findAll({
      where: { customerId },
      include: [
        {
          model: Product,
          as: "product",
          include: [
            {
              model: Vendor,
              as: "vendor",
              attributes: ["id", "name", "businessName"],
            },
            { model: Category, as: "category", attributes: ["id", "name"] },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: wishlistItems,
      count: wishlistItems.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Remove from Wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const customerId = req.user.id;

    const wishlistItem = await Wishlist.findOne({
      where: {
        id: req.params.id,
        customerId,
      },
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found",
      });
    }

    await wishlistItem.destroy();

    res.status(200).json({
      success: true,
      message: "Item removed from wishlist",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Move from Wishlist to Cart
exports.moveToCart = async (req, res) => {
  try {
    const customerId = req.user.id;
    const { quantity = 1 } = req.body;

    const wishlistItem = await Wishlist.findOne({
      where: {
        id: req.params.id,
        customerId,
      },
      include: [{ model: Product, as: "product" }],
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: "Wishlist item not found",
      });
    }

    if (wishlistItem.product.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient product quantity",
      });
    }

    // Add to cart
    let cartItem = await Cart.findOne({
      where: { customerId, productId: wishlistItem.productId },
    });

    if (cartItem) {
      await cartItem.update({ quantity: cartItem.quantity + quantity });
    } else {
      cartItem = await Cart.create({
        customerId,
        productId: wishlistItem.productId,
        quantity,
      });
    }

    // Remove from wishlist
    await wishlistItem.destroy();

    res.status(200).json({
      success: true,
      message: "Item moved to cart",
      data: cartItem,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
