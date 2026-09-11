/**
 * Profile routes — thin wrappers; domain logic in profileService.
 */
const express = require('express');
const path = require('path');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { verifyToken } = require('../middleware/authMiddleware');
const svc = require('../services/profileService');

const router = express.Router();

function handle(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({ success: false, message: err.message });
}

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const profilePicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'));
  },
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const data = await svc.getProfile(req.user.id);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ success: true, ...data });
  } catch (err) {
    handle(res, err);
  }
});

router.put('/', verifyToken, async (req, res) => {
  try {
    const { user } = await svc.updateProfile(req.user.id, req.body);
    res.json({ success: true, message: 'Profile updated successfully', user });
  } catch (err) {
    handle(res, err);
  }
});

router.put('/picture', verifyToken, uploadLimiter, profilePicUpload.single('profilePicture'), async (req, res) => {
  try {
    const { profilePicture } = await svc.updateProfilePicture(req.user.id, req.file);
    res.json({ success: true, message: 'Profile picture updated', profilePicture });
  } catch (err) {
    handle(res, err);
  }
});

router.delete('/picture', verifyToken, async (req, res) => {
  try {
    await svc.removeProfilePicture(req.user.id);
    res.json({ success: true, message: 'Profile picture removed' });
  } catch (err) {
    handle(res, err);
  }
});

router.put('/change-password', verifyToken, async (req, res) => {
  try {
    await svc.changePassword(req.user.id, req.body, { keepJti: req.user.jti });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    handle(res, err);
  }
});

router.get('/stats', verifyToken, async (req, res) => {
  try {
    const stats = await svc.getProfileStats(req.user);
    res.json({ success: true, stats });
  } catch (err) {
    handle(res, err);
  }
});

module.exports = router;
