/**
 * Application domain logic — create, stage changes, reject, schedule.
 * Routes should only validate HTTP and call these helpers.
 */
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const { applicationListFilter } = require('../utils/dataScope');
const { veiledEmployer, jobEmailSummary } = require('../utils/employerVeil');

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const IN_CHUNK = 4000;
const JOB_CAMPAIGN_SELECT = '_id jobCode title role publicId location locations department clientName summary experience description ctc salaryRange industry';

function chunkIds(list, size = IN_CHUNK) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function jobLocationLine(job) {
  const extra = Array.isArray(job?.locations) ? job.locations : [];
  return [...new Set([job?.location, ...extra].map((v) => String(v || '').trim()).filter(Boolean))].join(', ');
}

function stripJobHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jobCtcLine(job) {
  const field = String(job?.ctc || '').trim();
  if (field) return field;
  const min = job?.salaryRange?.min;
  const max = job?.salaryRange?.max;
  if (min == null && max == null) return '';
  if (min != null && max != null) return `${min}–${max} LPA`;
  if (min != null) return `${min} LPA`;
  return `${max} LPA`;
}

function jobPlainSummary(job) {
  const summary = stripJobHtml(job?.summary);
  if (summary) return summary.slice(0, 400);
  return stripJobHtml(job?.description).slice(0, 400);
}

function jobCampaignFields(job) {
  if (!job) {
    return {
      jobTitle: '',
      jobCode: '',
      jobLocation: '',
      jobDepartment: '',
      jobClient: '',
      jobExperience: '',
      jobSummary: '',
      jobCtc: '',
      jobIndustry: '',
    };
  }
  return {
    jobTitle: String(job.title || job.role || '').trim(),
    jobCode: String(job.jobCode || '').trim(),
    jobLocation: jobLocationLine(job),
    jobDepartment: String(job.department || '').trim(),
    jobClient: veiledEmployer(job.industry, job.clientName),
    jobExperience: String(job.experience || '').trim(),
    jobSummary: jobEmailSummary(jobPlainSummary(job), job.clientName),
    jobCtc: jobCtcLine(job),
    jobIndustry: String(job.industry || '').trim(),
  };
}

async function listApplications(organizationId, query = {}, user) {
  const { jobId, stage, assignedTo, isRejected, page = 1, limit = 200 } = query;
  const extra = {};
  if (jobId && jobId !== 'all') extra.jobId = jobId;
  if (stage) extra.stage = stage;
  if (assignedTo) extra.assignedTo = assignedTo;
  if (isRejected !== undefined) extra.isRejected = isRejected === 'true' || isRejected === true;
  else extra.isRejected = { $ne: true };

  const filter = await applicationListFilter(organizationId, user, extra);

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
    ? await applicationListFilter(organizationId, user, extra)
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
    appliedAt: new Date(),
    applicationCode: await require('./candidateCodeService').allocateApplicationCode(user.organizationId),
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
    ? await applicationListFilter(organizationId, user, { _id: applicationId })
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

/**
 * Remove applications left behind after a candidate is deleted so job counts stay accurate.
 */
async function purgeApplicationsForCandidates(organizationId, candidateIds = []) {
  const ids = [...new Set((candidateIds || []).map((id) => id).filter(Boolean))];
  if (!organizationId || !ids.length) return { deleted: 0 };
  const apps = await Application.find({
    organizationId,
    candidateId: { $in: ids },
  }).select('_id jobId').lean();
  if (!apps.length) return { deleted: 0 };
  await Application.deleteMany({
    organizationId,
    candidateId: { $in: ids },
  });
  const byJob = new Map();
  for (const app of apps) {
    if (!app.jobId) continue;
    const key = String(app.jobId);
    byJob.set(key, (byJob.get(key) || 0) + 1);
  }
  const Job = require('../models/Job');
  await Promise.all([...byJob.entries()].map(([jobId, n]) => (
    Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: -n } }).catch(() => {})
  )));
  return { deleted: apps.length };
}

/**
 * Tag an existing ATS candidate onto a requisition (recruiter add / edit).
 * Idempotent: already linked to that Job ID is a no-op success.
 */
