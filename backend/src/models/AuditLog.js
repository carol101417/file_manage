const { db } = require('../config/database');

class AuditLog {
  static create({ userId, username, action, targetType, targetId, detail, ipAddress }) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, target_type, target_id, detail, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(userId || null, username || null, action, targetType || null, targetId || null, detail || null, ipAddress || null);
  }

  static getAll(limit = 100, offset = 0) {
    const stmt = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset);
  }

  static getByUserId(userId, limit = 100) {
    const stmt = db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?');
    return stmt.all(userId, limit);
  }

  static cleanup(daysToKeep = 90) {
    const stmt = db.prepare('DELETE FROM audit_logs WHERE created_at < datetime("now", ? || " days")');
    return stmt.run(`-${daysToKeep}`);
  }
}

module.exports = AuditLog;
