/**
 * People Connect HR platform ops — tenants, plans, demo, unfinished-module flags.
 * Only isPlatformOperator (product team), never a customer tenant.
 */
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const { isPlatformOperator } = require('../utils/orgDomain');
const { isVendorProtectedOrg } = require('../utils/vendorDomains');
const { applyPlanLimits } = require('../config/planLimits');
const { INTERNAL_PREVIEW_FEATURES } = require('../config/planFeatures');
const { DEMO_ORG_SLUG, demoEnabled } = require('../services/demoWorkspaceService');

const PLANS = ['free_trial', 'starter', 'professional', 'enterprise'];
const PLATFORM_DOMAIN = 'peopleconnecthr.com';

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function assertPlatformOperator(user) {
  if (!isPlatformOperator(user)) {
    throw httpError('Only the People Connect HR platform team can open this dashboard', 403, {
      code: 'not_platform_operator',
    });
  }
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isCanonicalDemo(org) {
  return String(org?.slug || '').toLowerCase() === DEMO_ORG_SLUG;
}

function isPlatformWorkspace(org) {
  if (!org || org.isDemo) return false;
  return String(org.domain || '').toLowerCase() === PLATFORM_DOMAIN;
}

function tenantKind(org) {
  if (org?.isDemo || isCanonicalDemo(org)) return 'demo';
  if (isPlatformWorkspace(org)) return 'platform';
  return 'client';
}

function clientFilter() {
  return {
    isDemo: { $ne: true },
    domain: { $ne: PLATFORM_DOMAIN },
    slug: { $ne: DEMO_ORG_SLUG },
    archivedAt: null,
  };
}

function enabledModules(org) {
  if (org?.atsSettings?.internalPreview) return [...INTERNAL_PREVIEW_FEATURES];
  const list = org?.atsSettings?.previewModules;
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((key) => INTERNAL_PREVIEW_FEATURES.includes(key)))];
}

function applyModuleList(org, keys) {
  const next = [...new Set((keys || []).filter((key) => INTERNAL_PREVIEW_FEATURES.includes(key)))];
  if (!org.atsSettings) org.atsSettings = {};
  org.atsSettings.previewModules = next;
  org.atsSettings.internalPreview = next.length === INTERNAL_PREVIEW_FEATURES.length && next.length > 0;
  org.markModified('atsSettings');
}

async function countByOrg(model, ids, matchExtra = {}) {
  if (!ids.length) return new Map();
  const rows = await model.aggregate([
    { $match: { organizationId: { $in: ids }, ...matchExtra } },
    { $group: { _id: '$organizationId', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.n]));
}

async function userStatsByOrg(ids) {
  if (!ids.length) return new Map();
  const rows = await User.aggregate([
    { $match: { organizationId: { $in: ids } } },
    {
      $group: {
        _id: '$organizationId',
        userCount: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $ne: ['$isActive', false] }, 1, 0] } },
        lastActiveAt: { $max: '$lastActiveAt' },
        lastLoginAt: { $max: '$lastLoginAt' },
      },
    },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

function serializeTenant(org, extras = {}) {
  if (typeof extras === 'number') extras = { userCount: extras };
  const kind = tenantKind(org);
  const userCount = extras.userCount != null ? Number(extras.userCount) : 0;
  const row = {
    id: String(org._id),
    name: org.name || '',
    slug: org.slug || '',
    domain: org.domain || '',
    logo: org.logo || '',
    plan: org.plan || 'free_trial',
    planExpiresAt: org.planExpiresAt || null,
    isDemo: kind === 'demo',
    isCanonicalDemo: isCanonicalDemo(org),
    isVendorProtected: isVendorProtectedOrg(org),
    kind,
    archived: Boolean(org.archivedAt),
    internalPreview: Boolean(org.atsSettings?.internalPreview) || enabledModules(org).length === INTERNAL_PREVIEW_FEATURES.length,
    previewModules: enabledModules(org),
    userCount,
    activeUsers: Number(extras.activeUsers) || 0,
    openJobs: Number(extras.openJobs) || 0,
    candidates: Number(extras.candidates) || 0,
    lastActiveAt: extras.lastActiveAt || extras.lastLoginAt || null,
    ownerEmail: extras.ownerEmail || '',
    ownerName: extras.ownerName || '',
    createdAt: org.createdAt || null,
  };
  row.isEmptyShell = row.kind === 'client'
    && !row.isCanonicalDemo
    && row.openJobs === 0
    && row.candidates === 0
    && row.userCount <= 1;
  return row;
}