async function tagCandidateToJob(user, candidateId, jobIdRaw, { source = 'Recruiter' } = {}) {
  const Job = require('../models/Job');
  const mongoose = require('mongoose');
  const { allocateApplicationCode, ensureApplicationCode, ensureCandidateCode } = require('./candidateCodeService');

  const raw = String(jobIdRaw || '').trim();
  if (!user?.organizationId || !candidateId || !raw || raw === 'all') {
    return { tagged: false };
  }

  let job = null;
  if (mongoose.Types.ObjectId.isValid(raw) && raw.length === 24) {
    job = await Job.findOne({ _id: raw, organizationId: user.organizationId, isTemplate: { $ne: true } })
      .select('_id jobCode title role')
      .lean();
  }
  if (!job) {
    job = await Job.findOne({
      organizationId: user.organizationId,
      jobCode: raw.toUpperCase(),
      isTemplate: { $ne: true },
    }).select('_id jobCode title role').lean();
  }
  if (!job) return { tagged: false, error: 'Job not found' };

  const existing = await Application.findOne({
    organizationId: user.organizationId,
    jobId: job._id,
    candidateId,
  });
  if (existing) {
    await ensureApplicationCode(existing);
    const cand = await Candidate.findById(candidateId);
    if (cand) await ensureCandidateCode(cand);
    return { tagged: true, alreadyTagged: true, job, application: existing };
  }

  const application = new Application({
    organizationId: user.organizationId,
    jobId: job._id,
    candidateId,
    stage: 'Applied',
    source: source || 'Recruiter',
    assignedTo: user.id,
    appliedAt: new Date(),
    applicationCode: await allocateApplicationCode(user.organizationId),
    stageHistory: [{
      stage: 'Applied',
      movedAt: new Date(),
      movedBy: user.id,
      remark: source === 'Campaign'
      ? `Tagged to ${job.jobCode || 'job'} via campaign`
      : 'Tagged to job by recruiter',
    }],
  });
  await application.save();
  Job.findByIdAndUpdate(job._id, { $inc: { applicationCount: 1 } }).catch(() => {});
  const cand = await Candidate.findById(candidateId);
  if (cand) await ensureCandidateCode(cand);
  return { tagged: true, alreadyTagged: false, job, application };
}

async function resolveJobForOrg(user, jobIdRaw) {
  const Job = require('../models/Job');
  const mongoose = require('mongoose');
  const raw = String(jobIdRaw || '').trim();
  if (!user?.organizationId || !raw || raw === 'all') return null;
  let job = null;
  if (mongoose.Types.ObjectId.isValid(raw) && raw.length === 24) {
    job = await Job.findOne({ _id: raw, organizationId: user.organizationId, isTemplate: { $ne: true } })
      .select(JOB_CAMPAIGN_SELECT)
      .lean();
  }
  if (!job) {
    job = await Job.findOne({
      organizationId: user.organizationId,
      jobCode: raw.toUpperCase(),
      isTemplate: { $ne: true },
    }).select(JOB_CAMPAIGN_SELECT).lean();
  }
  return job;
}

async function jobApplyMeta(user, job) {
  if (!user?.organizationId || !job) {
    return {
      applyUrl: '',
      ...jobCampaignFields(null),
    };
  }
  const Organization = require('../models/Organization');
  const { careersJobUrl } = require('./careersService');
  const { signJobShareToken } = require('../utils/jobShareAttribution');
  const { cleanApplyUrl } = require('../utils/employerVeil');
  const org = await Organization.findById(user.organizationId).select('slug').lean();
  const slug = String(org?.slug || '').trim();
  let applyUrl = cleanApplyUrl(careersJobUrl(slug, job));
  const via = signJobShareToken({
    organizationId: user.organizationId,
    jobId: job._id,
    userId: user.id || user._id,
  });
  if (applyUrl && via) applyUrl += `${applyUrl.includes('?') ? '&' : '?'}via=${encodeURIComponent(via)}`;
  return {
    applyUrl: cleanApplyUrl(applyUrl),
    ...jobCampaignFields(job),
  };
}

