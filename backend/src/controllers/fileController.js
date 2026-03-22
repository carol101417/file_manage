const File = require('../models/File');
const DownloadLog = require('../models/DownloadLog');
const AuditLog = require('../models/AuditLog');
const { getClientIp } = require('../utils/validation');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Dangerous file extensions blacklist
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1',
  '.sh', '.csh', '.ksh', '.bash'
]);

class FileController {
  static upload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check file extension
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        // Delete the already-saved file
        const tempPath = req.file.path;
        if (tempPath && fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        return res.status(400).json({ error: `File type "${ext}" is not allowed` });
      }

      // Check disk space (warn if less than 500MB free)
      try {
        const stats = fs.statfsSync(path.join(__dirname, '../../uploads'));
        const freeBytes = stats.bfree * stats.bsize;
        if (freeBytes < 500 * 1024 * 1024) {
          // Delete the already-saved file
          const tempPath = req.file.path;
          if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          return res.status(507).json({ error: 'Insufficient disk space' });
        }
      } catch (e) {
        // statfsSync may not be available on all platforms, continue
      }

      const fileId = uuidv4();
      const fileData = {
        fileId,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploaderId: req.user.id
      };

      const id = File.create(fileData);

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user.id,
        username: req.user.username,
        action: 'FILE_UPLOAD',
        targetType: 'file',
        targetId: fileId,
        detail: `Uploaded: ${fileData.originalName} (${fileData.fileSize} bytes)`,
        ipAddress
      });

      res.status(201).json({
        message: 'File uploaded successfully',
        file: {
          id,
          fileId,
          originalName: fileData.originalName,
          fileSize: fileData.fileSize,
          shareLink: `/api/files/${fileId}/public-download`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static getAll(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
      const isAdmin = req.user.role === 'admin';
      const result = File.getAll(req.user.id, isAdmin, page, pageSize);

      res.json(result);
    } catch (error) {
      console.error('Get files error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static getById(req, res) {
    try {
      const { fileId } = req.params;
      const file = File.findByFileId(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const isAdmin = req.user.role === 'admin';
      const isOwner = file.uploader_id === req.user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(file);
    } catch (error) {
      console.error('Get file error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static download(req, res) {
    try {
      const { fileId } = req.params;
      const file = File.findByFileId(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(__dirname, '../../uploads', file.stored_name);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      const ipAddress = getClientIp(req);
      DownloadLog.create(file.id, req.user.id, ipAddress);
      File.incrementDownloadCount(file.id);

      res.download(filePath, file.original_name);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static publicDownload(req, res) {
    try {
      const { fileId } = req.params;
      const file = File.findByFileId(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = path.join(__dirname, '../../uploads', file.stored_name);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found on disk' });
      }

      const ipAddress = getClientIp(req);
      DownloadLog.create(file.id, null, ipAddress);
      File.incrementDownloadCount(file.id);

      const encodedFilename = encodeURIComponent(file.original_name);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
      res.setHeader('Content-Type', 'application/octet-stream');

      res.download(filePath, file.original_name);
    } catch (error) {
      console.error('Public download error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static delete(req, res) {
    try {
      const { fileId } = req.params;
      const file = File.findByFileId(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const isAdmin = req.user.role === 'admin';
      const isOwner = file.uploader_id === req.user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const filePath = path.join(__dirname, '../../uploads', file.stored_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      File.delete(file.id);

      // Audit log
      const ipAddress = getClientIp(req);
      AuditLog.create({
        userId: req.user.id,
        username: req.user.username,
        action: 'FILE_DELETE',
        targetType: 'file',
        targetId: fileId,
        detail: `Deleted: ${file.original_name}`,
        ipAddress
      });

      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static search(req, res) {
    try {
      const { keyword } = req.query;
      const page = parseInt(req.query.page) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
      }

      const isAdmin = req.user.role === 'admin';
      const result = File.search(keyword, req.user.id, isAdmin, page, pageSize);

      res.json(result);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static getShareLink(req, res) {
    try {
      const { fileId } = req.params;
      const file = File.findByFileId(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const isAdmin = req.user.role === 'admin';
      const isOwner = file.uploader_id === req.user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const shareLink = `/api/files/${fileId}/public-download`;

      res.json({ shareLink });
    } catch (error) {
      console.error('Get share link error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static getDownloadLogs(req, res) {
    try {
      const { fileId } = req.params;
      const file = File.findByFileId(fileId);

      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const isAdmin = req.user.role === 'admin';
      const isOwner = file.uploader_id === req.user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const logs = DownloadLog.getByFileId(file.id);

      res.json(logs);
    } catch (error) {
      console.error('Get download logs error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FileController;
