/**
 * Public careers-page domain logic (job feed, org page, apply).
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const OrgListItem = require('../models/OrgListItem');
const { planHasFeature } = require('../config/planFeatures');
const { normalizeText } = require('../utils/textNormalize');
const logger = require('../utils/logger');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  loadOrgEmailBrand,
  escapeHtml,
  otpCodeHtml,
  brandButtonHtml,
  infoPanelHtml,
  publicSiteBase,
} = require('./emailBrandLayout');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const APPLY_OTP_TTL_MS = 10 * 60 * 1000;
const APPLY_OTP_RESEND_MS = 45 * 1000;
const APPLY_OTP_MAX_ATTEMPTS = 5;

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function phoneDigitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
}

function generateApplyOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashApplyOtp(orgId, jobId, email, code) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`careers_apply:${String(orgId)}:${String(jobId)}:${normalizeEmail(email)}:${String(code).trim()}`)
    .digest('hex');
}

function applyOtpMatches(orgId, jobId, email, code, storedHash) {
  if (!storedHash || !code) return false;
  const expected = hashApplyOtp(orgId, jobId, email, code);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(storedHash), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signApplyOtpToken(payload) {
  return jwt.sign(
    { ...payload, purpose: 'careers_apply_otp' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
}

function signApplyVerifiedToken({ orgId, jobId, email }) {
  return jwt.sign(
    {
      orgId: String(orgId),
      jobId: String(jobId),
      email: normalizeEmail(email),
      purpose: 'careers_email_verified',
    },
    JWT_SECRET,
    { expiresIn: '30m' },
  );
}

function readApplyOtpToken(token) {
  if (!token) throw httpError('Enter the code from your email to continue.', 400);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw httpError('This verification code expired. Send a new code to continue.', 401);
    }
    throw httpError('This verification session expired. Send a new code to continue.', 401);
  }
  if (decoded.purpose !== 'careers_apply_otp' || !decoded.email || !decoded.otpHash) {
    throw httpError('Invalid verification session. Send a new code to continue.', 401);
  }
  return decoded;
}

function readApplyVerifiedToken(token, { orgId, jobId, email }) {
  if (!token) {
    throw httpError('Verify your email before submitting.', 400, { code: 'email_not_verified' });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw httpError('Your email verification expired. Send a new code to continue.', 401, {
      code: 'email_not_verified',
    });
  }
  if (decoded.purpose !== 'careers_email_verified' || !decoded.email) {
    throw httpError('Verify your email before submitting.', 400, { code: 'email_not_verified' });
  }
  if (normalizeEmail(decoded.email) !== normalizeEmail(email)) {
    throw httpError('Email does not match the verified address. Send a new code.', 400, {
      code: 'email_not_verified',
    });
  }
  if (String(decoded.orgId) !== String(orgId) || String(decoded.jobId) !== String(jobId)) {
    throw httpError('Email verification does not match this job. Send a new code.', 400, {
      code: 'email_not_verified',
    });
  }
  return decoded;
}

function buildApplyOtpEmailHtml({ name, code, jobTitle, brand }) {
  const first = escapeHtml((name || 'there').split(' ')[0] || 'there');
  const role = escapeHtml(jobTitle || 'this role');
  return wrapBrandedEmailHtml({
    title: 'Verify your email to apply',
    eyebrow: 'Application security',
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
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Hi ${first},</p>
      <p style="margin:0 0 4px 0;color:#475569;line-height:1.7;">
        Use this one-time code to confirm your email before applying for <strong>${role}</strong>.
      </p>
      ${otpCodeHtml(code, brand.brandColor)}
      <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.65;">
        This code expires in 10 minutes. If you did not start an application, you can ignore this email.
      </p>`,
  });
}

const DEFAULT_CTC = [
  '0-50K', '50K-1L', '1L-2L', '2L-3L', '3L-4L', '4L-5L', '5L-6L', '6L-7L', '7L-8L', '8L-9L', '9L-10L',
  '10L-12L', '12L-15L', '15L-18L', '18L-20L', '20L-25L', '25L-30L', '30L-40L', '40L-50L',
  '50L-75L', '75L-1CR', 'ABOVE 1CR',
  'NEGOTIABLE', 'CONFIDENTIAL', 'NOT DISCLOSED',
];
const DEFAULT_NOTICE = [
  'IMMEDIATE', '15 DAYS', '30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS', 'SERVING NOTICE',
];
const DEFAULT_EXPERIENCE = [
  'FRESHER',
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
];

async function loadCareersFieldOptions(organizationId) {
  const rows = await OrgListItem.find({
    organizationId,
    listKey: { $in: ['ctc', 'notice', 'experience'] },
    isActive: true,
  }).sort({ sortOrder: 1, name: 1 }).lean();

  const ctc = [];
  const notice = [];
  const experience = [];
  for (const row of rows) {
    const name = normalizeText(row.name || '');
    if (!name) continue;
    if (row.listKey === 'ctc') ctc.push(name);
    else if (row.listKey === 'notice') notice.push(name);
    else if (row.listKey === 'experience') experience.push(name);
  }

  const ctcBands = ctc.length ? ctc : DEFAULT_CTC;
  const noticeBands = notice.length ? notice : DEFAULT_NOTICE;
  // Prefer org experience catalog when maintained; else ATS year bands
  const experienceBands = experience.length ? experience : DEFAULT_EXPERIENCE;
  const expectedCtc = ctcBands.includes('AS PER COMPANY NORMS')
    ? ctcBands
    : ['AS PER COMPANY NORMS', ...ctcBands];

  return {
    experience: experienceBands,
    ctc: ctcBands,
    expectedCtc,
    noticePeriod: noticeBands,
  };
}

const xmlEscape = (str = '') => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function assertCareersLive(org) {
  // Treat missing flag as enabled for backwards compatibility; only block when explicitly false.
  if (org?.atsSettings && org.atsSettings.careersPageEnabled === false) {
    throw httpError('Careers page is not currently accepting applications.', 403);
  }
}

/** Open jobs appear on careers; never mutate records from a public GET. */
function publicOpenJobFilter(organizationId) {
  return {
    organizationId,
    status: 'Open',
    isPublished: { $ne: false },
  };
}

