/**
 * Public careers-page domain logic (job feed, org page, apply).
 */
const path = require('path');
const fs = require('fs');
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const OrgListItem = require('../models/OrgListItem');
const { planHasFeature } = require('../config/planFeatures');
const { checkOrgPlanLimit } = require('../middleware/rbacMiddleware');
const { normalizeText } = require('../utils/textNormalize');
const { publicDomainLabel, scrubPublicJobHtml, publicEmployerLabel, isOwnCompanyHire } = require('../utils/publicJobPrivacy');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  loadSendingEmailBrand,
  escapeHtml,
  brandButtonHtml,
  infoPanelHtml,
  publicSiteBase,
} = require('./emailBrandLayout');
const {
  findPublicOpenJob,
  ensurePublicId,
  careersJobPathSegment,
} = require('./jobPublicIdService');
const { allocateCandidateCode, allocateApplicationCode, ensureCandidateCode, ensureApplicationCode } = require('./candidateCodeService');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function phoneDigitsOnly(raw) {
  return String(raw || '').replace(/\D/g, '');
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

/** CDATA cannot contain `]]>`. */
function cdataSafe(value) {
  return String(value ?? '').replace(/]]>/g, '');
}

function publicJobDescription(job, orgName) {
  const html = job?.description || '';
  if (isOwnCompanyHire(job?.clientName, orgName)) return String(html);
  return scrubPublicJobHtml(html, job?.clientName);
}

function buildJobXmlItem({ job, orgName, orgSlug, baseUrl, referencePrefix = '' }) {
  const pathId = careersJobPathSegment(job);
  const ref = `${referencePrefix}${job.jobCode || pathId}`;
  const salary = job.salaryRange?.displayPublicly && job.salaryRange?.min
    ? `<salary>${xmlEscape(String(job.salaryRange.min))}-${xmlEscape(String(job.salaryRange.max || job.salaryRange.min))} ${xmlEscape(job.salaryRange.currency || 'INR')}</salary>`
    : '';
  return `
  <job>
    <title><![CDATA[${cdataSafe(job.title)}]]></title>
    <date>${(job.updatedAt || new Date()).toUTCString()}</date>
    <referencenumber>${xmlEscape(ref)}</referencenumber>
    <url><![CDATA[${cdataSafe(`${baseUrl}/careers/${orgSlug}/jobs/${pathId}`)}]]></url>
    <company><![CDATA[${cdataSafe(orgName)}]]></company>
    <city><![CDATA[${cdataSafe(job.location)}]]></city>
    <description><![CDATA[${cdataSafe(publicJobDescription(job, orgName))}]]></description>
    <jobtype>${xmlEscape(job.employmentType || 'full_time')}</jobtype>
    ${salary}
  </job>`;
}

function buildJobsXmlDocument({ publisher, publisherUrl = '', itemsXml = '' }) {
  const pubUrl = publisherUrl
    ? `\n  <publisherurl>${xmlEscape(publisherUrl)}</publisherurl>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n  <publisher>${xmlEscape(publisher)}</publisher>${pubUrl}${itemsXml}\n</source>`;
}

function liveFeedOrgFilter() {
  return {
    isActive: { $ne: false },
    archivedAt: null,
    isDemo: { $ne: true },
    slug: { $exists: true, $nin: [null, ''] },
    'atsSettings.careersPageEnabled': { $ne: false },
  };
}

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