async function hydrateTenants(orgs) {
  const ids = orgs.map((o) => o._id);
  const ownerIds = orgs.map((o) => o.ownerId).filter(Boolean);
  const [userStats, openJobs, candidates, owners] = await Promise.all([
    userStatsByOrg(ids),
    countByOrg(Job, ids, { status: 'Open' }),
    countByOrg(Candidate, ids),
    ownerIds.length
      ? User.find({ _id: { $in: ownerIds } }).select('email name').lean()
      : [],
  ]);
  const ownerMap = new Map(owners.map((u) => [String(u._id), u]));
  return orgs.map((org) => {
    const stats = userStats.get(String(org._id)) || {};
    const owner = ownerMap.get(String(org.ownerId || ''));
    return serializeTenant(org, {
      userCount: stats.userCount,
      activeUsers: stats.activeUsers,
      lastActiveAt: stats.lastActiveAt,
      lastLoginAt: stats.lastLoginAt,
      openJobs: openJobs.get(String(org._id)),
      candidates: candidates.get(String(org._id)),
      ownerEmail: owner?.email,
      ownerName: owner?.name,
    });
  });
}

async function getDemoStatus() {
  const org = await Organization.findOne({
    $or: [{ slug: DEMO_ORG_SLUG }, { isDemo: true }],
  }).sort({ isDemo: -1, createdAt: 1 }).lean();

  if (!org) {
    return {
      available: demoEnabled(),
      presentationPath: '/demo',
      workspace: null,
    };
  }

  const [users, last] = await Promise.all([
    User.countDocuments({ organizationId: org._id, isDemo: true }),
    User.findOne({ organizationId: org._id, isDemo: true })
      .select('lastLoginAt lastActiveAt')
      .sort({ lastLoginAt: -1 })
      .lean(),
  ]);

  return {
    available: demoEnabled(),
    presentationPath: '/demo',
    workspace: {
      id: String(org._id),
      name: org.name || 'Sales demo',
      slug: org.slug || DEMO_ORG_SLUG,
      domain: org.domain || '',
      plan: org.plan || 'enterprise',
      isCanonicalDemo: isCanonicalDemo(org),
      demoUsers: users,
      lastUsedAt: last?.lastLoginAt || last?.lastActiveAt || null,
    },
  };
}

async function getSummary(actor) {
  assertPlatformOperator(actor);
  const clients = clientFilter();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    workspaces,
    clientCount,
    demoCount,
    platformCount,
    preview,
    pendingTrials,
    newClients7d,
    planRows,
    clientUsers,
    demoUsers,
    pendingPreview,
    demo,
  ] = await Promise.all([
    Organization.countDocuments({ archivedAt: null }),
    Organization.countDocuments(clients),
    Organization.countDocuments({ $or: [{ isDemo: true }, { slug: DEMO_ORG_SLUG }] }),
    Organization.countDocuments({ isDemo: { $ne: true }, domain: PLATFORM_DOMAIN }),
    Organization.countDocuments({
      archivedAt: null,
      $or: [
        { 'atsSettings.internalPreview': true },
        { 'atsSettings.previewModules.0': { $exists: true } },
      ],
      isDemo: { $ne: true },
    }),
    User.countDocuments({ signupStatus: 'pending_approval' }),
    Organization.countDocuments({ ...clients, createdAt: { $gte: weekAgo } }),
    Organization.aggregate([
      { $match: clients },
      { $group: { _id: '$plan', n: { $sum: 1 } } },
    ]),
    User.countDocuments({ isDemo: { $ne: true }, isActive: { $ne: false } }),
    User.countDocuments({ isDemo: true, isActive: { $ne: false } }),
    User.find({ signupStatus: 'pending_approval' })
      .select('name email companyName createdAt role')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    getDemoStatus(),
  ]);

  const byPlan = Object.fromEntries(PLANS.map((plan) => [plan, 0]));
  planRows.forEach((row) => {
    const key = PLANS.includes(row._id) ? row._id : 'free_trial';
    byPlan[key] += row.n;
  });

  const liveOrgs = await Organization.find({ archivedAt: null })
    .select('name slug domain plan isDemo archivedAt ownerId atsSettings.internalPreview atsSettings.previewModules createdAt')
    .lean();
  const liveRows = await hydrateTenants(liveOrgs);
  const liveClients = liveRows.filter((row) => row.kind === 'client' && !row.isEmptyShell).length;
  const emptyShells = liveRows.filter((row) => row.isEmptyShell).length;

  return {
    generatedAt: new Date().toISOString(),
    workspaces,
    clients: liveClients,
    emptyShells,
    demo: demoCount,
    platform: platformCount,
    preview,
    pendingTrials,
    newClients7d,
    clientUsers,
    demoUsers,
    byPlan,
    previewModules: INTERNAL_PREVIEW_FEATURES,
    pendingPreview: pendingPreview.map((u) => ({
      id: String(u._id),
      name: u.name || '',
      email: u.email,
      companyName: u.companyName || '',
      role: u.role || '',
      createdAt: u.createdAt,
    })),
    demo,
  };
}