function publicSalaryRange(salaryRange) {
  if (!salaryRange || !salaryRange.displayPublicly) return undefined;
  return {
    min: salaryRange.min,
    max: salaryRange.max,
    currency: salaryRange.currency || 'INR',
    displayPublicly: true,
  };
}

function toPublicJobDoc(job) {
  const raw = job && typeof job.toObject === 'function' ? job.toObject() : { ...(job || {}) };
  const salaryRange = publicSalaryRange(raw.salaryRange);
  return {
    _id: raw._id,
    title: raw.title,
    department: raw.department,
    location: raw.location,
    locations: raw.locations,
    employmentType: raw.employmentType,
    description: raw.description,
    skills: raw.skills,
    experience: raw.experience,
    clientName: raw.clientName,
    grade: raw.grade,
    industry: raw.industry,
    jobCode: raw.jobCode,
    isPublished: raw.isPublished !== false,
    publishedAt: raw.publishedAt,
    priority: raw.priority,
    createdAt: raw.createdAt,
    openedAt: raw.openedAt,
    updatedAt: raw.updatedAt,
    ...(salaryRange ? { salaryRange } : {}),
  };
}

const publicHitBuckets = new Map();

function assertPublicRateLimit(bucketKey, { limit = 30, windowMs = 60 * 1000 } = {}) {
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

function parseCustomResponses(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function trimStr(v) {
  return String(v ?? '').trim();
}

function fillIfEmpty(doc, key, value) {
  const next = trimStr(value);
  if (!next) return;
  const cur = trimStr(doc[key]);
  if (!cur) doc[key] = next;
}

/**
 * Indeed/Google-for-Jobs-compatible XML feed of published jobs.
 * Gated by 'integrations.jobBoard' (Enterprise).
 */
async function getJobsXmlFeed(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug }).select('name plan atsSettings');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);
  if (!planHasFeature(org.plan, 'integrations.jobBoard')) {
    throw httpError('Job board feed is not available on this organization\'s current plan.', 403);
  }

  const jobs = await Job.find({ ...publicOpenJobFilter(org._id), isPublished: true })
    .select('title department location employmentType description skills salaryRange updatedAt jobCode');

  const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const items = jobs.map((job) => `
  <job>
    <title><![CDATA[${job.title}]]></title>
    <date>${(job.updatedAt || new Date()).toUTCString()}</date>
    <referencenumber>${job._id}</referencenumber>
    <url><![CDATA[${baseUrl}/careers/${orgSlug}/jobs/${job._id}]]></url>
    <company><![CDATA[${xmlEscape(org.name)}]]></company>
    <city><![CDATA[${xmlEscape(job.location)}]]></city>
    <description><![CDATA[${job.description || ''}]]></description>
    <jobtype>${xmlEscape(job.employmentType || 'full_time')}</jobtype>
    ${job.salaryRange?.displayPublicly && job.salaryRange?.min ? `<salary>${job.salaryRange.min}-${job.salaryRange.max || job.salaryRange.min} ${job.salaryRange.currency || 'INR'}</salary>` : ''}
  </job>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n  <publisher>${xmlEscape(org.name)}</publisher>${items}\n</source>`;
}