function toPublicJobDoc(job, org = {}) {
  const raw = job && typeof job.toObject === 'function' ? job.toObject() : { ...(job || {}) };
  const salaryRange = publicSalaryRange(raw.salaryRange);
  const publicId = String(raw.publicId || '').trim().toLowerCase() || null;
  const industry = String(raw.industry || '').trim();
  const orgName = String(org.name || '').trim();
  const ownHire = isOwnCompanyHire(raw.clientName, orgName);
  const employerLabel = publicEmployerLabel({
    industry,
    clientName: raw.clientName,
    orgName,
  });
  return {
    // Link key for careers URLs — never expose Mongo ObjectId on public pages.
    id: publicId || careersJobPathSegment(raw),
    publicId,
    title: raw.title,
    department: raw.department,
    location: raw.location,
    locations: raw.locations,
    employmentType: raw.employmentType,
    description: ownHire
      ? raw.description
      : scrubPublicJobHtml(raw.description, raw.clientName),
    skills: raw.skills,
    experience: raw.experience,
    grade: raw.grade,
    industry,
    domainLabel: ownHire ? employerLabel : publicDomainLabel(industry),
    employerLabel,
    ownHire,
    jobCode: raw.jobCode,
    isPublished: raw.isPublished !== false,
    publishedAt: raw.publishedAt,
    priority: raw.priority,
    createdAt: raw.createdAt,
    openedAt: raw.openedAt,
    updatedAt: raw.updatedAt,
    ...(salaryRange ? { salaryRange } : {}),
    workplaceType: raw.workplaceType || undefined,
    validThrough: raw.validThrough || undefined,
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

const JOB_FEED_SELECT = 'title location locations employmentType workplaceType description salaryRange updatedAt publishedAt jobCode publicId clientName organizationId';

/**
 * Indeed/Google-for-Jobs-compatible XML feed of published jobs for one tenant.
 * Gated by 'integrations.jobBoard' (Enterprise).
 */
async function getJobsXmlFeed(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug }).select('name slug plan atsSettings');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);
  if (!planHasFeature(org.plan, 'integrations.jobBoard')) {
    throw httpError('Job board feed is not available on this organization\'s current plan.', 403);
  }

  const jobs = await Job.find({ ...publicOpenJobFilter(org._id), isPublished: true })
    .select(JOB_FEED_SELECT);

  for (const job of jobs) {
    await ensurePublicId(job);
  }

  const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const items = jobs.map((job) => buildJobXmlItem({
    job,
    orgName: org.name,
    orgSlug,
    baseUrl,
  })).join('');

  return buildJobsXmlDocument({ publisher: org.name, itemsXml: items });
}

/**
 * Platform-wide XML of every live tenant's published careers jobs.
 * Publisher is the ATS; each <company> is that tenant (client workspace) name.
 */
async function getPlatformJobsXmlFeed() {
  const orgs = await Organization.find(liveFeedOrgFilter()).select('_id name slug atsSettings').lean();
  if (!orgs.length) {
    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    return buildJobsXmlDocument({
      publisher: process.env.PLATFORM_FEED_PUBLISHER || 'People Connect HR',
      publisherUrl: baseUrl,
      itemsXml: '',
    });
  }

  const orgById = new Map(orgs.map((org) => [String(org._id), org]));
  const jobs = await Job.find({
    organizationId: { $in: orgs.map((org) => org._id) },
    status: 'Open',
    isPublished: { $ne: false },
  }).select(JOB_FEED_SELECT).sort({ updatedAt: -1 });

  for (const job of jobs) {
    await ensurePublicId(job);
  }

  const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const items = jobs.map((job) => {
    const org = orgById.get(String(job.organizationId));
    if (!org?.slug) return '';
    return buildJobXmlItem({
      job,
      orgName: org.name,
      orgSlug: org.slug,
      baseUrl,
      referencePrefix: `${org.slug}-`,
    });
  }).join('');

  return buildJobsXmlDocument({
    publisher: process.env.PLATFORM_FEED_PUBLISHER || 'People Connect HR',
    publisherUrl: baseUrl,
    itemsXml: items,
  });
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
    .select('title department location locations employmentType workplaceType isPublished priority skills createdAt openedAt publishedAt industry experience clientName jobCode grade updatedAt publicId description')
    .sort({ priority: -1, openedAt: -1, createdAt: -1 });

  for (const job of jobs) {
    await ensurePublicId(job);
  }

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

  return { organization, jobs: jobs.map((job) => toPublicJobDoc(job, org)) };
}

/**
 * Job detail for public view (includes optional application form).
 */
