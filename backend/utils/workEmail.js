/**
 * Enterprise work-email validation — block free/personal providers at signup.
 */

const FREE_EMAIL_DOMAINS = new Set([
  // Google
  'gmail.com', 'googlemail.com', 'google.com',
  // Microsoft
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'hotmail.fr',
  'live.com', 'live.in', 'msn.com', 'passport.com',
  // Yahoo
  'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'ymail.com', 'rocketmail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Proton / privacy
  'proton.me', 'protonmail.com', 'pm.me', 'tutanota.com', 'tutamail.com',
  // AOL / others
  'aol.com', 'aim.com', 'zoho.com', 'zohomail.com',
  'mail.com', 'email.com', 'usa.com',
  'gmx.com', 'gmx.net', 'gmx.de',
  'fastmail.com', 'fastmail.fm',
  'yandex.com', 'yandex.ru',
  'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',
  'rediffmail.com', 'rediff.com',
  'inbox.com', 'hushmail.com',
  // Disposable / temp (common)
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.org', '10minutemail.com',
  'tempmail.com', 'throwaway.email', 'yopmail.com', 'sharklasers.com',
  'trashmail.com', 'discard.email', 'temp-mail.org', 'getnada.com',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getEmailDomain(email) {
  const normalized = String(email || '').toLowerCase().trim();
  const at = normalized.lastIndexOf('@');
  if (at < 0) return '';
  return normalized.slice(at + 1);
}

/**
 * @returns {{ valid: boolean, reason?: string, code?: string }}
 */
function validateWorkEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized) {
    return { valid: false, reason: 'Work email is required', code: 'email_required' };
  }
  if (!EMAIL_RE.test(normalized)) {
    return { valid: false, reason: 'Invalid email format', code: 'email_invalid' };
  }

  const domain = getEmailDomain(normalized);
  if (!domain || !domain.includes('.')) {
    return { valid: false, reason: 'Invalid email domain', code: 'email_invalid' };
  }

  // Reject obviously bad domains (no TLD length, numeric-only TLD handled loosely)
  const parts = domain.split('.');
  if (parts.some((p) => !p) || parts[parts.length - 1].length < 2) {
    return { valid: false, reason: 'Invalid email domain', code: 'email_invalid' };
  }

  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Please use your work email. Personal email providers (Gmail, Yahoo, Outlook, etc.) are not allowed.',
      code: 'personal_email_not_allowed',
    };
  }

  return { valid: true };
}

module.exports = {
  FREE_EMAIL_DOMAINS,
  validateWorkEmail,
  getEmailDomain,
};