/**
 * Resolve a custom careers-page domain to the org slug.
 */
async function resolveByDomain(domain) {
  const org = await Organization.findOne({
    'atsSettings.careersCustomDomain': String(domain).toLowerCase().trim()
  }).select('slug plan');
  if (!org) throw httpError('No organization found for this domain', 404);
  if (!planHasFeature(org.plan, 'careers.customDomain')) {
    throw httpError('Custom domain careers pages require the Enterprise plan.', 403);
  }
  return { slug: org.slug };
}

/**
 * Org public info + list of published jobs.
 */
async function getCareersPage(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name logo slug plan settings.careersPageTitle settings.careersPageDescription atsSettings.brandColor atsSettings.whiteLabel atsSettings.pageBlocks atsSettings.careersPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const jobs = await Job.find(publicOpenJobFilter(org._id))
    .select('title department location locations employmentType isPublished priority skills createdAt openedAt publishedAt industry experience clientName jobCode grade updatedAt')
    .sort({ priority: -1, openedAt: -1, createdAt: -1 })
    .lean();

  const whiteLabelActive = !!org.atsSettings?.whiteLabel?.enabled && planHasFeature(org.plan, 'whiteLabel');
  let pageBlocks = org.atsSettings?.pageBlocks || [];
  if (!planHasFeature(org.plan, 'careers.pageBuilder')) {
    pageBlocks = [];
  } else if (!planHasFeature(org.plan, 'careers.whiteLabelBuilder')) {
    const enterpriseTypes = ['custom_css', 'custom_html', 'video_hero', 'testimonials'];
    pageBlocks = pageBlocks.filter((b) => !enterpriseTypes.includes(b.type));
  }
  const organization = {
    name: org.name,
    logo: org.logo,
    slug: org.slug,
    careersPageTitle: org.settings?.careersPageTitle || '',
    careersPageDescription: org.settings?.careersPageDescription || '',
    brandColor: org.atsSettings?.brandColor || '#0d9488',
    whiteLabelActive,
    hidePoweredBy: whiteLabelActive && !!org.atsSettings?.whiteLabel?.hidePoweredBy,
    pageBlocks,
  };

  return { organization, jobs: jobs.map(toPublicJobDoc) };
}

/**
 * Job detail for public view (includes optional application form).
 */
async function getPublicJob(orgSlug, jobId) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name logo slug plan atsSettings.brandColor atsSettings.careersPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await Job.findOne({
    ...publicOpenJobFilter(org._id),
    _id: jobId,
  }).select('title department location locations description skills employmentType salaryRange experience clientName grade industry isPublished publishedAt jobCode');
  if (!job) throw httpError('Job not found', 404);

  let applicationForm = null;
  if (planHasFeature(org.plan, 'careers.formBuilder')) {
    const JobApplicationForm = require('../models/JobApplicationForm');
    const form = await JobApplicationForm.findOne({
      organizationId: org._id,
      jobId: job._id,
      isActive: true
    }).lean();
    if (form) {
      applicationForm = {
        title: form.title,
        fields: (form.fields || []).map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder,
          options: f.options,
          order: f.order,
          showWhen: f.showWhen || null
        }))
      };
    }
  }

  const publicJob = toPublicJobDoc(job);
  return {
    data: publicJob,
    job: publicJob,
    organization: {
      name: org.name,
      logo: org.logo,
      brandColor: org.atsSettings?.brandColor || '#0d9488',
      slug: org.slug,
    },
    applicationForm,
    fieldOptions: await loadCareersFieldOptions(org._id),
  };
}

