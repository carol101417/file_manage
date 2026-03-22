const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static create(username, password, role = 'user') {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const result = stmt.run(username, hashedPassword, role);
    return result.lastInsertRowid;
  }

  static findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static getAll() {
    const stmt = db.prepare('SELECT id, username, role, created_at FROM users');
    return stmt.all();
  }

  static delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  }

  static updatePassword(id, newPassword) {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    return stmt.run(hashedPassword, id);
  }

  static verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  static exists() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get();
    return result.count > 0;
  }
}

module.exports = User;
