/**
 * Organization domain — profile, members, candidate fields, audit.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Organization = require('../models/Organization');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { getEntitlements, planHasFeature } = require('../config/planFeatures');
const s3Service = require('./s3Service');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const LOGO_MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function unlinkOrgLogoFile(logo) {
  const match = String(logo || '').match(/^\/uploads\/(?:logos\/)?(org-logo-[^/\\]+)$/);
  if (!match) return;
  const filePath = path.join(UPLOADS_DIR, match[1]);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
  }
  const nested = path.join(UPLOADS_DIR, 'logos', match[1]);
  if (fs.existsSync(nested)) {
    try { fs.unlinkSync(nested); } catch (_) { /* ignore */ }
  }
}

async function deleteStoredLogo(logo) {
  if (!logo) return;
  await s3Service.deleteStoredAsset(logo);
  unlinkOrgLogoFile(logo);
}

async function persistLogoBuffer(organizationId, buffer, ext, contentType) {
  const filename = `org-logo-${organizationId}-${Date.now()}${ext}`;
  const uploaded = await s3Service.uploadAsset({
    kind: 'logo',
    body: buffer,
    filename,
    contentType: contentType || 'image/png',
  });
  if (uploaded?.publicPath) return uploaded.publicPath;
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

async function persistDataUrlLogo(organizationId, dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return dataUrl;
  const ext = LOGO_MIME_EXT[match[1].toLowerCase()];
  if (!ext) throw httpError('Unsupported logo image type', 400);
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw httpError('Logo must be under 2 MB', 400);
  return persistLogoBuffer(organizationId, buf, ext, match[1]);
}

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function getOrganization(organizationId, viewer) {
  const { reconcileOrgPipelineSafe, ensureCorePipelineStagesSafe } = require('./pipelineStageSync');
  await reconcileOrgPipelineSafe(organizationId);
  await ensureCorePipelineStagesSafe(organizationId, ['Rejected']);
  const org = await Organization.findById(organizationId);
  if (!org) throw httpError('Organization not found', 404);
  if (viewer && viewer.role === 'freelancer') {
    const o = org.toObject ? org.toObject() : org;
    return {
      _id: o._id,
      name: o.name,
      logo: o.logo,
      slug: o.slug,
      plan: o.plan,
      domain: o.domain,
      atsSettings: {
        candidateFields: o.atsSettings?.candidateFields,
        coreFieldPrefs: o.atsSettings?.coreFieldPrefs,
      },
    };
  }
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
  if (logo !== undefined) {
    const current = await Organization.findById(organizationId).select('logo');
    let nextLogo = logo;
    if (typeof logo === 'string' && logo.startsWith('data:image/')) {
      nextLogo = await persistDataUrlLogo(organizationId, logo);
      await deleteStoredLogo(current?.logo);
    } else if (!logo) {
      await deleteStoredLogo(current?.logo);
      nextLogo = '';
    }
    update.logo = nextLogo;
  }
  if (domain !== undefined) update.domain = String(domain).trim().toLowerCase();
  if (settings !== undefined) update.settings = settings;
  if (atsSettings !== undefined) {
    const nextAts = { ...atsSettings };
    if (Object.prototype.hasOwnProperty.call(nextAts, 'careersCustomDomain')) {
      const v = String(nextAts.careersCustomDomain || '').trim().toLowerCase();
      if (!v) delete nextAts.careersCustomDomain;
      else nextAts.careersCustomDomain = v;
    }
    if (Array.isArray(nextAts.pipelineStages)) {
      const hasRejected = nextAts.pipelineStages.some(
        (s) => String(s || '').trim().toLowerCase() === 'rejected'
      );
      if (!hasRejected) nextAts.pipelineStages = [...nextAts.pipelineStages, 'Rejected'];
    }
    update.atsSettings = nextAts;
  }

  const updated = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: update },
    { new: true }
  );
  // If custom domain was cleared, also $unset so unique index stays clean
  if (
    atsSettings &&
    Object.prototype.hasOwnProperty.call(atsSettings, 'careersCustomDomain') &&
    !String(atsSettings.careersCustomDomain || '').trim()
  ) {
    await Organization.updateOne(
      { _id: organizationId },
      { $unset: { 'atsSettings.careersCustomDomain': '' } }
    );
    return Organization.findById(organizationId);
  }
  return updated;
}

async function updateOrganizationLogo(organizationId, file) {
  if (!file) throw httpError('No image file provided', 400);
  const org = await Organization.findById(organizationId);
  if (!org) throw httpError('Organization not found', 404);
  const ext = path.extname(file.originalname || file.filename || '').toLowerCase() || '.png';
  const body = file.buffer || (file.path && fs.existsSync(file.path) ? fs.readFileSync(file.path) : null);
  if (!body) throw httpError('Could not read uploaded image', 400);
  const nextLogo = await persistLogoBuffer(organizationId, body, ext, file.mimetype);
  await deleteStoredLogo(org.logo);
  if (file.path && fs.existsSync(file.path)) {
    try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
  }
  org.logo = nextLogo;
  await org.save();
  return org;
}