async function getPublicJob(orgSlug, jobId) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name logo slug plan atsSettings.brandColor atsSettings.careersPageEnabled');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await findPublicOpenJob(
    org._id,
    jobId,
    'title department location locations description skills employmentType workplaceType validThrough salaryRange experience clientName grade industry isPublished publishedAt openedAt createdAt updatedAt jobCode publicId'
  );
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

  const publicJob = toPublicJobDoc(job, org);
  const { buildJobPostingJsonLd } = require('./googleJobsService');
  const jsonLd = buildJobPostingJsonLd(job, org);
  return {
    data: publicJob,
    job: publicJob,
    jsonLd,
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

async function getGoogleJobHtml(orgSlug, jobId) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name logo slug atsSettings.careersPageEnabled isDemo isActive archivedAt updatedAt');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await findPublicOpenJob(org._id, jobId, JOB_FEED_SELECT + ' industry experience department workplaceType validThrough publishedAt openedAt createdAt');
  if (!job) throw httpError('Job not found', 404);
  await ensurePublicId(job);

  const { buildJobPostingJsonLd, renderGoogleJobHtml } = require('./googleJobsService');
  const jsonLd = buildJobPostingJsonLd(job, org);
  return renderGoogleJobHtml(job, org, jsonLd);
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

  const job = await findPublicOpenJob(org._id, jobId, '_id publicId');
  if (!job) throw httpError('Job not found', 404);

  const email = normalizeEmail(emailRaw);
  const phone = phoneDigitsOnly(phoneRaw);

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw httpError('Enter a valid email address', 400);
    }
    const candidate = await Candidate.findOne({ email, organizationId: org._id }).select('_id candidateCode organizationId');
    if (candidate) {
      const app = await Application.findOne({ candidateId: candidate._id, jobId: job._id }).select('_id appliedAt createdAt applicationCode organizationId');
      if (app) {
        const candidateCode = await ensureCandidateCode(candidate);
        const applicationCode = await ensureApplicationCode(app);
        return {
          alreadyApplied: true,
          reason: 'email',
          candidateCode,
          applicationCode,
          existingProfile: true,
          appliedAt: app.appliedAt || app.createdAt || null,
        };
      }
    }
  }

  if (phone && phone.length === 10) {
    const phoneApp = await findApplicationByPhone(org._id, job._id, phone);
    if (phoneApp) {
      const cand = await Candidate.findById(phoneApp.candidateId).select('_id candidateCode organizationId');
      const candidateCode = cand ? await ensureCandidateCode(cand) : '';
      const applicationCode = await ensureApplicationCode(phoneApp);
      return {
        alreadyApplied: true,
        reason: 'phone',
        candidateCode,
        applicationCode,
        existingProfile: Boolean(cand),
        appliedAt: phoneApp.appliedAt || phoneApp.createdAt || null,
      };
    }
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
  }).select('createdAt appliedAt stage source candidateId applicationCode organizationId');
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

/**
 * Route careers applicants onto the job owner's ATS desk (Candidates + Applications).
 * Never stamp SPOC as "Careers Page" — that string does not match recruiter desks.
 */
