const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, '../', process.env.DATABASE_PATH || 'database.sqlite');
const db = new Database(dbPath);

console.log('Starting database migration...');
console.log('Database path:', dbPath);

try {
  // Check if migration is needed
  const tableInfo = db.prepare("PRAGMA table_info(download_logs)").all();
  const userIdColumn = tableInfo.find(col => col.name === 'user_id');

  if (userIdColumn && userIdColumn.notnull === 1) {
    console.log('Migration needed: user_id is NOT NULL, changing to allow NULL');

    // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
    db.exec(`
      BEGIN TRANSACTION;

      -- Create new table with correct schema
      CREATE TABLE download_logs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        user_id INTEGER,
        download_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Copy data from old table
      INSERT INTO download_logs_new (id, file_id, user_id, download_time, ip_address)
      SELECT id, file_id, user_id, download_time, ip_address FROM download_logs;

      -- Drop old table
      DROP TABLE download_logs;

      -- Rename new table
      ALTER TABLE download_logs_new RENAME TO download_logs;

      COMMIT;
    `);

    console.log('✅ Migration completed successfully!');
  } else {
    console.log('✅ No migration needed, user_id already allows NULL');
  }
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

db.close();
console.log('Database connection closed');
