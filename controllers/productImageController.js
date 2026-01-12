const { ProductImage, Product } = require("../models");
const { sequelize } = require("../config/database");

// Upload Product Images
exports.uploadProductImages = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if vendor owns this product
    if (req.userType === "vendor" && product.vendorId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to upload images for this product",
      });
    }

    if (!req.files || req.files.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No images provided",
      });
    }

    // Get the highest display order
    const maxOrder = await ProductImage.max("displayOrder", {
      where: { productId },
      transaction,
    });

    const images = [];
    let startOrder = maxOrder ? maxOrder + 1 : 0;

    for (const file of req.files) {
      const image = await ProductImage.create(
        {
          productId,
          image: file.buffer,
          type: file.mimetype,
          isDisplay: false,
          displayOrder: startOrder++,
        },
        { transaction }
      );

      images.push({
        id: image.id,
        productId: image.productId,
        type: image.type,
        isDisplay: image.isDisplay,
        displayOrder: image.displayOrder,
      });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: `${images.length} image(s) uploaded successfully`,
      data: images,
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Images for a Product
exports.getProductImages = async (req, res) => {
  try {
    const { productId } = req.params;
    const { includeImageData = "false" } = req.query;

    const attributes =
      includeImageData === "true"
        ? [
            "id",
            "productId",
            "image",
            "type",
            "isDisplay",
            "displayOrder",
            "createdAt",
          ]
        : ["id", "productId", "type", "isDisplay", "displayOrder", "createdAt"];

    const images = await ProductImage.findAll({
      where: { productId },
      attributes,
      order: [
        ["isDisplay", "DESC"],
        ["displayOrder", "ASC"],
        ["createdAt", "ASC"],
      ],
    });

    // Convert image buffer to base64 if included
    const imagesWithBase64 = images.map((img) => {
      const imgData = img.toJSON();
      if (imgData.image) {
        imgData.imageBase64 = `data:${
          imgData.type
        };base64,${imgData.image.toString("base64")}`;
        delete imgData.image; // Remove raw buffer
      }
      return imgData;
    });

    res.status(200).json({
      success: true,
      count: images.length,
      data: imagesWithBase64,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Image
exports.getProductImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await ProductImage.findByPk(imageId);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Set proper content type and send image
    res.set("Content-Type", image.type);
    res.send(image.image);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Display/Main Image for a Product
exports.getDisplayImage = async (req, res) => {
  try {
    const { productId } = req.params;

    const image = await ProductImage.findOne({
      where: { productId, isDisplay: true },
    });

    if (!image) {
      // If no display image, return first image
      const firstImage = await ProductImage.findOne({
        where: { productId },
        order: [
          ["displayOrder", "ASC"],
          ["createdAt", "ASC"],
        ],
      });

      if (!firstImage) {
        return res.status(404).json({
          success: false,
          message: "No images found for this product",
        });
      }

      res.set("Content-Type", firstImage.type);
      return res.send(firstImage.image);
    }

    res.set("Content-Type", image.type);
    res.send(image.image);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Set Display Image
exports.setDisplayImage = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { imageId } = req.params;

    const image = await ProductImage.findByPk(imageId, { transaction });

    if (!image) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Check product ownership
    const product = await Product.findByPk(image.productId, { transaction });
    if (req.userType === "vendor" && product.vendorId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this image",
      });
    }

    // Unset all other images as display for this product
    await ProductImage.update(
      { isDisplay: false },
      {
        where: { productId: image.productId },
        transaction,
      }
    );

    // Set this image as display
    image.isDisplay = true;
    await image.save({ transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Display image set successfully",
      data: {
        id: image.id,
        productId: image.productId,
        isDisplay: image.isDisplay,
      },
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Image Order
exports.updateImageOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { imageId } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || displayOrder === null) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Display order is required",
      });
    }

    const image = await ProductImage.findByPk(imageId, { transaction });

    if (!image) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Check product ownership
    const product = await Product.findByPk(image.productId, { transaction });
    if (req.userType === "vendor" && product.vendorId !== req.user.id) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this image",
      });
    }

    image.displayOrder = displayOrder;
    await image.save({ transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Image order updated successfully",
      data: {
        id: image.id,
        displayOrder: image.displayOrder,
      },
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete Product Image
exports.deleteProductImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await ProductImage.findByPk(imageId, {
      include: [{ model: Product, as: "product" }],
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: "Image not found",
      });
    }

    // Check if vendor owns this product
    if (req.userType === "vendor" && image.product.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this image",
      });
    }

    await image.destroy();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete All Images for a Product
exports.deleteAllProductImages = async (req, res) => {
  try {
    const { productId } = req.params;

    // Check if product exists and user has permission
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (req.userType === "vendor" && product.vendorId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete images for this product",
      });
    }

    const deletedCount = await ProductImage.destroy({
      where: { productId },
    });

    res.status(200).json({
      success: true,
      message: `${deletedCount} image(s) deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
