const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { db } = require('../config/database');
const { validatePasswordComplexity, getClientIp } = require('../utils/validation');

class AuthController {
  static login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = User.findByUsername(username);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = User.verifyPassword(password, user.password);

      if (!isValidPassword) {
        // Log failed attempt
        const ipAddress = getClientIp(req);
        AuditLog.create({
          userId: null,
          username,
          action: 'LOGIN_FAILED',
          detail: 'Invalid password',
          ipAddress
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const jti = uuidv4();
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, jti },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Log successful login
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: user.id,
        username: user.username,
        action: 'LOGIN',
        detail: 'Login successful',
        ipAddress
      });

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static register(req, res) {
    try {
      const { username, password, role } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      // Username validation
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3-32 characters, only letters, numbers and underscore' });
      }

      // Password complexity check
      const passwordError = validatePasswordComplexity(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const existingUser = User.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const userId = User.create(username, password, role || 'user');

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user?.id,
        username: req.user?.username,
        action: 'USER_CREATE',
        targetType: 'user',
        targetId: String(userId),
        detail: `Created user: ${username} (role: ${role || 'user'})`,
        ipAddress
      });

      res.status(201).json({
        message: 'User created successfully',
        userId
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static getMe(req, res) {
    try {
      const user = User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static logout(req, res) {
    try {
      const decoded = jwt.decode(req.token);
      if (decoded && decoded.jti) {
        const expiresAt = new Date(decoded.exp * 1000).toISOString();
        db.prepare('INSERT OR IGNORE INTO token_blacklist (token_jti, expires_at) VALUES (?, ?)').run(decoded.jti, expiresAt);
      }

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user.id,
        username: req.user.username,
        action: 'LOGOUT',
        detail: 'Logout successful',
        ipAddress
      });

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = AuthController;
