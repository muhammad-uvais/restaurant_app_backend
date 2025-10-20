const cluster = require("cluster");
const os = require("os");
const dotenv = require("dotenv");
dotenv.config();

const numCPUs = os.cpus().length; // Number of CPU cores
const port = process.env.PORT || 5001;

if (cluster.isMaster) {
  console.log(` Master process PID ${process.pid} is running`);
  console.log(` Forking ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Listen for dying workers and restart
  cluster.on("exit", (worker, code, signal) => {
    console.log(` Worker PID ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });

} else {
  // Worker processes
  const express = require("express");
  const app = require("./app.js");
  const connectDB = require("./db/connect.js");

  const start = async () => {
    try {
      console.log(` Worker PID ${process.pid} starting...`);
      console.log(" MONGO_URL from .env:", process.env.MONGO_URL ? "Loaded" : " Not Found");

      if (process.env.MONGO_URL) {
        console.log("🔍 MONGO_URL preview:", process.env.MONGO_URL.substring(0, 30) + "...[hidden]");
      }

      await connectDB(process.env.MONGO_URL);
      console.log(` Worker PID ${process.pid} connected to DB`);

      const server = app.listen(port, () => {
        console.log(` Worker PID ${process.pid} running → http://localhost:${port}`);
      });

      // Graceful shutdown
      const shutdown = (signal) => {
        console.log(` Worker PID ${process.pid} received ${signal}. Shutting down...`);
        server.close(() => {
          console.log(` Worker PID ${process.pid} closed`);
          process.exit(0);
        });
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);

    } catch (error) {
      console.error(` Worker PID ${process.pid} failed:`, error.message);
      process.exit(1);
    }
  };

  // Handle unhandled rejections
  process.on("unhandledRejection", (err) => {
    console.log(` Worker PID ${process.pid} unhandled rejection: ${err.message}`);
    process.exit(1);
  });

  start();
}
