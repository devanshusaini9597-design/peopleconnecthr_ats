const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const svc = require('../services/myTeamService');

router.use(verifyToken, requireOrganization, requireRecruiterOrAbove);

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.get('/', async (req, res) => {
  try {
    const data = await svc.getOverview(req.user);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/reports', async (req, res) => {
  try {
    const data = await svc.addReport(req.user, req.body?.userId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/reports/:userId', async (req, res) => {
  try {
    const data = await svc.removeReport(req.user, req.params.userId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.post('/tags', async (req, res) => {
  try {
    const data = await svc.createTag(req.user, req.body || {});
    res.status(201).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.put('/tags/:id', async (req, res) => {
  try {
    const data = await svc.updateTag(req.user, req.params.id, req.body || {});
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.delete('/tags/:id', async (req, res) => {
  try {
    const data = await svc.deleteTag(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
