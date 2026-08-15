const User = require('../models/User');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Organization = require('../models/Organization');
const Notification = require('../models/Notification');
const FreelancerSubmission = require('../models/FreelancerSubmission');
const { isFreelancer, createdByFilter, jobListFilter } = require('../utils/dataScope');
const { sendEmail } = require('./emailService');
const {
  wrapBrandedEmailHtml,
  brandButtonHtml,
  infoPanelHtml,
  loadOrgEmailBrand,
  escapeHtml,
  publicSiteBase,
} = require('./emailBrandLayout');
const logger = require('../utils/logger');

const SPOC_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];
const ADMIN_OVERRIDE_ROLES = ['owner', 'admin'];

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function requireFreelancer(user) {
  if (!isFreelancer(user)) throw httpError('Freelance recruiter access required', 403);
}

function asUserId(ref) {
  if (!ref) return null;
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}

/**
 * Mandate SPOC = who posted the job (createdBy), falling back to hiringManager.
 * Freelancers cannot reassign; only owner/admin may override at submit time.
 */
async function resolveMandateSpoc(job, { overrideSpocUserId, actor } = {}) {
  const orgId = job.organizationId;
  const canOverride = actor && ADMIN_OVERRIDE_ROLES.includes(actor.role);

  if (canOverride && overrideSpocUserId) {
    const override = await User.findOne({
      _id: overrideSpocUserId,
      organizationId: orgId,
      role: { $in: SPOC_ROLES },
      isActive: { $ne: false },
    }).select('name email role').lean();
    if (override) return override;
  }

  const orderedIds = [asUserId(job.createdBy), asUserId(job.hiringManager)].filter(Boolean);
  const uniqueIds = [...new Set(orderedIds)];
  if (!uniqueIds.length) return null;

  const users = await User.find({
    _id: { $in: uniqueIds },
    organizationId: orgId,
    role: { $in: SPOC_ROLES },
    isActive: { $ne: false },
  }).select('name email role').lean();

  const byId = new Map(users.map((u) => [String(u._id), u]));
  for (const id of uniqueIds) {
    if (byId.has(id)) return byId.get(id);
  }
  return null;
}

function attachMandateSpoc(job) {
  const poster = job.createdBy && typeof job.createdBy === 'object' ? job.createdBy : null;
  const hm = job.hiringManager && typeof job.hiringManager === 'object' ? job.hiringManager : null;
  const spoc = poster || hm || null;
  return {
    ...job,
    mandateSpoc: spoc
      ? { _id: spoc._id, name: spoc.name, email: spoc.email, role: spoc.role }
      : null,
  };
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || publicSiteBase() || '').replace(/\/$/, '');
}

async function shareCandidateWithSpoc(candidate, spocId, freelancerId) {
  const already = (candidate.sharedWith || []).some((row) => String(row.userId) === String(spocId));
  if (already) return;
  candidate.sharedWith = candidate.sharedWith || [];
  candidate.sharedWith.push({
    userId: spocId,
    sharedAt: new Date(),
    sharedBy: freelancerId,
  });
  await candidate.save();
}

