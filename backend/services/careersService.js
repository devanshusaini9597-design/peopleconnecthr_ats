/**
 * Public careers-page domain logic (job feed, org page, apply).
 */
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const { planHasFeature } = require('../config/planFeatures');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const xmlEscape = (str = '') => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Indeed/Google-for-Jobs-compatible XML feed of published jobs.
 * Gated by 'integrations.jobBoard' (Enterprise).
 */
async function getJobsXmlFeed(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug }).select('name plan');
  if (!org) throw httpError('Organization not found', 404);
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
    .select('name logo plan settings.careersPageTitle settings.careersPageDescription atsSettings.brandColor atsSettings.whiteLabel atsSettings.pageBlocks');
  if (!org) throw httpError('Organization not found', 404);

  const jobs = await Job.find({ organizationId: org._id, isPublished: true, status: 'Open' })
    .select('title department location employmentType');

  // White-Label Kit (Enterprise) — only honor the toggle if the org's
  // *current* plan is actually entitled, never trust the stored flag
  // alone (a downgraded org shouldn't keep the perk just because the
  // field is still `true` in the database).
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
    settings: org.settings,
    brandColor: org.atsSettings?.brandColor || '#4F46E5',
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

  const job = await Job.findOne({ _id: jobId, organizationId: org._id, isPublished: true, status: 'Open' })
    .select('title department location description skills employmentType salaryRange');
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

  return {
    data: job,
    job,
    organization: {
      name: org.name,
      logo: org.logo,
      brandColor: org.atsSettings?.brandColor || '#0d9488',
      slug: org.slug
    },
    applicationForm
  };
}

/**
 * Submit a public careers-page application.
 */
async function submitApplication(orgSlug, jobId, body = {}) {
  const org = await Organization.findOne({ slug: orgSlug });
  if (!org) throw httpError('Organization not found', 404);

  const job = await Job.findOne({ _id: jobId, organizationId: org._id, isPublished: true });
  if (!job) throw httpError('Job not available', 404);

  const { name, email, phone, resume, coverLetter, source, customResponses, firstName, lastName } = body;
  const resolvedName = name || [firstName, lastName].filter(Boolean).join(' ').trim();
  if (!resolvedName || !email) {
    throw httpError('Name and email are required', 400);
  }

  // Validate required custom form fields when form builder is entitled
  if (planHasFeature(org.plan, 'careers.formBuilder') && customResponses && typeof customResponses === 'object') {
    const JobApplicationForm = require('../models/JobApplicationForm');
    const form = await JobApplicationForm.findOne({
      organizationId: org._id,
      jobId: job._id,
      isActive: true
    }).lean();
    if (form) {
      for (const field of form.fields || []) {
        if (!field.required) continue;
        const val = customResponses[field.key];
        if (val == null || String(val).trim() === '') {
          throw httpError(`${field.label} is required`, 400);
        }
      }
    }
  }

  let candidate = await Candidate.findOne({ email: String(email).toLowerCase().trim(), organizationId: org._id });
  if (!candidate) {
    candidate = new Candidate({
      organizationId: org._id,
      name: resolvedName,
      email: String(email).toLowerCase().trim(),
      phone: phone || '',
      contact: phone || '',
      resume,
      customFields: customResponses && typeof customResponses === 'object' ? customResponses : {}
    });
    await candidate.save();
  } else if (customResponses && typeof customResponses === 'object') {
    candidate.customFields = { ...(candidate.customFields || {}), ...customResponses };
    await candidate.save();
  }

  const existingApp = await Application.findOne({ candidateId: candidate._id, jobId: job._id });
  if (existingApp) throw httpError('You have already applied for this job', 400);

  const application = new Application({
    organizationId: org._id,
    jobId: job._id,
    candidateId: candidate._id,
    stage: 'Applied',
    source: source || 'Careers Page',
    coverLetter,
    stageHistory: [{ stage: 'Applied', changedAt: new Date() }]
  });
  await application.save();

  return { applicationId: application._id, message: 'Application submitted successfully' };
}

module.exports = {
  getJobsXmlFeed,
  resolveByDomain,
  getCareersPage,
  getPublicJob,
  submitApplication,
};
