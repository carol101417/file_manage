const { db } = require('../config/database');

class AuditLog {
  /**
   * 创建审计日志记录
   * @param {Object} params - 审计日志参数
   * @param {number|null} params.userId - 操作用户 ID
   * @param {string|null} params.username - 操作用户名
   * @param {string} params.action - 操作类型（如 LOGIN、FILE_UPLOAD 等）
   * @param {string|null} params.targetType - 操作目标类型（如 user、file）
   * @param {string|null} params.targetId - 操作目标 ID
   * @param {string|null} params.detail - 操作详情描述
   * @param {string|null} params.ipAddress - 客户端 IP 地址
   * @returns {import('better-sqlite3').RunResult} 数据库插入结果
   */
  static create({ userId, username, action, targetType, targetId, detail, ipAddress }) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, detail, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(userId || null, username || null, action, targetType || null, targetId || null, detail || null, ipAddress || null);
  }

  /**
   * 获取所有审计日志（按时间倒序，支持分页）
   * @param {number} [limit=100] - 每页记录数
   * @param {number} [offset=0] - 偏移量
   * @returns {Array<Object>} 审计日志数组
   */
  static getAll(limit = 100, offset = 0) {
    const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  /**
   * 根据用户 ID 获取审计日志
   * @param {number} userId - 用户 ID
   * @param {number} [limit=100] - 返回记录数上限
   * @returns {Array<Object>} 该用户的审计日志数组
   */
  static getByUserId(userId, limit = 100) {
    const stmt = db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
    return stmt.all(userId, limit);
  }

  /**
   * 清理过期的审计日志
   * @param {number} [daysToKeep=90] - 保留最近多少天的日志，超出的将被删除
   * @returns {import('better-sqlite3').RunResult} 删除操作结果
   */
  static cleanup(daysToKeep = 90) {
    const stmt = db.prepare('DELETE FROM audit_logs WHERE created_at < datetime("now", ? || " days")');
    return stmt.run(`-${daysToKeep}`);
  }
}

module.exports = AuditLog;
