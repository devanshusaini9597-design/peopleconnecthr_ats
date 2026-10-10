const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { requireOwnerOrAdmin } = require('../middleware/rbacMiddleware');
const svc = require('../services/partnerSignupService');

function handle(res, error) {
  const payload = { success: false, message: error.message };
  if (error.code) payload.code = error.code;
  res.status(error.statusCode || 500).json(payload);
}

const run = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    handle(res, error);
  }
};

router.use(verifyToken, requireOrganization, requireOwnerOrAdmin);

router.get('/', run(async (req, res) => {
  const data = await svc.listApplications(req.user, req.query || {});
  res.json({ success: true, data });
}));

router.post('/bulk', run(async (req, res) => {
  const data = await svc.bulkApplications(req.user, req.body || {});
  res.json({ success: true, data });
}));

router.post('/', run(async (req, res) => {
  const data = await svc.createApplication(req.user, req.body || {});
  res.json({ success: true, data });
}));

router.get('/unread-count', run(async (req, res) => {
  const count = await svc.unreadApplicationCount(req.user);
  res.json({ success: true, count });
}));

router.post('/:id/mark-seen', run(async (req, res) => {
  const data = await svc.markApplicationSeen(req.user, req.params.id);
  res.json({ success: true, data });
}));

router.get('/:id', run(async (req, res) => {
  const data = await svc.getApplication(req.user, req.params.id);
  res.json({ success: true, data });
}));

router.get('/:id/review-check', run(async (req, res) => {
  const data = await svc.reviewApplication(req.user, req.params.id);
  res.json({ success: true, data });
}));

router.get('/:id/resume', run(async (req, res) => {
  const file = await svc.getResumeFile(req.user, req.params.id);
  const isDownload = String(req.query.download || '') === '1';
  const disposition = `${isDownload ? 'attachment' : 'inline'}; filename="${String(file.downloadName || 'resume.pdf').replace(/"/g, '')}"`;
  res.setHeader('Content-Disposition', disposition);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  if (file.source === 's3' && file.stream) {
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    if (typeof file.stream.pipe === 'function') {
      file.stream.pipe(res);
      return;
    }
    const { Readable } = require('stream');
    Readable.from(file.stream).pipe(res);
    return;
  }
  if (file.source === 's3-buffer' && file.buffer) {
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.send(file.buffer);
    return;
  }
  if (file.abs) {
    return res.download(file.abs, file.downloadName);
  }
  throw Object.assign(new Error('Resume file is no longer available'), { statusCode: 404 });
}));

router.patch('/:id/status', run(async (req, res) => {
  const data = await svc.updateApplicationStatus(req.user, req.params.id, req.body || {});
  res.json({ success: true, data });
}));

router.put('/:id', run(async (req, res) => {
  const data = await svc.updateApplication(req.user, req.params.id, req.body || {});
  res.json({ success: true, data });
}));

router.delete('/:id', run(async (req, res) => {
  const data = await svc.deleteApplication(req.user, req.params.id);
  res.json({ success: true, data });
}));

module.exports = router;