async function removeOrganizationLogo(organizationId) {
  const org = await Organization.findById(organizationId);
  if (!org) throw httpError('Organization not found', 404);
  await deleteStoredLogo(org.logo);
  org.logo = '';
  await org.save();
  return org;
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
  return User.find({ organizationId })
    .select('-password -inviteToken')
    .populate('reportsTo', 'name email role')
    .sort({ name: 1, email: 1 });
}

/**
 * Enterprise fallback when invite email cannot be delivered:
 * return (or refresh) a shareable accept-invite link for a pending member.
 */
async function getMemberInviteLink(organizationId, targetUserId) {
  const user = await User.findOne({ _id: targetUserId, organizationId }).select(
    '+inviteToken +inviteTokenExpires email name isActive role'
  );
  if (!user) throw httpError('User not found in organization', 404);
  if (user.role === 'owner') throw httpError('Owner does not need an invite link', 400);
  if (user.isActive !== false) {
    throw httpError('This member already accepted their invite and is active', 400);
  }

  const expired =
    !user.inviteToken ||
    !user.inviteTokenExpires ||
    new Date(user.inviteTokenExpires).getTime() <= Date.now();

  if (expired) {
    user.inviteToken = crypto.randomBytes(32).toString('hex');
    user.inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const acceptPath = user.role === 'freelancer' ? 'accept-freelancer-invite' : 'accept-invite';
  return {
    email: user.email,
    name: user.name || '',
    inviteUrl: `${frontendUrl}/${acceptPath}?token=${user.inviteToken}`,
    expiresAt: user.inviteTokenExpires,
    refreshed: expired,
  };
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

async function updateMemberReportsTo(organizationId, actor, targetUserId, reportsTo) {
  const { canAssignReportsTo, setReportsTo } = require('../utils/reportingScope');
  if (!canAssignReportsTo(actor)) {
    throw httpError('Only owner, admin, or HR manager can set reporting lines', 403);
  }
  return setReportsTo({
    organizationId,
    targetUserId,
    managerId: reportsTo,
  });
}

async function removeMember(organizationId, actorUserId, targetUserId) {
  if (targetUserId === actorUserId.toString()) {
    throw httpError('Cannot remove yourself');
  }
  const userToRemove = await User.findOne({ _id: targetUserId, organizationId });
  if (!userToRemove) throw httpError('User not found', 404);
  if (userToRemove.role === 'owner') throw httpError('Cannot remove owner', 403);

  const { revokeAllSessionsForUser } = require('./sessionService');
  await revokeAllSessionsForUser(targetUserId);
  await User.findByIdAndDelete(targetUserId);
  return { message: 'User removed from organization' };
}

function generateTempPassword() {
  const raw = crypto.randomBytes(12).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'x');
  return `Tmp-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function formatPersonName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const shouting = raw === raw.toUpperCase() && /[A-Z]/.test(raw) && raw.length > 1;
  if (!shouting) return raw;
  return raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function sendTemporaryPasswordEmail({ target, temporaryPassword, actorName }) {
  const { sendEmail } = require('./emailService');
  const {
    wrapBrandedEmailHtml,
    brandButtonHtml,
    loadSendingEmailBrand,
    escapeHtml,
  } = require('./emailBrandLayout');
  const logger = require('../utils/logger');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/login`;
  const brand = await loadSendingEmailBrand({
    userId: target._id,
    organizationId: target.organizationId || undefined,
    system: true,
  });
  const who = formatPersonName(target.name).split(/\s+/)[0] || 'there';
  const safePassword = escapeHtml(temporaryPassword);
  const safeOrg = escapeHtml(brand.name);
  const safeActor = escapeHtml(formatPersonName(actorName) || 'your administrator');

  const htmlBody = wrapBrandedEmailHtml({
    title: 'Temporary password',
    eyebrow: 'Account security',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    senderName: brand.name,
    senderEmail: brand.fromEmail,
    websiteUrl: brand.websiteUrl,
    supportEmail: brand.supportEmail,
    socialLinks: brand.socialLinks,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(who)},</p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">
        ${safeActor} reset your password for <strong style="color:#0f172a;">${safeOrg}</strong>.
        Use the temporary password below to sign in. You will be asked to choose a new password right after.
      </p>
      <div style="margin:20px 0;padding:16px 18px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Temporary password</p>
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:18px;font-weight:700;color:#0f172a;letter-spacing:0.04em;">${safePassword}</p>
      </div>
      <div style="text-align:center;">
        ${brandButtonHtml({ href: loginUrl, label: 'Sign in', brandColor: brand.brandColor })}
      </div>
      <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
        Sign in with <strong style="color:#334155;">${escapeHtml(target.email)}</strong>.
        If you did not expect this email, contact your administrator immediately.
      </p>`,
  });

  const textBody = [
    `Hi ${who},`,
    '',
    `${formatPersonName(actorName) || 'Your administrator'} reset your password for ${brand.name}.`,
    '',
    `Sign in: ${loginUrl}`,
    `Email: ${target.email}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    'You will be asked to choose a new password after you sign in.',
  ].join('\n');

  try {
    await sendEmail(
      target.email,
      `Temporary password for ${brand.name}`,
      htmlBody,
      textBody,
      {
        senderName: brand.name,
        senderEmail: brand.fromEmail,
        userId: target._id,
        organizationId: target.organizationId || undefined,
        system: true,
      }
    );
    return { emailSent: true, emailError: null };
  } catch (emailErr) {
    logger.error({ err: emailErr, email: target.email }, 'Temporary password email send failed');
    return {
      emailSent: false,
      emailError: emailErr.message === 'EMAIL_NOT_CONFIGURED'
        ? 'Email is not configured for this workspace'
        : (emailErr.message || 'Email could not be sent'),
    };
  }
}

/**
 * Owner or admin sets a one-time temporary password for a teammate (same org only).
 * Emails the teammate when possible. Target sessions are revoked; they must change password after login.
 */
async function resetMemberPassword(organizationId, actor, targetUserId) {
  const actorId = String(actor.id || actor._id || '');
  const actorRole = actor.role;
  if (String(targetUserId) === actorId) {
    throw httpError('Use Profile → Security to change your own password', 400);
  }
  const target = await User.findOne({ _id: targetUserId, organizationId });
  if (!target) throw httpError('User not found', 404);
  if (target.role === 'owner' && actorRole !== 'owner') {
    throw httpError('Only the owner can reset the owner account', 403);
  }
  if (!['owner', 'admin'].includes(actorRole)) {
    throw httpError('Only owner or admin can reset passwords', 403);
  }

  const temporaryPassword = generateTempPassword();
  target.password = temporaryPassword;
  target.mustChangePassword = true;
  await target.save();

  const { revokeAllSessionsForUser } = require('./sessionService');
  await revokeAllSessionsForUser(String(target._id));

  let actorName = actor.name || '';
  if (!actorName && actorId) {
    const actorUser = await User.findById(actorId).select('name').lean();
    actorName = actorUser?.name || '';
  }

  const mail = await sendTemporaryPasswordEmail({
    target,
    temporaryPassword,
    actorName,
  });

  return {
    userId: String(target._id),
    email: target.email,
    name: target.name || '',
    temporaryPassword,
    mustChangePassword: true,
    emailSent: mail.emailSent,
    emailError: mail.emailError,
  };
}

/**
 * Re-send the already-issued temporary password (must still match the stored hash).
 */
async function resendTemporaryPasswordEmail(organizationId, actor, targetUserId, temporaryPassword) {
  const actorRole = actor.role;
  if (!['owner', 'admin'].includes(actorRole)) {
    throw httpError('Only owner or admin can send temporary passwords', 403);
  }
  const secret = String(temporaryPassword || '').trim();
  if (!secret) throw httpError('Temporary password is required', 400);

  const target = await User.findOne({ _id: targetUserId, organizationId }).select('+password');
  if (!target) throw httpError('User not found', 404);
  if (target.role === 'owner' && actorRole !== 'owner') {
    throw httpError('Only the owner can reset the owner account', 403);
  }
  if (!target.mustChangePassword) {
    throw httpError('This account no longer has a pending temporary password', 400);
  }
  const matches = await target.comparePassword(secret);
  if (!matches) {
    throw httpError('Temporary password does not match. Reset again to issue a new one.', 400);
  }

  let actorName = actor.name || '';
  const actorId = String(actor.id || actor._id || '');
  if (!actorName && actorId) {
    const actorUser = await User.findById(actorId).select('name').lean();
    actorName = actorUser?.name || '';
  }

  const mail = await sendTemporaryPasswordEmail({
    target,
    temporaryPassword: secret,
    actorName,
  });
  if (!mail.emailSent) {
    throw httpError(mail.emailError || 'Email could not be sent', 503);
  }
  return {
    email: target.email,
    name: target.name || '',
    emailSent: true,
  };
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

async function renamePipelineStage(organizationId, oldName, newName) {
  const { renameStageLinked } = require('./pipelineStageSync');
  return renameStageLinked(organizationId, oldName, newName);
}

async function mergePipelineStages(organizationId, sourceNames, newName) {
  const { mergeStagesLinked } = require('./pipelineStageSync');
  return mergeStagesLinked(organizationId, sourceNames, newName);
}

module.exports = {
  getOrganization,
  updateOrganization,
  updateOrganizationLogo,
  removeOrganizationLogo,
  getCandidateFields,
  updateCandidateFields,
  saveLastImportMapping,
  listMembers,
  getMemberInviteLink,
  updateMemberRole,
  updateMemberReportsTo,
  removeMember,
  resetMemberPassword,
  resendTemporaryPasswordEmail,
  generateTempPassword,
  getUsage,
  getOrgEntitlements,
  listAuditLog,
  distinctAuditFields,
  exportAuditLogCsv,
  renamePipelineStage,
  mergePipelineStages,
};
