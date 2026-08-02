/**
 * Slack / Microsoft Teams app integration stubs.
 * Slash command endpoint + Teams webhook.
 * Credential fields: botToken, signingSecret (stored via IntegrationConfig category slack_app).
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Candidate = require('../models/Candidate');
const IntegrationConfig = require('../models/IntegrationConfig');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

const verifySlackSignature = (req, signingSecret) => {
  if (!signingSecret) return true; // stub mode when not configured
  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  if (!timestamp || !signature) return false;
  const base = `v0:${timestamp}:${req.rawBody || JSON.stringify(req.body)}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(base).digest('hex');
  return signature === `v0=${hmac}`;
};

const resolveOrgFromSlackTeam = async (teamId) => {
  const config = await IntegrationConfig.findOne({
    category: 'slack_app',
    isActive: true,
    'metadata.teamId': teamId
  });
  return config?.organizationId || null;
};

/** POST /commands — Slack slash commands */
router.post('/commands', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { command, text, team_id, user_name } = req.body;
    const orgId = await resolveOrgFromSlackTeam(team_id);

    let signingSecret = '';
    if (orgId) {
      const config = await IntegrationConfig.findOne({ organizationId: orgId, category: 'slack_app', isActive: true });
      if (config) {
        const creds = config.getDecryptedCredentials();
        signingSecret = creds.signingSecret || '';
      }
    }

    if (signingSecret && !verifySlackSignature(req, signingSecret)) {
      return res.status(401).json({ text: 'Invalid Slack signature' });
    }

    const cmd = (command || '').toLowerCase();
    const args = (text || '').trim();

    if (cmd === '/skillnix' && (!args || args === 'help')) {
      return res.json({
        response_type: 'ephemeral',
        text: '*SkillNix Slack App*\n• `/skillnix help` — show this message\n• `/skillnix candidates <query>` — search candidates by name or email'
      });
    }

    if (cmd === '/skillnix' && args.startsWith('candidates')) {
      const query = args.replace(/^candidates\s*/i, '').trim();
      if (!orgId) {
        return res.json({ response_type: 'ephemeral', text: 'SkillNix is not connected for this Slack workspace. Configure it in Integration Settings.' });
      }
      if (!query) {
        return res.json({ response_type: 'ephemeral', text: 'Usage: `/skillnix candidates <name or email>`' });
      }

      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const candidates = await Candidate.find({
        organizationId: orgId,
        $or: [{ name: regex }, { email: regex }]
      }).select('name email phone').limit(5);

      if (!candidates.length) {
        return res.json({ response_type: 'ephemeral', text: `No candidates found matching "${query}".` });
      }

      const lines = candidates.map((c) => `• *${c.name}* — ${c.email}${c.phone ? ` (${c.phone})` : ''}`);
      return res.json({
        response_type: 'ephemeral',
        text: `*Candidates matching "${query}":*\n${lines.join('\n')}`
      });
    }

    return res.json({
      response_type: 'ephemeral',
      text: `Unknown command. Try \`/skillnix help\`. (Requested by @${user_name || 'user'})`
    });
  } catch (error) {
    console.error('[Slack] command error:', error);
    res.json({ response_type: 'ephemeral', text: 'Something went wrong processing your command.' });
  }
});

/** POST /teams/webhook — Microsoft Teams outgoing webhook stub */
router.post('/teams/webhook', async (req, res) => {
  try {
    const text = (req.body?.text || '').trim().toLowerCase();
    if (!text || text === 'help') {
      return res.json({
        type: 'message',
        text: '**SkillNix Teams App**\\n\\n• `help` — show this message\\n• `candidates <query>` — search candidates'
      });
    }
    if (text.startsWith('candidates')) {
      return res.json({
        type: 'message',
        text: 'Candidate search via Teams is configured per organization. Connect your Teams webhook in Integration Settings.'
      });
    }
    res.json({ type: 'message', text: 'Unknown command. Try `help`.' });
  } catch (error) {
    res.status(500).json({ type: 'message', text: 'Error processing Teams webhook.' });
  }
});

/** GET /config — admin read slack/teams config */
router.get('/config', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('integrations.slackApp'), async (req, res) => {
  try {
    const config = await IntegrationConfig.findOne({
      organizationId: req.user.organizationId,
      category: 'slack_app'
    }).select('provider isActive settings updatedAt');
    res.json({ success: true, data: config || null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PUT /config — save slack app credentials */
router.put('/config', verifyToken, requireOrganization, tenantScope, requireAdmin, requireFeature('integrations.slackApp'), async (req, res) => {
  try {
    const { botToken, signingSecret, teamId, provider } = req.body;
    let config = await IntegrationConfig.findOne({
      organizationId: req.user.organizationId,
      category: 'slack_app'
    });

    if (!config) {
      config = new IntegrationConfig({
        organizationId: req.user.organizationId,
        category: 'slack_app',
        provider: provider || 'slack'
      });
    }

    const existing = config.getDecryptedCredentials();
    config.credentials = {
      ...existing,
      ...(botToken ? { botToken } : {}),
      ...(signingSecret ? { signingSecret } : {})
    };
    config.provider = provider || config.provider || 'slack';
    config.isActive = true;
    if (teamId) config.metadata = { ...(config.metadata || {}), teamId };
    await config.save();

    res.json({ success: true, data: { provider: config.provider, isActive: config.isActive, teamId: config.metadata?.teamId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