/**
 * Public check: has this email or phone already applied to this job?
 * Email+job is primary; phone+job is a secondary hard block.
 */
async function checkAlreadyApplied(orgSlug, jobId, emailRaw, phoneRaw, rateKey = '') {
  if (rateKey) assertPublicRateLimit(`status:${rateKey}`, { limit: 40, windowMs: 60 * 1000 });

  const org = await Organization.findOne({ slug: orgSlug }).select('_id atsSettings.careersPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await Job.findOne({ ...publicOpenJobFilter(org._id), _id: jobId }).select('_id');
  if (!job) throw httpError('Job not found', 404);

  const email = normalizeEmail(emailRaw);
  const phone = phoneDigitsOnly(phoneRaw);

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw httpError('Enter a valid email address', 400);
    }
    const candidate = await Candidate.findOne({ email, organizationId: org._id }).select('_id');
    if (candidate) {
      const app = await Application.findOne({ candidateId: candidate._id, jobId: job._id }).select('_id');
      if (app) return { alreadyApplied: true, reason: 'email' };
    }
  }

  if (phone && phone.length === 10) {
    const phoneApp = await findApplicationByPhone(org._id, job._id, phone);
    if (phoneApp) return { alreadyApplied: true, reason: 'phone' };
  }

  return { alreadyApplied: false };
}

async function findApplicationByPhone(organizationId, jobId, phoneDigits) {
  if (!phoneDigits || phoneDigits.length !== 10) return null;
  const candidates = await Candidate.find({
    organizationId,
    $or: [
      { phone: phoneDigits },
      { contact: phoneDigits },
    ],
  }).select('_id').lean();
  if (!candidates.length) return null;
  return Application.findOne({
    candidateId: { $in: candidates.map((c) => c._id) },
    jobId,
  }).select('createdAt stage source');
}

/**
 * Send 6-digit email OTP for careers apply (keyed by org + job + email).
 */
async function sendApplyOtp(orgSlug, jobId, { email: emailRaw, name, applyOtpToken } = {}, rateKey = '') {
  if (rateKey) assertPublicRateLimit(`otp:${rateKey}`, { limit: 12, windowMs: 60 * 1000 });

  const org = await Organization.findOne({ slug: orgSlug })
    .select('_id name atsSettings.careersPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await Job.findOne({ ...publicOpenJobFilter(org._id), _id: jobId })
    .select('_id title');
  if (!job) throw httpError('Job not found', 404);

  const email = normalizeEmail(emailRaw);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Enter a valid email address', 400);
  }

  // Rate-limit resend when an existing OTP session is provided
  if (applyOtpToken) {
    try {
      const prev = readApplyOtpToken(applyOtpToken);
      if (
        normalizeEmail(prev.email) === email
        && String(prev.orgId) === String(org._id)
        && String(prev.jobId) === String(job._id)
        && prev.otpSentAt
        && Date.now() - Number(prev.otpSentAt) < APPLY_OTP_RESEND_MS
      ) {
        const waitSec = Math.ceil((APPLY_OTP_RESEND_MS - (Date.now() - Number(prev.otpSentAt))) / 1000);
        throw httpError(`Please wait ${waitSec}s before requesting a new code.`, 429, {
          code: 'otp_resend_cooldown',
          retryAfterSec: waitSec,
        });
      }
    } catch (err) {
      if (err.code === 'otp_resend_cooldown' || err.statusCode === 429) throw err;
      // Expired / invalid prior token — allow a fresh send
    }
  }

  const dup = await checkAlreadyApplied(orgSlug, jobId, email);
  if (dup.alreadyApplied) {
    throw httpError('You have already applied for this job', 409, { code: 'ALREADY_APPLIED' });
  }

  const code = generateApplyOtp();
  const nextToken = signApplyOtpToken({
    orgId: String(org._id),
    jobId: String(job._id),
    email,
    otpHash: hashApplyOtp(org._id, job._id, email, code),
    otpSentAt: Date.now(),
    attempts: 0,
    name: trimStr(name).slice(0, 120),
  });

  const brand = await loadOrgEmailBrand(org._id);
  const html = buildApplyOtpEmailHtml({
    name: trimStr(name),
    code,
    jobTitle: job.title,
    brand,
  });
  await sendEmail(
    email,
    `Your verification code for ${job.title || 'your application'}`,
    html,
    `Your verification code is ${code}. It expires in 10 minutes.`,
    {
      senderName: brand.name,
      senderEmail: brand.fromEmail,
      organizationId: org._id,
    },
  ).catch((err) => {
    logger.error({ err: err.message, email }, 'Careers apply OTP email failed');
    if (process.env.NODE_ENV === 'production') {
      throw httpError(
        'We could not send your verification code. Please try again in a moment.',
        503,
      );
    }
    if (err.message === 'EMAIL_NOT_CONFIGURED') {
      logger.warn({ email, otp: code }, 'Dev-only careers apply OTP (email not configured)');
    }
  });

  return {
    message: 'Verification code sent',
    applyOtpToken: nextToken,
    expiresInSec: Math.floor(APPLY_OTP_TTL_MS / 1000),
    resendInSec: Math.floor(APPLY_OTP_RESEND_MS / 1000),
  };
}

