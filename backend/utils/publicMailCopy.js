/**
 * Customer-facing mail copy. The delivery vendor stays an implementation
 * detail; product screens and API messages must not name it.
 */
function publicMailError(message) {
  let text = String(message || '').trim();
  if (!text) return 'Mail could not be sent. Try again, or check Email settings.';
  text = text
    .replace(/zoho\s*campaigns/gi, 'campaign mail')
    .replace(/zoho\s*zeptomail/gi, 'organization mail')
    .replace(/zeptomail/gi, 'organization mail')
    .replace(/ZOHO_[A-Z0-9_]+/g, 'mail settings')
    .replace(/\bZoho\b/g, 'the mail service')
    .replace(/platform mail/gi, 'organization mail');
  return text;
}

function publicMailProvider(provider, channel) {
  const raw = String(provider || '').toLowerCase();
  if (channel === 'marketing' || /campaign/.test(raw)) return 'Campaigns';
  if (/zepto|zoho|smtp|transaction/.test(raw) || !raw) return 'Organization mail';
  return 'Organization mail';
}

module.exports = { publicMailError, publicMailProvider };
