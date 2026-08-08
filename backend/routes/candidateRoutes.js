const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');
const candidateController = require('../controller/candidateController');
const { requireRecruiterOrAbove, requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

// Multer Setup — disk storage only (avoids holding large files in RAM)
const ALLOWED_UPLOAD_EXTS = ['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.csv', '.txt',
  '.jpg', '.jpeg', '.png', '.gif', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_UPLOAD_EXTS.includes(ext)) cb(null, true);
  else cb(new Error(`File type ${ext} not allowed`));
};

// Permanent uploads (resumes stored under uploads/)
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.pdf';
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
      cb(null, uniqueName);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter
});

// Temp uploads (parse-only) — cleaned up after processing
const memoryUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter
});

// --- LIST / SEARCH / ANALYTICS (before /:id) ---
router.get('/', candidateController.listCandidates);
router.get('/analytics/data-quality', candidateController.getDataQualityAnalytics);
router.get('/check-email/:email', candidateController.checkEmail);

// --- PENDING (before /:id so "pending" is not captured as an id) ---
router.post('/pending/save', requireRecruiterOrAbove, candidateController.savePending);
router.get('/pending', candidateController.getPending);
router.put('/pending/:id', requireRecruiterOrAbove, candidateController.updatePending);
router.post('/pending/delete', requireRecruiterOrAbove, candidateController.deletePending);
router.post('/pending/clear-all', requireRecruiterOrAbove, candidateController.clearAllPending);
router.post('/pending/import', requireRecruiterOrAbove, candidateController.importPending);

// --- CREATE / BULK / IMPORT ---
router.post('/', requireRecruiterOrAbove, diskUpload.single('resume'), candidateController.createCandidate);
router.post('/bulk-from-parsed', requireRecruiterOrAbove, candidateController.bulkCreateFromParsed);
router.post('/extract-headers', diskUpload.single('file'), candidateController.extractHeaders);
router.post('/bulk-upload-auto', requireRecruiterOrAbove, requireFeature('jobs.bulkImport'), diskUpload.single('file'), candidateController.bulkUploadCandidates);
router.post('/bulk-upload', requireRecruiterOrAbove, requireFeature('jobs.bulkImport'), diskUpload.single('file'), (req, res, next) => {
    try {
        logger.info('--- 📥 BULK UPLOAD REQUEST RECEIVED ---');
        logger.info('--- 📦 req.body keys:', Object.keys(req.body || {}));
        logger.info('--- 📦 req.body.columnMapping type:', typeof req.body?.columnMapping);
        logger.info('--- 📦 req.body.columnMapping raw:', req.body?.columnMapping);
        logger.info('--- 📄 req.file:', req.file ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        } : 'NO FILE');
    } catch (e) {
        logger.error('--- ❌ Bulk upload pre-log failed:', e.message);
    }
    next();
}, candidateController.bulkUploadCandidates);

router.post('/parse-logic', memoryUpload.single('resume'), candidateController.parseLogic);

// --- REVIEW / SHARE ---
router.post('/revalidate-record', requireRecruiterOrAbove, candidateController.revalidateRecord);
router.post('/import-reviewed', requireRecruiterOrAbove, candidateController.importReviewedCandidates);
router.post('/share', requireRecruiterOrAbove, candidateController.shareCandidate);
router.post('/import-shared', requireRecruiterOrAbove, candidateController.importSharedCandidates);
router.post('/import-all-to-mine', requireRecruiterOrAbove, candidateController.importAllToMine);

// --- BULK DELETE / CLEAR ---
router.post('/bulk-delete', requireRecruiterOrAbove, candidateController.bulkDeleteCandidates);
router.delete('/clear-all/now', requireAdmin, candidateController.clearAllCandidates);

// --- SINGLE CANDIDATE (param routes last) ---
router.get('/:id/resume', candidateController.getResume);
router.get('/:id', candidateController.getCandidateById);
router.put('/:id', requireRecruiterOrAbove, diskUpload.single('resume'), candidateController.updateCandidate);
router.delete('/:id', requireRecruiterOrAbove, candidateController.deleteCandidate);

module.exports = router;
