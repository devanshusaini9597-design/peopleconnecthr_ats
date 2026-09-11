/**
 * Job CRUD routes (extracted from server.js).
 * Mounted at /jobs with verifyToken applied per-route (legacy path without /api).
 */
const express = require('express');
const multer = require('multer');
const Job = require('../models/Job');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');
const { jobListFilter, isFreelancer } = require('../utils/dataScope');
const {
  openJobsSinceFilter,
  isNewlyOpenTransition,
  incrementOrgJobUnseen,
  countUnseenOpenJobs,
  markOpenJobsSeenFilter,
  userIdFilter,
} = require('../utils/jobNavUpdates');
const logger = require('../utils/logger');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const { parseUploadedJd } = require('../services/jdImportService');
const { promoteNamesSafe } = require('../services/skillCatalogSync');
const { promoteNamesSafe: promotePositionsSafe } = require('../services/positionCatalogSync');
const {
  resolveJobCodeForCreate,
  assertJobCodeUnique,
  allocateJobCode,
  previewNextJobCode,
  healOrganizationJobCodes,
  orgJobCodePrefix,
} = require('../services/jobCodeService');

const router = express.Router();
const jdUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function jobRouteError(res, err) {
  const status = err.statusCode || (err.code === 11000 ? 409 : 500);
  const message = err.code === 11000
    ? 'Job ID is already used in your organization'
    : (err.message || 'Request failed');
  return res.status(status).json({ message });
}

function syncLocations(data) {
  if (Array.isArray(data.locations) && data.locations.length) {
    data.locations = data.locations.map((v) => String(v || '').trim().toUpperCase()).filter(Boolean);
    data.location = data.locations.join(', ');
  } else if (data.location) {
    data.locations = String(data.location)
      .split(',')
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);
    data.location = data.locations.join(', ');
  }
  return data;
}

function normalizeJobStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  const map = {
    open: 'Open',
    'on hold': 'On Hold',
    closed: 'Closed',
    draft: 'Draft',
    cancelled: 'Cancelled',
  };
  return map[key] || status || 'Open';
}

function normalizeJobPriority(priority) {
  const key = String(priority || '').trim().toLowerCase();
  if (['low', 'medium', 'high', 'urgent'].includes(key)) return key;
  return 'medium';
}

async function syncHiringManager(data, organizationId) {
  const emails = (data.hiringManagers || [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length || !organizationId) return data;
  const users = await User.find({
    organizationId,
    isActive: { $ne: false },
    email: { $exists: true, $ne: '' },
  }).select('_id email').lean();
  const byEmail = new Map(users.map((u) => [String(u.email || '').toLowerCase(), u._id]));
  const first = emails.map((e) => byEmail.get(e)).find(Boolean);
  if (first) data.hiringManager = first;
  return data;
}

/** Resolve hiring-manager emails on a job to user ids in this org. */
async function resolveHiringManagerUserIds(organizationId, job) {
  const emails = (job.hiringManagers || [])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length || !organizationId) return [];
  const { organizationIdMatch } = require('../utils/dataScope');
  const orgClause = organizationIdMatch(organizationId);
  if (!orgClause) return [];
  const rows = await User.find({
    ...orgClause,
    email: { $in: emails },
    isActive: { $ne: false },
  }).select('_id').lean();
  return rows.map((row) => row._id);
}

