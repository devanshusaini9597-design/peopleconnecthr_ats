const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const platformOps = require('../services/platformOpsService');
const logger = require('../utils/logger');

function handle(res, err, label) {
  const status = err.statusCode || 500;
  if (status >= 500) logger.error({ err: err.message }, label);
  return res.status(status).json({
    success: false,
    code: err.code || undefined,
    message: err.message || 'Server error',
  });
}

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const data = await platformOps.getSummary(req.user);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops summary');
  }
});

router.get('/summary', async (req, res) => {
  try {
    const data = await platformOps.getSummary(req.user);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops summary');
  }
});

router.get('/operators', async (req, res) => {
  try {
    const data = await platformOps.getSummary(req.user);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops operators');
  }
});

router.get(['/orgs', '/organizations'], async (req, res) => {
  try {
    const data = await platformOps.listTenants(req.user, req.query);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops list tenants');
  }
});

router.get('/tenants', async (req, res) => {
  try {
    const data = await platformOps.listTenants(req.user, req.query);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops list tenants');
  }
});

router.get('/tenants/:id', async (req, res) => {
  try {
    const data = await platformOps.getTenant(req.user, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops get tenant');
  }
});

router.patch('/tenants/:id', async (req, res) => {
  try {
    const data = await platformOps.updateTenant(req.user, req.params.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    handle(res, err, 'platform ops update tenant');
  }
});

router.post('/tenants/:id/inspect', async (req, res) => {
  try {
    const { setAuthCookie } = require('../utils/authCookies');
    const result = await platformOps.inspectTenant(req.user, req.params.id, req);
    setAuthCookie(res, result.token);
    res.json({ success: true, data: { redirect: '/dashboard', user: result.payload?.user } });
  } catch (err) {
    handle(res, err, 'platform ops inspect tenant');
  }
});

module.exports = router;
