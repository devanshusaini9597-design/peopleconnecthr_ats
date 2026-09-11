/**
 * WhatsApp Cloud API — Skillnix talks to Meta directly (no Twilio/Wati).
 * Now: one company connects with Meta token + phone ID.
 * Later: Embedded Signup onboards other companies for SaaS.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { getAdapter } = require('../adapters');
const inboxService = require('../services/inboxService');
const {
  getPlatformConfig,
  getOrgConnection,
  completeOnboarding,
} = require('../services/whatsappCloudService');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('integrations.whatsapp'));

/** Public-to-the-org: whether Meta Embedded Signup is enabled on this Skillnix instance */
router.get('/connect-config', async (_req, res) => {
  try {
    const platform = getPlatformConfig();
    const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
    res.json({
      success: true,
      data: {
        appId: platform.appId,
        configId: platform.configId,
        graphVersion: platform.graphVersion,
        ready: platform.saasReady,
        saasReady: platform.saasReady,
        companyReady: platform.companyReady,
        webhookUrl: backendUrl ? `${backendUrl}/api/whatsapp/webhook` : '/api/whatsapp/webhook',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /api/whatsapp/status */
router.get('/status', async (req, res) => {
  try {
    const connection = await getOrgConnection(req.user.organizationId);
    const platform = getPlatformConfig();
    res.json({
      success: true,
      configured: !!connection,
      signupReady: platform.ready,
      data: connection,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/whatsapp/embedded-signup
 * Completes Meta Embedded Signup: exchange code, store WABA + phone for this org.
 */
router.post('/embedded-signup', requireAdmin, async (req, res) => {
  try {
    const { code, wabaId, phoneNumberId, businessId } = req.body || {};
    const data = await completeOnboarding({
      organizationId: req.user.organizationId,
      userId: req.user.id || req.user._id,
      code,
      wabaId,
      phoneNumberId,
      businessId,
    });
    res.json({ success: true, message: 'WhatsApp connected', data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/whatsapp/send
 * body: { candidateId, message } OR { to, message }
 */
router.post('/send', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { candidateId, to, message, templateName, languageCode, components } = req.body || {};
    if ((!message || !String(message).trim()) && !templateName) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    if (candidateId) {
      const result = await inboxService.createOutbound(req.user.organizationId, req.user, {
        candidateId,
        channel: 'whatsapp',
        body: message ? String(message).trim() : (templateName ? `Template: ${templateName}` : ''),
        templateName,
        languageCode: languageCode || (templateName ? 'en_US' : ''),
        components,
      });
      return res.json({ success: true, message: 'WhatsApp message sent', data: result });
    }

    const adapter = await getAdapter(req.user.organizationId, 'whatsapp');
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not connected yet. Open Settings → Integrations and click Connect WhatsApp.',
      });
    }

    const recipient = to;
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'No phone number available to send to' });
    }

    const sendResult = await adapter.sendWhatsApp({
      to: recipient,
      message: message ? String(message).trim() : '',
      templateName,
      languageCode,
      components,
    });
    res.json({ success: true, message: 'WhatsApp message sent', data: sendResult });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