/** In-app alert always; email only when requested. */
async function dispatchJobOpeningNotifications(req, job, { notifyEmail = true, notifyInApp = true } = {}) {
  if (!req.user.organizationId || job.isTemplate || job.status !== 'Open') return;

  if (notifyInApp) {
    try {
      const { listAudienceUserIds, notifyMany } = require('../utils/reportingScope');
      const teamIds = await listAudienceUserIds(req.user.organizationId, 'recruiters');
      const freelancerIds = await listAudienceUserIds(req.user.organizationId, 'freelancers');
      const hiringIds = await resolveHiringManagerUserIds(req.user.organizationId, job);
      const ids = [...new Set([...teamIds, ...freelancerIds, ...hiringIds].map((id) => String(id)).filter(Boolean))];
      const loc = job.location || 'Location TBD';
      const sent = await notifyMany(ids, {
        type: 'job_opening',
        title: `New opening: ${job.title || job.role}`,
        message: `${job.title || job.role} · ${loc}${job.clientName ? ` · ${job.clientName}` : ''}`,
        relatedJobId: job._id,
        senderId: req.user.id,
        senderName: req.user.name || 'Recruiting',
        priority: 'medium',
      }, { skipId: req.user.id });
      if (!sent.length) {
        logger.warn('[jobRoutes] job_opening notifyMany returned 0 docs', {
          jobId: String(job._id),
          audience: ids.length,
          orgId: String(req.user.organizationId),
        });
      } else {
        logger.info('[jobRoutes] job_opening notified', {
          jobId: String(job._id),
          sent: sent.length,
          audience: ids.length,
        });
      }
    } catch (err) {
      logger.warn('[jobRoutes] job_opening in-app notify failed', err.message);
    }
  }

  if (notifyEmail) {
    try {
      const { emailJobOpeningToTeam } = require('../services/jobEmailService');
      emailJobOpeningToTeam({
        organizationId: req.user.organizationId,
        job,
        actorId: req.user.id,
        actorName: req.user.name || req.user.email || 'Recruiting',
      }).catch((err) => logger.warn('[jobRoutes] job opening email failed', err.message));
    } catch (err) {
      logger.warn('[jobRoutes] job opening email setup failed', err.message);
    }
  }
}

router.post('/parse-jd', verifyToken, requireRecruiterOrAbove, jdUpload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Upload a PDF, Word, or TXT job description' });
    }
    const parsed = await parseUploadedJd({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      filename: req.file.originalname,
    });
    res.json({ success: true, data: parsed });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message || 'Could not read this JD file' });
  }
});

router.get('/', verifyToken, async (req, res) => {
  try {
    const { isTemplate } = req.query;
    const query = jobListFilter(req, { isTemplate });

    const staffFields = isFreelancer(req.user) ? 'name role' : 'name email role';
    const jobs = await Job.find(query).setOptions(
      req.user.organizationId ? { _tenantId: req.user.organizationId } : {}
    ).populate('hiringManager', staffFields).populate('createdBy', staffFields).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/updates', verifyToken, async (req, res) => {
  try {
    const sinceRaw = String(req.query.since || '').trim();
    const since = sinceRaw ? new Date(sinceRaw) : null;
    if (!since || Number.isNaN(since.getTime())) {
      return res.json({ success: true, data: { newCount: 0 } });
    }
    const newCount = await Job.countDocuments(
      openJobsSinceFilter(req.user.organizationId, since)
    );
    res.json({ success: true, data: { newCount } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Unread job openings for sidebar — count Open jobs this user has not seen. */
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('jobsUnseenCount jobsLastSeenAt').lean();
    const fromJobs = await countUnseenOpenJobs({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      jobsLastSeenAt: user?.jobsLastSeenAt || null,
    });
    const fromCounter = Number(user?.jobsUnseenCount) || 0;
    const raw = Math.max(Number(fromJobs) || 0, fromCounter);
    const count = Math.max(0, Math.min(9, Number.isFinite(raw) ? raw : 0));
    res.json({ success: true, count });
  } catch (err) {
    logger.warn('[jobRoutes] unread-count failed', err.message);
    res.status(500).json({ message: err.message });
  }
});

/** Mark job-opening alerts read when user opens the Jobs page. */
router.post('/mark-seen', verifyToken, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const now = new Date();
    // Prefer client open time so a slow mark-seen cannot land AFTER a job
    // posted during the same visit (which would hide the sidebar badge).
    let seenAt = now;
    const raw = req.body?.seenAt;
    if (raw) {
      const clientAt = new Date(raw);
      if (!Number.isNaN(clientAt.getTime())) {
        const skewMs = 60_000;
        if (clientAt.getTime() <= now.getTime() + skewMs) {
          seenAt = clientAt.getTime() > now.getTime() ? now : clientAt;
        }
      }
    }
    const seenFilter = markOpenJobsSeenFilter(req.user.organizationId, req.user.id, seenAt);
    let seenQuery = Job.updateMany(seenFilter, { $addToSet: { seenBy: req.user.id } });
    if (req.user.organizationId && typeof seenQuery.setOptions === 'function') {
      seenQuery = seenQuery.setOptions({ _tenantId: req.user.organizationId });
    }
    await Promise.all([
      Notification.updateMany(
        {
          type: 'job_opening',
          isRead: false,
          ...userIdFilter(req.user.id),
        },
        { $set: { isRead: true } }
      ),
      seenQuery,
      User.findByIdAndUpdate(req.user.id, {
        $set: { jobsLastSeenAt: seenAt, jobsUnseenCount: 0 },
      }),
    ]);
    res.json({ success: true, seenAt: seenAt.toISOString() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** Recent open jobs for dashboard widget */
/** Assign missing / de-duplicate job IDs within the signed-in organization */
router.post('/heal-codes', verifyToken, requireRecruiterOrAbove, async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(400).json({ message: 'Organization required' });
    }
    const result = await healOrganizationJobCodes(req.user.organizationId);
    res.json({ success: true, ...result });
  } catch (err) {
    jobRouteError(res, err);
  }
});

/** Preview the next auto Job ID for this organization (not reserved until save). */
router.get('/next-code', verifyToken, requireRecruiterOrAbove, async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(400).json({ message: 'Organization required' });
    }
    const org = await Organization.findById(req.user.organizationId).select('slug name').lean();
    const jobCode = await previewNextJobCode(req.user.organizationId);
    res.json({
      success: true,
      jobCode,
      prefix: orgJobCodePrefix(org),
      format: `${orgJobCodePrefix(org)}-${new Date().getFullYear()}-0001`,
    });
  } catch (err) {
    jobRouteError(res, err);
  }
});

