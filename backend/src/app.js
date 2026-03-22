const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
require('dotenv').config();

// Validate critical environment variables
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-this-in-production') {
  console.error('FATAL: JWT_SECRET is not set or is using the default value.');
  console.error('Please set a secure JWT_SECRET environment variable.');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const { initDatabase, db } = require('./config/database');
const User = require('./models/User');

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database
initDatabase();

// Create default admin user if no users exist
if (!User.exists()) {
  console.log('Creating default admin user...');
  User.create('admin', 'Admin123!', 'admin');
  console.log('Default admin user created: username=admin, password=Admin123!');
  console.log('IMPORTANT: Please change the default password after first login!');
}

// Cleanup expired token blacklist entries on startup and every hour
const cleanupBlacklist = () => {
  try {
    db.prepare("DELETE FROM token_blacklist WHERE expires_at < datetime('now')").run();
  } catch (e) { /* table may not exist yet on first run */ }
};
cleanupBlacklist();
setInterval(cleanupBlacklist, 60 * 60 * 1000);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve frontend static files (for production)
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Catch-all route for frontend (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

module.exports = app;
