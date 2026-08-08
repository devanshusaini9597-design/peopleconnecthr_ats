/**
 * Generate new secrets for rotation. Does NOT modify .env automatically.
 * Usage: node scripts/rotate-secrets.js
 *
 * Then manually update:
 * - MongoDB Atlas user password (if previously leaked)
 * - backend/.env JWT_SECRET / INTEGRATION_ENCRYPTION_KEY
 * - Vercel/Render env vars
 */
const crypto = require('crypto');

console.log('=== SkillNix secret rotation helpers ===\n');
console.log('JWT_SECRET=' + crypto.randomBytes(32).toString('hex'));
console.log('INTEGRATION_ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
console.log('DEMO_PASSWORD_SUGGESTION=' + crypto.randomBytes(9).toString('base64url') + 'Aa1!');
console.log('\nNOTE: This folder has no .git history scrub target.');
console.log('If secrets were ever committed elsewhere, rotate Atlas + JWT immediately.');
console.log('Do NOT commit .env. Pre-commit hook blocks .env files.');
