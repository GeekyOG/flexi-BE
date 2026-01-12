const jwt = require("jsonwebtoken");
const { User, Vendor, Customer } = require("../models");

// Generate JWT Token
const generateToken = (id, type) => {
  return jwt.sign({ id, type }, "your_jwt_secret_key_here", {
    expiresIn: "1d",
  });
};

// Protect routes - General authentication
const protect = (userTypes = ["user", "vendor", "customer"]) => {
  return async (req, res, next) => {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    try {
      const decoded = jwt.verify(token, "your_jwt_secret_key_here");

      if (!userTypes.includes(decoded.type)) {
        return res
          .status(403)
          .json({ success: false, message: "Access denied" });
      }

      let user;
      if (decoded.type === "user") {
        user = await User.findByPk(decoded.id, {
          attributes: { exclude: ["password"] },
        });
      } else if (decoded.type === "vendor") {
        user = await Vendor.findByPk(decoded.id, {
          attributes: { exclude: ["password"] },
        });
      } else if (decoded.type === "customer") {
        user = await Customer.findByPk(decoded.id, {
          attributes: { exclude: ["password"] },
        });
      }

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      req.user = user;
      req.userType = decoded.type;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }
  };
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.userType === "customer") {
      return next();
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Verified vendor check
const verifiedVendor = (req, res, next) => {
  if (req.userType === "vendor" && !req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message:
        "Your vendor account is not verified. Please wait for admin approval.",
    });
  }
  next();
};

// Verified customer check (for part payment)
const verifiedCustomer = (req, res, next) => {
  if (req.userType === "customer" && req.user.kycStatus !== "verified") {
    return res.status(403).json({
      success: false,
      message:
        "Your KYC is not verified. Part payments are only available for verified customers.",
    });
  }
  next();
};

module.exports = {
  generateToken,
  protect,
  authorize,
  verifiedVendor,
  verifiedCustomer,
};
