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
const { normalizeText } = require('../utils/textNormalize');
const logger = require('../utils/logger');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
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

  const jobs = await Job.find({ organizationId: org._id, isPublished: true, status: 'Open' })
    .select('title department location employmentType description skills salaryRange updatedAt');

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
    .select('name logo slug plan settings.careersPageTitle settings.careersPageDescription atsSettings');
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  // Open = live on careers. Backfill isPublished for older Open jobs.
  const jobs = await Job.find({ organizationId: org._id, status: 'Open' })
    .select('title department location locations employmentType isPublished priority skills createdAt openedAt publishedAt industry experience clientName ctc jobCode grade updatedAt')
    .sort({ priority: -1, openedAt: -1, createdAt: -1 });

  const unpublished = jobs.filter((j) => !j.isPublished).map((j) => j._id);
  if (unpublished.length) {
    await Job.updateMany(
      { _id: { $in: unpublished } },
      { $set: { isPublished: true, publishedAt: new Date() } },
    );
    jobs.forEach((j) => {
      if (!j.isPublished) {
        j.isPublished = true;
      }
    });
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
    _id: org._id,
    name: org.name,
    logo: org.logo,
    slug: org.slug,
    settings: org.settings,
    careersPageTitle: org.settings?.careersPageTitle || '',
    careersPageDescription: org.settings?.careersPageDescription || '',
    brandColor: org.atsSettings?.brandColor || '#0d9488',
    whiteLabelActive,
    hidePoweredBy: whiteLabelActive && !!org.atsSettings?.whiteLabel?.hidePoweredBy,
    pageBlocks
  };

  return { organization, jobs };
}

/**
 * Job detail for public view (includes optional application form).
 */
async function getPublicJob(orgSlug, jobId) {
  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  // Open jobs are careers-eligible. Backfill isPublished for older Open jobs.
  let job = await Job.findOne({ _id: jobId, organizationId: org._id, status: 'Open' })
    .select('title department location locations description skills employmentType salaryRange ctc experience clientName grade industry isPublished publishedAt');
  if (!job) throw httpError('Job not found', 404);

  if (!job.isPublished) {
    job.isPublished = true;
    job.publishedAt = job.publishedAt || new Date();
    await job.save();
  }

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

  return {
    data: job,
    job,
    organization: {
      name: org.name,
      logo: org.logo,
      brandColor: org.atsSettings?.brandColor || '#0d9488',
      slug: org.slug
    },
    applicationForm,
    fieldOptions: await loadCareersFieldOptions(org._id),
  };
}

/**
 * Public check: has this email already applied to this job?
 */
async function checkAlreadyApplied(orgSlug, jobId, emailRaw) {
  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  const job = await Job.findOne({ _id: jobId, organizationId: org._id, status: 'Open' }).select('_id');
  if (!job) throw httpError('Job not found', 404);

  const email = trimStr(emailRaw).toLowerCase();
  if (!email) return { alreadyApplied: false };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Enter a valid email address', 400);
  }

  const candidate = await Candidate.findOne({ email, organizationId: org._id }).select('_id');
  if (!candidate) return { alreadyApplied: false };

  const app = await Application.findOne({ candidateId: candidate._id, jobId: job._id })
    .select('createdAt stage source');
  if (!app) return { alreadyApplied: false };

  return {
    alreadyApplied: true,
    appliedAt: app.createdAt,
    stage: app.stage || 'Applied',
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

/**
 * Submit a public careers-page application (ATS-aligned fields + resume file).
 */
async function submitApplication(orgSlug, jobId, body = {}, file = null) {
  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) throw httpError('Organization not found', 404);
  assertCareersLive(org);

  // Open jobs accept applications; backfill isPublished for older Open jobs
  const job = await Job.findOne({ _id: jobId, organizationId: org._id, status: 'Open' });
  if (!job) throw httpError('Job not available', 404);
  if (!job.isPublished) {
    job.isPublished = true;
    job.publishedAt = job.publishedAt || new Date();
    await job.save();
  }

  const customResponses = parseCustomResponses(body.customResponses);
  const name = trimStr(body.name || [body.firstName, body.lastName].filter(Boolean).join(' '));
  const email = trimStr(body.email).toLowerCase();
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
  const phoneDigits = phone.replace(/\D/g, '');
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

  // Block duplicates before writing candidate / resume
  const existingCand = await Candidate.findOne({ email, organizationId: org._id }).select('_id');
  if (existingCand) {
    const existingApp = await Application.findOne({ candidateId: existingCand._id, jobId: job._id }).select('_id');
    if (existingApp) {
      throw httpError('You have already applied for this job', 409, { code: 'ALREADY_APPLIED' });
    }
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
  submitApplication,
};
