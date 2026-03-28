const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  /**
   * 创建新用户，密码使用 bcrypt 加密存储
   * @param {string} username - 用户名
   * @param {string} password - 明文密码
   * @param {string} [role='user'] - 用户角色（'user' 或 'admin'）
   * @returns {number} 新创建用户的 ID
   */
  static create(username, password, role = 'user') {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const result = stmt.run(username, hashedPassword, role);
    return result.lastInsertRowid;
  }

  /**
   * 根据用户名查找用户（包含密码字段，用于认证）
   * @param {string} username - 用户名
   * @returns {Object|undefined} 用户对象，未找到时返回 undefined
   */
  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  /**
   * 根据用户 ID 查找用户（不含密码字段，用于信息展示）
   * @param {number} id - 用户 ID
   * @returns {Object|undefined} 用户对象（id, username, role, created_at），未找到时返回 undefined
   */
  static findById(id) {
    const stmt = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * 获取所有用户列表（不含密码字段）
   * @returns {Array<Object>} 用户数组
   */
  static getAll() {
    const stmt = db.prepare('SELECT id, username, role, created_at FROM users');
    return stmt.all();
  }

  /**
   * 删除用户
   * @param {number} id - 用户 ID
   * @returns {import('better-sqlite3').RunResult} 删除操作结果
   */
  static delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * 更新用户密码（自动使用 bcrypt 加密）
   * @param {number} id - 用户 ID
   * @param {string} newPassword - 新的明文密码
   * @returns {import('better-sqlite3').RunResult} 更新操作结果
   */
  static updatePassword(id, newPassword) {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    return stmt.run(hashedPassword, id);
  }

  /**
   * 验证密码是否匹配
   * @param {string} plainPassword - 用户输入的明文密码
   * @param {string} hashedPassword - 数据库中存储的 bcrypt 哈希密码
   * @returns {boolean} 密码是否匹配
   */
  static verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  /**
   * 检查是否已存在任何用户
   * @returns {boolean} 如果数据库中有用户则返回 true
   */
  static exists() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get();
    return result.count > 0;
  }
}

module.exports = User;
