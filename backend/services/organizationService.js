/**
 * Organization domain — profile, members, candidate fields, audit.
 */
const Organization = require('../models/Organization');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getEntitlements, planHasFeature } = require('../config/planFeatures');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function getOrganization(organizationId) {
  const org = await Organization.findById(organizationId);
  if (!org) throw httpError('Organization not found', 404);
  return org;
}

async function updateOrganization(organizationId, body) {
  const { name, logo, domain, settings, atsSettings } = body;

  if (atsSettings && Object.prototype.hasOwnProperty.call(atsSettings, 'careersCustomDomain') && atsSettings.careersCustomDomain) {
    const currentOrg = await Organization.findById(organizationId).select('plan');
    if (!currentOrg || !planHasFeature(currentOrg.plan, 'careers.customDomain')) {
      throw httpError('Custom domain careers pages require the Enterprise plan.', 403, {
        code: 'UPGRADE_REQUIRED',
        feature: 'careers.customDomain',
      });
    }
  }

  if (atsSettings?.whiteLabel?.enabled) {
    const currentOrg = await Organization.findById(organizationId).select('plan');
    if (!currentOrg || !planHasFeature(currentOrg.plan, 'whiteLabel')) {
      throw httpError('The White-Label Kit requires the Enterprise plan.', 403, {
        code: 'UPGRADE_REQUIRED',
        feature: 'whiteLabel',
      });
    }
  }

  if (atsSettings?.portalLocalization?.enabled) {
    const currentOrg = await Organization.findById(organizationId).select('plan');
    if (!currentOrg || !planHasFeature(currentOrg.plan, 'portal.localization')) {
      throw httpError(
        'Multi-locale candidate portal requires a plan that includes portal.localization.',
        403,
        { code: 'UPGRADE_REQUIRED', feature: 'portal.localization' }
      );
    }
  }

  const update = {};
  if (name !== undefined) update.name = name;
  if (logo !== undefined) update.logo = logo;
  if (domain !== undefined) update.domain = String(domain).trim().toLowerCase();
  if (settings !== undefined) update.settings = settings;
  if (atsSettings !== undefined) update.atsSettings = atsSettings;

  return Organization.findByIdAndUpdate(organizationId, { $set: update }, { new: true });
}

async function getCandidateFields(organizationId) {
  const { mergeCandidateFields } = require('../config/coreCandidateFields');
  const org = await Organization.findById(organizationId)
    .select('atsSettings.candidateFields atsSettings.coreFieldPrefs atsSettings.lastImportMapping')
    .lean();
  if (!org) throw httpError('Organization not found', 404);
  return {
    fields: mergeCandidateFields(org),
    lastImportMapping: org.atsSettings?.lastImportMapping || null,
  };
}

async function updateCandidateFields(organizationId, body) {
  const { CORE_KEYS, slugifyFieldKey, mergeCandidateFields } = require('../config/coreCandidateFields');
  const { customFields, coreFieldPrefs } = body || {};

  const cleaned = [];
  const seen = new Set();
  if (Array.isArray(customFields)) {
    for (let i = 0; i < customFields.length; i += 1) {
      const raw = customFields[i] || {};
      let key = String(raw.key || slugifyFieldKey(raw.label || '')).trim().toLowerCase();
      key = key.replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
      if (!key || CORE_KEYS.has(key) || seen.has(key)) continue;
      seen.add(key);
      cleaned.push({
        key,
        label: String(raw.label || key).trim().slice(0, 80),
        type: ['text', 'number', 'date', 'select', 'boolean'].includes(raw.type) ? raw.type : 'text',
        required: !!raw.required,
        options: Array.isArray(raw.options)
          ? raw.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 50)
          : [],
        showInTable: raw.showInTable !== false,
        showInForm: raw.showInForm !== false,
        importAliases: Array.isArray(raw.importAliases)
          ? raw.importAliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean).slice(0, 20)
          : [],
        order: typeof raw.order === 'number' ? raw.order : 1000 + i,
      });
    }
  }

  const prefs = {};
  if (coreFieldPrefs && typeof coreFieldPrefs === 'object') {
    Object.entries(coreFieldPrefs).forEach(([k, v]) => {
      if (!CORE_KEYS.has(k) || !v || typeof v !== 'object') return;
      prefs[k] = {};
      if (v.showInTable !== undefined) prefs[k].showInTable = !!v.showInTable;
      if (v.showInForm !== undefined) prefs[k].showInForm = !!v.showInForm;
    });
  }

  const update = { 'atsSettings.candidateFields': cleaned };
  if (coreFieldPrefs !== undefined) {
    update['atsSettings.coreFieldPrefs'] = prefs;
  }

  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: update },
    { new: true }
  ).select('atsSettings.candidateFields atsSettings.coreFieldPrefs atsSettings.lastImportMapping');

  return {
    fields: mergeCandidateFields(org),
    lastImportMapping: org.atsSettings?.lastImportMapping || null,
  };
}