router.get('/recent', verifyToken, async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const query = {
      ...jobListFilter(req),
      status: { $in: ['Open', 'On Hold'] },
    };
    const rows = await Job.find(query)
      .setOptions(req.user.organizationId ? { _tenantId: req.user.organizationId } : {})
      .select('title role jobCode location experience ctc clientName skills status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const query = { _id: req.params.id, ...jobListFilter(req) };
    const staffFields = isFreelancer(req.user) ? 'name role' : 'name email role';
    const job = await Job.findOne(query).setOptions(
      req.user.organizationId ? { _tenantId: req.user.organizationId } : {}
    ).populate('hiringManager', staffFields).populate('createdBy', staffFields);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', verifyToken, requireRecruiterOrAbove, checkPlanLimit('jobs'), async (req, res) => {
  try {
    const jobData = { ...req.body };

    if (req.user.organizationId) {
      jobData.organizationId = req.user.organizationId;
    }
    jobData.createdBy = req.user.id;

    if (jobData.role && !jobData.title) jobData.title = jobData.role;
    if (jobData.title && !jobData.role) jobData.role = jobData.title;
    if (jobData.title) jobData.title = String(jobData.title).toUpperCase();
    if (jobData.role) jobData.role = String(jobData.role).toUpperCase();
    syncLocations(jobData);
    if (jobData.status) jobData.status = normalizeJobStatus(jobData.status);
    if (jobData.priority !== undefined) jobData.priority = normalizeJobPriority(jobData.priority);

    if (!jobData.isTemplate && String(jobData.status || 'Open').toLowerCase() !== 'draft' && !String(jobData.industry || '').trim()) {
      return res.status(400).json({ message: 'Select an industry/tag before publishing this job.' });
    }

    await syncHiringManager(jobData, jobData.organizationId);

    if (!jobData.isTemplate) {
      const useCustom = req.body.customJobCode === true && String(req.body.jobCode || '').trim();
      jobData.jobCode = await resolveJobCodeForCreate(
        jobData.organizationId,
        useCustom ? req.body.jobCode : '',
        { forceAuto: !useCustom }
      );
    } else {
      delete jobData.jobCode;
    }

    if (!jobData.isTemplate && String(jobData.status || 'Open').toLowerCase() === 'open') {
      jobData.openedAt = new Date();
      jobData.seenBy = [];
    }

    const newJob = new Job(jobData);
    await newJob.save();
    await promoteNamesSafe(req.user.organizationId, req.user.id, newJob.skills);
    await promotePositionsSafe(req.user.organizationId, req.user.id, newJob.title || newJob.role);

    if (req.user.organizationId && !newJob.isTemplate && String(newJob.status || '').toLowerCase() !== 'draft') {
      await Organization.findByIdAndUpdate(req.user.organizationId, {
        $inc: { 'usageCurrent.jobs': 1 },
      });
    }

    eventBus.emit(eventTypes.JOB_CREATED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      jobId: newJob._id,
      title: newJob.title,
    });

    const notifyEmail = req.body.notifyEmail !== false;
    if (!newJob.isTemplate && newJob.status === 'Open') {
      await incrementOrgJobUnseen(req.user.organizationId);
      await dispatchJobOpeningNotifications(req, newJob, { notifyEmail, notifyInApp: true });
    }

    res.status(201).json(newJob);
  } catch (err) {
    jobRouteError(res, err);
  }
});

