const express = require("express");
const app = require("./app.js");
const dotenv = require("dotenv");
dotenv.config();
const connectDB = require("./db/connect.js");

const port = process.env.PORT || 5001;

const start = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    app.listen(port, () => {
      console.log(`Server running → http://localhost:${port}`);
    });
  } catch (error) {
    console.error("DB Connection failed:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log(`Error: ${err.message}`);
  process.exit(1);
});

start();
