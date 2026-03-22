const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { db } = require('../config/database');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is blacklisted
    if (decoded.jti) {
      const blacklisted = db.prepare('SELECT 1 FROM token_blacklist WHERE token_jti = ?').get(decoded.jti);
      if (blacklisted) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