async function saveLastImportMapping(organizationId, body) {
  const { headers, map } = body || {};
  const lastImportMapping = {
    headers: Array.isArray(headers) ? headers.map((h) => String(h || '')).slice(0, 200) : [],
    map: map && typeof map === 'object' ? map : {},
    savedAt: new Date(),
  };
  await Organization.findByIdAndUpdate(organizationId, {
    $set: { 'atsSettings.lastImportMapping': lastImportMapping },
  });
  return lastImportMapping;
}

async function listMembers(organizationId) {
  return User.find({ organizationId }).select('-password');
}

async function updateMemberRole(organizationId, actorUserId, targetUserId, body) {
  const { role, customRoleId } = body;
  if (targetUserId === actorUserId.toString()) {
    throw httpError('Cannot change your own role');
  }

  const update = {};
  if (role !== undefined) update.role = role;
  if (customRoleId !== undefined) {
    if (customRoleId) {
      const CustomRole = require('../models/CustomRole');
      const pack = await CustomRole.findOne({ _id: customRoleId, organizationId });
      if (!pack) throw httpError('Custom role not found');
      update.customRoleId = pack._id;
    } else {
      update.customRoleId = null;
    }
  }

  const user = await User.findOneAndUpdate(
    { _id: targetUserId, organizationId },
    { $set: update },
    { new: true }
  ).select('-password');

  if (!user) throw httpError('User not found in organization', 404);
  return user;
}

async function removeMember(organizationId, actorUserId, targetUserId) {
  if (targetUserId === actorUserId.toString()) {
    throw httpError('Cannot remove yourself');
  }
  const userToRemove = await User.findOne({ _id: targetUserId, organizationId });
  if (!userToRemove) throw httpError('User not found', 404);
  if (userToRemove.role === 'owner') throw httpError('Cannot remove owner', 403);

  await User.findByIdAndDelete(targetUserId);
  return { message: 'User removed from organization' };
}

async function getUsage(organizationId) {
  const org = await Organization.findById(organizationId);
  return org.usageCurrent;
}

async function getOrgEntitlements(organizationId) {
  const org = await Organization.findById(organizationId).select('plan');
  if (!org) throw httpError('Organization not found', 404);
  return { plan: org.plan, entitlements: getEntitlements(org.plan) };
}

function buildAuditLogFilter(organizationId, query) {
  const filter = { organizationId };
  if (query.action) filter.action = query.action;
  if (query.resource) filter.resource = query.resource;
  if (query.userId) filter.userId = query.userId;
  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    if (query.startDate) filter.timestamp.$gte = new Date(query.startDate);
    if (query.endDate) filter.timestamp.$lte = new Date(query.endDate);
  }
  return filter;
}

async function listAuditLog(organizationId, query) {
  const filter = buildAuditLogFilter(organizationId, query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));

  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return {
    data: entries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

async function distinctAuditFields(organizationId) {
  const [actions, resources] = await Promise.all([
    AuditLog.distinct('action', { organizationId }),
    AuditLog.distinct('resource', { organizationId }),
  ]);
  return { actions: actions.sort(), resources: resources.sort() };
}

async function exportAuditLogCsv(organizationId, query) {
  const filter = buildAuditLogFilter(organizationId, query);
  const entries = await AuditLog.find(filter)
    .sort({ timestamp: -1 })
    .limit(10000)
    .populate('userId', 'name email')
    .lean();

  const escapeCsv = (value) => {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const header = ['Timestamp', 'Action', 'Resource', 'Resource ID', 'User', 'Email', 'IP Address', 'Details'];
  const rows = entries.map((e) =>
    [
      e.timestamp?.toISOString?.() || '',
      e.action,
      e.resource,
      e.resourceId || '',
      e.userId?.name || '',
      e.userId?.email || '',
      e.ipAddress || '',
      e.details,
    ]
      .map(escapeCsv)
      .join(',')
  );

  const csv = [header.map(escapeCsv).join(','), ...rows].join('\n');

  try {
    const { getAdapter } = require('../adapters');
    const siem = await getAdapter(organizationId, 'siem');
    if (siem && typeof siem.shipEvents === 'function') {
      await siem.shipEvents(
        entries.slice(0, 500).map((e) => ({
          timestamp: e.timestamp?.toISOString?.() || new Date().toISOString(),
          action: e.action,
          resource: e.resource,
          resourceId: e.resourceId,
          user: e.userId?.email || e.userId?.name,
          ipAddress: e.ipAddress,
        }))
      );
    }
  } catch (siemErr) {
    console.warn('[audit-export] SIEM ship failed:', siemErr.message);
  }

  return {
    csv,
    filename: `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

module.exports = {
  getOrganization,
  updateOrganization,
  getCandidateFields,
  updateCandidateFields,
  saveLastImportMapping,
  listMembers,
  updateMemberRole,
  removeMember,
  getUsage,
  getOrgEntitlements,
  listAuditLog,
  distinctAuditFields,
  exportAuditLogCsv,
};
