const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { checkPlanLimit } = require('../middleware/rbacMiddleware');
const { rejectFreelancerCompanyMail } = require('../utils/dataScope');
const {
  getSenderStatus,
  sendTypedEmail,
  sendBulkTypedEmails,
  buildEmailPreview,
  sendTestEmail,
  sendMarketing,
  getEmailChannels,
} = require('../services/emailOutboundService');
const emailReports = require('../services/emailReportService');

function handle(res, error, label) {
  if (error.code === 'USE_VERIFIED_DOMAIN') {
    return res.status(400).json({ success: false, message: error.message, code: 'USE_VERIFIED_DOMAIN' });
  }
  const status = error.statusCode || 500;
  if (status >= 500) logger.error(label || 'Email route error:', error);
  const body = { success: false, message: error.message || 'Request failed' };
  if (error.displayMessage) body.displayMessage = error.displayMessage;
  if (error.code) body.code = error.code;
  if (error.message === 'EMAIL_NOT_CONFIGURED') body.message = 'EMAIL_NOT_CONFIGURED';
  return res.status(status).json(body);
}

router.get('/sender-status', async (req, res) => {
  try {
    const status = await getSenderStatus(req.user?.id);
    res.json({ success: true, ...status });
  } catch (err) {
    handle(res, err);
  }
});

router.post('/send', rejectFreelancerCompanyMail, checkPlanLimit('emails'), async (req, res) => {
  try {
    const result = await sendTypedEmail(req.user, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error, '❌ Send Email Error:');
  }
});

router.post('/send-bulk', rejectFreelancerCompanyMail, checkPlanLimit('emails'), async (req, res) => {
  try {
    const result = await sendBulkTypedEmails(req.user, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error, '❌ Bulk Email Error:');
  }
});

router.post('/preview', (req, res) => {
  try {
    const template = buildEmailPreview(req.body);
    res.json({ success: true, subject: template.subject, html: template.html });
  } catch (error) {
    handle(res, error, 'Preview error:');
  }
});

router.post('/test', async (req, res) => {
  try {
    const result = await sendTestEmail(req.body.email);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error, '❌ Test Email Error:');
  }
});

router.post('/send-marketing', rejectFreelancerCompanyMail, async (req, res) => {
  try {
    const result = await sendMarketing(req.user, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    const displayMessage =
      error.displayMessage ||
      (error.code === 'CAMPAIGNS_NOT_CONFIGURED'
        ? 'Add ZOHO_CAMPAIGNS_LIST_KEY in backend .env (from Zoho Campaigns → Mailing Lists → list key).'
        : null);
    if (displayMessage) error.displayMessage = displayMessage;
    handle(res, error, 'Marketing email error:');
  }
});

router.get('/channels', async (req, res) => {
  try {
    const result = await getEmailChannels(req.user?.id, req.user?.organizationId);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

router.get('/reports', async (req, res) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(400).json({ success: false, message: 'Organization required' });
    }
    const data = await emailReports.listEmailReports(req.user.organizationId, req.query);
    return res.json({ success: true, ...data });
  } catch (error) {
    logger.error({ err: error.message, stack: error.stack }, 'Email reports list error');
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load email reports',
      displayMessage: error.displayMessage || 'Could not load email reports. Please retry.',
    });
  }
});

router.get('/reports/:id', async (req, res) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(400).json({ success: false, message: 'Organization required' });
    }
    if (req.params.id === 'sync') {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    const item = await emailReports.getEmailReportDetail(req.params.id, req.user.organizationId);
    return res.json({ success: true, item });
  } catch (error) {
    logger.error({ err: error.message }, 'Email report detail error');
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load report',
    });
  }
});

router.post('/reports/sync', async (req, res) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(400).json({ success: false, message: 'Organization required' });
    }
    const [stale, campaigns] = await Promise.all([
      emailReports.syncStaleReports(req.user.organizationId, { max: 20 }),
      emailReports.syncRecentCampaigns(req.user.organizationId, { limit: 50 }).catch((err) => ({
        error: err.message,
        imported: 0,
        synced: 0,
        total: 0,
      })),
    ]);
    return res.json({
      success: true,
      message: 'Email reports refreshed from ZeptoMail / Zoho Campaigns',
      stale,
      campaigns,
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Email reports sync-all error');
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Refresh failed',
    });
  }
});

router.post('/reports/:id/sync', async (req, res) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(400).json({ success: false, message: 'Organization required' });
    }
    const item = await emailReports.syncEmailSend(req.params.id, req.user.organizationId);
    return res.json({ success: true, item });
  } catch (error) {
    logger.error({ err: error.message }, 'Email report sync error');
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Sync failed',
    });
  }
});

module.exports = router;