/**
 * Verify careers apply OTP and return a short-lived email-verified token.
 */
async function verifyApplyOtp(orgSlug, jobId, { applyOtpToken, code } = {}, rateKey = '') {
  if (rateKey) assertPublicRateLimit(`otp-verify:${rateKey}`, { limit: 30, windowMs: 60 * 1000 });

  const org = await Organization.findOne({ slug: orgSlug })
    .select('_id atsSettings.careersPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await Job.findOne({ ...publicOpenJobFilter(org._id), _id: jobId }).select('_id');
  if (!job) throw httpError('Job not found', 404);

  const decoded = readApplyOtpToken(applyOtpToken);
  if (String(decoded.orgId) !== String(org._id) || String(decoded.jobId) !== String(job._id)) {
    throw httpError('Invalid verification session. Send a new code to continue.', 401);
  }

  const attempts = Number(decoded.attempts || 0);
  if (attempts >= APPLY_OTP_MAX_ATTEMPTS) {
    throw httpError('Too many incorrect codes. Send a new code to continue.', 429, {
      code: 'otp_locked',
    });
  }
  if (decoded.otpSentAt && Date.now() - Number(decoded.otpSentAt) > APPLY_OTP_TTL_MS) {
    throw httpError('This verification code expired. Send a new code to continue.', 401);
  }
  if (!applyOtpMatches(org._id, job._id, decoded.email, String(code || '').trim(), decoded.otpHash)) {
    const nextToken = signApplyOtpToken({
      orgId: decoded.orgId,
      jobId: decoded.jobId,
      email: decoded.email,
      otpHash: decoded.otpHash,
      otpSentAt: decoded.otpSentAt,
      attempts: attempts + 1,
      name: decoded.name || '',
    });
    throw httpError('Incorrect code. Try again.', 400, {
      code: 'otp_invalid',
      applyOtpToken: nextToken,
      attemptsRemaining: APPLY_OTP_MAX_ATTEMPTS - attempts - 1,
    });
  }

  const emailVerifiedToken = signApplyVerifiedToken({
    orgId: org._id,
    jobId: job._id,
    email: decoded.email,
  });

  return {
    message: 'Email verified',
    emailVerifiedToken,
    email: decoded.email,
  };
}

async function storeResumeFile(organizationId, file) {
  if (!file) return '';
  const documentStorage = require('./documentStorageService');
  const filePath = (file.path && fs.existsSync(file.path))
    ? file.path
    : (fs.existsSync(path.join(process.cwd(), 'uploads', file.filename))
      ? path.join(process.cwd(), 'uploads', file.filename)
      : path.join(__dirname, '..', 'uploads', file.filename));

  const uploaded = await documentStorage.uploadResume({
    organizationId,
    localFilePath: filePath,
    originalName: file.originalname
  });
  if (uploaded && uploaded.key) {
    logger.info('[Careers] Resume stored via', uploaded.storage, '—', uploaded.key);
    return uploaded.key;
  }
  return `/uploads/${file.filename}`;
}

async function resolveJobSpocEmails(job) {
  const User = require('../models/User');
  const emails = new Set();
  for (const raw of job.hiringManagers || []) {
    const email = normalizeEmail(raw);
    if (email && email.includes('@')) emails.add(email);
  }
  const ids = [job.hiringManager, job.createdBy].filter(Boolean);
  if (ids.length) {
    const users = await User.find({ _id: { $in: ids } }).select('email').lean();
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (email) emails.add(email);
    }
  }
  return [...emails];
}

