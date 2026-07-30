const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');

/**
 * POST /login
 */
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    // STUB: generate a portal access token, log it, send email
    console.log(`[STUB] Magic link for candidate ${email} requested`);
    res.json({ success: true, message: 'If an account exists, a login link has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Middleware for requiring portal token
const requirePortalAuth = (req, res, next) => {
  // STUB: extract token and verify
  req.candidateId = 'stub_candidate_id'; 
  req.organizationId = 'stub_org_id';
  next();
};

/**
 * GET /status
 */
router.get('/status', requirePortalAuth, async (req, res) => {
  try {
    const applications = await Application.find({ candidateId: req.candidateId })
      .populate('jobId', 'title');
      
    const mapped = applications.map(app => ({
      id: app._id,
      jobTitle: app.jobId ? app.jobId.title : 'Unknown Job',
      stage: app.stage,
      appliedAt: app.createdAt,
      lastActivityAt: app.updatedAt
    }));
    
    res.json({ success: true, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /application/:id
 */
router.get('/application/:id', requirePortalAuth, async (req, res) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, candidateId: req.candidateId }).populate('jobId');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /application/:id/documents
 */
router.post('/application/:id/documents', requirePortalAuth, async (req, res) => {
  try {
    // STUB: handle document upload
    res.json({ success: true, message: 'Document uploaded' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
