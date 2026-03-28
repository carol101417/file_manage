const File = require('../models/File');
const DownloadLog = require('../models/DownloadLog');
const AuditLog = require('../models/AuditLog');
const { getClientIp } = require('../utils/validation');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * 危险文件扩展名黑名单
 * 禁止上传可执行脚本等高风险文件类型
 * @type {Set<string>}
 */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.ps1',
  '.sh', '.csh', '.ksh', '.bash'
]);

class FileController {
  /**
   * 上传文件
   * 检查文件扩展名、磁盘空间，保存文件记录到数据库并记录审计日志
   * @param {import('express').Request} req - 请求对象，req.file 由 multer 中间件提供
   * @param {import('express').Response} res - 响应对象，成功时返回 201 及文件信息和分享链接
   */
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

  /**
   * 获取文件列表（分页）
   * 管理员可查看全部文件，普通用户仅查看自己上传的文件
   * @param {import('express').Request} req - 请求对象，query 中可传 page 和 pageSize
   * @param {import('express').Response} res - 响应对象，返回分页文件列表
   */
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

  /**
   * 根据文件 ID 获取文件详情
   * 仅文件所有者或管理员可访问
   * @param {import('express').Request} req - 请求对象，params 中需包含 fileId
   * @param {import('express').Response} res - 响应对象，返回文件详情 JSON
   */
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

  /**
   * 下载文件（需登录）
   * 记录下载日志并增加下载计数
   * @param {import('express').Request} req - 请求对象，params 中需包含 fileId
   * @param {import('express').Response} res - 响应对象，以附件形式发送文件
   */
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

  /**
   * 公开下载文件（无需登录）
   * 通过分享链接下载，记录下载日志并增加下载计数，设置 UTF-8 文件名头
   * @param {import('express').Request} req - 请求对象，params 中需包含 fileId
   * @param {import('express').Response} res - 响应对象，以附件形式发送文件
   */
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

  /**
   * 删除文件
   * 仅文件所有者或管理员可操作，同时删除磁盘上的物理文件并记录审计日志
   * @param {import('express').Request} req - 请求对象，params 中需包含 fileId
   * @param {import('express').Response} res - 响应对象，返回删除成功消息
   */
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

  /**
   * 搜索文件
   * 按关键字搜索文件名，支持分页，管理员可搜索全部文件
   * @param {import('express').Request} req - 请求对象，query 中需包含 keyword，可选 page 和 pageSize
   * @param {import('express').Response} res - 响应对象，返回搜索结果的分页列表
   */
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

  /**
   * 获取文件的公开分享链接
   * 仅文件所有者或管理员可获取
   * @param {import('express').Request} req - 请求对象，params 中需包含 fileId
   * @param {import('express').Response} res - 响应对象，返回包含 shareLink 的 JSON
   */
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

  /**
   * 获取文件的下载日志
   * 仅文件所有者或管理员可查看
   * @param {import('express').Request} req - 请求对象，params 中需包含 fileId
   * @param {import('express').Response} res - 响应对象，返回下载日志数组
   */
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
