/**
 * Public freelance-recruiter partner signup + owner review inbox.
 */
const path = require('path');
const fs = require('fs');
const Organization = require('../models/Organization');
const User = require('../models/User');
const FreelancerApplication = require('../models/FreelancerApplication');
const Notification = require('../models/Notification');
const { planHasFeature } = require('../config/planFeatures');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  loadOrgEmailBrand,
  escapeHtml,
  brandButtonHtml,
  infoPanelHtml,
  publicSiteBase,
} = require('./emailBrandLayout');
const { orgJobCodePrefix } = require('./jobCodeService');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function trimStr(v) {
  return String(v ?? '').trim();
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function phoneDigitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
}

const publicHitBuckets = new Map();

function assertPublicRateLimit(bucketKey, { limit = 20, windowMs = 60 * 1000 } = {}) {
  const now = Date.now();
  let entry = publicHitBuckets.get(bucketKey);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    publicHitBuckets.set(bucketKey, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    throw httpError('Too many requests. Please wait a moment and try again.', 429, {
      code: 'rate_limited',
    });
  }
}

function assertPartnerPageLive(org) {
  if (org?.atsSettings && org.atsSettings.freelancerPageEnabled === false) {
    throw httpError('This partnership page is not currently accepting applications.', 403);
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPersonName(name) {
  const t = trimStr(name);
  if (t.length < 2 || t.length > 80) return false;
  if (/^\d+$/.test(t)) return false;
  if ((t.match(/\d/g) || []).length > 2) return false;
  return /^[\p{L}\s.'’-]+$/u.test(t);
}

function toPublicOrg(org) {
  const whiteLabelActive = !!org.atsSettings?.whiteLabel?.enabled && planHasFeature(org.plan, 'whiteLabel');
  return {
    name: org.name,
    logo: org.logo,
    slug: org.slug,
    brandColor: org.atsSettings?.brandColor || '#0d9488',
    whiteLabelActive,
    hidePoweredBy: whiteLabelActive && !!org.atsSettings?.whiteLabel?.hidePoweredBy,
    freelancerPageTitle: org.atsSettings?.freelancerPageTitle
      || org.settings?.freelancerPageTitle
      || '',
    freelancerPageDescription: org.atsSettings?.freelancerPageDescription
      || org.settings?.freelancerPageDescription
      || '',
  };
}

async function getPartnerPage(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name logo slug plan settings atsSettings.brandColor atsSettings.whiteLabel atsSettings.freelancerPageEnabled atsSettings.freelancerPageTitle atsSettings.freelancerPageDescription');
  if (!org) throw httpError('Organization not found', 404);
  assertPartnerPageLive(org);
  return { organization: toPublicOrg(org) };
}

function parseBody(body = {}) {
  const name = trimStr(body.name).replace(/\s{2,}/g, ' ').toUpperCase();
  const email = normalizeEmail(body.email);
  const phone = phoneDigitsOnly(body.phone);
  return {
    name,
    email,
    phone,
    location: trimStr(body.location).slice(0, 120),
    linkedinUrl: '',
    currentCompany: trimStr(body.currentCompany).slice(0, 160),
    yearsExperience: trimStr(body.yearsExperience).slice(0, 40),
    specializations: trimStr(body.specializations).slice(0, 400),
    rolesHired: trimStr(body.rolesHired).slice(0, 400),
    availability: trimStr(body.availability).slice(0, 120),
    commercialNote: trimStr(body.commercialNote).slice(0, 400),
    coverNote: trimStr(body.coverNote).slice(0, 4000),
  };
}

function validateApply(fields) {
  if (!isValidPersonName(fields.name)) throw httpError('Please enter a valid full legal name.', 400);
  if (!isValidEmail(fields.email)) throw httpError('Please enter a valid email address.', 400);
  if (fields.phone.length !== 10) throw httpError('Please enter a valid 10-digit mobile number.', 400);
}

function assertOwnerOrAdmin(user) {
  if (!['owner', 'admin'].includes(String(user?.role || ''))) {
    throw httpError('Access denied. Only the organisation owner or admin can review partner applications.', 403);
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function allocatePartnerReference(organizationId) {
  const org = organizationId
    ? await Organization.findById(organizationId).select('slug name codeSeq').lean()
    : null;
  const prefix = `${orgJobCodePrefix(org)}-PART-`;
  if (!organizationId) return `PART-${Date.now().toString(36).toUpperCase()}`;

  const key = 'codeSeq.partner';
  if ((Number(org?.codeSeq?.partner) || 0) < 1) {
    const rows = await FreelancerApplication.find({
      organizationId,
      referenceCode: { $regex: `^${escapeRegex(prefix)}` },
    }).select('referenceCode').lean();
    let max = 0;
    for (const row of rows) {
      const n = parseInt(String(row.referenceCode || '').slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    if (max > 0) {
      await Organization.updateOne({ _id: organizationId }, { $max: { [key]: max } });
    }
  }

  for (let i = 0; i < 20; i += 1) {
    const updated = await Organization.findByIdAndUpdate(
      organizationId,
      { $inc: { [key]: 1 } },
      { new: true, projection: { codeSeq: 1 } },
    );
    const n = Number(updated?.codeSeq?.partner) || 0;
    if (n < 1) continue;
    const code = `${prefix}${String(n).padStart(6, '0')}`;
    const exists = await FreelancerApplication.findOne({ organizationId, referenceCode: code }).select('_id').lean();
    if (!exists) return code;
  }
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}

async function ensureReference(application) {
  if (!application) return '';
  const existing = String(application.referenceCode || '').trim().toUpperCase();
  if (existing) return existing;
  const code = await allocatePartnerReference(application.organizationId);
  application.referenceCode = code;
  return code;
}

function firstName(name) {
  const part = String(name || '').trim().split(/\s+/)[0] || 'there';
  return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
}

async function notifyApplicant(org, application, kind) {
  if (!application?.email) return false;
  const brand = await loadOrgEmailBrand(org._id);
  const orgName = org.name || brand.name || 'our team';
  const reference = String(application.referenceCode || '').trim();
  const greeting = `Hi ${escapeHtml(firstName(application.name))},`;
  let title = 'Partnership application received';
  let subject = `We received your partnership application | ${orgName}`;
  let lead = `Thank you for applying to join <strong style="color:#0f172a;">${escapeHtml(orgName)}</strong> as a freelance recruitment partner.`;
  let detail = 'Your application is now with the partnership desk. A member of the team will review your profile. If you are shortlisted, they will contact you on the email or mobile number you provided. Workspace access is issued only by a formal invitation — this application does not create an account.';
  let statusLabel = 'Received — under review';

  if (kind === 'contacted') {
    title = 'Partnership application update';
    subject = `Your partnership application is moving forward | ${orgName}`;
    lead = `Your partnership application with <strong style="color:#0f172a;">${escapeHtml(orgName)}</strong> has been reviewed.`;
    detail = 'A member of our partnership team will contact you shortly on the email or mobile number you provided. Please keep this reference for any correspondence.';
    statusLabel = 'Shortlisted — we will contact you';
  } else if (kind === 'rejected') {
    title = 'Partnership application update';
    subject = `Update on your partnership application | ${orgName}`;
    lead = `Thank you for your interest in partnering with <strong style="color:#0f172a;">${escapeHtml(orgName)}</strong>.`;
    detail = 'After review, we are not able to move forward with a partnership at this time. You may submit a fresh application in the future if your practice changes.';
    statusLabel = 'Not proceeding';
  }

  const html = wrapBrandedEmailHtml({
    title,
    eyebrow: 'Talent partnerships',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    bodyHtml: `
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">${greeting}</p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">${lead}</p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">${detail}</p>
      ${infoPanelHtml([
        ...(reference ? [{ label: 'Reference', value: reference }] : []),
        { label: 'Status', value: statusLabel },
        { label: 'Email on file', value: application.email },
      ], brand.brandColor)}
    `,
  });

  await sendEmail(
    application.email,
    subject,
    html,
    `${title}. Reference ${reference || 'on file'}. Status: ${statusLabel}.`,
    { organizationId: org._id, senderName: brand.name, system: true },
  );
  return true;
}

function resumeMeta(file) {
  if (!file) return { resumePath: '', resumeOriginalName: '' };
  const stored = file.filename ? `uploads/${file.filename}` : (file.path || '');
  return {
    resumePath: stored,
    resumeOriginalName: String(file.originalname || '').slice(0, 180),
  };
}

async function notifyCompany(org, application) {
  const staff = await User.find({
    organizationId: org._id,
    role: { $in: ['owner', 'admin'] },
    isActive: { $ne: false },
    signupStatus: { $ne: 'rejected' },
  }).select('_id email name').lean();

  const title = 'New independent recruiter application';
  const message = `${application.name} submitted a partnership application for ${org.name}.`;
  const linkUrl = '/freelancer-applications';

  await Promise.all(staff.map(async (person) => {
    try {
      await Notification.create({
        userId: person._id,
        senderName: application.name,
        type: 'system',
        title,
        message,
        relatedEmail: application.email,
        linkUrl,
        priority: 'high',
        actionRequired: true,
        status: 'pending',
      });
    } catch (err) {
      logger.warn({ err }, 'Freelancer application in-app notification failed');
    }
  }));

  const recipients = staff.map((p) => p.email).filter(Boolean);
  if (!recipients.length) return;
  try {
    const brand = await loadOrgEmailBrand(org._id);
    const inboxUrl = `${publicSiteBase()}/freelancer-applications`;
    const html = wrapBrandedEmailHtml({
      title,
      eyebrow: 'Talent partnerships',
      orgName: brand.name,
      logoUrl: brand.logoUrl,
      brandColor: brand.brandColor,
      wordmark: brand.wordmark,
      bodyHtml: `
        <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">
          ${escapeHtml(application.name)} submitted an independent recruiter application for
          <strong style="color:#0f172a;">${escapeHtml(org.name)}</strong>.
        </p>
        <p style="margin:0 0 4px 0;color:#475569;"><strong>Email:</strong> ${escapeHtml(application.email)}</p>
        <p style="margin:0 0 4px 0;color:#475569;"><strong>Phone:</strong> ${escapeHtml(application.phone || '—')}</p>
        <p style="margin:0 0 16px 0;color:#475569;"><strong>Location:</strong> ${escapeHtml(application.location || '—')}</p>
        <div style="text-align:center;">
          ${brandButtonHtml({ href: inboxUrl, label: 'Review application', brandColor: brand.brandColor })}
        </div>
      `,
    });
    await sendEmail(
      recipients,
      `${title} — ${application.name}`,
      html,
      `${application.name} submitted an independent recruiter application. Review: ${inboxUrl}`,
      { organizationId: org._id, senderName: brand.name, system: true },
    );
  } catch (err) {
    logger.warn({ err }, 'Freelancer application email failed');
  }
}

function publicApplicationStatus(status) {
  const key = status === 'approved' ? 'invited' : String(status || 'pending');
  const labels = {
    pending: 'Received — under review',
    contacted: 'Shortlisted — we will contact you',
    invited: 'Invitation sent — join the company',
    joined: 'Joined the company',
    rejected: 'Not proceeding',
  };
  return { status: labels[key] ? key : 'pending', statusLabel: labels[key] || labels.pending };
}

function duplicateFromRecords(existingApp) {
  if (!existingApp) return { duplicate: false };
  const pub = publicApplicationStatus(existingApp.status);
  const referenceCode = String(existingApp.referenceCode || '').trim();
  if (pub.status === 'joined') {
    return {
      duplicate: true,
      code: 'already_selected',
      referenceCode,
      status: pub.status,
      statusLabel: pub.statusLabel,
      message: 'You have already joined this company with this email. Sign in with the account from your invitation.',
    };
  }
  if (pub.status === 'invited') {
    return {
      duplicate: true,
      code: 'already_selected',
      referenceCode,
      status: pub.status,
      statusLabel: pub.statusLabel,
      message: 'You have already applied with this email or mobile number. This profile has been selected. Please watch your email for the invitation.',
    };
  }
  if (pub.status === 'rejected') {
    return {
      duplicate: true,
      code: 'already_applied',
      referenceCode,
      status: pub.status,
      statusLabel: pub.statusLabel,
      message: 'You have already applied with this email or mobile number. That application is not proceeding, and a second application cannot be submitted with the same email.',
    };
  }
  return {
    duplicate: true,
    code: 'already_applied',
    referenceCode,
    status: pub.status,
    statusLabel: pub.statusLabel,
    message: 'You have already applied with this email or mobile number. One email can hold only one partnership application. Use your reference to track the status.',
  };
}

async function findExistingApplication(organizationId, email, phone) {
  const clauses = [];
  if (email) clauses.push({ email });
  if (phone && String(phone).length === 10) clauses.push({ phone });
  if (!clauses.length) return null;
  return FreelancerApplication.findOne({
    organizationId,
    $or: clauses,
  }).sort({ createdAt: -1 });
}

async function checkApplication(orgSlug, rawBody, rateKey) {
  assertPublicRateLimit(`partner-check:${rateKey}:${orgSlug}`, { limit: 30, windowMs: 10 * 60 * 1000 });
  const org = await Organization.findOne({ slug: orgSlug }).select('_id slug atsSettings.freelancerPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertPartnerPageLive(org);

  const email = normalizeEmail(rawBody.email);
  const phone = phoneDigitsOnly(rawBody.phone);
  const existingApp = await findExistingApplication(org._id, isValidEmail(email) ? email : '', phone.length === 10 ? phone : '');
  return duplicateFromRecords(existingApp);
}

async function trackApplication(orgSlug, rawBody, rateKey) {
  assertPublicRateLimit(`partner-track:${rateKey}:${orgSlug}`, { limit: 20, windowMs: 10 * 60 * 1000 });
  const org = await Organization.findOne({ slug: orgSlug }).select('_id atsSettings.freelancerPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertPartnerPageLive(org);

  const referenceCode = trimStr(rawBody.reference || rawBody.referenceCode).toUpperCase();
  const email = normalizeEmail(rawBody.email);
  if (!referenceCode || !isValidEmail(email)) {
    throw httpError('Enter the application reference and the email used on the application.', 400);
  }

  const row = await FreelancerApplication.findOne({
    organizationId: org._id,
    referenceCode,
    email,
  });

  if (!row) {
    return { found: false, message: 'No application matches that reference and email.' };
  }

  if (row.status !== 'joined' && row.userId) {
    const member = await User.findOne({
      _id: row.userId,
      organizationId: org._id,
    }).select('isActive').lean();
    if (member?.isActive && row.inviteUrl) {
      row.status = 'joined';
      row.reviewedAt = row.reviewedAt || new Date();
      await row.save();
    }
  }

  const pub = publicApplicationStatus(row.status);
  const order = ['pending', 'contacted', 'invited', 'joined'];
  const current = order.indexOf(pub.status);
  const steps = [
    { id: 'pending', label: 'Received' },
    { id: 'contacted', label: 'In conversation' },
    { id: 'invited', label: 'Company invitation' },
    { id: 'joined', label: 'Joined the team' },
  ].map((step, index) => ({
    ...step,
    state: pub.status === 'rejected'
      ? 'ended'
      : (index < current ? 'done' : index === current ? 'current' : 'upcoming'),
  }));
  return {
    found: true,
    referenceCode: row.referenceCode,
    status: pub.status,
    statusLabel: pub.statusLabel,
    submittedAt: row.createdAt,
    updatedAt: row.updatedAt,
    steps,
  };
}

async function submitApplication(orgSlug, rawBody, file, rateKey) {
  assertPublicRateLimit(`partner-apply:${rateKey}:${orgSlug}`, { limit: 8, windowMs: 10 * 60 * 1000 });

  const org = await Organization.findOne({ slug: orgSlug }).select('name slug atsSettings.freelancerPageEnabled plan');
  if (!org) throw httpError('Organization not found', 404);
  assertPartnerPageLive(org);

  const fields = parseBody(rawBody);
  validateApply(fields);
  const resume = resumeMeta(file);

  const existingApp = await findExistingApplication(org._id, fields.email, fields.phone);
  const duplicate = duplicateFromRecords(existingApp);
  if (duplicate.duplicate) {
    throw httpError(duplicate.message, 409, {
      code: duplicate.code,
      referenceCode: duplicate.referenceCode,
      statusLabel: duplicate.statusLabel,
    });
  }

  const payload = {
    organizationId: org._id,
    userId: existingApp?.userId || null,
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    location: fields.location,
    linkedinUrl: fields.linkedinUrl,
    currentCompany: fields.currentCompany,
    yearsExperience: fields.yearsExperience,
    specializations: fields.specializations,
    rolesHired: fields.rolesHired,
    availability: fields.availability,
    commercialNote: fields.commercialNote,
    coverNote: fields.coverNote,
    status: 'pending',
    referenceCode: existingApp?.referenceCode
      ? String(existingApp.referenceCode).trim().toUpperCase()
      : await allocatePartnerReference(org._id),
    ...(resume.resumePath ? resume : {}),
  };

  let application;
  if (existingApp) {
    if (!payload.resumePath) {
      payload.resumePath = existingApp.resumePath;
      payload.resumeOriginalName = existingApp.resumeOriginalName;
    } else if (existingApp.resumePath && existingApp.resumePath !== payload.resumePath) {
      try {
        const oldAbs = path.resolve(existingApp.resumePath);
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      } catch { /* ignore */ }
    }
    Object.assign(existingApp, payload, { reviewedAt: null, reviewedBy: null, reviewNote: '' });
    application = await existingApp.save();
  } else {
    application = await FreelancerApplication.create(payload);
  }

  notifyCompany(org, application).catch((err) => {
    logger.warn({ err }, 'Freelancer application notify failed');
  });

  let confirmationSent = false;
  try {
    confirmationSent = await notifyApplicant(org, application, 'received');
  } catch (err) {
    logger.warn({ err }, 'Freelancer applicant confirmation email failed');
  }

  return {
    message: 'Your partnership application has been received. Please keep your reference for any correspondence.',
    referenceCode: application.referenceCode || '',
    email: application.email,
    status: 'pending',
    confirmationSent,
  };
}

function serializeApplication(doc) {
  const row = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...(doc || {}) };
  const reviewer = row.reviewedBy && typeof row.reviewedBy === 'object' ? row.reviewedBy : null;
  return {
    id: String(row._id),
    referenceCode: row.referenceCode || '',
    name: row.name,
    email: row.email,
    phone: row.phone,
    location: row.location,
    linkedinUrl: row.linkedinUrl,
    currentCompany: row.currentCompany,
    yearsExperience: row.yearsExperience,
    specializations: row.specializations,
    rolesHired: row.rolesHired,
    availability: row.availability,
    commercialNote: row.commercialNote,
    coverNote: row.coverNote,
    resumeOriginalName: row.resumeOriginalName || '',
    hasResume: Boolean(row.resumePath),
    status: row.status === 'approved' ? 'invited' : row.status,
    userId: row.userId ? String(row.userId) : null,
    inviteUrl: row.inviteUrl || '',
    inviteEmailSent: Boolean(row.inviteEmailSent),
    reviewNote: row.reviewNote || '',
    reviewedAt: row.reviewedAt || null,
    contactedAt: row.contactedAt || null,
    reviewedByName: reviewer?.name || reviewer?.email || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const MEMBER_ROLE_LABEL = {
  owner: 'company owner',
  admin: 'company admin',
  hr_manager: 'HR manager',
  hr_recruiter: 'recruiter',
  recruiter: 'recruiter',
  sales: 'sales teammate',
  freelancer: 'freelance recruiter',
  interviewer: 'interviewer',
  other: 'teammate',
  readonly: 'read-only teammate',
};

function identityFromRecords(organizationId, userRow, candidateRow) {
  if (userRow && String(userRow.organizationId) === String(organizationId)) {
    const roleLabel = MEMBER_ROLE_LABEL[userRow.role] || 'company teammate';
    return {
      blocked: true,
      code: 'already_member',
      role: userRow.role,
      roleLabel,
      name: userRow.name || '',
      active: userRow.isActive !== false,
      message: `This email is already a ${roleLabel} in the company${userRow.name ? ` (${userRow.name})` : ''}. An invitation was not sent.`,
    };
  }
  if (userRow) {
    return {
      blocked: true,
      code: 'other_company',
      role: userRow.role || '',
      roleLabel: 'account in another company',
      name: userRow.name || '',
      active: userRow.isActive !== false,
      message: 'This email already belongs to an account in another company. An invitation was not sent.',
    };
  }
  if (candidateRow) {
    return {
      blocked: true,
      code: 'already_candidate',
      role: 'candidate',
      roleLabel: 'candidate',
      name: candidateRow.name || '',
      active: true,
      message: `This email is already a candidate${candidateRow.name ? ` (${candidateRow.name})` : ''}. An invitation was not sent.`,
    };
  }
  return null;
}

async function identityMapForEmails(organizationId, emails) {
  const list = [...new Set(emails.filter(Boolean))];
  const map = new Map();
  if (!list.length) return map;
  const Candidate = require('../models/Candidate');
  const [users, candidates] = await Promise.all([
    User.find({ email: { $in: list } }).select('email name role isActive organizationId').lean(),
    Candidate.find({ organizationId, email: { $in: list } }).select('email name').lean(),
  ]);
  const userByEmail = new Map(users.map((row) => [row.email, row]));
  const candidateByEmail = new Map(candidates.map((row) => [row.email, row]));
  for (const email of list) {
    const identity = identityFromRecords(organizationId, userByEmail.get(email), candidateByEmail.get(email));
    if (identity) map.set(email, identity);
  }
  return map;
}

async function listApplications(user, { status } = {}) {
  assertOwnerOrAdmin(user);
  const filter = { organizationId: user.organizationId };
  if (status && status !== 'all') {
    if (status === 'invited' || status === 'approved') {
      filter.status = { $in: ['invited', 'approved'] };
    } else if (['pending', 'contacted', 'joined', 'rejected'].includes(status)) {
      filter.status = status;
    }
  }
  const rows = await FreelancerApplication.find(filter)
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(500);
  for (const row of rows) {
    if (row.status === 'joined' && !row.inviteUrl) {
      row.status = 'pending';
      row.reviewedAt = null;
      await row.save();
    }
  }
  const identities = await identityMapForEmails(user.organizationId, rows.map((row) => row.email));
  const counts = await FreelancerApplication.aggregate([
    { $match: { organizationId: user.organizationId } },
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const byStatus = { pending: 0, contacted: 0, invited: 0, joined: 0, rejected: 0 };
  for (const row of counts) {
    if (row._id === 'approved') byStatus.invited += row.n;
    else if (byStatus[row._id] != null) byStatus[row._id] += row.n;
  }
  return {
    applications: rows.map((row) => {
      const serialized = serializeApplication(row);
      serialized.teamState = serialized.status === 'joined'
        ? 'joined'
        : serialized.status === 'invited'
          ? 'invited'
          : '';
      serialized.identity = identities.get(row.email) || null;
      return serialized;
    }),
    counts: byStatus,
  };
}

async function getApplication(user, id) {
  assertOwnerOrAdmin(user);
  const row = await FreelancerApplication.findOne({
    _id: id,
    organizationId: user.organizationId,
  }).populate('reviewedBy', 'name email');
  if (!row) throw httpError('Application not found', 404);
  return serializeApplication(row);
}

async function updateApplicationStatus(user, id, { status, reviewNote } = {}) {
  assertOwnerOrAdmin(user);
  const nextStatus = status === 'approved' ? 'invited' : status;
  const allowed = ['pending', 'contacted', 'invited', 'rejected'];
  if (!allowed.includes(nextStatus)) throw httpError('Invalid status', 400);

  const application = await FreelancerApplication.findOne({
    _id: id,
    organizationId: user.organizationId,
  });
  if (!application) throw httpError('Application not found', 404);

  const note = trimStr(reviewNote).slice(0, 2000);
  const actor = {
    id: user.id || user._id,
    _id: user._id || user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
  };

  let alreadyJoined = false;
  if (nextStatus === 'invited' && !['invited', 'approved', 'joined'].includes(application.status)) {
    const identities = await identityMapForEmails(user.organizationId, [application.email]);
    const identity = identities.get(application.email);
    if (identity?.blocked) {
      throw httpError(identity.message, 409, { code: identity.code });
    }
    const { inviteTeammate } = require('./onboardingService');
    try {
      const invite = await inviteTeammate(actor, {
        email: application.email,
        role: 'freelancer',
        name: application.name,
      });
      application.userId = invite.userId;
      application.inviteUrl = invite.inviteUrl || '';
      application.inviteEmailSent = Boolean(invite.emailSent);
    } catch (err) {
      const existing = await User.findOne({
        email: application.email,
        organizationId: user.organizationId,
      }).select('_id isActive');
      if (!existing) throw err;
      application.userId = existing._id;
      alreadyJoined = existing.isActive !== false;
    }
  }

  const previousStatus = application.status;
  application.status = alreadyJoined ? 'joined' : nextStatus;
  application.reviewNote = note;
  application.reviewedBy = actor.id;
  application.reviewedAt = new Date();
  if (nextStatus === 'contacted') application.contactedAt = new Date();
  await ensureReference(application);
  await application.save();

  if (previousStatus !== nextStatus && (nextStatus === 'contacted' || nextStatus === 'rejected')) {
    const org = await Organization.findById(user.organizationId).select('name slug').lean();
    if (org) {
      notifyApplicant(org, application, nextStatus).catch((err) => {
        logger.warn({ err }, 'Freelancer applicant status email failed');
      });
    }
  }

  const serialized = serializeApplication(await application.populate('reviewedBy', 'name email'));
  return serialized;
}

async function reviewApplication(user, id) {
  assertOwnerOrAdmin(user);
  const application = await FreelancerApplication.findOne({
    _id: id,
    organizationId: user.organizationId,
  }).lean();
  if (!application) throw httpError('Application not found', 404);

  const identities = await identityMapForEmails(user.organizationId, [application.email]);
  const identity = identities.get(application.email) || null;
  const phone = phoneDigitsOnly(application.phone);
  const clauses = [{ email: application.email }];
  if (phone.length === 10) clauses.push({ phone });
  const others = await FreelancerApplication.find({
    organizationId: user.organizationId,
    _id: { $ne: application._id },
    $or: clauses,
  }).select('name email phone referenceCode status createdAt').sort({ createdAt: -1 }).lean();

  const otherApplications = others.map((row) => ({
    id: String(row._id),
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    referenceCode: row.referenceCode || '',
    status: row.status === 'approved' ? 'invited' : row.status,
    createdAt: row.createdAt,
    matchedOn: row.email === application.email ? 'email' : 'phone',
  }));

  const matchCount = (identity ? 1 : 0) + otherApplications.length;
  return {
    applicationId: String(application._id),
    name: application.name,
    email: application.email,
    phone: application.phone || '',
    referenceCode: application.referenceCode || '',
    status: application.status === 'approved' ? 'invited' : application.status,
    checkedAt: new Date().toISOString(),
    clear: matchCount === 0,
    matchCount,
    identity,
    otherApplications,
    recommendation: matchCount === 0
      ? 'No existing company, candidate, or application record uses this email or mobile number. The team may invite this person.'
      : 'A matching record was found. Do not send a company invitation until the match is resolved.',
  };
}

async function getResumeFile(user, id) {
  assertOwnerOrAdmin(user);
  const row = await FreelancerApplication.findOne({
    _id: id,
    organizationId: user.organizationId,
  }).select('resumePath resumeOriginalName name').lean();
  if (!row) throw httpError('Application not found', 404);
  if (!row.resumePath) throw httpError('No resume uploaded', 404);
  const abs = path.resolve(row.resumePath);
  const uploadsRoot = path.resolve('uploads');
  const rel = path.relative(uploadsRoot, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw httpError('Invalid resume path', 400);
  if (!fs.existsSync(abs)) throw httpError('Resume file is no longer available', 404);
  return {
    abs,
    downloadName: row.resumeOriginalName || `${row.name || 'freelancer'}-resume.pdf`,
  };
}

async function createApplication(user, body = {}) {
  assertOwnerOrAdmin(user);
  const fields = parseBody(body);
  validateApply(fields);
  const existingApp = await findExistingApplication(user.organizationId, fields.email, fields.phone);
  const duplicate = duplicateFromRecords(existingApp);
  if (duplicate.duplicate) throw httpError(duplicate.message, 409, { code: duplicate.code });
  const row = await FreelancerApplication.create({
    organizationId: user.organizationId,
    ...fields,
    referenceCode: await allocatePartnerReference(user.organizationId),
    status: 'pending',
  });
  return serializeApplication(row);
}

async function updateApplication(user, id, body = {}) {
  assertOwnerOrAdmin(user);
  const application = await FreelancerApplication.findOne({
    _id: id,
    organizationId: user.organizationId,
  });
  if (!application) throw httpError('Application not found', 404);
  const fields = parseBody(body);
  const assignable = [
    'name', 'email', 'phone', 'location', 'currentCompany', 'yearsExperience',
    'specializations', 'rolesHired', 'availability', 'commercialNote', 'coverNote',
  ];
  for (const key of assignable) {
    if (body[key] !== undefined) application[key] = fields[key];
  }
  if (body.reviewNote !== undefined) application.reviewNote = trimStr(body.reviewNote).slice(0, 2000);
  if (fields.name && !isValidPersonName(fields.name) && body.name !== undefined) {
    throw httpError('Please enter a valid full legal name.', 400);
  }
  if (body.email !== undefined && !isValidEmail(fields.email)) {
    throw httpError('Please enter a valid email address.', 400);
  }
  if (body.phone !== undefined && fields.phone.length !== 10) {
    throw httpError('Please enter a valid 10-digit mobile number.', 400);
  }
  await application.save();
  return serializeApplication(await application.populate('reviewedBy', 'name email'));
}

async function linkInviteToApplication({ organizationId, email, userId, inviteUrl, inviteEmailSent }) {
  const application = await FreelancerApplication.findOne({
    organizationId,
    email: normalizeEmail(email),
  });
  if (!application || application.status === 'rejected') return null;
  application.userId = userId || application.userId;
  if (inviteUrl) application.inviteUrl = inviteUrl;
  application.inviteEmailSent = Boolean(inviteEmailSent);
  if (application.status !== 'joined') application.status = 'invited';
  application.reviewedAt = application.reviewedAt || new Date();
  await application.save();
  return application;
}

async function markFreelancerJoined({ organizationId, email, userId }) {
  const application = await FreelancerApplication.findOne({
    organizationId,
    email: normalizeEmail(email),
  });
  if (!application || application.status === 'rejected') return null;
  application.userId = userId || application.userId;
  application.status = 'joined';
  application.reviewedAt = new Date();
  await application.save();
  return application;
}

async function deleteApplication(user, id) {
  assertOwnerOrAdmin(user);
  const row = await FreelancerApplication.findOne({
    _id: id,
    organizationId: user.organizationId,
  });
  if (!row) throw httpError('Application not found', 404);
  if (row.resumePath) {
    try {
      const abs = path.resolve(row.resumePath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch { /* ignore */ }
  }
  await row.deleteOne();
  return { deleted: true, id: String(id) };
}

module.exports = {
  getPartnerPage,
  checkApplication,
  trackApplication,
  submitApplication,
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  updateApplicationStatus,
  getResumeFile,
  reviewApplication,
  linkInviteToApplication,
  markFreelancerJoined,
};
