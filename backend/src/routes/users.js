const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, adminMiddleware, UserController.getAll);
router.post('/', authMiddleware, adminMiddleware, UserController.create);
router.delete('/:userId', authMiddleware, adminMiddleware, UserController.delete);
router.put('/change-password', authMiddleware, UserController.changePassword);
router.put('/:userId/reset-password', authMiddleware, adminMiddleware, UserController.resetPassword);

module.exports = router;