function careersJobUrl(orgSlug, jobId) {
  const base = (publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/careers/${orgSlug}/jobs/${jobId}`;
}

async function notifyCareersApplyEmails({
  org,
  orgSlug,
  job,
  candidate,
  application,
}) {
  const brand = await loadOrgEmailBrand(org._id);
  const jobTitle = job.title || 'the role';
  const jobCode = trimStr(job.jobCode);
  const candidateName = candidate.name || 'Candidate';
  const applyUrl = careersJobUrl(orgSlug, job._id);
  const appsUrl = (publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '')
    ? `${(publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '')}/applications`
    : '';

  const candidateHtml = wrapBrandedEmailHtml({
    title: 'Application received',
    eyebrow: 'Careers',
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
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml((candidateName || 'there').split(' ')[0])},</p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">
        Thank you for applying for <strong>${escapeHtml(jobTitle)}</strong>${jobCode ? ` (${escapeHtml(jobCode)})` : ''} at ${escapeHtml(org.name || brand.name)}.
      </p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">
        Our recruiting team has received your application and will review your profile. If there is a match, they will contact you on this email.
      </p>
      ${infoPanelHtml([
        { label: 'Role', value: jobTitle },
        ...(jobCode ? [{ label: 'Job ID', value: jobCode }] : []),
        { label: 'Status', value: 'Application received' },
      ], brand.brandColor)}
      ${applyUrl ? `<div style="text-align:center;">${brandButtonHtml({ href: applyUrl, label: 'View role', brandColor: brand.brandColor })}</div>` : ''}`,
  });

  await sendEmail(
    candidate.email,
    `We received your application – ${jobTitle} | ${org.name || brand.name}`,
    candidateHtml,
    `Thank you for applying for ${jobTitle}. Our team will review your profile.`,
    {
      senderName: brand.name,
      senderEmail: brand.fromEmail,
      organizationId: org._id,
    },
  ).catch((err) => {
    logger.warn({ err: err.message, email: candidate.email }, 'Careers candidate confirmation email failed');
  });

  const spocEmails = await resolveJobSpocEmails(job);
  if (!spocEmails.length) return;

  const spocHtml = wrapBrandedEmailHtml({
    title: 'New careers application',
    eyebrow: 'Hiring alert',
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
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">New application received</p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">
        <strong>${escapeHtml(candidateName)}</strong> applied for <strong>${escapeHtml(jobTitle)}</strong>${jobCode ? ` (${escapeHtml(jobCode)})` : ''} via the careers page.
      </p>
      ${infoPanelHtml([
        { label: 'Candidate', value: candidateName },
        { label: 'Email', value: candidate.email },
        { label: 'Phone', value: candidate.phone || candidate.contact || '—' },
        { label: 'Experience', value: candidate.experience || '—' },
        { label: 'Current CTC', value: candidate.ctc || '—' },
        { label: 'Expected CTC', value: candidate.expectedCtc || '—' },
        { label: 'Notice', value: candidate.noticePeriod || '—' },
        ...(jobCode ? [{ label: 'Job ID', value: jobCode }] : []),
      ], brand.brandColor)}
      ${appsUrl ? `<div style="text-align:center;">${brandButtonHtml({ href: appsUrl, label: 'Open applications', brandColor: brand.brandColor })}</div>` : ''}`,
  });

  await Promise.all(spocEmails.map((to) => sendEmail(
    to,
    `New application: ${candidateName} → ${jobTitle}`,
    spocHtml,
    `${candidateName} (${candidate.email}) applied for ${jobTitle} via careers.`,
    {
      senderName: brand.name,
      senderEmail: brand.fromEmail,
      organizationId: org._id,
    },
  ).catch((err) => {
    logger.warn({ err: err.message, to }, 'Careers SPOC notify email failed');
  })));
}

/**
 * Submit a public careers-page application (ATS-aligned fields + resume file).
 */
async function submitApplication(orgSlug, jobId, body = {}, file = null, rateKey = '') {
  if (rateKey) assertPublicRateLimit(`apply:${rateKey}`, { limit: 10, windowMs: 60 * 1000 });

  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await Job.findOne({ ...publicOpenJobFilter(org._id), _id: jobId });
  if (!job) throw httpError('Job not available', 404);

  const customResponses = parseCustomResponses(body.customResponses);
  const name = trimStr(body.name || [body.firstName, body.lastName].filter(Boolean).join(' '));
  const email = normalizeEmail(body.email);
  const phone = trimStr(body.phone || body.contact);
  const position = trimStr(body.position);
  const companyName = trimStr(body.companyName || body.company);
  const location = trimStr(body.location);
  const experience = trimStr(body.experience);
  const ctc = trimStr(body.ctc);
  const expectedCtc = trimStr(body.expectedCtc);
  const noticePeriod = trimStr(body.noticePeriod);
  // Always careers page — never collect source on the public form
  const source = 'Careers Page';
  const coverLetter = trimStr(body.coverLetter || body.remark);
  const remark = coverLetter;

  if (!name) throw httpError('Full name is required', 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Enter a valid email address', 400);
  }
  readApplyVerifiedToken(body.emailVerifiedToken, { orgId: org._id, jobId: job._id, email });

  const phoneDigits = phoneDigitsOnly(phone);
  if (!phone || phoneDigits.length !== 10) {
    throw httpError('Enter a valid 10-digit mobile number', 400);
  }
  if (!experience) throw httpError('Experience is required', 400);
  if (!ctc) throw httpError('Current CTC is required', 400);
  if (!expectedCtc) throw httpError('Expected CTC is required', 400);
  if (!noticePeriod) throw httpError('Notice period is required', 400);
  if (!file && !trimStr(body.resume)) {
    throw httpError('Resume / CV is required', 400);
  }

  // Block duplicates before writing candidate / resume (email+job, then phone+job)
  const existingCand = await Candidate.findOne({ email, organizationId: org._id }).select('_id');
  if (existingCand) {
    const existingApp = await Application.findOne({ candidateId: existingCand._id, jobId: job._id }).select('_id');
    if (existingApp) {
      throw httpError('You have already applied for this job', 409, { code: 'ALREADY_APPLIED' });
    }
  }
  const phoneDup = await findApplicationByPhone(org._id, job._id, phoneDigits);
  if (phoneDup) {
    throw httpError('You have already applied for this job', 409, { code: 'ALREADY_APPLIED' });
  }

  if (planHasFeature(org.plan, 'careers.formBuilder')) {
    const JobApplicationForm = require('../models/JobApplicationForm');
    const form = await JobApplicationForm.findOne({
      organizationId: org._id,
      jobId: job._id,
      isActive: true
    }).lean();
    if (form) {
      for (const field of form.fields || []) {
        if (!field.required) continue;
        const rule = field.showWhen;
        if (rule?.fieldKey) {
          if (String(customResponses[rule.fieldKey] ?? '') !== String(rule.equals ?? '')) continue;
        }
        const val = customResponses[field.key];
        if (val == null || String(val).trim() === '') {
          throw httpError(`${field.label} is required`, 400);
        }
      }
    }
  }

  let resumeKey = trimStr(body.resume);
  if (file) {
    try {
      resumeKey = await storeResumeFile(org._id, file);
    } catch (err) {
      logger.error({ err }, '[Careers] Resume upload failed');
      throw httpError('Failed to store resume. Please try again.', 500);
    }
  }

  const textFields = {
    name: normalizeText(name),
    position: position ? normalizeText(position) : '',
    companyName: companyName ? normalizeText(companyName) : '',
    location: location ? normalizeText(location) : '',
    experience: experience ? normalizeText(experience) : '',
    ctc: ctc ? normalizeText(ctc) : '',
    expectedCtc: expectedCtc ? normalizeText(expectedCtc) : '',
    noticePeriod: noticePeriod ? normalizeText(noticePeriod) : '',
    source: normalizeText(source),
    remark: remark ? normalizeText(remark) : '',
  };

  let candidate = existingCand
    ? await Candidate.findById(existingCand._id)
    : null;
  if (!candidate) {
    candidate = new Candidate({
      organizationId: org._id,
      name: textFields.name,
      email,
      phone: phoneDigits,
      contact: phoneDigits,
      position: textFields.position || (job.title ? normalizeText(job.title) : ''),
      companyName: textFields.companyName,
      location: textFields.location || (job.location ? normalizeText(job.location) : ''),
      experience: textFields.experience,
      ctc: textFields.ctc || 'NA',
      expectedCtc: textFields.expectedCtc,
      noticePeriod: textFields.noticePeriod,
      source: textFields.source,
      remark: textFields.remark,
      resume: resumeKey,
      status: 'APPLIED',
      statusEnteredAt: new Date(),
      customFields: customResponses,
    });
    if (!Array.isArray(candidate.statusHistory) || candidate.statusHistory.length === 0) {
      candidate.statusHistory = [{
        status: 'APPLIED',
        remark: 'Applied via careers page',
        updatedAt: new Date(),
        updatedBy: 'Careers Page',
      }];
    }
    await candidate.save();
  } else {
    fillIfEmpty(candidate, 'name', textFields.name);
    fillIfEmpty(candidate, 'phone', phoneDigits);
    fillIfEmpty(candidate, 'contact', phoneDigits);
    fillIfEmpty(candidate, 'position', textFields.position);
    fillIfEmpty(candidate, 'companyName', textFields.companyName);
    fillIfEmpty(candidate, 'location', textFields.location);
    fillIfEmpty(candidate, 'experience', textFields.experience);
    fillIfEmpty(candidate, 'ctc', textFields.ctc);
    fillIfEmpty(candidate, 'expectedCtc', textFields.expectedCtc);
    fillIfEmpty(candidate, 'noticePeriod', textFields.noticePeriod);
    fillIfEmpty(candidate, 'source', textFields.source);
    if (resumeKey && !trimStr(candidate.resume)) candidate.resume = resumeKey;
    if (textFields.remark) {
      const existingRemark = trimStr(candidate.remark);
      candidate.remark = existingRemark
        ? `${existingRemark}\n\n[Careers apply] ${textFields.remark}`
        : textFields.remark;
    }
    if (Object.keys(customResponses).length) {
      candidate.customFields = { ...(candidate.customFields || {}), ...customResponses };
    }
    await candidate.save();
  }

  const existingApp = await Application.findOne({ candidateId: candidate._id, jobId: job._id });
  if (existingApp) {
    throw httpError('You have already applied for this job', 409, { code: 'ALREADY_APPLIED' });
  }

  const application = new Application({
    organizationId: org._id,
    jobId: job._id,
    candidateId: candidate._id,
    stage: 'Applied',
    source: 'Careers Page',
    coverLetter: coverLetter.slice(0, 5000),
    notes: coverLetter.slice(0, 5000),
    stageHistory: [{ stage: 'Applied', movedAt: new Date(), remark: 'Applied via careers page' }],
  });
  await application.save();

  try {
    const eventBus = require('../events/eventBus');
    const eventTypes = require('../events/eventTypes');
    eventBus.emit(eventTypes.APPLICATION_CREATED, {
      organizationId: org._id,
      applicationId: application._id,
      jobId: job._id,
      candidateId: candidate._id,
      source: 'Careers Page',
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'Careers APPLICATION_CREATED emit failed');
  }

  notifyCareersApplyEmails({
    org,
    orgSlug,
    job,
    candidate,
    application,
  }).catch((err) => {
    logger.warn({ err: err.message }, 'Careers apply notification emails failed');
  });

  return {
    applicationId: application._id,
    candidateId: candidate._id,
    message: 'Application submitted successfully',
  };
}

module.exports = {
  getJobsXmlFeed,
  resolveByDomain,
  getCareersPage,
  getPublicJob,
  checkAlreadyApplied,
  sendApplyOtp,
  verifyApplyOtp,
  submitApplication,
};
