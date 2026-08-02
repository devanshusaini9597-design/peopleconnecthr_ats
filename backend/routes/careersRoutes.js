const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const { planHasFeature } = require('../config/planFeatures');

const xmlEscape = (str = '') => String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * GET /:orgSlug/jobs.xml
 * Indeed/Google-for-Jobs-compatible XML feed of published jobs — the
 * pull-based "job board posting" mechanism referenced in adapters/jobBoardAdapter.js.
 * The org submits this URL once in the board's publisher console; no push
 * API call is needed after that, so this needs no BYOK credentials.
 * Gated by 'integrations.jobBoard' (Enterprise) same as the push adapter.
 */
router.get('/:orgSlug/jobs.xml', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug }).select('name plan');
    if (!org) return res.status(404).send('Organization not found');
    if (!planHasFeature(org.plan, 'integrations.jobBoard')) {
      return res.status(403).send('Job board feed is not available on this organization\'s current plan.');
    }

    const jobs = await Job.find({ organizationId: org._id, isPublished: true, status: 'Open' })
      .select('title department location employmentType description skills salaryRange updatedAt');

    const baseUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const items = jobs.map((job) => `
  <job>
    <title><![CDATA[${job.title}]]></title>
    <date>${(job.updatedAt || new Date()).toUTCString()}</date>
    <referencenumber>${job._id}</referencenumber>
    <url><![CDATA[${baseUrl}/careers/${req.params.orgSlug}/jobs/${job._id}]]></url>
    <company><![CDATA[${xmlEscape(org.name)}]]></company>
    <city><![CDATA[${xmlEscape(job.location)}]]></city>
    <description><![CDATA[${job.description || ''}]]></description>
    <jobtype>${xmlEscape(job.employmentType || 'full_time')}</jobtype>
    ${job.salaryRange?.displayPublicly && job.salaryRange?.min ? `<salary>${job.salaryRange.min}-${job.salaryRange.max || job.salaryRange.min} ${job.salaryRange.currency || 'INR'}</salary>` : ''}
  </job>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<source>\n  <publisher>${xmlEscape(org.name)}</publisher>${items}\n</source>`;
    res.set('Content-Type', 'application/xml').send(xml);
  } catch (error) {
    res.status(500).send('Failed to generate job feed');
  }
});

/**
 * GET /by-domain/:domain
 * Resolves a custom careers-page domain (Enterprise, 'careers.customDomain')
 * to the org's slug, so the frontend can fetch the rest of the careers-page
 * data via the normal /:orgSlug routes below. The customer must separately
 * CNAME `domain` to this app's frontend hosting — that DNS step is outside
 * this repo's scope.
 */
router.get('/by-domain/:domain', async (req, res) => {
  try {
    const org = await Organization.findOne({ 'atsSettings.careersCustomDomain': req.params.domain.toLowerCase().trim() }).select('slug plan');
    if (!org) return res.status(404).json({ success: false, message: 'No organization found for this domain' });
    if (!planHasFeature(org.plan, 'careers.customDomain')) {
      return res.status(403).json({ success: false, message: 'Custom domain careers pages require the Enterprise plan.' });
    }
    res.json({ success: true, data: { slug: org.slug } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /:orgSlug
 * Get org public info + list of published jobs
 */
router.get('/:orgSlug', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug })
      .select('name logo plan settings.careersPageTitle settings.careersPageDescription atsSettings.brandColor atsSettings.whiteLabel atsSettings.pageBlocks');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

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
    const orgPublic = {
      _id: org._id,
      name: org.name,
      logo: org.logo,
      settings: org.settings,
      brandColor: org.atsSettings?.brandColor || '#4F46E5',
      whiteLabelActive,
      hidePoweredBy: whiteLabelActive && !!org.atsSettings?.whiteLabel?.hidePoweredBy,
      pageBlocks
    };

    res.json({ success: true, data: { organization: orgPublic, jobs } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /:orgSlug/jobs/:jobId
 * Get job detail for public view
 */
router.get('/:orgSlug/jobs/:jobId', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug });
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: org._id, isPublished: true, status: 'Open' })
      .select('title department location description skills employmentType salaryRange');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /:orgSlug/jobs/:jobId/apply
 * Submit application
 */
router.post('/:orgSlug/jobs/:jobId/apply', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug });
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    
    const job = await Job.findOne({ _id: req.params.jobId, organizationId: org._id, isPublished: true });
    if (!job) return res.status(404).json({ success: false, message: 'Job not available' });
    
    const { name, email, phone, resume, coverLetter, source } = req.body;
    
    let candidate = await Candidate.findOne({ email, organizationId: org._id });
    if (!candidate) {
      // Check plan limit logic would typically go here
      candidate = new Candidate({
        organizationId: org._id,
        name,
        email,
        phone,
        resume
      });
      await candidate.save();
    }
    
    const existingApp = await Application.findOne({ candidateId: candidate._id, jobId: job._id });
    if (existingApp) return res.status(400).json({ success: false, message: 'You have already applied for this job' });
    
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
    
    res.json({ success: true, applicationId: application._id, message: 'Application submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
