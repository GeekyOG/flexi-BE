const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize("flexishops", "root", "", {
  host: "localhost",
  dialect: "mysql",
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("MySQL Database connected successfully");
    await sequelize.sync({ alter: false });
    console.log("Database synchronized");
  } catch (error) {
    console.error("Unable to connect to database:", error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
