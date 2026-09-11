/**
 * Per-user notification preferences — enterprise channel matrix + quiet hours.
 */
const User = require('../models/User');
const {
  NOTIFICATION_CATEGORIES,
  TYPE_TO_CATEGORY,
  defaultNotificationPreferences,
} = require('../config/notificationPreferences');
const { getManager } = require('../utils/reportingScope');
const {
  resolveEmployeeSpocLabel,
  loadOrgEmployeeNames,
  firstNameOf,
} = require('../utils/spocIdentity');

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object') {
      out[key] = deepMerge(base[key], val);
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  return out;
}

function categoryForType(type) {
  return TYPE_TO_CATEGORY[type] || 'teamActivity';
}

function parseHm(str) {
  const m = String(str || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function minutesInTimezone(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    return hour * 60 + minute;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

function isQuietHours(prefs, now = new Date(), { priority } = {}) {
  const q = prefs?.quietHours;
  if (!q?.enabled) return false;
  if (priority === 'urgent') return false;

  const start = parseHm(q.start);
  const end = parseHm(q.end);
  if (start == null || end == null) return false;

  const cur = minutesInTimezone(now, q.timezone);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

async function getMergedPreferences(userId) {
  const user = await User.findById(userId).select('notificationPreferences').lean();
  return deepMerge(defaultNotificationPreferences(), user?.notificationPreferences || {});
}

async function getPreferences(userId) {
  const preferences = await getMergedPreferences(userId);
  return { preferences, categories: NOTIFICATION_CATEGORIES };
}

function sanitizePreferences(input) {
  const defaults = defaultNotificationPreferences();
  const out = deepMerge(defaults, {});

  if (input?.channels && typeof input.channels === 'object') {
    for (const cat of NOTIFICATION_CATEGORIES) {
      const row = input.channels[cat];
      if (!row || typeof row !== 'object') continue;
      out.channels[cat] = {
        inApp: row.inApp !== false,
        email: row.email === true,
        push: row.push !== false,
      };
    }
  }

  if (input?.callbacks && typeof input.callbacks === 'object') {
    out.callbacks = {
      includeAsSpoc: input.callbacks.includeAsSpoc !== false,
      includeAsManager: input.callbacks.includeAsManager !== false,
      digestOnly: input.callbacks.digestOnly === true,
    };
  }

  if (input?.quietHours && typeof input.quietHours === 'object') {
    const q = input.quietHours;
    out.quietHours = {
      enabled: q.enabled === true,
      start: parseHm(q.start) != null ? q.start : defaults.quietHours.start,
      end: parseHm(q.end) != null ? q.end : defaults.quietHours.end,
      timezone: String(q.timezone || defaults.quietHours.timezone).slice(0, 64),
    };
  }

  return out;
}

async function updatePreferences(userId, patch) {
  const sanitized = sanitizePreferences(patch);
  await User.findByIdAndUpdate(userId, { $set: { notificationPreferences: sanitized } });
  return getPreferences(userId);
}

async function shouldDeliver(userId, type, channel = 'inApp', { priority } = {}) {
  if (!userId || !type) return false;
  if (type === 'system') return channel === 'inApp';

  const prefs = await getMergedPreferences(userId);
  const category = categoryForType(type);
  const row = prefs.channels?.[category];
  if (!row) return true;

  if (channel === 'inApp' && !row.inApp) return false;
  if (channel === 'email' && !row.email) return false;
  if (channel === 'push' && !row.push) return false;

  if ((channel === 'inApp' || channel === 'push') && isQuietHours(prefs, new Date(), { priority })) {
    return false;
  }

  return true;
}

async function findUserIdsBySpocLabel(organizationId, spocLabel) {
  if (!organizationId || !String(spocLabel || '').trim()) return [];
  const needle = String(spocLabel).trim().toLowerCase();
  const names = await loadOrgEmployeeNames(organizationId);
  const users = await User.find({
    organizationId,
    isActive: { $ne: false },
    role: { $ne: 'freelancer' },
  })
    .select('_id name email')
    .lean();

  const matched = [];
  for (const u of users) {
    const label = resolveEmployeeSpocLabel(u, names).toLowerCase();
    const first = firstNameOf(u.name).toLowerCase();
    const full = String(u.name || '').trim().toLowerCase();
    if (label === needle || first === needle || full === needle) {
      matched.push(String(u._id));
    }
  }
  return matched;
}

/**
 * Enterprise callback routing: owner + optional SPOC + optional manager.
 */
async function resolveCallbackRecipientIds(candidate) {
  const recipients = [];
  const seen = new Set();
  const createdBy = candidate.createdBy?.toString();

  const add = (userId, role) => {
    const id = String(userId || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    recipients.push({ userId: id, role });
  };

  if (createdBy) add(createdBy, 'owner');

  const spocIds = await findUserIdsBySpocLabel(candidate.organizationId, candidate.spoc);
  for (const id of spocIds) add(id, 'spoc');

  if (candidate.organizationId && createdBy) {
    const manager = await getManager(candidate.organizationId, createdBy);
    if (manager?._id) add(String(manager._id), 'manager');
  }

  const filtered = [];
  for (const r of recipients) {
    const prefs = await getMergedPreferences(r.userId);
    if (!prefs.channels?.callbacks?.inApp && !prefs.channels?.callbacks?.email) continue;
    if (r.role === 'spoc' && !prefs.callbacks?.includeAsSpoc) continue;
    if (r.role === 'manager' && !prefs.callbacks?.includeAsManager) continue;
    filtered.push(r.userId);
  }

  return filtered;
}

async function shouldSendCallbackEmail(userId) {
  const prefs = await getMergedPreferences(userId);
  return prefs.channels?.callbacks?.email === true;
}

async function shouldCreateCallbackInApp(userId, { daysRemaining, currentHour } = {}) {
  const prefs = await getMergedPreferences(userId);
  if (!prefs.channels?.callbacks?.inApp) return false;
  if (prefs.callbacks?.digestOnly) {
    return currentHour >= 7 && currentHour <= 9 && daysRemaining >= 0;
  }
  return true;
}

module.exports = {
  NOTIFICATION_CATEGORIES,
  categoryForType,
  getPreferences,
  updatePreferences,
  sanitizePreferences,
  shouldDeliver,
  isQuietHours,
  resolveCallbackRecipientIds,
  shouldSendCallbackEmail,
  shouldCreateCallbackInApp,
  findUserIdsBySpocLabel,
};
