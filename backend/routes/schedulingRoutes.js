/**
 * Self-schedule booking — Professional+, gated by scheduling.selfBook.
 * Public routes for candidates; authenticated routes for creating links.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const svc = require('../services/schedulingService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

/** GET /public/:tokenOrSlug — link info + available slots */
router.get('/public/:tokenOrSlug', async (req, res) => {
  try {
    const data = await svc.getPublicLink(req.params.tokenOrSlug);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/** POST /public/:tokenOrSlug/book */
router.post('/public/:tokenOrSlug/book', async (req, res) => {
  try {
    const data = await svc.bookPublicSlot(req.params.tokenOrSlug, req.body);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

// ── Authenticated routes ─────────────────────────────────────────────
router.use(verifyToken, requireOrganization, tenantScope, requireFeature('scheduling.selfBook'), requireRecruiterOrAbove);

/** POST /links — create scheduling link */
router.post('/links', async (req, res) => {
  try {
    const link = await svc.createSchedulingLink(req.user, req.body);
    res.status(201).json({ success: true, data: link });
  } catch (error) {
    handle(res, error);
  }
});

/** GET /links */
router.get('/links', async (req, res) => {
  try {
    const links = await svc.listSchedulingLinks(req.user.organizationId);
    res.json({ success: true, data: links });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
