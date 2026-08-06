/**
 * Onboarding routes — thin wrappers. Logic in onboardingService.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { setAuthCookie } = require('../utils/authCookies');
const svc = require('../services/onboardingService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({ success: false, message: error.message });
}

router.post('/register', async (req, res) => {
  try {
    const body = await svc.register(req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const body = await svc.verifyEmail(req.body.token);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/resend-verification', async (req, res) => {
  res.json(svc.resendVerification());
});

router.post('/create-org', verifyToken, async (req, res) => {
  try {
    const body = await svc.createOrg(req.user.id, req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/invite', verifyToken, requireOrganization, requireAdmin, checkPlanLimit('users'), async (req, res) => {
  try {
    const body = await svc.inviteTeammate(req.user, req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/accept-invite', async (req, res) => {
  try {
    const result = await svc.acceptInvite(req.body, req);
    if (result.setCookieToken) setAuthCookie(res, result.setCookieToken);
    res.json(result.body);
  } catch (error) {
    handle(res, error);
  }
});

router.get('/invite/:token', async (req, res) => {
  try {
    const body = await svc.getInvite(req.params.token);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/complete-onboarding', verifyToken, async (req, res) => {
  try {
    const body = await svc.completeOnboarding(req.user.id);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
