const jwt = require("jsonwebtoken");

/**
 * Generates a JWT token for a user
 * @param {String} id - User ID
 * @param {String} role - User role (superadmin, admin, staff, user)
 * @returns {String} JWT token
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role }, // include role in payload
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

module.exports = generateToken;
