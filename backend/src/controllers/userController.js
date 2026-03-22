const User = require('../models/User');
const File = require('../models/File');
const AuditLog = require('../models/AuditLog');
const { validatePasswordComplexity, getClientIp } = require('../utils/validation');
const path = require('path');
const fs = require('fs');

class UserController {
  static getAll(req, res) {
    try {
      const users = User.getAll();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static create(req, res) {
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
        userId: req.user.id,
        username: req.user.username,
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
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static delete(req, res) {
    try {
      const { userId } = req.params;

      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      const user = User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Clean up user's files from disk
      const { files: userFiles } = File.getAll(parseInt(userId), false, 1, 999999);
      for (const file of userFiles) {
        const filePath = path.join(__dirname, '../../uploads', file.stored_name);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) { console.error('Failed to delete file:', filePath, e); }
        }
      }

      User.delete(userId);

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user.id,
        username: req.user.username,
        action: 'USER_DELETE',
        targetType: 'user',
        targetId: userId,
        detail: `Deleted user: ${user.username}`,
        ipAddress
      });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      // Password complexity check
      const passwordError = validatePasswordComplexity(newPassword);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const user = User.findByUsername(req.user.username);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!User.verifyPassword(currentPassword, user.password)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      User.updatePassword(userId, newPassword);

      // Invalidate all existing tokens for this user by blacklisting current token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(req.token);
      if (decoded && decoded.jti) {
        const { db } = require('../config/database');
        const expiresAt = new Date(decoded.exp * 1000).toISOString();
        db.prepare('INSERT OR IGNORE INTO token_blacklist (token_jti, expires_at) VALUES (?, ?)').run(decoded.jti, expiresAt);
      }

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user.id,
        username: req.user.username,
        action: 'PASSWORD_CHANGE',
        targetType: 'user',
        targetId: String(userId),
        detail: 'User changed own password',
        ipAddress
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static resetPassword(req, res) {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
      }

      const passwordError = validatePasswordComplexity(newPassword);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const user = User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      User.updatePassword(userId, newPassword);

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user.id,
        username: req.user.username,
        action: 'PASSWORD_RESET',
        targetType: 'user',
        targetId: userId,
        detail: `Admin reset password for user: ${user.username}`,
        ipAddress
      });

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UserController;