async function listTenants(actor, query = {}) {
  assertPlatformOperator(actor);
  const view = String(query.view || 'live').toLowerCase();
  const q = String(query.q || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(query.limit, 10) || 50));

  const mongo = {};
  if (view === 'archived') mongo.archivedAt = { $ne: null };
  else if (view !== 'all') mongo.archivedAt = null;

  const orgs = await Organization.find(mongo)
    .select('name slug domain logo plan planExpiresAt isDemo archivedAt ownerId atsSettings.internalPreview atsSettings.previewModules createdAt')
    .sort({ isDemo: -1, createdAt: -1 })
    .limit(100)
    .lean();

  let items = await hydrateTenants(orgs);
  if (view === 'live') {
    const shells = items.filter((row) => row.isEmptyShell && !row.archived);
    if (shells.length) {
      await Organization.updateMany(
        { _id: { $in: shells.map((row) => row.id) } },
        { $set: { archivedAt: new Date() } }
      );
      items = items.map((row) => (
        shells.some((s) => s.id === row.id) ? { ...row, archived: true, isEmptyShell: true } : row
      ));
    }
  }
  const hiddenShells = items.filter((row) => row.archived && row.isEmptyShell).length;

  if (q) {
    items = items.filter((row) =>
      `${row.name} ${row.slug} ${row.domain} ${row.ownerEmail}`.toLowerCase().includes(q)
    );
  }
  if (view === 'live') items = items.filter((row) => !row.archived && !row.isEmptyShell && row.kind !== 'platform');
  if (view === 'clients') items = items.filter((row) => row.kind === 'client' && !row.isEmptyShell && !row.archived);
  if (view === 'demo') items = items.filter((row) => row.kind === 'demo');
  if (view === 'shells') items = items.filter((row) => row.isEmptyShell && !row.archived);
  if (view === 'platform') items = items.filter((row) => row.kind === 'platform');
  if (view === 'preview') items = items.filter((row) => row.kind === 'client' && row.previewModules.length > 0);
  if (view === 'archived') items = items.filter((row) => row.archived);

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total,
    page,
    pages,
    hiddenShells,
  };
}

async function updateTenant(actor, orgId, body = {}) {
  assertPlatformOperator(actor);
  if (!mongoose.isValidObjectId(orgId)) throw httpError('Organization not found', 404);
  const org = await Organization.findById(orgId);
  if (!org) throw httpError('Organization not found', 404);

  if (body.plan !== undefined) {
    const plan = String(body.plan || '').trim();
    if (!PLANS.includes(plan)) throw httpError('Invalid plan', 400, { code: 'invalid_plan' });
    if (isVendorProtectedOrg(org) && plan !== 'enterprise') {
      throw httpError('The vendor workspace stays on Enterprise and cannot be downgraded', 400, {
        code: 'vendor_protected',
      });
    }
    org.plan = plan;
    if (org.productPlans) org.productPlans.ats = plan;
    else org.productPlans = { ats: plan };
    applyPlanLimits(org, plan);
  }

  if (typeof body.isDemo === 'boolean') {
    if (isCanonicalDemo(org) && body.isDemo === false) {
      throw httpError('The client-presentation demo workspace cannot be turned off', 400, {
        code: 'demo_protected',
      });
    }
    org.isDemo = body.isDemo;
    await User.updateMany({ organizationId: org._id }, { $set: { isDemo: body.isDemo } });
  }

  if (typeof body.internalPreview === 'boolean') {
    if (org.isDemo || isCanonicalDemo(org)) {
      throw httpError('Unfinished modules stay off on demo workspaces', 400, {
        code: 'demo_preview_blocked',
      });
    }
    applyModuleList(org, body.internalPreview ? INTERNAL_PREVIEW_FEATURES : []);
  }

  if (Array.isArray(body.previewModules)) {
    if (org.isDemo || isCanonicalDemo(org)) {
      throw httpError('Unfinished modules stay off on demo workspaces', 400, {
        code: 'demo_preview_blocked',
      });
    }
    applyModuleList(org, body.previewModules);
  }

  if (body.previewModule) {
    if (org.isDemo || isCanonicalDemo(org)) {
      throw httpError('Unfinished modules stay off on demo workspaces', 400, {
        code: 'demo_preview_blocked',
      });
    }
    const key = String(body.previewModule);
    if (!INTERNAL_PREVIEW_FEATURES.includes(key)) throw httpError('Unknown module', 400);
    const current = new Set(enabledModules(org));
    if (body.enabled) current.add(key);
    else current.delete(key);
    applyModuleList(org, [...current]);
  }

  if (typeof body.archived === 'boolean') {
    if (isCanonicalDemo(org) && body.archived) {
      throw httpError('The client-presentation demo cannot be archived', 400, { code: 'demo_protected' });
    }
    if (isVendorProtectedOrg(org) && body.archived) {
      throw httpError('The vendor workspace cannot be archived', 400, { code: 'vendor_protected' });
    }
    org.archivedAt = body.archived ? new Date() : null;
  }

  await org.save();
  const [row] = await hydrateTenants([org.toObject()]);
  return row;
}