async function resolveCareersDeskOwner(job, attributedUser = null) {
  const User = require('../models/User');
  const { resolveEmployeeSpocLabel, loadOrgEmployeeNames } = require('../utils/spocIdentity');
  const { isFreelancer } = require('../utils/dataScope');
  const ownerUser = attributedUser || (
    (job.hiringManager || job.createdBy)
      ? await User.findById(job.hiringManager || job.createdBy).select('_id name email role').lean()
      : null
  );
  const ownerId = ownerUser?._id || job.hiringManager || job.createdBy || null;
  const shareIds = [];
  const pushId = (raw) => {
    if (!raw) return;
    const id = String(raw);
    if (!shareIds.includes(id)) shareIds.push(id);
  };
  pushId(job.hiringManager);
  pushId(job.createdBy);
  for (const rec of job.assignedRecruiters || []) pushId(rec);

  let spocName = '';
  if (ownerUser) {
    if (isFreelancer(ownerUser)) {
      spocName = normalizeText(trimStr(ownerUser.name) || String(ownerUser.email || '').split('@')[0]);
    } else {
      const names = await loadOrgEmployeeNames(job.organizationId);
      spocName = resolveEmployeeSpocLabel(ownerUser, names);
    }
  }
  if (!spocName) spocName = trimStr(job.spocName);
  if (!spocName && Array.isArray(job.hiringManagers) && job.hiringManagers.length) {
    const first = trimStr(job.hiringManagers[0]);
    if (first && !first.includes('@')) spocName = first;
  }
  return {
    createdBy: ownerId || undefined,
    assignedTo: ownerId || undefined,
    spoc: spocName,
    shareWithIds: shareIds.filter((id) => !ownerId || String(id) !== String(ownerId)),
    client: trimStr(job.clientName),
    attributedUser,
  };
}

async function resolveAttributedSharer(organizationId, job, viaToken) {
  const { verifyJobShareToken } = require('../utils/jobShareAttribution');
  const userId = verifyJobShareToken(viaToken, { organizationId, jobId: job._id });
  if (!userId) return null;
  const User = require('../models/User');
  return User.findOne({
    _id: userId,
    organizationId,
    isActive: { $ne: false },
  }).select('_id name email role').lean();
}

function mergeSharedWith(candidate, userIds = []) {
  if (!candidate || !userIds.length) return;
  const existing = new Set(
    (candidate.sharedWith || []).map((row) => String(row.userId || '')).filter(Boolean)
  );
  const owner = candidate.createdBy ? String(candidate.createdBy) : '';
  if (!Array.isArray(candidate.sharedWith)) candidate.sharedWith = [];
  for (const raw of userIds) {
    const id = String(raw || '').trim();
    if (!id || existing.has(id) || id === owner) continue;
    candidate.sharedWith.push({ userId: id, sharedAt: new Date() });
    existing.add(id);
  }
}

