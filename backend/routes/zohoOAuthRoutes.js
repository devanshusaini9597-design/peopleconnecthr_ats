/**
 * Zoho Campaigns OAuth — get refresh_token from auth code.
 * 1. Visit the auth URL (see .env comment or GET /oauth/zoho/auth-url).
 * 2. After Zoho redirects to /oauth/zoho/callback?code=..., this route exchanges code for tokens.
 * 3. Copy the refresh_token into backend .env as ZOHO_CAMPAIGNS_REFRESH_TOKEN.
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();

const TOKEN_URL = process.env.ZOHO_CAMPAIGNS_ACCOUNTS_URL || 'https://accounts.zoho.in/oauth/v2/token';

// ─── GET /oauth/zoho/auth-url — returns the URL to visit to start OAuth ───
router.get('/auth-url', (req, res) => {
  const clientId = (process.env.ZOHO_CAMPAIGNS_CLIENT_ID || '').trim();
  const redirectUri = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).trim().replace(/\/$/, '') + '/oauth/zoho/callback';
  if (!clientId) {
    return res.status(400).json({
      success: false,
      message: 'ZOHO_CAMPAIGNS_CLIENT_ID not set in .env'
    });
  }
  const scope = 'ZohoCampaigns.contact.CREATE,ZohoCampaigns.contact.READ,ZohoCampaigns.contact.UPDATE';
  const authUrl = `https://accounts.zoho.in/oauth/v2/auth?scope=${encodeURIComponent(scope)}&client_id=${encodeURIComponent(clientId)}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&prompt=consent`;
  res.json({ success: true, authUrl, redirectUri });
});

// ─── GET /oauth/zoho/callback?code=... — exchange code for tokens ───
router.get('/callback', async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!code) {
    return res.status(400).send('Missing code. Use the auth URL from /oauth/zoho/auth-url first.');
  }

  const clientId = (process.env.ZOHO_CAMPAIGNS_CLIENT_ID || '').trim();
  const clientSecret = (process.env.ZOHO_CAMPAIGNS_CLIENT_SECRET || '').trim();
  const redirectUri = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).trim().replace(/\/$/, '') + '/oauth/zoho/callback';

  if (!clientId || !clientSecret) {
    return res.status(500).send('ZOHO_CAMPAIGNS_CLIENT_ID and ZOHO_CAMPAIGNS_CLIENT_SECRET must be set in .env');
  }

  try {
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    );

    const data = response.data;
    const refreshToken = data.refresh_token || '';
    const accessToken = data.access_token || '';
    const scope = data.scope || '';

    if (!refreshToken) {
      return res.status(500).send('Zoho did not return a refresh_token. Try again with prompt=consent in the auth URL.');
    }

    // Show a simple HTML page with the refresh_token to copy into .env
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Zoho Campaigns — Refresh Token</title></head>
<body style="font-family: system-ui; max-width: 640px; margin: 40px auto; padding: 20px;">
  <h1>Zoho Campaigns OAuth</h1>
  <p>Copy the value below into <strong>backend .env</strong> as <code>ZOHO_CAMPAIGNS_REFRESH_TOKEN</code>, then restart the backend.</p>
  <pre style="background: #f1f5f9; padding: 16px; border-radius: 8px; overflow-x: auto; word-break: break-all;">${refreshToken}</pre>
  <p><small>Scope: ${scope || '—'}</small></p>
  <p><small>Access token (short-lived): ${accessToken ? accessToken.substring(0, 30) + '…' : '—'}</small></p>
</body>
</html>
    `);
  } catch (err) {
    const msg = err.response?.data?.error || err.response?.data?.message || err.message;
    console.error('[Zoho OAuth] Token exchange failed:', msg);
    res.status(500).send(`Token exchange failed: ${msg}`);
  }
});

module.exports = router;
