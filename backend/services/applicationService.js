/**
 * Application domain logic — create, stage changes, reject, schedule.
 * Routes should only validate HTTP and call these helpers.
 */
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const { applicationListFilter } = require('../utils/dataScope');

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function listApplications(organizationId, query = {}, user) {
  const { jobId, stage, assignedTo, isRejected, page = 1, limit = 200 } = query;
  const extra = {};
  if (jobId && jobId !== 'all') extra.jobId = jobId;
  if (stage) extra.stage = stage;
  if (assignedTo) extra.assignedTo = assignedTo;
  if (isRejected !== undefined) extra.isRejected = isRejected === 'true' || isRejected === true;
  else extra.isRejected = { $ne: true };

  const filter = applicationListFilter(organizationId, user, extra);

  return Application.find(filter)
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .sort({ updatedAt: -1 })
    .populate('candidateId jobId assignedTo');
}

async function getStats(organizationId, { jobId } = {}, user) {
  const extra = { isRejected: { $ne: true } };
  if (jobId && jobId !== 'all') extra.jobId = jobId;
  const filter = user
    ? applicationListFilter(organizationId, user, extra)
    : { organizationId, ...extra };

  const applications = await Application.find(filter).select('stage createdAt hiredAt isHired').lean();
  const byStage = {};
  const hiredDurations = [];

  for (const app of applications) {
    byStage[app.stage] = (byStage[app.stage] || 0) + 1;
    if (app.isHired && app.hiredAt && app.createdAt) {
      const days = Math.max(
        0,
        Math.round((new Date(app.hiredAt) - new Date(app.createdAt)) / (1000 * 60 * 60 * 24))
      );
      hiredDurations.push(days);
    }
  }

  const avgTime = hiredDurations.length
    ? `${Math.round(hiredDurations.reduce((a, b) => a + b, 0) / hiredDurations.length)}d`
    : 'N/A';

  return { total: applications.length, byStage, avgTime };
}

/**
 * Create application; optionally upsert candidate from inline details.
 */
async function createApplication(user, body) {
  let { jobId, candidateId, stage = 'Applied', source = 'Direct', assignedTo, candidate } = body;

  if (!jobId || jobId === 'all') throw httpError('jobId is required');

  if (!candidateId && candidate) {
    const name = (candidate.name || '').trim();
    const email = (candidate.email || '').trim().toLowerCase();
    const contact = (candidate.contact || candidate.phone || '').trim();
    if (!name || !email) throw httpError('Candidate name and email are required');

    let existingCandidate = await Candidate.findOne({
      email,
      organizationId: user.organizationId,
    });

    if (!existingCandidate) {
      existingCandidate = new Candidate({
        name,
        email,
        contact: contact || '0000000000',
        ctc: candidate.ctc || 'N/A',
        organizationId: user.organizationId,
        createdBy: user.id,
        source: source || 'Direct',
      });
      await existingCandidate.save();
    }
    candidateId = existingCandidate._id;
  }

  if (!candidateId) throw httpError('candidateId or candidate details required');

  const ownedCandidate = await Candidate.findOne({
    _id: candidateId,
    organizationId: user.organizationId,
  }).select('_id');
  if (!ownedCandidate) throw httpError('Candidate not found', 404);

  const existing = await Application.findOne({
    jobId,
    candidateId,
    organizationId: user.organizationId,
  });
  if (existing) throw httpError('Candidate already applied to this job');

  const application = new Application({
    organizationId: user.organizationId,
    jobId,
    candidateId,
    stage,
    source,
    assignedTo,
    stageHistory: [{ stage, movedAt: new Date(), movedBy: user.id }],
  });

  await application.save();
  await application.populate('candidateId jobId assignedTo');

  try {
    const Job = require('../models/Job');
    await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });
  } catch (_) {
    /* non-blocking */
  }

  return application;
}