function careersJobUrl(orgSlug, jobOrId) {
  const base = (publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  if (!base || !orgSlug) return '';
  const segment = typeof jobOrId === 'object' && jobOrId
    ? careersJobPathSegment(jobOrId)
    : String(jobOrId || '');
  if (!segment) return '';
  return `${base}/careers/${orgSlug}/jobs/${segment}`;
}

async function notifyCareersApplyEmails({
  org,
  orgSlug,
  job,
  candidate,
  application,
  existingProfile = false,
  extraNotifyEmail = '',
}) {
  const brand = await loadSendingEmailBrand({
    organizationId: org._id,
    system: true,
  });
  const jobTitle = job.title || 'the role';
  const jobCode = trimStr(job.jobCode);
  const candidateName = candidate.name || 'Candidate';
  const candidateCode = trimStr(candidate.candidateCode);
  const applicationCode = trimStr(application?.applicationCode);
  const applyUrl = careersJobUrl(orgSlug, job);
  const appsUrl = (publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '')
    ? `${(publicSiteBase() || process.env.FRONTEND_URL || '').replace(/\/$/, '')}/applications`
    : '';

  const candidateHtml = wrapBrandedEmailHtml({
    title: 'Application received',
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
        Our recruiting team has received your application and will review your submission. If your profile is suitable for the role, they will contact you on this email.
      </p>
      <p style="margin:0 0 12px 0;color:#475569;line-height:1.7;">
        Please retain your Candidate ID and Application ID for any future correspondence.
      </p>
      ${infoPanelHtml([
        { label: 'Role', value: jobTitle },
        ...(jobCode ? [{ label: 'Job ID', value: jobCode }] : []),
        ...(candidateCode ? [{ label: 'Candidate ID', value: candidateCode }] : []),
        ...(applicationCode ? [{ label: 'Application ID', value: applicationCode }] : []),
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
      system: true,
    },
  ).catch((err) => {
    logger.warn({ err: err.message, email: candidate.email }, 'Careers candidate confirmation email failed');
  });

  const spocEmails = await resolveJobSpocEmails(job);
  const extra = normalizeEmail(extraNotifyEmail);
  if (extra) spocEmails.push(extra);
  const uniqueEmails = [...new Set(spocEmails.filter(Boolean))];
  if (!uniqueEmails.length) return;

  const spocHtml = wrapBrandedEmailHtml({
    title: 'New careers application',
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
        ${existingProfile
          ? ' This email/phone was already in ATS — the existing candidate profile was not overwritten.'
          : ''}
      </p>
      ${infoPanelHtml([
        { label: 'Candidate', value: candidateName },
        ...(candidateCode ? [{ label: 'Candidate ID', value: candidateCode }] : []),
        ...(applicationCode ? [{ label: 'Application ID', value: applicationCode }] : []),
        { label: 'Email', value: candidate.email },
        { label: 'Phone', value: candidate.phone || candidate.contact || '—' },
        { label: 'Experience', value: candidate.experience || '—' },
        { label: 'Current CTC', value: candidate.ctc || '—' },
        { label: 'Expected CTC', value: candidate.expectedCtc || '—' },
        { label: 'Notice', value: candidate.noticePeriod || '—' },
        ...(jobCode ? [{ label: 'Job ID', value: jobCode }] : []),
        ...(existingProfile ? [{ label: 'ATS profile', value: 'Existing — not changed' }] : []),
      ], brand.brandColor)}
      ${appsUrl ? `<div style="text-align:center;">${brandButtonHtml({ href: appsUrl, label: 'Open applications', brandColor: brand.brandColor })}</div>` : ''}`,
  });

  await Promise.all(uniqueEmails.map((to) => sendEmail(
    to,
    `New application: ${candidateName} → ${jobTitle}`,
    spocHtml,
    `${candidateName} (${candidate.email}) applied for ${jobTitle} via careers.`,
    {
      senderName: brand.name,
      senderEmail: brand.fromEmail,
      organizationId: org._id,
      system: true,
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

  const job = await findPublicOpenJob(org._id, jobId);
  if (!job) throw httpError('Job not available', 404);

  const CORE_APPLY_KEYS = new Set([
    'name', 'firstName', 'lastName', 'email', 'phone', 'contact', 'position',
    'companyName', 'company', 'location', 'experience', 'ctc', 'expectedCtc',
    'noticePeriod', 'source', 'coverLetter', 'remark', 'resume', 'customResponses',
  ]);
  const customResponses = { ...parseCustomResponses(body.customResponses) };
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    for (const [key, val] of Object.entries(body)) {
      if (CORE_APPLY_KEYS.has(key)) continue;
      if (val == null || val === '') continue;
      if (customResponses[key] == null) customResponses[key] = val;
    }
  }
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
  const existingCand = await Candidate.findOne({ email, organizationId: org._id }).select('_id candidateCode organizationId');
  if (existingCand) {
    const existingApp = await Application.findOne({ candidateId: existingCand._id, jobId: job._id }).select('_id applicationCode organizationId');
    if (existingApp) {
      const candidateCode = await ensureCandidateCode(existingCand);
      const applicationCode = await ensureApplicationCode(existingApp);
      throw httpError('An application for this job is already on file', 409, {
        code: 'ALREADY_APPLIED',
        candidateCode,
        applicationCode,
        existingProfile: true,
      });
    }
  }
  const phoneDup = await findApplicationByPhone(org._id, job._id, phoneDigits);
  if (phoneDup) {
    const phoneCand = await Candidate.findById(phoneDup.candidateId).select('_id candidateCode organizationId');
    const candidateCode = phoneCand ? await ensureCandidateCode(phoneCand) : '';
    const applicationCode = await ensureApplicationCode(phoneDup);
    throw httpError('An application for this job is already on file', 409, {
      code: 'ALREADY_APPLIED',
      candidateCode,
      applicationCode,
      existingProfile: true,
    });
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

  const attributedUser = await resolveAttributedSharer(org._id, job, body.via || body.shareVia || '');
  const desk = await resolveCareersDeskOwner(job, attributedUser);
  const todayIso = new Date().toISOString().split('T')[0];
  let existingProfile = false;

  if (!candidate) {
    // New public applicant counts against the employer's plan candidate quota.
    const limitCheck = await checkOrgPlanLimit(org, 'candidates');
    if (!limitCheck.ok) {
      throw httpError('This employer is not accepting new applications at the moment. Please try again later.', 403, {
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }
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
      appliedAt: new Date(),
      date: todayIso,
      spoc: desk.spoc,
      client: desk.client,
      createdBy: desk.createdBy,
      customFields: customResponses,
      candidateCode: await allocateCandidateCode(org._id),
    });
    mergeSharedWith(candidate, desk.shareWithIds);
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
    existingProfile = true;
    // Keep existing ATS contact data. Share the attributed desk so they can see this apply.
    if (!candidate.createdBy && desk.createdBy) candidate.createdBy = desk.createdBy;
    const currentSpoc = trimStr(candidate.spoc);
    if (!currentSpoc || /^careers\s*page$/i.test(currentSpoc)) {
      if (desk.spoc) candidate.spoc = desk.spoc;
    }
    mergeSharedWith(candidate, [
      desk.createdBy,
      ...desk.shareWithIds,
    ].filter(Boolean));
    await ensureCandidateCode(candidate);
    if (candidate.isModified()) await candidate.save();
  }

  const existingApp = await Application.findOne({ candidateId: candidate._id, jobId: job._id });
  if (existingApp) {
    const candidateCode = await ensureCandidateCode(candidate);
    const applicationCode = await ensureApplicationCode(existingApp);
    throw httpError('An application for this job is already on file', 409, {
      code: 'ALREADY_APPLIED',
      candidateCode,
      applicationCode,
      existingProfile: true,
    });
  }

  const application = new Application({
    organizationId: org._id,
    jobId: job._id,
    candidateId: candidate._id,
    stage: 'Applied',
    source: 'Careers Page',
    assignedTo: desk.assignedTo,
    coverLetter: coverLetter.slice(0, 5000),
    notes: coverLetter.slice(0, 5000),
    appliedAt: new Date(),
    applicationCode: await allocateApplicationCode(org._id),
    metadata: {
      submittedBy: desk.createdBy ? String(desk.createdBy) : undefined,
      attributedRole: attributedUser?.role || '',
      viaJobShare: Boolean(attributedUser),
    },
    stageHistory: [{
      stage: 'Applied',
      movedAt: new Date(),
      remark: attributedUser
        ? `Applied via job link shared by ${trimStr(attributedUser.name) || trimStr(attributedUser.email) || 'desk owner'}`
        : 'Applied via careers page',
    }],
  });
  await application.save();
  Job.findByIdAndUpdate(job._id, { $inc: { applicationCount: 1 } }).catch(() => {});

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
    existingProfile,
    extraNotifyEmail: attributedUser?.email || '',
  }).catch((err) => {
    logger.warn({ err: err.message }, 'Careers apply notification emails failed');
  });

  const candidateCode = String(candidate.candidateCode || '').trim().toUpperCase();
  const applicationCode = String(application.applicationCode || '').trim().toUpperCase();
  return {
    applicationId: application._id,
    candidateId: candidate._id,
    candidateCode,
    applicationCode,
    existingProfile,
    message: existingProfile
      ? 'Application submitted. Your existing ATS profile was not changed.'
      : 'Application submitted successfully',
  };
}

module.exports = {
  getJobsXmlFeed,
  getPlatformJobsXmlFeed,
  buildJobsXmlDocument,
  cdataSafe,
  resolveByDomain,
  getCareersPage,
  getPublicJob,
  getGoogleJobHtml,
  checkAlreadyApplied,
  submitApplication,
  careersJobUrl,
  publicTurnstileConfig: () => require('../utils/turnstile').publicTurnstileConfig(),
};
