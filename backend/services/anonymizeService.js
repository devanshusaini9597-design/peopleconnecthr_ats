/**
 * Anonymize Service — strips PII from resume text / candidate views.
 * Regex/heuristic-based (not LLM). Optional AI assist can be layered in routes.
 */

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g;
const URL_RE = /https?:\/\/[^\s]+/gi;
const PHOTO_URL_RE = /https?:\/\/[^\s]*(?:photo|avatar|profile|linkedin\.com\/in)[^\s]*/gi;

const SCHOOL_PATTERNS = [
  /\b(?:university|college|institute|school|academy)\s+of\s+[A-Z][\w\s,&.-]{2,60}/gi,
  /\b[A-Z][\w\s&.-]{2,40}\s+(?:University|College|Institute|School|Academy)\b/g,
  /\b(?:IIT|NIT|IIIT|BITS|MIT|Stanford|Harvard|Oxford|Cambridge)\b[\w\s,-]*/gi
];

const REDACT = '[REDACTED]';

const stripName = (text, name) => {
  if (!name || !text) return text;
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  let out = text;
  for (const part of parts) {
    if (part.length < 2) continue;
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), REDACT);
  }
  return out;
};

/**
 * @param {string} text Raw resume or profile text
 * @param {{ name?: string }} [options] Known candidate name to redact
 * @returns {{ anonymizedText: string, redactions: string[] }}
 */
const anonymizeText = (text, options = {}) => {
  if (!text || typeof text !== 'string') {
    return { anonymizedText: '', redactions: [] };
  }

  const redactions = [];
  let out = text;

  if (options.name) {
    const before = out;
    out = stripName(out, options.name);
    if (out !== before) redactions.push('name');
  }

  if (EMAIL_RE.test(out)) {
    out = out.replace(EMAIL_RE, '[EMAIL]');
    redactions.push('email');
  }
  EMAIL_RE.lastIndex = 0;

  if (PHONE_RE.test(out)) {
    out = out.replace(PHONE_RE, '[PHONE]');
    redactions.push('phone');
  }

  if (PHOTO_URL_RE.test(out)) {
    out = out.replace(PHOTO_URL_RE, '[PHOTO_URL]');
    redactions.push('photo_url');
  }
  PHOTO_URL_RE.lastIndex = 0;

  for (const pattern of SCHOOL_PATTERNS) {
    if (pattern.test(out)) {
      out = out.replace(pattern, '[SCHOOL]');
      if (!redactions.includes('school')) redactions.push('school');
    }
    pattern.lastIndex = 0;
  }

  if (URL_RE.test(out)) {
    out = out.replace(URL_RE, '[URL]');
    if (!redactions.includes('url')) redactions.push('url');
  }
  URL_RE.lastIndex = 0;

  return { anonymizedText: out.trim(), redactions: [...new Set(redactions)] };
};

/**
 * Build anonymized view of a candidate document (fields only, no _id change).
 */
const anonymizeCandidate = (candidate) => {
  const doc = candidate.toObject ? candidate.toObject() : { ...candidate };
  const { anonymizedText } = anonymizeText(doc.resumeText || '', { name: doc.name });

  return {
    ...doc,
    name: REDACT,
    email: '[EMAIL]',
    contact: '[PHONE]',
    phone: '[PHONE]',
    resume: '',
    anonymizedResumeText: anonymizedText,
    redactedFields: ['name', 'email', 'contact', 'phone', 'resume']
  };
};

module.exports = { anonymizeText, anonymizeCandidate, REDACT };
