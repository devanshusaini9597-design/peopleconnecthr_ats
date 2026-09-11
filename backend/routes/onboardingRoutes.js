/**
 * Onboarding routes — thin wrappers. Logic in onboardingService.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { requireOrganization } = require('../middleware/tenantMiddleware');
const { setAuthCookie } = require('../utils/authCookies');
const svc = require('../services/onboardingService');
const trial = require('../services/trialRequestService');

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.error) body.error = error.error;
  if (error.displayMessage) body.displayMessage = error.displayMessage;
  if (error.signupOtpToken) body.signupOtpToken = error.signupOtpToken;
  if (error.email) body.email = error.email;
  return res.status(status).json(body);
}

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const body = await svc.register(req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/send-signup-otp', registerLimiter, async (req, res) => {
  try {
    const body = await svc.sendSignupOtp(req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/verify-signup-otp', registerLimiter, async (req, res) => {
  try {
    const body = await svc.verifySignupOtp(req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/resend-signup-otp', registerLimiter, async (req, res) => {
  try {
    const body = await svc.resendSignupOtp(req.body);
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
  try {
    const body = await svc.resendVerification(req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
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

router.get('/trial-requests', verifyToken, async (req, res) => {
  try {
    const data = await trial.listTrialRequests(req.user, { status: req.query.status });
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/trial-requests/approve', (req, res) => {
  const frontendUrl = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const token = String(req.query.token || '').trim();
  if (!token) {
    return res.redirect(`${frontendUrl}/login?trial=error&message=${encodeURIComponent('Missing approval token')}`);
  }
  // Do not approve on GET (token would sit in access logs). Hand off to the SPA, which POSTs.
  return res.redirect(302, `${frontendUrl}/trial-approve#${encodeURIComponent(token)}`);
});

router.post('/trial-requests/approve-with-token', registerLimiter, async (req, res) => {
  try {
    const body = await trial.approveWithToken(req.body && req.body.token);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/trial-requests/:id/approve', verifyToken, async (req, res) => {
  try {
    trial.assertPlatformOperator(req.user);
    const body = await trial.approveTrialRequest(req.params.id, req.user);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/trial-requests/:id/reject', verifyToken, async (req, res) => {
  try {
    const body = await trial.rejectTrialRequest(req.params.id, req.user);
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
