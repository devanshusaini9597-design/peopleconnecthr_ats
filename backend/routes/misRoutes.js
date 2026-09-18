/**
 * MIS / Marketing contacts routes.
 * Public: GET /unsubscribe
 * Auth: company owner only (requireOwner)
 */
const express = require('express');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/rbacMiddleware');
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

router.use(verifyToken, requireOwner);

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

router.post('/bulk-delete', async (req, res) => {
  try {
    const data = await svc.bulkDelete(req.user, req.body?.ids || []);
    res.json({ success: true, ...data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/move-to-candidates', async (req, res) => {
  try {
    const data = await svc.moveToCandidates(req.user, req.body?.ids || [], {
      removeFromMis: req.body?.removeFromMis !== false,
    });
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
