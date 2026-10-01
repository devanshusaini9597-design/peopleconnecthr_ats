/**
 * MIS / Marketing contacts routes.
 * Public: GET /unsubscribe, GET /export/download (signed token)
 * Auth: company employees (not freelancers). Export: owner only.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOwner, requireMisCompany } = require('../middleware/rbacMiddleware');
const { multerFileFilter } = require('../utils/uploadAllowlist');
const svc = require('../services/misService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.xlsx';
      cb(null, `mis-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: multerFileFilter,
});

/** Public one-click unsubscribe (no auth). */
router.get('/unsubscribe', async (req, res) => {
  try {
    const data = await svc.unsubscribePublic({
      id: req.query.id,
      token: req.query.token,
    });
    const wantsHtml = String(req.headers.accept || '').includes('text/html')
      || String(req.query.format || '') === 'html';
    if (wantsHtml) {
      return res
        .status(200)
        .type('html')
        .send(`<!doctype html><html><body style="font-family:system-ui;padding:40px;max-width:480px;margin:auto">
          <h1 style="font-size:20px">Unsubscribed</h1>
          <p>${data.message}</p>
        </body></html>`);
    }
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * Signed export download — streams directly from Railway (bypasses Vercel body limits).
 * Token is short-lived and owner-bound.
 */
router.get('/export/download', async (req, res) => {
  try {
    const file = svc.resolveExportDownload(req.query.token);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('X-Export-Count', String(file.count));
    if (file.capped) res.setHeader('X-Export-Capped', '1');
    res.setHeader('Cache-Control', 'no-store');
    return fs.createReadStream(file.filePath).pipe(res);
  } catch (error) {
    handle(res, error);
  }
});

router.use(verifyToken, requireMisCompany);

router.get('/stats', async (req, res) => {
  try {
    // Identity comes only from the auth token — never from query/body
    const data = await svc.getMisStats(req.user);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/reports', async (req, res) => {
  try {
    const data = await svc.getMisReports(req.user, req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/', async (req, res) => {
  try {
    const data = await svc.listContacts(req.user, req.query);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/', async (req, res) => {
  try {
    const data = await svc.createContact(req.user, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    const data = await svc.bulkUpload(req.user, req.file);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/bulk-upload/jobs/:jobId', async (req, res) => {
  try {
    const data = svc.getBulkUploadJob(req.user, req.params.jobId);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/bulk-delete', async (req, res) => {
  try {
    const data = await svc.bulkDelete(req.user, req.body?.ids || []);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/bulk-update', async (req, res) => {
  try {
    const data = await svc.bulkUpdate(req.user, req.body?.ids || [], req.body?.updates || {});
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/move-to-candidates', requireOwner, async (req, res) => {
  try {
    const data = await svc.moveToCandidates(req.user, req.body?.ids || [], {
      removeFromMis: req.body?.removeFromMis !== false,
    });
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

/** Owner-only: start async export job (returns jobId immediately). */
router.post('/export', requireOwner, async (req, res) => {
  try {
    const data = await svc.startExportContacts(req.user, req.body || {});
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/export/jobs/:jobId', requireOwner, async (req, res) => {
  try {
    const data = svc.getExportJob(req.user, req.params.jobId);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/send-marketing', async (req, res) => {
  try {
    const data = await svc.sendMarketingToMis(req.user, req.body || {});
    res.json({ success: true, ...data });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.displayMessage || error.message,
      ...(error.code ? { code: error.code } : {}),
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await svc.getContact(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = await svc.updateContact(req.user, req.params.id, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const data = await svc.deleteContact(req.user, req.params.id);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
