const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { checkPlanLimit } = require('../middleware/rbacMiddleware');
const {
  getSenderStatus,
  sendTypedEmail,
  sendBulkTypedEmails,
  buildEmailPreview,
  sendTestEmail,
  sendMarketing,
  getEmailChannels,
} = require('../services/emailOutboundService');

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

router.post('/send', checkPlanLimit('emails'), async (req, res) => {
  try {
    const result = await sendTypedEmail(req.user, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error, '❌ Send Email Error:');
  }
});

router.post('/send-bulk', checkPlanLimit('emails'), async (req, res) => {
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

router.post('/send-marketing', async (req, res) => {
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
    const result = await getEmailChannels(req.user?.id);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
