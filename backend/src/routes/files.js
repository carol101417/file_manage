const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const FileController = require('../controllers/fileController');
const { authMiddleware } = require('../middleware/auth');
const { normalizeUploadedFilename, safeExtname } = require('../utils/filename');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const normalizedOriginalName = normalizeUploadedFilename(file.originalname);
    file.originalname = normalizedOriginalName;

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = safeExtname(normalizedOriginalName);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB default
  }
});

router.post('/upload', authMiddleware, upload.single('file'), FileController.upload);
router.get('/', authMiddleware, FileController.getAll);
router.get('/search', authMiddleware, FileController.search);
router.get('/:fileId', authMiddleware, FileController.getById);
router.get('/:fileId/download', authMiddleware, FileController.download);
router.get('/:fileId/public-download', FileController.publicDownload);
router.get('/:fileId/share-link', authMiddleware, FileController.getShareLink);
router.get('/:fileId/logs', authMiddleware, FileController.getDownloadLogs);
router.delete('/:fileId', authMiddleware, FileController.delete);

module.exports = router;