async function changeStage(user, applicationId, { stage, remark }) {
  const nextStage = String(stage || '').trim();
  if (!nextStage) throw httpError('stage is required');

  const application = await Application.findOne({
    _id: applicationId,
    organizationId: user.organizationId,
  });
  if (!application) throw httpError('Not found', 404);

  const previousStage = application.stage;
  application.stage = nextStage;
  application.lastActivityAt = new Date();
  application.stageHistory.push({
    stage: nextStage,
    movedAt: new Date(),
    movedBy: user.id,
    remark,
  });

  if (/^(hired|joined)$/i.test(nextStage)) {
    application.isHired = true;
    application.hiredAt = application.hiredAt || new Date();
  }

  await application.save();
  await application.populate('candidateId jobId assignedTo');

  try {
    const talentPoolService = require('./talentPoolService');
    const cand = application.candidateId;
    const job = application.jobId;
    const candidateDoc = cand && cand._id ? cand : { _id: cand };
    if (/^interview$/i.test(nextStage)) {
      await talentPoolService.enrollByTrigger(user.organizationId, candidateDoc, { trigger: 'interview', job });
    } else if (/^(hired|joined)$/i.test(nextStage)) {
      await talentPoolService.enrollByTrigger(user.organizationId, candidateDoc, { trigger: 'hired', job });
    } else if (/^(rejected)$/i.test(nextStage)) {
      await talentPoolService.enrollByTrigger(user.organizationId, candidateDoc, { trigger: 'reject', job });
    } else if (/^(dropped|withdrawn)$/i.test(nextStage)) {
      await talentPoolService.enrollByTrigger(user.organizationId, candidateDoc, { trigger: 'dropped', job });
    }
  } catch (poolErr) {
    console.warn('[stage] talent pool automation skipped:', poolErr.message);
  }

  eventBus.emit(eventTypes.APPLICATION_STAGE_CHANGED, {
    organizationId: user.organizationId,
    userId: user.id,
    resourceType: 'Application',
    resourceId: application._id,
    candidateId: application.candidateId,
    jobId: application.jobId,
    previousStage,
    newStage: nextStage,
  });

  if (/^(hired|joined)$/i.test(nextStage)) {
    eventBus.emit(eventTypes.CANDIDATE_HIRED, {
      organizationId: user.organizationId,
      userId: user.id,
      resourceType: 'Application',
      resourceId: application._id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      applicationId: application._id,
      hiredAt: application.hiredAt,
    });
  }

  return application;
}

async function rejectApplication(user, applicationId, { reason, talentPoolIds } = {}) {
  const application = await Application.findOneAndUpdate(
    { _id: applicationId, organizationId: user.organizationId },
    {
      $set: {
        isRejected: true,
        rejectedAt: new Date(),
        rejectedBy: user.id,
        rejectionReason: reason,
      },
    },
    { new: true }
  );

  if (application) {
    eventBus.emit(eventTypes.APPLICATION_REJECTED, {
      organizationId: user.organizationId,
      userId: user.id,
      resourceType: 'Application',
      resourceId: application._id,
      candidateId: application.candidateId,
      jobId: application.jobId,
      reason,
    });

    try {
      const { planHasFeature } = require('../config/planFeatures');
      const Organization = require('../models/Organization');
      const Job = require('../models/Job');
      const talentPoolService = require('./talentPoolService');
      const org = await Organization.findById(user.organizationId).select('plan');
      if (planHasFeature(org?.plan, 'candidates.talentPools') && application.candidateId) {
        const candidate = await Candidate.findOne({
          _id: application.candidateId,
          organizationId: user.organizationId,
        }).select('_id position skills product client remark talentPoolConsent');
        const job = await Job.findOne({
          _id: application.jobId,
          organizationId: user.organizationId,
        }).select('title role industry skills clientName description summary');
        await talentPoolService.enrollByTrigger(user.organizationId, candidate, {
          trigger: 'reject',
          job,
          talentPoolIds,
        });
      }
    } catch (poolErr) {
      console.warn('[reject] talent pool automation skipped:', poolErr.message);
    }
  }

  return application;
}

async function getApplication(organizationId, applicationId, user) {
  const filter = user
    ? applicationListFilter(organizationId, user, { _id: applicationId })
    : { _id: applicationId, organizationId };
  const application = await Application.findOne(filter).populate('candidateId jobId assignedTo');
  if (!application) throw httpError('Application not found', 404);
  return application;
}

async function assignApplication(organizationId, applicationId, assignedTo) {
  return Application.findOneAndUpdate(
    { _id: applicationId, organizationId },
    { $set: { assignedTo } },
    { new: true }
  );
}