async function archiveEmptyShells(actor) {
  assertPlatformOperator(actor);
  const orgs = await Organization.find({
    archivedAt: null,
    isDemo: { $ne: true },
    slug: { $ne: DEMO_ORG_SLUG },
    domain: { $ne: PLATFORM_DOMAIN },
  })
    .select('name slug domain logo plan planExpiresAt isDemo archivedAt ownerId atsSettings.internalPreview atsSettings.previewModules createdAt')
    .lean();
  const rows = await hydrateTenants(orgs);
  const ids = rows.filter((row) => row.isEmptyShell).map((row) => row.id);
  if (ids.length) {
    await Organization.updateMany(
      { _id: { $in: ids } },
      { $set: { archivedAt: new Date() } }
    );
  }
  return { archived: ids.length, ids };
}

async function getTenant(actor, orgId) {
  assertPlatformOperator(actor);
  if (!mongoose.isValidObjectId(orgId)) throw httpError('Organization not found', 404);
  const org = await Organization.findById(orgId)
    .select('name slug domain logo plan planExpiresAt isDemo archivedAt ownerId atsSettings.internalPreview atsSettings.previewModules billingCustomerId billingSubscriptionId createdAt usageCurrent usageLimits')
    .lean();
  if (!org) throw httpError('Organization not found', 404);
  const [workspace] = await hydrateTenants([org]);

  const [users, audit] = await Promise.all([
    User.find({ organizationId: org._id })
      .select('name email role lastLoginAt lastActiveAt isActive isDemo isEmailVerified')
      .sort({ role: 1, createdAt: 1 })
      .limit(50)
      .lean(),
    require('../models/AuditLog').find({ organizationId: org._id })
      .select('action resource details timestamp userId')
      .sort({ timestamp: -1 })
      .limit(25)
      .lean(),
  ]);

  let invoices = [];
  let subscription = null;
  try {
    const stripeService = require('./stripeService');
    invoices = await stripeService.listInvoices(org, { limit: 12 });
    subscription = await stripeService.getSubscriptionSummary(org);
  } catch {
    invoices = [];
  }

  return {
    workspace,
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name || '',
      email: u.email,
      role: u.role,
      lastLoginAt: u.lastLoginAt || null,
      lastActiveAt: u.lastActiveAt || null,
      isActive: u.isActive !== false,
      isDemo: Boolean(u.isDemo),
    })),
    audit: audit.map((a) => ({
      id: String(a._id),
      action: a.action,
      resource: a.resource,
      details: a.details || null,
      timestamp: a.timestamp,
    })),
    billing: {
      customerId: org.billingCustomerId || '',
      subscriptionId: org.billingSubscriptionId || '',
      subscription,
      invoices,
    },
  };
}

async function inspectTenant(actor, orgId, req) {
  assertPlatformOperator(actor);
  if (!mongoose.isValidObjectId(orgId)) throw httpError('Organization not found', 404);
  const org = await Organization.findById(orgId);
  if (!org) throw httpError('Organization not found', 404);
  if (isPlatformWorkspace(org)) {
    throw httpError('Cannot inspect the platform operator workspace this way', 400, { code: 'inspect_blocked' });
  }

  let target = org.ownerId ? await User.findById(org.ownerId) : null;
  if (!target) {
    target = await User.findOne({ organizationId: org._id, role: 'owner', isActive: { $ne: false } });
  }
  if (!target) {
    target = await User.findOne({ organizationId: org._id, isActive: { $ne: false } }).sort({ createdAt: 1 });
  }
  if (!target) throw httpError('No active user in this workspace', 404);
  if (isPlatformOperator(target)) {
    throw httpError('Cannot inspect a platform operator account', 400, { code: 'inspect_blocked' });
  }

  const auth = require('./authService');
  return auth.completeLogin(target, req);
}

module.exports = {
  PLANS,
  DEMO_ORG_SLUG,
  assertPlatformOperator,
  serializeTenant,
  tenantKind,
  getSummary,
  listTenants,
  updateTenant,
  archiveEmptyShells,
  getTenant,
  inspectTenant,
};
