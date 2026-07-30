const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');

/**
 * GET /:orgSlug
 * Get org public info + list of published jobs
 */
router.get('/:orgSlug', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug })
      .select('name logo settings.careersPageTitle settings.careersPageDescription');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    
    const jobs = await Job.find({ organizationId: org._id, isPublished: true, status: 'Open' })
      .select('title department location employmentType');
    
    res.json({ success: true, data: { organization: org, jobs } });
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
