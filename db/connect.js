const mongoose = require("mongoose");

const connectDB = (url) => {
  return mongoose.connect(url); // no extra options needed
};

module.exports = connectDB;