async function notifySpocOfSubmission({ user, spoc, candidate, job, note }) {
  const freelancerName = user.name || user.email || 'Freelance recruiter';
  const jobTitle = job.title || job.role || 'Open mandate';
  const candidateName = candidate.name || 'Candidate';

  try {
    await Notification.create({
      userId: spoc._id,
      senderId: user.id,
      senderName: freelancerName,
      type: 'freelancer_submission',
      title: `${candidateName} submitted for ${jobTitle}`,
      message: `${freelancerName} submitted ${candidateName} for ${jobTitle}.`,
      candidateId: candidate._id,
      candidateName,
      candidatePosition: jobTitle,
      candidateContact: candidate.contact || '',
      relatedEmail: user.email || '',
      priority: 'high',
      actionRequired: false,
      status: 'pending',
    });
  } catch (err) {
    logger.warn({ err }, 'Freelance submission in-app notification failed');
  }

  if (!spoc.email) return;
  try {
    const brand = await loadOrgEmailBrand(user.organizationId);
    const atsUrl = `${frontendUrl()}/ats?q=${encodeURIComponent(candidateName)}`;
    const rows = [
      { label: 'Candidate', value: candidateName },
      { label: 'Mandate', value: jobTitle },
      { label: 'Submitted by', value: freelancerName },
      user.email ? { label: 'Recruiter email', value: user.email } : null,
      candidate.email ? { label: 'Candidate email', value: candidate.email } : null,
      candidate.contact ? { label: 'Phone', value: candidate.contact } : null,
      note ? { label: 'Note', value: note } : null,
    ].filter(Boolean);
    const html = wrapBrandedEmailHtml({
      title: 'New freelance submission',
      eyebrow: 'Mandate handoff',
      orgName: brand.name,
      logoUrl: brand.logoUrl,
      brandColor: brand.brandColor,
      wordmark: brand.wordmark,
      bodyHtml: `
        <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(spoc.name || 'there')},</p>
        <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
          A freelance recruiter submitted a candidate to you on <strong style="color:#0f172a;">${escapeHtml(brand.name)}</strong>.
        </p>
        ${infoPanelHtml(rows, brand.brandColor)}
        <div style="text-align:center;">
          ${brandButtonHtml({ href: atsUrl, label: 'Review candidate', brandColor: brand.brandColor })}
        </div>`,
    });
    await sendEmail(
      spoc.email,
      `${candidateName} submitted for ${jobTitle}`,
      html,
      `${freelancerName} submitted ${candidateName} for ${jobTitle}. Review: ${atsUrl}`,
      {
        senderName: brand.name,
        organizationId: user.organizationId,
        system: true,
      }
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Freelance submission email to SPOC failed');
  }
}

async function notifyFreelancerOfReview({ user, submission, status }) {
  const freelancer = submission.freelancerId;
  const candidate = submission.candidateId;
  const job = submission.jobId;
  if (!freelancer?._id) return;
  const reviewerName = user.name || user.email || 'Company SPOC';
  const candidateName = candidate?.name || 'your candidate';
  const jobTitle = job?.title || job?.role || 'the mandate';
  const statusLabel = String(status || '').replace(/_/g, ' ');

  try {
    await Notification.create({
      userId: freelancer._id,
      senderId: user.id,
      senderName: reviewerName,
      type: 'freelancer_submission',
      title: `${candidateName} marked ${statusLabel}`,
      message: `${reviewerName} marked ${candidateName} as ${statusLabel} for ${jobTitle}.`,
      candidateId: candidate?._id,
      candidateName,
      candidatePosition: jobTitle,
      relatedEmail: user.email || '',
      priority: status === 'rejected' ? 'medium' : 'high',
      actionRequired: false,
      status: 'pending',
    });
  } catch (err) {
    logger.warn({ err }, 'Freelance review in-app notification failed');
  }

  if (!freelancer.email) return;
  try {
    const brand = await loadOrgEmailBrand(user.organizationId);
    const html = wrapBrandedEmailHtml({
      title: 'Submission update',
      eyebrow: 'Mandate handoff',
      orgName: brand.name,
      logoUrl: brand.logoUrl,
      brandColor: brand.brandColor,
      wordmark: brand.wordmark,
      bodyHtml: `
        <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(freelancer.name || 'there')},</p>
        <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
          ${escapeHtml(reviewerName)} updated your submission on <strong style="color:#0f172a;">${escapeHtml(brand.name)}</strong>.
        </p>
        ${infoPanelHtml([
          { label: 'Candidate', value: candidateName },
          { label: 'Mandate', value: jobTitle },
          { label: 'Status', value: statusLabel },
        ], brand.brandColor)}`,
    });
    await sendEmail(
      freelancer.email,
      `${candidateName} marked ${statusLabel}`,
      html,
      `${reviewerName} marked ${candidateName} as ${statusLabel} for ${jobTitle}.`,
      {
        senderName: brand.name,
        organizationId: user.organizationId,
        system: true,
      }
    );
  } catch (err) {
    logger.warn({ err: err.message }, 'Freelance review email failed');
  }
}

async function listSpocs(user) {
  requireFreelancer(user);
  return User.find({
    organizationId: user.organizationId,
    isActive: { $ne: false },
    role: { $in: SPOC_ROLES },
  }).select('name email role').sort({ name: 1 }).lean();
}

async function listMandates(user) {
  requireFreelancer(user);
  const filter = jobListFilter({ user });
  const jobs = await Job.find(filter)
    .populate('hiringManager', 'name email role')
    .populate('createdBy', 'name email role')
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();
  return jobs.map(attachMandateSpoc);
}

async function listOwnCandidates(user) {
  requireFreelancer(user);
  return Candidate.find({
    organizationId: user.organizationId,
    ...createdByFilter(user),
  }).select('name email contact position status source createdAt').sort({ createdAt: -1 }).limit(500).lean();
}

async function getDeskSummary(user) {
  requireFreelancer(user);
  const own = { organizationId: user.organizationId, ...createdByFilter(user) };
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalCandidates, thisMonth, mandates, submissions, recentCandidates] = await Promise.all([
    Candidate.countDocuments(own),
    Candidate.countDocuments({ ...own, createdAt: { $gte: startOfMonth } }),
    listMandates(user),
    listSubmissions(user),
    Candidate.find(own)
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name email position status source createdAt')
      .lean(),
  ]);

  const byStatus = { submitted: 0, reviewing: 0, shortlisted: 0, rejected: 0 };
  for (const row of submissions) {
    if (byStatus[row.status] !== undefined) byStatus[row.status] += 1;
  }

  return {
    totalCandidates,
    thisMonth,
    openMandates: mandates.length,
    awaitingReview: (byStatus.submitted || 0) + (byStatus.reviewing || 0),
    shortlisted: byStatus.shortlisted || 0,
    rejected: byStatus.rejected || 0,
    submittedTotal: submissions.length,
    mandates: mandates.slice(0, 5),
    recentSubmissions: submissions.slice(0, 8),
    recentCandidates,
  };
}

