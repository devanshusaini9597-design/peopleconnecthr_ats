/**
 * Pure announcement rules: audience roles, HTML safety, targeting match, limits.
 * Kept free of mongoose so route behavior can be unit-tested.
 */

const TITLE_MAX = 140;
const BODY_MAX = 5000;
const ATTACHMENT_MAX = 3;
const ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** People who can open Announcements. Interviewer, readonly, and other are not in any bucket. */
const STAFF_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];
const ADMIN_ROLES = ['owner', 'admin', 'hr_manager'];
const AUDIENCES = ['all', 'admins', 'recruiters', 'freelancers', 'public'];
const SEVERITIES = ['info', 'success', 'warning', 'critical'];

function rolesForAudience(audience) {
  if (audience === 'admins') return [...ADMIN_ROLES];
  if (audience === 'recruiters') return [...STAFF_ROLES];
  if (audience === 'freelancers') return ['freelancer'];
  if (audience === 'public') return [];
  return [...STAFF_ROLES];
}

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function normList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const key = norm(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, 30);
}

function sanitizeAnnouncementHtml(input) {
  let html = String(input || '');
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<\/?(iframe|object|embed|link|meta|form|base)[^>]*>/gi, '');
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript:/gi, '');
  html = html.replace(/data:text\/html/gi, '');
  return html.trim();
}

function toPlainText(input) {
  return String(input || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function validateAnnouncementContent({ title, body }) {
  const safeTitle = String(title || '').trim();
  const safeBody = sanitizeAnnouncementHtml(body);
  const plain = toPlainText(safeBody);
  if (!safeTitle || !plain) {
    return { error: 'Title and message are required' };
  }
  if (safeTitle.length > TITLE_MAX) {
    return { error: `Title must be ${TITLE_MAX} characters or fewer` };
  }
  if (plain.length > BODY_MAX) {
    return { error: `Message must be ${BODY_MAX} characters or fewer` };
  }
  return { title: safeTitle, body: safeBody, plain };
}

function parseWhen(value) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: 'Invalid date' };
  return date;
}

/**
 * A person matches when every non-empty dimension matches.
 * profile: { id, reportsTo, department, location, office }
 */
function userMatchesTargets(profile, targets = {}) {
  const departments = normList(targets.departments);
  const locations = normList(targets.locations);
  const offices = normList(targets.offices);
  const teams = (Array.isArray(targets.teamManagerIds) ? targets.teamManagerIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);

  if (departments.length && !departments.includes(norm(profile?.department))) return false;
  if (locations.length && !locations.includes(norm(profile?.location))) return false;
  if (offices.length && !offices.includes(norm(profile?.office))) return false;
  if (teams.length) {
    const id = String(profile?.id || '');
    const manager = String(profile?.reportsTo || '');
    if (!teams.includes(id) && !teams.includes(manager)) return false;
  }
  return true;
}

function cleanLabels(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const label = String(value || '').trim().slice(0, 80);
    const key = norm(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.slice(0, 30);
}

function cleanIdList(values) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const id = String(value || '').trim();
    if (!/^[a-fA-F0-9]{24}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(0, 30);
}

function hasTargets(targets = {}) {
  return Boolean(
    normList(targets.departments).length
    || normList(targets.locations).length
    || normList(targets.offices).length
    || (Array.isArray(targets.teamManagerIds) && targets.teamManagerIds.length)
  );
}

module.exports = {
  TITLE_MAX,
  BODY_MAX,
  ATTACHMENT_MAX,
  ATTACHMENT_BYTES,
  STAFF_ROLES,
  ADMIN_ROLES,
  AUDIENCES,
  SEVERITIES,
  rolesForAudience,
  norm,
  normList,
  sanitizeAnnouncementHtml,
  toPlainText,
  validateAnnouncementContent,
  parseWhen,
  userMatchesTargets,
  cleanLabels,
  cleanIdList,
  hasTargets,
};
