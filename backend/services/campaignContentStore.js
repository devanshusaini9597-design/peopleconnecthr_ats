/**
 * Short-lived public HTML for Zoho Campaigns content_url fetch.
 * Zoho must be able to GET this URL from the internet (BACKEND_URL).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TTL_MS = 60 * 60 * 1000; // 1 hour
const memory = new Map();
const DIR = path.join(__dirname, '..', 'uploads', 'campaign-content');

function ensureDir() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
  } catch (_) {}
}

function prune() {
  const now = Date.now();
  for (const [id, entry] of memory.entries()) {
    if (entry.expiresAt <= now) {
      memory.delete(id);
      try {
        fs.unlinkSync(path.join(DIR, `${id}.html`));
      } catch (_) {}
    }
  }
}

/**
 * @param {string} html
 * @returns {{ id: string, publicUrl: string }}
 */
function storeCampaignHtml(html) {
  prune();
  ensureDir();
  const id = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + TTL_MS;
  const body = String(html || '');
  memory.set(id, { html: body, expiresAt });
  try {
    fs.writeFileSync(path.join(DIR, `${id}.html`), body, 'utf8');
  } catch (err) {
    console.warn('[CampaignContent] disk write failed:', err.message);
  }

  const base = (
    process.env.EMAIL_LINKS_BACKEND_URL ||
    process.env.BACKEND_URL ||
    process.env.API_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (!base) {
    const err = new Error(
      'BACKEND_URL is required so Zoho can fetch campaign HTML (content_url).'
    );
    err.code = 'CAMPAIGNS_CONTENT_URL';
    throw err;
  }
  return {
    id,
    publicUrl: `${base}/api/public/campaign-content/${id}`,
  };
}

/**
 * @param {string} id
 * @returns {string|null}
 */
function getCampaignHtml(id) {
  if (!id || !/^[a-f0-9]{32}$/i.test(id)) return null;
  const entry = memory.get(id);
  if (entry) {
    if (entry.expiresAt <= Date.now()) {
      memory.delete(id);
      return null;
    }
    return entry.html;
  }
  try {
    const filePath = path.join(DIR, `${id}.html`);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
}

module.exports = {
  storeCampaignHtml,
  getCampaignHtml,
};
