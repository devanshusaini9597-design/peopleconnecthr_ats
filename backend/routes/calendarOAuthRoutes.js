/**
 * Google Calendar OAuth — per-organization refresh-token flow.
 *
 * Flow:
 *  1. Org admin calls GET /api/integrations/oauth/google-calendar/auth-url
 *     (authenticated) — returns a Google consent URL with a short-lived
 *     signed `state` token identifying the org + admin.
 *  2. Admin visits that URL, grants calendar access.
 *  3. Google redirects the browser to GET /oauth/google-calendar/callback
 *     (public — Google calls this directly, no Authorization header).
 *     We verify the signed state, exchange the code for a refresh token,
 *     and upsert an IntegrationConfig (category 'calendar', provider
 *     'google') for that org — credentials are encrypted at rest via the
 *     model's pre-save hook.
 *
 * Requires env vars: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET.
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

const redirectUri = () => (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '') + '/oauth/google-calendar/callback';

// ─── GET /api/integrations/oauth/google-calendar/auth-url ───
router.get('/auth-url', verifyToken, requireOrganization, tenantScope, requireAdmin, async (req, res) => {
  const clientId = (process.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim();
  if (!clientId) {
    return res.status(400).json({ success: false, message: 'GOOGLE_CALENDAR_CLIENT_ID not set in backend/.env' });
  }

  const org = await Organization.findById(req.user.organizationId).select('plan');
  if (!org || !planHasFeature(org.plan, 'integrations.calendar')) {
    return res.status(403).json({ success: false, code: 'UPGRADE_REQUIRED', message: 'Your plan does not include Calendar integration.', feature: 'integrations.calendar' });
  }

  // Short-lived signed state — proves this request originated from an
  // authenticated admin of this org, since Google's callback carries no auth.
  const state = jwt.sign({ organizationId: req.user.organizationId, adminId: req.user.id, purpose: 'google_calendar_oauth' }, JWT_SECRET, { expiresIn: '15m' });

  const scope = 'https://www.googleapis.com/auth/calendar.events';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state
  }).toString()}`;

  res.json({ success: true, authUrl });
});

// ─── GET /oauth/google-calendar/callback?code=&state= (public, mounted separately in server.js) ───
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Google denied access: ${error}`);
  }
  if (!code || !state) {
    return res.status(400).send('Missing code or state.');
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET);
    if (payload.purpose !== 'google_calendar_oauth') throw new Error('Invalid state purpose');
  } catch (err) {
    return res.status(400).send('Invalid or expired state — please restart the connection flow from Integration Settings.');
  }

  const clientId = (process.env.GOOGLE_CALENDAR_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    return res.status(500).send('GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET not set in backend/.env');
  }

  try {
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code'
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const { refresh_token: refreshToken, access_token: accessToken } = tokenResponse.data;
    if (!refreshToken) {
      return res.status(500).send('Google did not return a refresh_token. Disconnect any prior authorization for this app in your Google Account and try again (prompt=consent should normally prevent this).');
    }

    let config = await IntegrationConfig.findOne({ organizationId: payload.organizationId, provider: 'google' });
    const isNew = !config;
    if (!config) {
      config = new IntegrationConfig({ organizationId: payload.organizationId, provider: 'google', category: 'calendar' });
    }
    config.category = 'calendar';
    config.displayName = config.displayName || 'Google Calendar';
    config.credentials = { clientId, clientSecret, refreshToken, calendarId: 'primary' };
    config.isActive = true;
    config.isValidated = false;
    config.configuredBy = config.configuredBy || payload.adminId;
    config.lastModifiedBy = payload.adminId;
    config.auditLog.push({ action: isNew ? 'created' : 'updated', performedBy: payload.adminId, details: 'Connected via Google OAuth' });
    await config.save();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Google Calendar Connected</title></head>
<body style="font-family: system-ui; max-width: 640px; margin: 40px auto; padding: 20px;">
  <h1>✅ Google Calendar connected</h1>
  <p>You can close this tab and return to Integration Settings — the connection is saved and active.</p>
</body>
</html>
    `);
  } catch (err) {
    const msg = err.response?.data?.error_description || err.message;
    console.error('[Google Calendar OAuth] Token exchange failed:', msg);
    res.status(500).send(`Token exchange failed: ${msg}`);
  }
});

module.exports = router;
