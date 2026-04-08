const express = require('express');
const router = express.Router();
const { addClient } = require('../utils/sseManager');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/notifications', async (req, res) => {

  try {
    // If token exists → authenticate admin
    if (req.query.token) {
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    // Else → guest user (fingerPrint based)
    else if (req.query.fingerPrint) {
    }

    // No identity provided
    else {
      return res.status(400).json({
        message: "Provide token (admin) or fingerPrint (user)"
      });
    }

    // 🔥 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.flushHeaders();

    addClient(req, res);

  } catch (err) {
    return res.status(401).end();
  }
});

module.exports = router;