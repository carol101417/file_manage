const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { db } = require('../config/database');

/**
 * 认证中间件
 * 从请求头中提取并验证 JWT 令牌，检查令牌是否已被加入黑名单
 * 验证通过后将解码后的用户信息挂载到 req.user，原始令牌挂载到 req.token
 * @param {import('express').Request} req - 请求对象
 * @param {import('express').Response} res - 响应对象
 * @param {import('express').NextFunction} next - 下一个中间件
 */
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

/**
 * 管理员权限中间件
 * 检查当前用户是否具有 admin 角色，需在 authMiddleware 之后使用
 * @param {import('express').Request} req - 请求对象（req.user 需已设置）
 * @param {import('express').Response} res - 响应对象
 * @param {import('express').NextFunction} next - 下一个中间件
 */
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
