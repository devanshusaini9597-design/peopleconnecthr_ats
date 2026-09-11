/**
 * Upsert a ZeptoMail mailbox for a verified domain.
 *
 * Usage:
 *   node scripts/upsert-zepto-mailbox.js skillnixrecruitment
 *
 * Reads credentials from env:
 *   MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM
 *   MAIL_PROFILE_SKILLNIXRECRUITMENT_API_KEY
 *   MAIL_PROFILE_SKILLNIXRECRUITMENT_API_URL
 *   MAIL_PROFILE_SKILLNIXRECRUITMENT_ALLOWED
 *   MAIL_PROFILE_SKILLNIXRECRUITMENT_MATCH
 *   MAIL_PROFILE_SKILLNIXRECRUITMENT_AGENT_ALIAS
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const PROFILE = (process.argv[2] || 'skillnixrecruitment').toLowerCase();

const PROFILES = {
  skillnixrecruitment: {
    key: 'skillnixrecruitment',
    fromEnv: 'MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM',
    keyEnv: 'MAIL_PROFILE_SKILLNIXRECRUITMENT_API_KEY',
    urlEnv: 'MAIL_PROFILE_SKILLNIXRECRUITMENT_API_URL',
    allowedEnv: 'MAIL_PROFILE_SKILLNIXRECRUITMENT_ALLOWED',
    matchEnv: 'MAIL_PROFILE_SKILLNIXRECRUITMENT_MATCH',
    agentEnv: 'MAIL_PROFILE_SKILLNIXRECRUITMENT_AGENT_ALIAS',
    defaults: {
      fromEmail: 'noreply@skillnixrecruitment.com',
      allowedFromDomains: ['skillnixrecruitment.com'],
      matchDomains: ['skillnixrecruitment.com', 'skillnix.com'],
      apiUrl: 'https://api.zeptomail.in/',
      agentAlias: '55325c17f6c9da39',
    },
  },
};

async function main() {
  const profile = PROFILES[PROFILE];
  if (!profile) {
    console.error(`Unknown profile "${PROFILE}". Known: ${Object.keys(PROFILES).join(', ')}`);
    process.exit(1);
  }

  const apiKey = (process.env[profile.keyEnv] || '').trim();
  const fromEmail = (process.env[profile.fromEnv] || profile.defaults.fromEmail || '').trim().toLowerCase();
  const apiUrl = (process.env[profile.urlEnv] || profile.defaults.apiUrl || 'https://api.zeptomail.in/').replace(/\/?$/, '/');
  const agentAlias = (process.env[profile.agentEnv] || profile.defaults.agentAlias || '').trim();
  const allowedFromDomains = String(process.env[profile.allowedEnv] || profile.defaults.allowedFromDomains.join(','))
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const matchDomains = String(process.env[profile.matchEnv] || profile.defaults.matchDomains.join(','))
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!apiKey || !fromEmail) {
    console.error(`Missing ${profile.keyEnv} or ${profile.fromEnv} in .env`);
    process.exit(1);
  }

  const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!mongoUrl) {
    console.error('MONGODB_URL missing');
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  const ZeptoMailbox = require('../models/ZeptoMailbox');

  const doc = await ZeptoMailbox.findOneAndUpdate(
    { key: profile.key },
    {
      key: profile.key,
      fromEmail,
      apiKey,
      apiUrl,
      agentAlias,
      allowedFromDomains,
      matchDomains,
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log('Upserted Zepto mailbox:', {
    key: doc.key,
    fromEmail: doc.fromEmail,
    apiUrl: doc.apiUrl,
    agentAlias: doc.agentAlias,
    allowedFromDomains: doc.allowedFromDomains,
    matchDomains: doc.matchDomains,
    apiKeyMasked: `${apiKey.slice(0, 18)}…`,
  });

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) { /* ignore */ }
  process.exit(1);
});