async function candidateIdsFromMisContacts(user, misIds = []) {
  const mongoose = require('mongoose');
  const MisContact = require('../models/MisContact');
  const { misListFilter } = require('../utils/dataScope');
  const unique = [...new Set(
    (Array.isArray(misIds) ? misIds : [])
      .map((id) => String(id || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  )];
  if (!unique.length || !user?.organizationId) {
    return { ids: [], created: 0 };
  }
  const rows = [];
  for (const part of chunkIds(unique)) {
    const batch = await MisContact.find(
      misListFilter(user.organizationId, user, { _id: { $in: part } })
    ).lean();
    rows.push(...batch);
  }
  const emails = [...new Set(rows.map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean))];
  const existing = emails.length
    ? await Candidate.find({
      organizationId: user.organizationId,
      email: { $in: emails },
    }).select('_id email').lean()
    : [];
  const byEmail = new Map(existing.map((row) => [String(row.email || '').trim().toLowerCase(), String(row._id)]));
  const ids = [];
  let created = 0;
  for (const row of rows) {
    const email = String(row.email || '').trim().toLowerCase();
    if (!email) continue;
    if (byEmail.has(email)) {
      ids.push(byEmail.get(email));
      continue;
    }
    const name = String(row.name || '').trim();
    if (!name) continue;
    try {
      const doc = new Candidate({
        name,
        email,
        contact: String(row.contact || row.phone || '').trim(),
        phone: String(row.phone || row.contact || '').trim(),
        position: String(row.position || '').trim(),
        companyName: String(row.companyName || '').trim(),
        location: String(row.location || '').trim(),
        state: String(row.state || '').trim(),
        experience: String(row.experience || '').trim(),
        ctc: String(row.ctc || '').trim() || 'TO BE UPDATED',
        expectedCtc: String(row.expectedCtc || '').trim(),
        noticePeriod: String(row.noticePeriod || '').trim(),
        skills: String(row.skills || '').trim(),
        product: String(row.product || '').trim(),
        client: String(row.client || '').trim(),
        source: String(row.source || 'MIS').trim() || 'MIS',
        remark: String(row.remark || '').trim(),
        status: 'APPLIED',
        organizationId: user.organizationId,
        createdBy: user.id || user._id,
      });
      await doc.save();
      const id = String(doc._id);
      byEmail.set(email, id);
      ids.push(id);
      created += 1;
    } catch {
      /* duplicate race: try lookup */
      const hit = await Candidate.findOne({
        organizationId: user.organizationId,
        email,
      }).select('_id').lean();
      if (hit?._id) {
        const id = String(hit._id);
        byEmail.set(email, id);
        ids.push(id);
      }
    }
  }
  return { ids: [...new Set(ids)], created };
}

async function bulkTagCandidatesToJob(req, { ids = [], misIds = [], jobId } = {}) {
  const mongoose = require('mongoose');
  const { candidateWriteScope } = require('../utils/dataScope');
  const user = req.user;
  const job = await resolveJobForOrg(user, jobId);
  if (!job) throw httpError('Job not found. Pick a Job ID from your openings.');
  const fromMis = await candidateIdsFromMisContacts(user, misIds);
  const unique = [...new Set(
    [...(Array.isArray(ids) ? ids : []), ...fromMis.ids]
      .map((id) => String(id || '').trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
  )];
  const scope = candidateWriteScope(req);
  const allowed = [];
  for (const part of chunkIds(unique)) {
    const batch = await Candidate.find({ $and: [scope, { _id: { $in: part } }] }).select('_id').lean();
    allowed.push(...batch);
  }
  const allowedSet = new Set(allowed.map((row) => String(row._id)));
  let tagged = 0;
  let already = 0;
  let skipped = unique.length - allowedSet.size;
  for (const id of allowedSet) {
    const result = await tagCandidateToJob(user, id, job._id, { source: 'Campaign' });
    if (result?.alreadyTagged) already += 1;
    else if (result?.tagged) tagged += 1;
    else skipped += 1;
  }
  const meta = await jobApplyMeta(user, job);
  return {
    tagged,
    already,
    skipped,
    fromMis: fromMis.created,
    total: unique.length,
    job: { _id: job._id, jobCode: job.jobCode, title: job.title || job.role || '' },
    ...meta,
  };
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
  tagCandidateToJob,
  bulkTagCandidatesToJob,
  jobApplyMeta,
  jobCampaignFields,
  resolveJobForOrg,
  purgeApplicationsForCandidates,
};
