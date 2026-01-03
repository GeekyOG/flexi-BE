const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const bcrypt = require("bcryptjs");

// Category Model
const Category = sequelize.define(
  "Category",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Categories",
        key: "id",
      },
    },
  },
  {
    tableName: "Categories",
    timestamps: true,
  }
);

// Self-referencing association for parent categories
Category.belongsTo(Category, { as: "parent", foreignKey: "parentId" });
Category.hasMany(Category, { as: "children", foreignKey: "parentId" });

// Vendor Model
const Vendor = sequelize.define(
  "Vendor",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    businessName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "Vendors",
    timestamps: true,
    hooks: {
      beforeCreate: async (vendor) => {
        if (vendor.password) {
          vendor.password = await bcrypt.hash(vendor.password, 10);
        }
      },
      beforeUpdate: async (vendor) => {
        if (vendor.changed("password")) {
          vendor.password = await bcrypt.hash(vendor.password, 10);
        }
      },
    },
  }
);

Vendor.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Customer Model
const Customer = sequelize.define(
  "Customer",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    kycStatus: {
      type: DataTypes.ENUM("pending", "verified", "rejected"),
      defaultValue: "pending",
    },
    nin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Customers",
    timestamps: true,
    hooks: {
      beforeCreate: async (customer) => {
        if (customer.password) {
          customer.password = await bcrypt.hash(customer.password, 10);
        }
      },
      beforeUpdate: async (customer) => {
        if (customer.changed("password")) {
          customer.password = await bcrypt.hash(customer.password, 10);
        }
      },
    },
  }
);

Customer.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// User Model (Admin/Staff)
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "manager", "staff"),
      defaultValue: "staff",
    },
  },
  {
    tableName: "Users",
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password")) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Product Model
const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    vendorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Vendors",
        key: "id",
      },
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Categories",
        key: "id",
      },
    },
    viewCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    salesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "Products",
    timestamps: true,
  }
);

// Customer Address Model
const CustomerAddress = sequelize.define(
  "CustomerAddress",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",
        key: "id",
      },
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "CustomerAddresses",
    timestamps: true,
  }
);

// Sale Model
const Sale = sequelize.define(
  "Sale",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    paid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    balance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",
        key: "id",
      },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
    addressId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "CustomerAddresses",
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("pending", "partial", "completed", "cancelled"),
      defaultValue: "pending",
    },
    paymentReference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "Sales",
    timestamps: true,
  }
);

// Payment Model
const Payment = sequelize.define(
  "Payment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    saleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Sales",
        key: "id",
      },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    paymentReference: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "success", "failed"),
      defaultValue: "pending",
    },
    paymentMethod: {
      type: DataTypes.STRING,
      defaultValue: "paystack",
    },
  },
  {
    tableName: "Payments",
    timestamps: true,
  }
);

// KYC Model
const Kyc = sequelize.define(
  "Kyc",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",
        key: "id",
      },
    },
    doc: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    docType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      defaultValue: "pending",
    },
  },
  {
    tableName: "Kycs",
    timestamps: true,
  }
);

// Cart Model
const Cart = sequelize.define(
  "Cart",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",
        key: "id",
      },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    tableName: "Carts",
    timestamps: true,
  }
);

// Wishlist Model
const Wishlist = sequelize.define(
  "Wishlist",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Customers",
        key: "id",
      },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
  },
  {
    tableName: "Wishlists",
    timestamps: true,
  }
);

// Associations
Vendor.hasMany(Product, { foreignKey: "vendorId", as: "products" });
Product.belongsTo(Vendor, { foreignKey: "vendorId", as: "vendor" });

Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });
Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

Customer.hasMany(Sale, { foreignKey: "customerId", as: "sales" });
Sale.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Product.hasMany(Sale, { foreignKey: "productId", as: "sales" });
Sale.belongsTo(Product, { foreignKey: "productId", as: "product" });

Customer.hasMany(Kyc, { foreignKey: "customerId", as: "kycs" });
Kyc.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Customer.hasMany(CustomerAddress, {
  foreignKey: "customerId",
  as: "addresses",
});
CustomerAddress.belongsTo(Customer, {
  foreignKey: "customerId",
  as: "customer",
});

Sale.belongsTo(CustomerAddress, { foreignKey: "addressId", as: "address" });

Sale.hasMany(Payment, { foreignKey: "saleId", as: "payments" });
Payment.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });

Customer.hasMany(Cart, { foreignKey: "customerId", as: "cart" });
Cart.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Product.hasMany(Cart, { foreignKey: "productId", as: "cartItems" });
Cart.belongsTo(Product, { foreignKey: "productId", as: "product" });

Customer.hasMany(Wishlist, { foreignKey: "customerId", as: "wishlist" });
Wishlist.belongsTo(Customer, { foreignKey: "customerId", as: "customer" });

Product.hasMany(Wishlist, { foreignKey: "productId", as: "wishlistItems" });
Wishlist.belongsTo(Product, { foreignKey: "productId", as: "product" });

module.exports = {
  Category,
  Vendor,
  Customer,
  User,
  Product,
  Sale,
  Kyc,
  CustomerAddress,
  Payment,
  Cart,
  Wishlist,
};