async function updateRating(organizationId, applicationId, rating) {
  return Application.findOneAndUpdate(
    { _id: applicationId, organizationId },
    { $set: { rating, lastActivityAt: new Date() } },
    { new: true }
  );
}

async function updateNotes(organizationId, applicationId, notesInput) {
  const notes = typeof notesInput === 'string' ? notesInput : '';
  const application = await Application.findOneAndUpdate(
    { _id: applicationId, organizationId },
    { $set: { notes, lastActivityAt: new Date() } },
    { new: true }
  );
  if (!application) throw httpError('Not found', 404);
  return application;
}

async function deleteApplication(organizationId, applicationId) {
  const deleted = await Application.findOneAndDelete({
    _id: applicationId,
    organizationId,
  });
  if (!deleted) throw httpError('Application not found', 404);
  return { message: 'Application deleted' };
}

async function listByJob(organizationId, jobId) {
  return Application.find({
    jobId,
    organizationId,
  }).populate('candidateId');
}

async function listByCandidate(organizationId, candidateId) {
  return Application.find({
    candidateId,
    organizationId,
  });
}

async function scheduleInterview(user, applicationId, body) {
  const {
    scheduledAt,
    mode = 'Video',
    location = '',
    remark = '',
    meetingLink = '',
    duration = 60,
  } = body;

  if (!scheduledAt) throw httpError('scheduledAt is required');

  const application = await Application.findOne({
    _id: applicationId,
    organizationId: user.organizationId,
  });
  if (!application) throw httpError('Not found', 404);

  const when = new Date(scheduledAt);
  application.metadata = {
    ...(application.metadata || {}),
    interview: {
      scheduledAt: when,
      mode,
      location,
      meetingLink,
      remark,
      updatedAt: new Date(),
      updatedBy: user.id,
    },
  };
  application.lastActivityAt = new Date();

  const stamp = `\n[Interview scheduled] ${when.toLocaleString()} · ${mode}${location ? ` · ${location}` : ''}${remark ? ` — ${remark}` : ''}`;
  application.notes = `${application.notes || ''}${stamp}`.trim();

  const earlyStages = ['Applied', 'Screening'];
  if (earlyStages.some((s) => s.toLowerCase() === String(application.stage || '').toLowerCase())) {
    application.stage = 'Interview';
    application.stageHistory.push({
      stage: 'Interview',
      movedAt: new Date(),
      movedBy: user.id,
      remark: 'Auto-moved on schedule',
    });
  }

  await application.save();

  try {
    const Interview = require('../models/Interview');
    const typeMap = {
      Video: 'video',
      Phone: 'phone_screen',
      Onsite: 'in_person',
      video: 'video',
      phone_screen: 'phone_screen',
      in_person: 'in_person',
      panel: 'panel',
      technical: 'technical',
      hr: 'hr',
    };
    const interviewType = typeMap[mode] || 'video';
    let interview = await Interview.findOne({
      organizationId: user.organizationId,
      applicationId: application._id,
      status: { $in: ['scheduled', 'rescheduled', 'in_progress'] },
    });
    if (interview) {
      interview.scheduledAt = when;
      interview.type = interviewType;
      interview.location = location || '';
      interview.meetingLink = meetingLink || location || '';
      interview.duration = duration || 60;
      interview.status = 'scheduled';
      await interview.save();
    } else {
      interview = await Interview.create({
        organizationId: user.organizationId,
        applicationId: application._id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        interviewers: [
          { userId: user.id, name: user.name || '', email: user.email || '' },
        ],
        scheduledAt: when,
        duration: duration || 60,
        type: interviewType,
        location: location || '',
        meetingLink: meetingLink || (mode === 'Video' ? location : '') || '',
        status: 'scheduled',
        createdBy: user.id,
      });
    }
    application.metadata.interview.interviewId = interview._id;
    await application.save();
  } catch (syncErr) {
    console.warn('Interview sync skipped:', syncErr.message);
  }

  await application.populate('candidateId jobId assignedTo');
  return application;
}

module.exports = {
  listApplications,
  getStats,
  getApplication,
  createApplication,
  changeStage,
  assignApplication,
  rejectApplication,
  updateRating,
  updateNotes,
  scheduleInterview,
  deleteApplication,
  listByJob,
  listByCandidate,
};
