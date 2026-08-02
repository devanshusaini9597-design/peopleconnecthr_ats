/**
 * Outlook / Microsoft Graph Calendar OAuth — per-organization refresh-token flow.
 * Mirrors google-calendar OAuth in calendarOAuthRoutes.js.
 *
 * Env: OUTLOOK_CALENDAR_CLIENT_ID, OUTLOOK_CALENDAR_CLIENT_SECRET,
 *      OUTLOOK_CALENDAR_TENANT (default 'common')
 */
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const IntegrationConfig = require('../models/IntegrationConfig');
const Organization = require('../models/Organization');

const tenant = () => (process.env.OUTLOOK_CALENDAR_TENANT || 'common').trim();
const redirectUri = () =>
  (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '') +
  '/oauth/outlook-calendar/callback';

const SCOPES = [
  'offline_access',
  'Calendars.ReadWrite',
  'User.Read'
].join(' ');

router.get('/auth-url', verifyToken, requireOrganization, tenantScope, requireAdmin, async (req, res) => {
  const clientId = (process.env.OUTLOOK_CALENDAR_CLIENT_ID || '').trim();
  if (!clientId) {
    return res.status(400).json({
      success: false,
      message: 'OUTLOOK_CALENDAR_CLIENT_ID not set in backend/.env'
    });
  }

  const org = await Organization.findById(req.user.organizationId).select('plan');
  if (!org || !planHasFeature(org.plan, 'integrations.calendar')) {
    return res.status(403).json({
      success: false,
      code: 'UPGRADE_REQUIRED',
      message: 'Your plan does not include Calendar integration.',
      feature: 'integrations.calendar'
    });
  }

  const state = jwt.sign(
    { organizationId: req.user.organizationId, adminId: req.user.id, purpose: 'outlook_calendar_oauth' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const authUrl = `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'consent'
  }).toString()}`;

  res.json({ success: true, authUrl });
});

router.get('/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    return res.status(400).send(`Microsoft denied access: ${error}${errorDescription ? ` — ${errorDescription}` : ''}`);
  }
  if (!code || !state) {
    return res.status(400).send('Missing code or state.');
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET);
    if (payload.purpose !== 'outlook_calendar_oauth') throw new Error('Invalid state purpose');
  } catch {
    return res.status(400).send('Invalid or expired state — restart the connection from Integration Settings.');
  }

  const clientId = (process.env.OUTLOOK_CALENDAR_CLIENT_ID || '').trim();
  const clientSecret = (process.env.OUTLOOK_CALENDAR_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    return res.status(500).send('OUTLOOK_CALENDAR_CLIENT_ID / OUTLOOK_CALENDAR_CLIENT_SECRET not set.');
  }

  try {
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: String(code),
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
        scope: SCOPES
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const { refresh_token: refreshToken, access_token: accessToken } = tokenResponse.data;
    if (!refreshToken && !accessToken) {
      return res.status(500).send('Microsoft did not return tokens. Try again with admin consent.');
    }

    let config = await IntegrationConfig.findOne({
      organizationId: payload.organizationId,
      provider: 'outlook',
      category: 'calendar'
    });
    const isNew = !config;
    if (!config) {
      config = new IntegrationConfig({
        organizationId: payload.organizationId,
        provider: 'outlook',
        category: 'calendar'
      });
    }
    config.displayName = config.displayName || 'Outlook Calendar';
    config.credentials = {
      clientId,
      clientSecret,
      refreshToken: refreshToken || '',
      accessToken: accessToken || '',
      tenant: tenant(),
      calendarId: 'primary'
    };
    config.isActive = true;
    config.isValidated = false;
    config.configuredBy = config.configuredBy || payload.adminId;
    config.lastModifiedBy = payload.adminId;
    config.auditLog.push({
      action: isNew ? 'created' : 'updated',
      performedBy: payload.adminId,
      details: 'Connected via Microsoft OAuth'
    });
    await config.save();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Outlook Connected</title></head>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:20px">
<h1>Outlook Calendar connected</h1>
<p>You can close this tab and return to Integration Settings.</p>
</body></html>`);
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    console.error('[Outlook Calendar OAuth] Token exchange failed:', msg);
    res.status(500).send(`Token exchange failed: ${msg}`);
  }
});

module.exports = router;
