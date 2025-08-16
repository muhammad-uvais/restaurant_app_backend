const express = require("express");
const app = require("./app.js");
const dotenv = require("dotenv");
dotenv.config();
const connectDB = require("./db/connect.js");

const port = process.env.PORT || 5001;

const start = async () => {
  try {
    console.log("🚀 Starting server...");
    console.log("📦 MONGO_URL from .env:", process.env.MONGO_URL ? "Loaded ✅" : "❌ Not Found");

    // Optional: Print part of the connection string (avoid showing password)
    if (process.env.MONGO_URL) {
      console.log("🔍 MONGO_URL preview:", process.env.MONGO_URL.substring(0, 30) + "...[hidden]");
    }

    await connectDB(process.env.MONGO_URL);
    console.log("✅ Database connection successful");

    app.listen(port, () => {
      console.log(`✅ Server running → http://localhost:${port}`);
    });

  } catch (error) {
    console.error("❌ DB Connection failed:", error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log(`⚠️ Unhandled Promise Rejection: ${err.message}`);
  process.exit(1);
});

start();
