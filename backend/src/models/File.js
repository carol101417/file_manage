const { db } = require('../config/database');
const { normalizeUploadedFilename, toLatin1MojibakeFromUtf8, toCp1252MojibakeFromUtf8 } = require('../utils/filename');

function normalizeFileRow(row) {
  if (!row) return row;
  if (typeof row.original_name === 'string') {
    row.original_name = normalizeUploadedFilename(row.original_name);
  }
  return row;
}

class File {
  static create(fileData) {
    const { fileId, originalName, storedName, fileSize, mimeType, uploaderId } = fileData;
    const stmt = db.prepare(`
      INSERT INTO files (file_id, original_name, stored_name, file_size, mime_type, uploader_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(fileId, originalName, storedName, fileSize, mimeType, uploaderId);
    return result.lastInsertRowid;
  }

  static findByFileId(fileId) {
    const stmt = db.prepare(`
      SELECT f.*, u.username as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploader_id = u.id
      WHERE f.file_id = ?
    `);
    return normalizeFileRow(stmt.get(fileId));
  }

  static findById(id) {
    const stmt = db.prepare(`
      SELECT f.*, u.username as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploader_id = u.id
      WHERE f.id = ?
    `);
    return normalizeFileRow(stmt.get(id));
  }

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

  static delete(id) {
    const stmt = db.prepare('DELETE FROM files WHERE id = ?');
    return stmt.run(id);
  }

  static incrementDownloadCount(id) {
    const stmt = db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?');
    return stmt.run(id);
  }

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
