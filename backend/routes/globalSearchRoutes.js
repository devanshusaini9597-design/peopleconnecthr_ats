const express = require('express');
const router = express.Router();
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { requireFeature } = require('../middleware/featureMiddleware');
const {
  isFreelancer,
  createdByFilter,
  jobListFilter,
  applicationListFilter,
  canViewOrgAnalytics,
  deskOrSharedWithMe,
} = require('../utils/dataScope');

router.use(requireFeature('search.global'));

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, data: { candidates: [], jobs: [], applications: [] } });
    }
    const orgId = req.user.organizationId;
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    let candidateScope;
    if (isFreelancer(req.user)) {
      candidateScope = { organizationId: orgId, ...createdByFilter(req.user) };
    } else if (canViewOrgAnalytics(req.user)) {
      // Owner / admin / manager: search all org candidates
      candidateScope = { organizationId: orgId };
    } else {
      // Recruiter: own desk + candidates shared with them only
      candidateScope = deskOrSharedWithMe(req.user, orgId);
    }
    const jobScope = jobListFilter(req);
    const appScope = applicationListFilter(orgId, req.user);

    const [candidates, jobs, applications] = await Promise.all([
      Candidate.find({
        ...candidateScope,
        $or: [{ name: rx }, { email: rx }, { skills: rx }, { position: rx }]
      }).select('name email position status').limit(8).lean(),
      Job.find({
        ...jobScope,
        $or: [{ title: rx }, { department: rx }, { location: rx }]
      }).select('title department location status isPublished').limit(8).lean(),
      Application.find(appScope)
        .populate('candidateId', 'name email')
        .populate('jobId', 'title')
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean()
        .then((apps) => apps.filter((a) => {
          const hay = `${a.candidateId?.name || ''} ${a.candidateId?.email || ''} ${a.jobId?.title || ''} ${a.stage || ''}`;
          return hay.toLowerCase().includes(q.toLowerCase());
        }).slice(0, 8))
    ]);

    res.json({ success: true, data: { candidates, jobs, applications, q } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
