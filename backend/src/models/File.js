const { db } = require('../config/database');
const { normalizeUploadedFilename, toLatin1MojibakeFromUtf8, toCp1252MojibakeFromUtf8 } = require('../utils/filename');

/**
 * 规范化文件行数据，修正可能的乱码文件名
 * @param {Object|null} row - 数据库查询返回的文件行对象
 * @returns {Object|null} 处理后的文件行对象，若输入为 null 则返回 null
 */
function normalizeFileRow(row) {
  if (!row) return row;
  if (typeof row.original_name === 'string') {
    row.original_name = normalizeUploadedFilename(row.original_name);
  }
  return row;
}

class File {
  /**
   * 创建文件记录
   * @param {Object} fileData - 文件数据
   * @param {string} fileData.fileId - 文件 UUID
   * @param {string} fileData.originalName - 原始文件名
   * @param {string} fileData.storedName - 存储文件名
   * @param {number} fileData.fileSize - 文件大小（字节）
   * @param {string} fileData.mimeType - MIME 类型
   * @param {number} fileData.uploaderId - 上传者用户 ID
   * @returns {number} 新插入记录的 ID
   */
  static create(fileData) {
    const { fileId, originalName, storedName, fileSize, mimeType, uploaderId } = fileData;
    const stmt = db.prepare(`
      INSERT INTO files (file_id, original_name, stored_name, file_size, mime_type, uploader_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(fileId, originalName, storedName, fileSize, mimeType, uploaderId);
    return result.lastInsertRowid;
  }

  /**
   * 根据文件 UUID 查找文件（含上传者用户名）
   * @param {string} fileId - 文件 UUID
   * @returns {Object|undefined} 文件对象，未找到时返回 undefined
   */
  static findByFileId(fileId) {
    const stmt = db.prepare(`
      SELECT f.*, u.username as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploader_id = u.id
      WHERE f.file_id = ?
    `);
    return normalizeFileRow(stmt.get(fileId));
  }

  /**
   * 根据数据库自增 ID 查找文件（含上传者用户名）
   * @param {number} id - 文件数据库 ID
   * @returns {Object|undefined} 文件对象，未找到时返回 undefined
   */
  static findById(id) {
    const stmt = db.prepare(`
      SELECT f.*, u.username as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploader_id = u.id
      WHERE f.id = ?
    `);
    return normalizeFileRow(stmt.get(id));
  }

  /**
   * 获取文件列表（分页），管理员可查看全部，普通用户仅查看自己的文件
   * @param {number|null} [userId=null] - 当前用户 ID
   * @param {boolean} [isAdmin=false] - 是否为管理员
   * @param {number} [page=1] - 页码
   * @param {number} [pageSize=20] - 每页记录数
   * @returns {{files: Array<Object>, total: number, page: number, pageSize: number}} 分页结果
   */
  static getAll(userId = null, isAdmin = false, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    let countQuery = 'SELECT COUNT(*) as total FROM files';
    let query = `
      SELECT f.*, u.username as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploader_id = u.id
    `;

    if (!isAdmin && userId) {
      countQuery += ' WHERE uploader_id = ?';
      query += ' WHERE f.uploader_id = ?';
      const total = db.prepare(countQuery).get(userId).total;
      const files = db.prepare(query + ' ORDER BY f.upload_time DESC LIMIT ? OFFSET ?').all(userId, pageSize, offset).map(normalizeFileRow);
      return { files, total, page, pageSize };
    }

    const total = db.prepare(countQuery).get().total;
    const files = db.prepare(query + ' ORDER BY f.upload_time DESC LIMIT ? OFFSET ?').all(pageSize, offset).map(normalizeFileRow);
    return { files, total, page, pageSize };
  }

  /**
   * 删除文件记录
   * @param {number} id - 文件数据库 ID
   * @returns {import('better-sqlite3').RunResult} 删除操作结果
   */
  static delete(id) {
    const stmt = db.prepare('DELETE FROM files WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * 增加文件的下载计数
   * @param {number} id - 文件数据库 ID
   * @returns {import('better-sqlite3').RunResult} 更新操作结果
   */
  static incrementDownloadCount(id) {
    const stmt = db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * 按关键字搜索文件名（同时匹配 UTF-8 原文、Latin1 乱码形式和 CP1252 乱码形式）
   * @param {string} keyword - 搜索关键字
   * @param {number|null} [userId=null] - 当前用户 ID
   * @param {boolean} [isAdmin=false] - 是否为管理员
   * @param {number} [page=1] - 页码
   * @param {number} [pageSize=20] - 每页记录数
   * @returns {{files: Array<Object>, total: number, page: number, pageSize: number}} 分页搜索结果
   */
  static search(keyword, userId = null, isAdmin = false, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const searchTerm = `%${keyword}%`;
    const mojibakeTerm = `%${toLatin1MojibakeFromUtf8(keyword)}%`;
    const mojibakeCp1252Term = `%${toCp1252MojibakeFromUtf8(keyword)}%`;

    let countQuery = 'SELECT COUNT(*) as total FROM files WHERE (original_name LIKE ? OR original_name LIKE ? OR original_name LIKE ?)';
    let query = `
      SELECT f.*, u.username as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploader_id = u.id
      WHERE (f.original_name LIKE ? OR f.original_name LIKE ? OR f.original_name LIKE ?)
    `;

    if (!isAdmin && userId) {
      countQuery += ' AND uploader_id = ?';
      query += ' AND f.uploader_id = ?';
      const total = db.prepare(countQuery).get(searchTerm, mojibakeTerm, mojibakeCp1252Term, userId).total;
      const files = db.prepare(query + ' ORDER BY f.upload_time DESC LIMIT ? OFFSET ?').all(searchTerm, mojibakeTerm, mojibakeCp1252Term, userId, pageSize, offset).map(normalizeFileRow);
      return { files, total, page, pageSize };
    }

    const total = db.prepare(countQuery).get(searchTerm, mojibakeTerm, mojibakeCp1252Term).total;
    const files = db.prepare(query + ' ORDER BY f.upload_time DESC LIMIT ? OFFSET ?').all(searchTerm, mojibakeTerm, mojibakeCp1252Term, pageSize, offset).map(normalizeFileRow);
    return { files, total, page, pageSize };
  }
}

module.exports = File;
