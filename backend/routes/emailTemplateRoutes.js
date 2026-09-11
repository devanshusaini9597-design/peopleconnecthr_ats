/**
 * Email templates — org-scoped. Send path uses emailTemplateSendService.
 */
const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const svc = require('../services/emailTemplateService');
const { rejectFreelancerCompanyMail } = require('../utils/dataScope');

function handle(res, err, label) {
  if (err.statusCode && err.statusCode < 500) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
  if (label) logger.error(label, err);
  return res.status(500).json({ success: false, message: err.message });
}

function orgId(req) {
  return req.user?.organizationId;
}

router.get('/', async (req, res) => {
  try {
    const templates = await svc.listTemplates(req.user.id, orgId(req));
    res.json({ success: true, templates });
  } catch (err) {
    handle(res, err, 'Get templates error:');
  }
});

router.post('/ensure-subscribe', async (req, res) => {
  try {
    const result = await svc.ensureSubscribe(req.user.id, orgId(req));
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err, 'Ensure subscribe template error:');
  }
});

router.post('/send', rejectFreelancerCompanyMail, async (req, res) => {
  try {
    const { sendTemplateEmail } = require('../services/emailTemplateSendService');
    const result = await sendTemplateEmail(req.user, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.code === 'USE_VERIFIED_DOMAIN') {
      return res.status(400).json({ success: false, message: err.message, code: 'USE_VERIFIED_DOMAIN' });
    }
    if (err.code === 'CAMPAIGNS_NOT_CONFIGURED' || err.message === 'CAMPAIGNS_NOT_CONFIGURED') {
      return res.status(400).json({
        success: false,
        message: err.message,
        code: 'CAMPAIGNS_NOT_CONFIGURED',
        displayMessage:
          err.displayMessage ||
          'Zoho Campaigns is not configured. Add OAuth credentials (or API key) and ZOHO_CAMPAIGNS_LIST_KEY in backend .env.',
      });
    }
    if (err.statusCode && err.statusCode < 500) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        displayMessage: err.displayMessage || err.message,
      });
    }
    logger.error('[Send email] Template send error:', err.message, err);
    res.status(500).json({
      success: false,
      message: err.message,
      displayMessage: err.displayMessage,
    });
  }
});

router.post('/seed-defaults', async (req, res) => {
  try {
    const result = await svc.seedDefaults(req.user.id, orgId(req));
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err, 'Seed templates error:');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const template = await svc.getTemplate(req.user.id, req.params.id, orgId(req));
    res.json({ success: true, template });
  } catch (err) {
    handle(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const template = await svc.createTemplate(req.user.id, req.body, orgId(req));
    res.status(201).json({ success: true, template });
  } catch (err) {
    handle(res, err, 'Create template error:');
  }
});

router.put('/:id', async (req, res) => {
  try {
    const template = await svc.updateTemplate(req.user.id, req.params.id, req.body, orgId(req));
    res.json({ success: true, template });
  } catch (err) {
    handle(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await svc.deleteTemplate(req.user.id, req.params.id, orgId(req));
    res.json({ success: true, ...result });
  } catch (err) {
    handle(res, err);
  }
});

module.exports = router;