router.put('/:id', verifyToken, requireRecruiterOrAbove, async (req, res) => {
  try {
    const scope = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : { createdBy: req.user.id };

    const updates = { ...req.body };
    delete updates._id;
    delete updates.organizationId;
    delete updates.createdBy;

    const jobCodeInput = updates.jobCode;
    delete updates.jobCode;
    if (updates.role && !updates.title) updates.title = updates.role;
    if (updates.title && !updates.role) updates.role = updates.title;
    if (updates.title) updates.title = String(updates.title).toUpperCase();
    if (updates.role) updates.role = String(updates.role).toUpperCase();
    syncLocations(updates);
    if (updates.status) updates.status = normalizeJobStatus(updates.status);
    if (updates.priority !== undefined) updates.priority = normalizeJobPriority(updates.priority);
    await syncHiringManager(updates, scope.organizationId || req.user.organizationId);

    if (updates.status === 'Closed' && !updates.closedAt) {
      updates.closedAt = new Date();
      updates.isPublished = false;
    }

    const existing = await Job.findOne({ _id: req.params.id, ...scope }).lean();
    if (!existing) return res.status(404).json({ message: 'Job not found' });

    const nextStatus = updates.status || existing.status;
    const nextIndustry = updates.industry !== undefined
      ? String(updates.industry || '').trim()
      : String(existing.industry || '').trim();
    if (!existing.isTemplate && String(nextStatus || '').toLowerCase() !== 'draft' && !nextIndustry) {
      return res.status(400).json({ message: 'Select an industry/tag before publishing this job.' });
    }

    if (jobCodeInput !== undefined && !existing.isTemplate) {
      const trimmed = String(jobCodeInput || '').trim();
      if (trimmed) {
        const orgId = scope.organizationId || req.user.organizationId;
        updates.jobCode = await assertJobCodeUnique(orgId, trimmed, req.params.id);
      }
    }

    const becomingOpen = isNewlyOpenTransition(existing.status, updates.status || existing.status);
    if (becomingOpen && !existing.isTemplate) {
      updates.openedAt = new Date();
      updates.seenBy = [];
    }

    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, ...scope },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!job) return res.status(404).json({ message: 'Job not found' });

    const nowOpen = String(job.status || '').toLowerCase() === 'open';
    const notifyEmail = req.body.notifyEmail !== false;
    if (becomingOpen && nowOpen && !job.isTemplate) {
      if (req.user.organizationId) {
        await Organization.findByIdAndUpdate(req.user.organizationId, {
          $inc: { 'usageCurrent.jobs': 1 },
        });
      }
      await incrementOrgJobUnseen(req.user.organizationId);
      await dispatchJobOpeningNotifications(req, job, { notifyEmail, notifyInApp: true });
    }
    await promoteNamesSafe(req.user.organizationId, req.user.id, job.skills);
    await promotePositionsSafe(req.user.organizationId, req.user.id, job.title || job.role);
    if (!job.jobCode && !job.isTemplate) {
      job.jobCode = await allocateJobCode(job.organizationId);
      await job.save();
    }
    res.json(job);
  } catch (err) {
    jobRouteError(res, err);
  }
});

router.delete('/:id', verifyToken, requireRecruiterOrAbove, async (req, res) => {
  try {
    const scope = req.user.organizationId
      ? { organizationId: req.user.organizationId }
      : { createdBy: req.user.id };

    const deleted = await Job.findOneAndDelete({ _id: req.params.id, ...scope });
    if (!deleted) return res.status(404).json({ message: 'Job not found' });

    try {
      const Notification = require('../models/Notification');
      await Notification.updateMany(
        {
          type: 'job_opening',
          isDismissed: false,
          $or: [
            { relatedJobId: deleted._id },
            { title: `New opening: ${deleted.title || deleted.role}` },
          ],
        },
        { $set: { isDismissed: true, isRead: true } }
      );
    } catch (notifErr) {
      logger.warn('[jobRoutes] dismiss job_opening notifs failed', notifErr.message);
    }

    if (
      req.user.organizationId
      && !deleted.isTemplate
      && String(deleted.status || '').toLowerCase() !== 'draft'
    ) {
      await Organization.findByIdAndUpdate(req.user.organizationId, {
        $inc: { 'usageCurrent.jobs': -1 },
      });
    }

    res.json({ message: 'Job deleted successfully', id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
