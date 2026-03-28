const User = require('../models/User');
const File = require('../models/File');
const AuditLog = require('../models/AuditLog');
const { validatePasswordComplexity, getClientIp } = require('../utils/validation');
const path = require('path');
const fs = require('fs');

class UserController {
  /**
   * 获取所有用户列表
   * @param {import('express').Request} req - 请求对象
   * @param {import('express').Response} res - 响应对象，返回用户数组
   */
  static getAll(req, res) {
    try {
      const users = User.getAll();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * 创建新用户（管理员操作）
   * 校验用户名格式和密码复杂度，检查用户名是否已存在，创建后记录审计日志
   * @param {import('express').Request} req - 请求对象，body 中需包含 username、password，可选 role
   * @param {import('express').Response} res - 响应对象，成功时返回 201 及新用户 ID
   */
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

  /**
   * 删除用户（管理员操作）
   * 不允许删除自己，删除时同时清理用户上传的所有文件（磁盘 + 数据库），并记录审计日志
   * @param {import('express').Request} req - 请求对象，params 中需包含 userId
   * @param {import('express').Response} res - 响应对象，返回删除成功消息
   */
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

  /**
   * 修改当前用户密码
   * 验证旧密码，检查新密码复杂度，更新后将当前令牌加入黑名单使其失效
   * @param {import('express').Request} req - 请求对象，body 中需包含 currentPassword 和 newPassword
   * @param {import('express').Response} res - 响应对象，返回密码修改成功消息
   */
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

  /**
   * 重置指定用户的密码（管理员操作）
   * 校验新密码复杂度，更新用户密码并记录审计日志
   * @param {import('express').Request} req - 请求对象，params 中需包含 userId，body 中需包含 newPassword
   * @param {import('express').Response} res - 响应对象，返回密码重置成功消息
   */
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
