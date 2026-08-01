/**
 * WhatsApp Business messaging — standalone channel add-on
 * (feature key: integrations.whatsapp, Enterprise; BYOK via Twilio).
 *
 * Distinct from the existing "wa.me click-to-chat" link in the candidate
 * table (which just opens WhatsApp Web/App manually) — this sends an
 * actual message through the org's own Twilio WhatsApp sender, logged and
 * auditable, the same way Email/SMS sends already work.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { getAdapter } = require('../adapters');
const Candidate = require('../models/Candidate');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('integrations.whatsapp'));

/** GET /api/whatsapp/status — whether this org has an active, validated WhatsApp sender configured */
router.get('/status', async (req, res) => {
  try {
    const adapter = await getAdapter(req.user.organizationId, 'whatsapp');
    res.json({ success: true, configured: !!adapter });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/whatsapp/send
 * body: { candidateId, message } OR { to, message } for an arbitrary number
 */
router.post('/send', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { candidateId, to, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    let recipient = to;
    if (!recipient && candidateId) {
      const candidate = await Candidate.findOne({ _id: candidateId, organizationId: req.user.organizationId }).select('contact phone name');
      if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
      recipient = candidate.contact || candidate.phone;
    }
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'No phone number available to send to' });
    }

    const adapter = await getAdapter(req.user.organizationId, 'whatsapp');
    if (!adapter) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp is not configured yet. Connect a Twilio WhatsApp sender in Settings → Integrations.'
      });
    }

    const result = await adapter.sendWhatsApp({ to: recipient, message: message.trim() });
    res.json({ success: true, message: 'WhatsApp message sent', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
