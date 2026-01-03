const { Category } = require("../models");
const { getPagination, getPagingData } = require("../utils/pagination");
const { Op } = require("sequelize");

// Create Category
exports.createCategory = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    const category = await Category.create({
      name,
      parentId: parentId || null,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Categories with hierarchy
exports.getAllCategories = async (req, res) => {
  try {
    const { page = 1, size, search } = req.query;
    const { limit, offset } = getPagination(page, size);

    const whereCondition = {};

    if (search) {
      whereCondition.name = { [Op.like]: `%${search}%` };
    }

    const data = await Category.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      include: [
        {
          model: Category,
          as: "parent",
          attributes: ["id", "name"],
        },
        {
          model: Category,
          as: "children",
          attributes: ["id", "name", "parentId"],
          include: [
            {
              model: Category,
              as: "children",
              attributes: ["id", "name", "parentId"],
            },
          ],
        },
      ],
      order: [["name", "ASC"]],
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

// Get Category Tree (Root categories with all descendants)
exports.getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { parentId: null },
      include: [
        {
          model: Category,
          as: "children",
          include: [
            {
              model: Category,
              as: "children",
              include: [
                {
                  model: Category,
                  as: "children",
                },
              ],
            },
          ],
        },
      ],
      order: [["name", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Single Category with all related
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id, {
      include: [
        {
          model: Category,
          as: "parent",
          attributes: ["id", "name"],
        },
        {
          model: Category,
          as: "children",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Category
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Prevent circular reference
    if (req.body.parentId) {
      const parentId = parseInt(req.body.parentId);
      if (parentId === category.id) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be its own parent",
        });
      }

      // Check if new parent is not a descendant
      const isDescendant = await checkIfDescendant(category.id, parentId);
      if (isDescendant) {
        return res.status(400).json({
          success: false,
          message: "Cannot set a descendant category as parent",
        });
      }
    }

    const updatedCategory = await category.update(req.body);

    res.status(200).json({
      success: true,
      data: updatedCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Helper function to check if a category is a descendant
async function checkIfDescendant(categoryId, potentialParentId) {
  const potentialParent = await Category.findByPk(potentialParentId);
  if (!potentialParent) return false;

  if (potentialParent.parentId === categoryId) return true;
  if (!potentialParent.parentId) return false;

  return await checkIfDescendant(categoryId, potentialParent.parentId);
}

// Delete Category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id, {
      include: [{ model: Category, as: "children" }],
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has children
    if (category.children && category.children.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete category with subcategories. Please delete or reassign subcategories first.",
      });
    }

    await category.destroy();

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