async function createSubmission(user, body) {
  requireFreelancer(user);
  const { candidateId, jobId, spocUserId, note } = body || {};
  if (!candidateId || !jobId) {
    throw httpError('candidateId and jobId are required');
  }

  const candidate = await Candidate.findOne({
    _id: candidateId,
    organizationId: user.organizationId,
    ...createdByFilter(user),
  });
  if (!candidate) throw httpError('Candidate not found on your desk', 404);

  const job = await Job.findOne({
    _id: jobId,
    organizationId: user.organizationId,
    status: 'Open',
  })
    .populate('hiringManager', 'name email role')
    .populate('createdBy', 'name email role');
  if (!job) throw httpError('Open mandate not found', 404);

  // Freelancers always notify the mandate poster; owner/admin may override via spocUserId.
  const spoc = await resolveMandateSpoc(job, {
    overrideSpocUserId: spocUserId,
    actor: user,
  });
  if (!spoc) {
    throw httpError(
      'This mandate has no company SPOC. Ask an owner/admin to re-open or reassign the job poster.',
      400
    );
  }

  const existing = await FreelancerSubmission.findOne({
    organizationId: user.organizationId,
    jobId,
    candidateId,
  });
  if (existing) throw httpError('This candidate is already submitted against this mandate', 409);

  const org = await Organization.findById(user.organizationId).select('atsSettings.pipelineStages').lean();
  const stages = org?.atsSettings?.pipelineStages;
  const stage = Array.isArray(stages) && stages.length ? stages[0] : 'Applied';

  let application = await Application.findOne({
    organizationId: user.organizationId,
    jobId,
    candidateId,
  });
  if (!application) {
    application = await Application.create({
      organizationId: user.organizationId,
      jobId,
      candidateId,
      stage,
      source: 'Freelance',
      assignedTo: spoc._id,
      metadata: {
        submittedBy: String(user.id),
        freelancerSubmission: true,
      },
      stageHistory: [{
        stage,
        movedAt: new Date(),
        movedBy: user.id,
        remark: 'Submitted by freelance recruiter',
      }],
    });
    await Job.findByIdAndUpdate(jobId, { $inc: { applicationCount: 1 } });
  } else {
    application.metadata = {
      ...(application.metadata || {}),
      submittedBy: String(user.id),
      freelancerSubmission: true,
    };
    if (!application.assignedTo) application.assignedTo = spoc._id;
    if (!application.source || application.source === 'Direct') application.source = 'Freelance';
    await application.save();
  }

  await shareCandidateWithSpoc(candidate, spoc._id, user.id);

  const submission = await FreelancerSubmission.create({
    organizationId: user.organizationId,
    freelancerId: user.id,
    candidateId,
    jobId,
    spocUserId: spoc._id,
    applicationId: application._id,
    note: String(note || '').trim(),
    status: 'submitted',
  });

  await notifySpocOfSubmission({
    user,
    spoc,
    candidate,
    job,
    note: String(note || '').trim(),
  });

  return submission.populate([
    { path: 'candidateId', select: 'name email contact position' },
    { path: 'jobId', select: 'title role location status department' },
    { path: 'spocUserId', select: 'name email role' },
  ]);
}

async function listSubmissions(user) {
  const filter = { organizationId: user.organizationId };
  if (isFreelancer(user)) {
    filter.freelancerId = user.id;
  } else if (['owner', 'admin'].includes(user.role)) {
    // org-wide review
  } else if (SPOC_ROLES.includes(user.role)) {
    filter.spocUserId = user.id;
  } else {
    throw httpError('Access denied', 403);
  }

  return FreelancerSubmission.find(filter)
    .populate('candidateId', 'name email contact position status source')
    .populate('jobId', 'title role location status department')
    .populate('freelancerId', 'name email')
    .populate('spocUserId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
}

async function updateSubmissionStatus(user, id, status) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  if (!SPOC_ROLES.includes(user.role)) throw httpError('Access denied', 403);
  const allowed = ['submitted', 'reviewing', 'shortlisted', 'rejected'];
  if (!allowed.includes(status)) throw httpError('Invalid status');

  const query = { _id: id, organizationId: user.organizationId };
  if (!['owner', 'admin'].includes(user.role)) {
    query.spocUserId = user.id;
  }

  const submission = await FreelancerSubmission.findOneAndUpdate(
    query,
    { $set: { status, reviewedAt: new Date(), reviewedBy: user.id } },
    { new: true }
  )
    .populate('candidateId', 'name email contact position')
    .populate('jobId', 'title role location')
    .populate('freelancerId', 'name email')
    .populate('spocUserId', 'name email role');

  if (!submission) throw httpError('Submission not found', 404);
  await notifyFreelancerOfReview({ user, submission, status });
  return submission;
}

module.exports = {
  listSpocs,
  listMandates,
  listOwnCandidates,
  getDeskSummary,
  createSubmission,
  listSubmissions,
  updateSubmissionStatus,
  resolveMandateSpoc,
  attachMandateSpoc,
};
