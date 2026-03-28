const { db } = require('../config/database');
const { normalizeUploadedFilename } = require('../utils/filename');

class DownloadLog {
  /**
   * 创建下载日志记录
   * @param {number} fileId - 文件数据库 ID
   * @param {number|null} userId - 下载用户 ID（公开下载时为 null）
   * @param {string} ipAddress - 客户端 IP 地址
   * @returns {number} 新插入记录的 ID
   */
  static create(fileId, userId, ipAddress) {
    const stmt = db.prepare(`
      INSERT INTO download_logs (file_id, user_id, ip_address)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(fileId, userId, ipAddress);
    return result.lastInsertRowid;
  }

  /**
   * 根据文件 ID 获取下载日志（含下载用户名）
   * @param {number} fileId - 文件数据库 ID
   * @returns {Array<Object>} 下载日志数组，按下载时间倒序排列
   */
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

  /**
   * 根据用户 ID 获取下载日志（含文件原始名称，自动修正乱码文件名）
   * @param {number} userId - 用户 ID
   * @returns {Array<Object>} 下载日志数组，按下载时间倒序排列
   */
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
