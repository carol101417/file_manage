const { db } = require('../config/database');
const { normalizeUploadedFilename } = require('../utils/filename');

class DownloadLog {
  static create(fileId, userId, ipAddress) {
    const stmt = db.prepare(`
      INSERT INTO download_logs (file_id, user_id, ip_address)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(fileId, userId, ipAddress);
    return result.lastInsertRowid;
  }

  static getByFileId(fileId) {
    const stmt = db.prepare(`
      SELECT dl.*, u.username
      FROM download_logs dl
      LEFT JOIN users u ON dl.user_id = u.id
      WHERE dl.file_id = ?
      ORDER BY dl.download_time DESC
    `);
    return stmt.all(fileId);
  }

  static getByUserId(userId) {
    const stmt = db.prepare(`
      SELECT dl.*, f.original_name
      FROM download_logs dl
      JOIN files f ON dl.file_id = f.id
      WHERE dl.user_id = ?
      ORDER BY dl.download_time DESC
    `);
    return stmt.all(userId).map((row) => {
      if (row && typeof row.original_name === 'string') {
        row.original_name = normalizeUploadedFilename(row.original_name);
      }
      return row;
    });
  }
}

module.exports = DownloadLog;
