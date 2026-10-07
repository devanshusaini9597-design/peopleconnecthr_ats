/**
 * Platform-wide Google for Jobs (Search JobPosting) — not a per-tenant BYOK feed.
 *
 * Google indexes public careers URLs with JSON-LD JobPosting markup, then
 * learns about new/removed URLs via sitemap + Indexing API.
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Job = require('../models/Job');
const Organization = require('../models/Organization');
const logger = require('../utils/logger');
const { publicSiteBase, publicOrgLogoUrl, escapeHtml } = require('./emailBrandLayout');
const { careersJobPathSegment, ensurePublicId } = require('./jobPublicIdService');
const { publicEmployerLabel, isOwnCompanyHire, scrubPublicJobHtml } = require('../utils/publicJobPrivacy');
const { buildSchemaJobLocations, inferWorkplaceType } = require('../utils/jobLocationParse');

const EMPLOYMENT_MAP = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
  freelance: 'CONTRACTOR',
};

const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const INDEXING_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const INDEXING_PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish';

function liveFeedOrgFilter() {
  return {
    isActive: { $ne: false },
    archivedAt: null,
    isDemo: { $ne: true },
    slug: { $exists: true, $nin: [null, ''] },
    'atsSettings.careersPageEnabled': { $ne: false },
  };
}

function defaultValidDays() {
  const n = Number(process.env.GOOGLE_JOBS_VALID_DAYS || 28);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 90) : 28;
}

function isoDate(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function publicJobUrl(orgSlug, job) {
  const base = publicSiteBase().replace(/\/$/, '');
  const segment = careersJobPathSegment(job);
  if (!base || !orgSlug || !segment) return '';
  return `${base}/careers/${orgSlug}/jobs/${segment}`;
}

function employerName(job, org) {
  return publicEmployerLabel({
    industry: job?.industry,
    clientName: job?.clientName,
    orgName: org?.name,
  }) || String(org?.name || 'Employer').trim();
}

function descriptionHtml(job, org) {
  const html = job?.description || '';
  if (isOwnCompanyHire(job?.clientName, org?.name)) return String(html || `<p>${escapeHtml(job?.title || 'Job')}</p>`);
  const scrubbed = scrubPublicJobHtml(html, job?.clientName);
  return String(scrubbed || `<p>${escapeHtml(job?.title || 'Job')}</p>`);
}

function logoUrl(org) {
  if (org?.logo && /^https?:\/\//i.test(String(org.logo))) return String(org.logo);
  return publicOrgLogoUrl(org?._id, org?.updatedAt ? new Date(org.updatedAt).getTime() : '') || undefined;
}

function validThroughIso(job) {
  if (job?.validThrough) return isoDate(job.validThrough);
  const start = job?.publishedAt || job?.openedAt || job?.createdAt || new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + defaultValidDays());
  return end.toISOString();
}

function stripToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildJobPostingJsonLd(job, org) {
  const url = publicJobUrl(org?.slug, job);
  const name = employerName(job, org);
  const loc = buildSchemaJobLocations(job);
  const datePosted = isoDate(job?.publishedAt || job?.openedAt || job?.createdAt);
  const identifier = job?.publicId || job?.jobCode || String(job?._id || '');
  const posting = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job?.title || job?.role || 'Job',
    description: descriptionHtml(job, org),
    datePosted,
    validThrough: validThroughIso(job),
    employmentType: EMPLOYMENT_MAP[job?.employmentType] || 'FULL_TIME',
    identifier: {
      '@type': 'PropertyValue',
      name,
      value: `${org?.slug || 'org'}:${identifier}`,
    },
    hiringOrganization: {
      '@type': 'Organization',
      name,
      sameAs: `${publicSiteBase().replace(/\/$/, '')}/careers/${org?.slug || ''}`,
      ...(logoUrl(org) ? { logo: logoUrl(org) } : {}),
    },
    directApply: true,
    url,
  };

  if (url) posting.applicationApplyUrl = url;
  if (loc.jobLocation) posting.jobLocation = loc.jobLocation;
  if (loc.jobLocationType) posting.jobLocationType = loc.jobLocationType;
  if (loc.applicantLocationRequirements) posting.applicantLocationRequirements = loc.applicantLocationRequirements;
  if (job?.experience) {
    posting.experienceRequirements = String(job.experience);
  }
  if (job?.industry) posting.industry = String(job.industry);
  if (job?.department) posting.occupationalCategory = String(job.department);

  const salary = job?.salaryRange;
  if (salary?.displayPublicly && salary?.min) {
    posting.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: salary.currency || 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: salary.min,
        ...(salary.max ? { maxValue: salary.max } : {}),
        unitText: 'YEAR',
      },
    };
  }

  return posting;
}

function xmlEscape(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jobIndexSelect() {
  return 'title role location locations employmentType description salaryRange updatedAt publishedAt openedAt createdAt jobCode publicId clientName industry experience department workplaceType validThrough organizationId isPublished status';
}

async function loadLiveJobsForFeed({ orgSlug } = {}) {
  const orgQuery = liveFeedOrgFilter();
  if (orgSlug) orgQuery.slug = String(orgSlug).toLowerCase().trim();
  const orgs = await Organization.find(orgQuery).select('_id name slug logo atsSettings updatedAt').lean();
  if (!orgs.length) return { orgs: [], jobs: [] };

  const jobs = await Job.find({
    organizationId: { $in: orgs.map((o) => o._id) },
    status: 'Open',
    isPublished: { $ne: false },
    isTemplate: { $ne: true },
  }).select(jobIndexSelect()).sort({ updatedAt: -1 }).lean();

  for (const job of jobs) {
    await ensurePublicId(job);
  }
  return { orgs, jobs };
}

async function getJobsSitemapXml(orgSlug) {
  const { orgs, jobs } = await loadLiveJobsForFeed({ orgSlug });
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));
  const urls = [];
  for (const job of jobs) {
    const org = orgById.get(String(job.organizationId));
    if (!org?.slug) continue;
    const loc = publicJobUrl(org.slug, job);
    if (!loc) continue;
    const lastmod = isoDate(job.updatedAt || job.publishedAt);
    urls.push(
      `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmod ? `\n    <lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}\n    <changefreq>daily</changefreq>\n  </url>`
    );
  }
  const seenOrgs = new Set();
  for (const org of orgs) {
    if (seenOrgs.has(org.slug)) continue;
    seenOrgs.add(org.slug);
    const loc = `${publicSiteBase().replace(/\/$/, '')}/careers/${org.slug}`;
    urls.push(`  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>daily</changefreq>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

function getRobotsTxt() {
  const base = publicSiteBase().replace(/\/$/, '');
  return [
    'User-agent: *',
    'Allow: /careers/',
    'Allow: /api/careers/',
    'Disallow: /api/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    `Sitemap: ${base}/api/careers/sitemap.xml`,
    '',
  ].join('\n');
}

function renderGoogleJobHtml(job, org, jsonLd) {
  const url = publicJobUrl(org.slug, job);
  const name = employerName(job, org);
  const loc = [job.location, ...(Array.isArray(job.locations) ? job.locations : [])]
    .filter(Boolean)
    .join(', ') || 'India';
  const desc = descriptionHtml(job, org);
  const title = `${escapeHtml(job.title || 'Job')} — ${escapeHtml(name)}`;
  const ld = JSON.stringify(jsonLd || buildJobPostingJsonLd(job, org)).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <meta name="description" content="${escapeHtml(stripToText(desc).slice(0, 160))}"/>
  <link rel="canonical" href="${escapeHtml(url)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:url" content="${escapeHtml(url)}"/>
  <script type="application/ld+json">${ld}</script>
</head>
<body>
  <main>
    <p><a href="${escapeHtml(`${publicSiteBase().replace(/\/$/, '')}/careers/${org.slug}`)}">${escapeHtml(name)}</a></p>
    <h1>${escapeHtml(job.title || 'Job')}</h1>
    <p>${escapeHtml(loc)} · ${escapeHtml(EMPLOYMENT_MAP[job.employmentType] || 'FULL_TIME')} · ${escapeHtml(inferWorkplaceType(job))}</p>
    <article>${desc}</article>
    <p><a href="${escapeHtml(url)}">Apply for this job</a></p>
  </main>
</body>
</html>`;
}

function loadServiceAccount() {
  const raw = String(process.env.GOOGLE_JOBS_SERVICE_ACCOUNT_JSON || '').trim();
  const file = String(process.env.GOOGLE_JOBS_SERVICE_ACCOUNT_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  let json = raw;
  if (!json && file) {
    const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    json = fs.readFileSync(abs, 'utf8');
  }
  if (!json) return null;
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Google Jobs service account JSON is missing client_email or private_key');
  }
  return parsed;
}

function indexingEnabled() {
  const flag = String(process.env.GOOGLE_JOBS_INDEXING || '1').trim();
  if (flag === '0' || flag.toLowerCase() === 'false') return false;
  try {
    return Boolean(loadServiceAccount());
  } catch {
    return false;
  }
}

let cachedToken = { accessToken: '', expiresAt: 0 };

async function getIndexingAccessToken() {
  if (cachedToken.accessToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }
  const sa = loadServiceAccount();
  if (!sa) throw new Error('Google Jobs Indexing API is not configured');
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: INDEXING_SCOPE,
      aud: INDEXING_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );
  const { data } = await axios.post(
    INDEXING_TOKEN_URL,
    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
  );
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
  };
  return cachedToken.accessToken;
}

async function publishUrlNotification(url, type) {
  if (!url) return { skipped: true, reason: 'missing_url' };
  if (!indexingEnabled()) return { skipped: true, reason: 'indexing_disabled' };
  const token = await getIndexingAccessToken();
  const response = await axios.post(
    INDEXING_PUBLISH_URL,
    { url, type },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000, validateStatus: () => true }
  );
  if (response.status >= 400) {
    const err = new Error(`Indexing API HTTP ${response.status}`);
    err.status = response.status;
    err.body = response.data;
    throw err;
  }
  return { notified: true, type, url, data: response.data };
}

function isIndexableJob(job, org) {
  if (!job || job.isTemplate) return false;
  if (!org) return false;
  if (org.isDemo || org.isActive === false || org.archivedAt) return false;
  if (org.atsSettings && org.atsSettings.careersPageEnabled === false) return false;
  return String(job.status) === 'Open' && job.isPublished !== false;
}

async function notifyJobForGoogle(jobLike, { deleted = false } = {}) {
  if (!jobLike?._id && !jobLike?.organizationId) return { skipped: true, reason: 'no_job' };
  const job = jobLike.title !== undefined
    ? jobLike
    : await Job.findById(jobLike._id || jobLike.jobId).select(jobIndexSelect());
  if (!job) return { skipped: true, reason: 'job_missing' };

  const org = await Organization.findById(job.organizationId)
    .select('name slug logo atsSettings isDemo isActive archivedAt updatedAt')
    .lean();
  if (!org?.slug) return { skipped: true, reason: 'org_missing' };

  await ensurePublicId(job);
  const url = publicJobUrl(org.slug, job);
  const live = !deleted && isIndexableJob(job, org);
  const type = live ? 'URL_UPDATED' : 'URL_DELETED';

  let result;
  try {
    result = await publishUrlNotification(url, type);
  } catch (err) {
    logger.warn({ err: err.message, status: err.status, url, type }, '[googleJobs] Indexing API failed');
    result = { notified: false, error: err.message, status: err.status, url, type };
  }

  try {
    await Job.updateOne({ _id: job._id }, {
      $set: {
        'googleJobs.lastNotifiedAt': new Date(),
        'googleJobs.lastType': type,
        'googleJobs.lastHttpStatus': result.status || (result.notified ? 200 : undefined),
        'googleJobs.lastError': result.error || '',
      },
    });
  } catch (err) {
    logger.warn({ err: err.message }, '[googleJobs] could not persist index status');
  }
  return result;
}

function scheduleGoogleJobsNotify(jobLike, opts) {
  setImmediate(() => {
    notifyJobForGoogle(jobLike, opts).catch((err) => {
      logger.warn({ err: err.message }, '[googleJobs] notify failed');
    });
  });
}

module.exports = {
  buildJobPostingJsonLd,
  getJobsSitemapXml,
  getRobotsTxt,
  renderGoogleJobHtml,
  publicJobUrl,
  notifyJobForGoogle,
  scheduleGoogleJobsNotify,
  indexingEnabled,
  liveFeedOrgFilter,
  EMPLOYMENT_MAP,
};
