require('dotenv').config();
const axios = require('axios');

const rawKey = process.env.ZOHO_ZEPTOMAIL_API_KEY;
const fromEmail = process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL;
const apiUrl = process.env.ZOHO_ZEPTOMAIL_API_URL || 'https://api.zeptomail.com/';

console.log('--- ZeptoMail Direct Test ---');
console.log('Raw key from .env (first 20 chars):', rawKey?.substring(0, 20));
console.log('Raw key length:', rawKey?.length);
console.log('From email:', fromEmail);
console.log('API URL:', apiUrl);

const authHeader = rawKey?.startsWith('Zoho-enczapikey') ? rawKey : `Zoho-enczapikey ${rawKey}`;
console.log('Auth header (first 30 chars):', authHeader.substring(0, 30));
console.log('Auth header total length:', authHeader.length);

const endpoint = `${apiUrl}v1.1/email`;
console.log('Endpoint:', endpoint);
console.log('---');

(async () => {
  try {
    const res = await axios.post(endpoint, {
      from: { address: fromEmail, name: 'Skillnix Test' },
      to: [{ email_address: { address: fromEmail, name: 'Test' } }],
      subject: 'ZeptoMail Direct Test',
      htmlbody: '<p>If you receive this, ZeptoMail API is working correctly.</p>'
    }, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    console.log('SUCCESS:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('FAILED:', err.response?.status, JSON.stringify(err.response?.data, null, 2));
  }
})();
