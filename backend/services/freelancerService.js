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
const { lastSeenAt, presenceStatus, heartbeat } = require('./presenceService');
const ops = require('./freelancerOps');

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

function candidateRefId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || '');
  return String(value);
}

function presentSubmission(row, extraCandidate = null) {
  const populated = row?.candidateId && typeof row.candidateId === 'object' && row.candidateId.name
    ? row.candidateId
    : extraCandidate;
  const snap = row?.candidateSnapshot || {};
  const name = String(populated?.name || snap.name || '').trim();
  const email = String(populated?.email || snap.email || '').trim();
  const contact = String(populated?.contact || snap.contact || '').trim();
  const position = String(populated?.position || snap.position || '').trim();
  const history = Array.isArray(row?.history) ? row.history : [];
  let lastReassignment = null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.action === 'reassign_spoc') {
      lastReassignment = {
        at: history[i].at,
        byName: history[i].byName || '',
        fromName: history[i].meta?.fromName || '',
        toName: history[i].meta?.toName || '',
        from: history[i].meta?.from || '',
        to: history[i].meta?.to || '',
      };
      break;
    }
  }
  return {
    ...row,
    candidateSnapshot: { name, email, contact, position },
    candidateId: {
      ...(typeof row?.candidateId === 'object' ? row.candidateId : {}),
      _id: populated?._id || candidateRefId(row?.candidateId) || undefined,
      name,
      email,
      contact,
      position,
    },
    lastReassignment,
  };
}

async function hydrateSubmissions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const missingIds = list
    .filter((row) => !(row.candidateId && row.candidateId.name))
    .map((row) => candidateRefId(row.candidateId))
    .filter(Boolean);
  let extras = new Map();
  if (missingIds.length) {
    const found = await Candidate.find({ _id: { $in: missingIds } })
      .select('name email contact position resume noticePeriod expectedCtc ctc phone')
      .lean();
    extras = new Map(found.map((c) => [String(c._id), c]));
  }
  const settings = list[0]?.organizationId
    ? await ops.loadDeskSettings(list[0].organizationId)
    : ops.DEFAULT_DESK;
  return list.map((row) => {
    const presented = presentSubmission(row, extras.get(candidateRefId(row.candidateId)));
    return ops.enrichAging(presented, settings.slaDays);
  });
}

function orgStaffFilter(organizationId) {
  return {
    organizationId,
    role: { $ne: 'freelancer' },
    isActive: { $ne: false },
  };
}

function pickSpocFromStaff(job, staff) {
  const byId = new Map(staff.map((u) => [String(u._id), u]));
  const byEmail = new Map(staff.map((u) => [String(u.email || '').toLowerCase(), u]));
  const hmId = asUserId(job.hiringManager);
  if (hmId && byId.has(hmId)) return byId.get(hmId);
  for (const raw of job.hiringManagers || []) {
    const token = String(raw || '').trim();
    if (!token) continue;
    if (byId.has(token)) return byId.get(token);
    const email = token.toLowerCase();
    if (byEmail.has(email)) return byEmail.get(email);
  }
  const posterId = asUserId(job.createdBy);
  if (posterId && byId.has(posterId)) return byId.get(posterId);
  return null;
}

/**
 * Mandate SPOC = hiring manager on the job (who owns the requisition).
 * Falls back to the poster only if no hiring manager was assigned.
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

  const staff = await User.find(orgStaffFilter(orgId)).select('name email role phone').lean();
  return pickSpocFromStaff(job, staff);
}

function publicStaffContact(person) {
  if (!person) return null;
  return {
    _id: person._id,
    name: person.name || '',
    role: person.role || '',
  };
}

function attachMandateSpoc(job, spoc = null) {
  const hm = job.hiringManager && typeof job.hiringManager === 'object' ? job.hiringManager : null;
  const poster = job.createdBy && typeof job.createdBy === 'object' ? job.createdBy : null;
  const resolved = spoc || hm || poster || null;
  return {
    ...job,
    mandateSpoc: publicStaffContact(resolved),
    postedBy: publicStaffContact(poster),
    hiringManager: publicStaffContact(hm) || job.hiringManager,
    createdBy: publicStaffContact(poster) || job.createdBy,
  };
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || publicSiteBase() || '').replace(/\/$/, '');
}

async function shareCandidateWithSpoc(candidate, spocId, freelancerId, spocUser = null) {
  const already = (candidate.sharedWith || []).some((row) => String(row.userId) === String(spocId));
  if (!already) {
    candidate.sharedWith = candidate.sharedWith || [];
    candidate.sharedWith.push({
      userId: spocId,
      sharedAt: new Date(),
      sharedBy: freelancerId,
    });
  }
  // Stamp SPOC name so the hiring manager's desk filter also surfaces this handoff
  const spocName = String(spocUser?.name || '').trim();
  if (spocName && !String(candidate.spoc || '').trim()) {
    candidate.spoc = spocName.toUpperCase();
  }
  if (!String(candidate.source || '').trim() || /^direct$/i.test(candidate.source)) {
    candidate.source = 'Freelance';
  }
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
    const atsUrl = `${frontendUrl()}/ats?view=shared&q=${encodeURIComponent(candidateName)}`;
    const rows = [
      { label: 'Candidate', value: candidateName },
      job.jobCode ? { label: 'Job ID', value: job.jobCode } : null,
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

/**
 * When a freelancer shares a candidate who already exists in the company ATS,
 * notify the hiring manager / company — never overwrite or re-add the profile.
 */
async function notifyCompanyOfExistingCandidateShare({ user, spoc, candidate, job, duplicates }) {
  const freelancerName = user.name || user.email || 'Freelance recruiter';
  const jobTitle = job?.title || job?.role || 'Open mandate';
  const candidateName = candidate?.name || 'Candidate';
  const matchSummary = (duplicates || [])
    .map((d) => [d.name, d.email, d.contact, d.matchOn ? `via ${d.matchOn}` : '']
      .filter(Boolean)
      .join(' · '))
    .filter(Boolean)
    .join('; ') || 'existing ATS profile';

  const recipients = [];
  if (spoc?._id) recipients.push(spoc);

  // Also ping org leadership so company ops can see the attempt.
  try {
    const leaders = await User.find({
      organizationId: user.organizationId,
      role: { $in: ['owner', 'admin', 'hr_manager'] },
      isActive: { $ne: false },
    }).select('_id name email role').limit(12).lean();
    for (const lead of leaders) {
      if (!recipients.some((r) => String(r._id) === String(lead._id))) {
        recipients.push(lead);
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Duplicate-share leadership lookup failed');
  }

  for (const person of recipients) {
    if (!person?._id) continue;
    try {
      await Notification.create({
        userId: person._id,
        senderId: user.id,
        senderName: freelancerName,
        type: 'freelancer_submission',
        title: `Existing candidate shared · ${candidateName}`,
        message: `${freelancerName} attempted to share ${candidateName} for ${jobTitle}, but this person is already available in the company ATS. No profile was overwritten or added. Match: ${matchSummary}.`,
        candidateId: duplicates?.[0]?._id || candidate?._id,
        candidateName,
        candidatePosition: jobTitle,
        candidateContact: candidate?.contact || '',
        relatedEmail: user.email || '',
        priority: 'medium',
        actionRequired: false,
        status: 'pending',
      });
    } catch (err) {
      logger.warn({ err }, 'Duplicate-share in-app notification failed');
    }

    if (!person.email) continue;
    try {
      const brand = await loadOrgEmailBrand(user.organizationId);
      const atsUrl = `${frontendUrl()}/ats?q=${encodeURIComponent(candidateName)}`;
      const rows = [
        { label: 'Shared candidate', value: candidateName },
        job?.jobCode ? { label: 'Job ID', value: job.jobCode } : null,
        { label: 'Mandate', value: jobTitle },
        { label: 'Shared by', value: freelancerName },
        user.email ? { label: 'Recruiter email', value: user.email } : null,
        candidate?.email ? { label: 'Email on share', value: candidate.email } : null,
        candidate?.contact ? { label: 'Phone on share', value: candidate.contact } : null,
        { label: 'ATS match', value: matchSummary },
        { label: 'Action taken', value: 'Blocked — no overwrite, no new ATS record' },
      ].filter(Boolean);
      const html = wrapBrandedEmailHtml({
        title: 'Candidate already in ATS',
        eyebrow: 'Freelance share blocked',
        orgName: brand.name,
        logoUrl: brand.logoUrl,
        brandColor: brand.brandColor,
        wordmark: brand.wordmark,
        bodyHtml: `
          <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(person.name || 'there')},</p>
          <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
            A freelance recruiter shared a candidate who is <strong style="color:#0f172a;">already available</strong> in your company ATS.
            The existing profile was <strong>not overwritten</strong> and no duplicate was added.
          </p>
          ${infoPanelHtml(rows, brand.brandColor)}
          <div style="text-align:center;">
            ${brandButtonHtml({ href: atsUrl, label: 'Open candidate in ATS', brandColor: brand.brandColor })}
          </div>`,
      });
      await sendEmail(
        person.email,
        `Existing candidate shared · ${candidateName}`,
        html,
        `${freelancerName} shared ${candidateName} for ${jobTitle}, but the candidate already exists in ATS. No overwrite. Match: ${matchSummary}. Review: ${atsUrl}`,
        {
          senderName: brand.name,
          organizationId: user.organizationId,
          system: true,
        }
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'Duplicate-share email to company failed');
    }
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
      title: `Review update · ${candidateName}`,
      message: submission.feedback
        ? `${reviewerName} marked ${statusLabel} for ${jobTitle}: ${submission.feedback}`
        : `${reviewerName} moved this handoff to ${statusLabel} for ${jobTitle}.`,
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
          submission.feedback ? { label: 'Feedback', value: submission.feedback } : null,
        ].filter(Boolean), brand.brandColor)}`,
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
  }).select('_id name role').sort({ name: 1 }).lean();
}

async function listMandates(user) {
  requireFreelancer(user);
  const filter = jobListFilter({ user });
  const [jobs, staff] = await Promise.all([
    Job.find(filter)
      .setOptions(user.organizationId ? { _tenantId: user.organizationId } : {})
      .populate('hiringManager', 'name email role phone')
      .populate('createdBy', 'name email role phone')
      .sort({ createdAt: -1, updatedAt: -1 })
      .lean(),
    User.find(orgStaffFilter(user.organizationId)).select('name email role phone').lean(),
  ]);
  return jobs.map((job) => attachMandateSpoc(job, pickSpocFromStaff(job, staff)));
}

async function listOwnCandidates(user) {
  requireFreelancer(user);
  const uid = user.id || user._id;
  return Candidate.find({
    organizationId: user.organizationId,
    ...createdByFilter(user),
    hiddenFromFreelancerIds: { $nin: [uid, String(uid)] },
  }).select('name email contact position status source createdAt').sort({ createdAt: -1 }).limit(500).lean();
}

async function getDeskSummary(user) {
  requireFreelancer(user);
  const uid = user.id || user._id;
  const own = {
    organizationId: user.organizationId,
    ...createdByFilter(user),
    hiddenFromFreelancerIds: { $nin: [uid, String(uid)] },
  };
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [totalCandidates, thisMonth, lastMonth, mandates, submissions, recentCandidates] = await Promise.all([
    Candidate.countDocuments(own),
    Candidate.countDocuments({ ...own, createdAt: { $gte: startOfMonth } }),
    Candidate.countDocuments({ ...own, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
    listMandates(user),
    listSubmissions(user),
    Candidate.find(own)
      .sort({ createdAt: -1 })
      .limit(6)
      .select('name email position status source createdAt')
      .lean(),
  ]);

  const byStatus = { submitted: 0, reviewing: 0, shortlisted: 0, selection: 0, joined: 0, rejected: 0 };
  for (const row of submissions) {
    if (byStatus[row.status] !== undefined) byStatus[row.status] += 1;
  }

  const submittedTotal = submissions.length;
  const shortlisted = (byStatus.shortlisted || 0) + (byStatus.selection || 0) + (byStatus.joined || 0);
  const rejected = byStatus.rejected || 0;
  const candidateTrend = lastMonth > 0
    ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
    : (thisMonth > 0 ? 100 : 0);
  const settings = await ops.loadDeskSettings(user.organizationId);
  const slaBreaches = submissions.filter((row) => row.slaBreached).length;

  return {
    totalCandidates,
    thisMonth,
    lastMonth,
    candidateTrend,
    openMandates: mandates.length,
    awaitingReview: (byStatus.submitted || 0) + (byStatus.reviewing || 0),
    shortlisted,
    rejected,
    submittedTotal,
    conversionRate: submittedTotal > 0 ? Math.round((shortlisted / submittedTotal) * 100) : 0,
    rejectionRate: submittedTotal > 0 ? Math.round((rejected / submittedTotal) * 100) : 0,
    slaBreaches,
    deskSettings: settings,
    mandates: mandates.slice(0, 20),
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
    ...jobListFilter({ user }),
  })
    .setOptions(user.organizationId ? { _tenantId: user.organizationId } : {})
    .populate('hiringManager', 'name email role')
    .populate('createdBy', 'name email role');
  if (!job) throw httpError('Open mandate not found', 404);

  // Freelancers always notify the hiring manager; owner/admin may override via spocUserId.
  const spoc = await resolveMandateSpoc(job, {
    overrideSpocUserId: spocUserId,
    actor: user,
  });
  if (!spoc) {
    throw httpError(
      'This mandate has no hiring manager. Ask an owner/admin to assign a hiring manager on the job.',
      400
    );
  }

  const existing = await FreelancerSubmission.findOne({
    organizationId: user.organizationId,
    jobId,
    candidateId,
  });
  if (existing) {
    if (existing.archivedAt) {
      throw httpError(
        'This handoff was archived by the company. Ask your hiring manager to restore it if you need to reopen.',
        409
      );
    }
    throw httpError('This candidate is already submitted against this mandate', 409);
  }

  let quality;
  try {
    ({ quality } = await ops.validateBeforeSubmit(user, {
      candidate,
      jobId,
      note,
    }));
  } catch (err) {
    // Company-facing notice: freelancer tried to share someone already in ATS.
    // Do not create Application / share / overwrite — only notify and rethrow.
    if (err.code === 'DUPLICATE' && Array.isArray(err.duplicates) && err.duplicates.length) {
      try {
        await notifyCompanyOfExistingCandidateShare({
          user,
          spoc,
          candidate,
          job,
          duplicates: err.duplicates,
        });
      } catch (notifyErr) {
        logger.warn({ err: notifyErr }, 'Duplicate-share company notify failed');
      }
    }
    throw err;
  }

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

  await shareCandidateWithSpoc(candidate, spoc._id, user.id, spoc);

  const submission = await FreelancerSubmission.create({
    organizationId: user.organizationId,
    freelancerId: user.id,
    candidateId,
    jobId,
    spocUserId: spoc._id,
    applicationId: application._id,
    note: String(note || '').trim(),
    status: 'submitted',
    candidateSnapshot: {
      name: candidate.name || '',
      email: candidate.email || '',
      contact: candidate.contact || '',
      position: candidate.position || '',
    },
    qualityFlags: {
      hasResume: quality.hasResume,
      hasNote: quality.hasNote,
      hasNotice: quality.hasNotice,
      hasExpectedCtc: quality.hasExpectedCtc,
      missing: quality.missing,
    },
    history: [{
      action: 'submitted',
      at: new Date(),
      by: user.id,
      byName: user.name || user.email || '',
      meta: { spocUserId: String(spoc._id) },
    }],
  });

  await ops.writeAudit(user, 'freelancer.submitted', submission._id, {
    jobId: String(jobId),
    candidateId: String(candidateId),
    spocUserId: String(spoc._id),
  });

  await notifySpocOfSubmission({
    user,
    spoc,
    candidate,
    job,
    note: String(note || '').trim(),
  });

  return submission.populate([
    { path: 'candidateId', select: 'name email contact position resume noticePeriod expectedCtc ctc phone' },
    { path: 'jobId', select: 'title role location status department jobCode clientName' },
    { path: 'spocUserId', select: 'name email role phone' },
  ]);
}

function submissionScopeQuery(user, id) {
  const query = { _id: id, organizationId: user.organizationId };
  if (isFreelancer(user)) {
    query.freelancerId = user.id;
  } else if (!['owner', 'admin', 'hr_manager'].includes(user.role)) {
    query.spocUserId = user.id;
  }
  return query;
}

async function listSubmissions(user, opts = {}) {
  const includeArchived = Boolean(opts.includeArchived);
  const filter = { organizationId: user.organizationId };
  if (isFreelancer(user)) {
    filter.freelancerId = user.id;
  } else if (['owner', 'admin', 'hr_manager'].includes(user.role)) {
    // Leadership: all freelance handoffs in the org
  } else {
    // Recruiters / sales: only handoffs where they are the mandate SPOC
    filter.spocUserId = user.id;
  }
  if (!includeArchived) {
    filter.archivedAt = null;
  }

  const rows = await FreelancerSubmission.find(filter)
    .populate('candidateId', 'name email contact position location companyName resume noticePeriod expectedCtc ctc phone')
    .populate('jobId', 'title role location locations status department jobCode clientName')
    .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
    .populate('spocUserId', 'name email role phone')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  return hydrateSubmissions(rows);
}

async function updateSubmissionStatus(user, id, body) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  const status = typeof body === 'string' ? body : body?.status;
  const feedbackRaw = typeof body === 'string' ? undefined : body?.feedback;
  const allowed = ['submitted', 'reviewing', 'shortlisted', 'selection', 'joined', 'rejected'];
  if (!allowed.includes(status)) throw httpError('Invalid status');

  const query = submissionScopeQuery(user, id);
  query.archivedAt = null;

  // Warn on shortlist if org already has another candidate with same email/phone
  if ((status === 'shortlisted' || status === 'selection' || status === 'joined') && !(body && body.forceDuplicate)) {
    const peek = await FreelancerSubmission.findOne(query).populate('candidateId', 'email contact phone name').lean();
    if (peek?.candidateId) {
      const dups = await ops.findDuplicateCandidates(user.organizationId, peek.candidateId, {
        excludeId: peek.candidateId._id,
      });
      if (dups.length) {
        throw httpError(
          'Possible duplicate in ATS. Confirm shortlist to continue.',
          409,
          { code: 'DUPLICATE', duplicates: dups }
        );
      }
    }
  }

  const historyEntry = {
    action: 'status_change',
    at: new Date(),
    by: user.id,
    byName: user.name || user.email || '',
    meta: { status, feedbackUpdated: feedbackRaw !== undefined },
  };

  const $set = { status, reviewedAt: new Date(), reviewedBy: user.id };
  if (feedbackRaw !== undefined) {
    $set.feedback = String(feedbackRaw || '').trim().slice(0, 4000);
  }

  const submission = await FreelancerSubmission.findOneAndUpdate(
    query,
    { $set, $push: { history: historyEntry } },
    { new: true }
  )
    .populate('candidateId', 'name email contact position resume noticePeriod expectedCtc ctc phone')
    .populate('jobId', 'title role location jobCode clientName')
    .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
    .populate('spocUserId', 'name email role phone');

  if (!submission) {
    const archived = await FreelancerSubmission.findOne({
      ...submissionScopeQuery(user, id),
      archivedAt: { $ne: null },
    }).select('_id').lean();
    if (archived) throw httpError('This handoff is archived. Restore it before changing stage.', 409);
    throw httpError('Submission not found', 404);
  }

  await ops.writeAudit(user, 'freelancer.status_change', submission._id, { status });

  // Mirror review into the company application pipeline (enterprise handoff).
  const STATUS_TO_STAGE = {
    submitted: 'Applied',
    reviewing: 'Screening',
    shortlisted: 'Shortlisted',
    selection: 'Selected',
    joined: 'Joined',
    rejected: null,
  };
  const STATUS_TO_CANDIDATE = {
    submitted: 'APPLIED',
    reviewing: 'SCREENING',
    shortlisted: 'SHORTLISTED',
    selection: 'SELECTED',
    joined: 'JOINED',
    rejected: 'REJECTED',
  };
  if (submission.applicationId) {
    try {
      const application = await Application.findOne({
        _id: submission.applicationId,
        organizationId: user.organizationId,
      });
      if (application) {
        const nextStage = STATUS_TO_STAGE[status];
        application.metadata = {
          ...(application.metadata || {}),
          freelancerSubmission: true,
          freelancerReviewStatus: status,
          lastReviewedBy: String(user.id),
          lastReviewedAt: new Date().toISOString(),
        };
        if (nextStage && application.stage !== nextStage) {
          application.stage = nextStage;
          application.stageHistory = application.stageHistory || [];
          application.stageHistory.push({
            stage: nextStage,
            movedAt: new Date(),
            movedBy: user.id,
            remark: `Freelance desk review → ${status}`,
          });
        } else if (status === 'rejected') {
          application.stageHistory = application.stageHistory || [];
          application.stageHistory.push({
            stage: application.stage || 'Applied',
            movedAt: new Date(),
            movedBy: user.id,
            remark: 'Freelance desk review → rejected',
          });
        }
        await application.save();
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to sync freelance review into application pipeline');
    }
  }

  // Keep the linked candidate status company-driven so freelancers see read-only progress.
  try {
    const candId = submission.candidateId?._id || submission.candidateId;
    const nextCandStatus = STATUS_TO_CANDIDATE[status];
    if (candId && nextCandStatus) {
      await Candidate.findOneAndUpdate(
        { _id: candId, organizationId: user.organizationId },
        { $set: { status: nextCandStatus } }
      );
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to sync freelance review into candidate status');
  }

  await notifyFreelancerOfReview({ user, submission, status });
  return submission;
}

async function archiveSubmission(user, id) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);

  const query = { ...submissionScopeQuery(user, id), archivedAt: null };
  const submission = await FreelancerSubmission.findOneAndUpdate(
    query,
    {
      $set: {
        archivedAt: new Date(),
        archivedBy: user.id,
        reviewedAt: new Date(),
        reviewedBy: user.id,
      },
      $push: {
        history: {
          action: 'archived',
          at: new Date(),
          by: user.id,
          byName: user.name || user.email || '',
          meta: {},
        },
      },
    },
    { new: true }
  )
    .populate('candidateId', 'name email contact position')
    .populate('jobId', 'title role location jobCode clientName')
    .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
    .populate('spocUserId', 'name email role phone');

  if (!submission) throw httpError('Submission not found or already archived', 404);
  await ops.writeAudit(user, 'freelancer.archived', submission._id, {});

  try {
    const freelancer = submission.freelancerId;
    const candidate = submission.candidateId;
    const job = submission.jobId;
    if (freelancer?._id) {
      const reviewerName = user.name || user.email || 'Company reviewer';
      const candidateName = candidate?.name || 'your candidate';
      const jobTitle = job?.title || job?.role || 'the mandate';
      await Notification.create({
        userId: freelancer._id,
        senderId: user.id,
        senderName: reviewerName,
        type: 'freelancer_submission',
        title: `Handoff archived · ${candidateName}`,
        message: `${reviewerName} archived the handoff for ${candidateName} on ${jobTitle}. It no longer appears on active desks.`,
        candidateId: candidate?._id,
        candidateName,
        candidatePosition: jobTitle,
        relatedEmail: user.email || '',
        priority: 'low',
        actionRequired: false,
        status: 'pending',
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Archive handoff notification failed');
  }

  return submission;
}

async function restoreSubmission(user, id) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);

  const query = {
    ...submissionScopeQuery(user, id),
    archivedAt: { $ne: null },
  };
  const submission = await FreelancerSubmission.findOneAndUpdate(
    query,
    {
      $set: {
        archivedAt: null,
        archivedBy: null,
        reviewedAt: new Date(),
        reviewedBy: user.id,
      },
      $push: {
        history: {
          action: 'restored',
          at: new Date(),
          by: user.id,
          byName: user.name || user.email || '',
          meta: {},
        },
      },
    },
    { new: true }
  )
    .populate('candidateId', 'name email contact position')
    .populate('jobId', 'title role location jobCode clientName')
    .populate('freelancerId', 'name email lastActiveAt lastLoginAt profilePicture')
    .populate('spocUserId', 'name email role phone');

  if (!submission) throw httpError('Archived submission not found', 404);
  await ops.writeAudit(user, 'freelancer.restored', submission._id, {});

  try {
    const freelancer = submission.freelancerId;
    const candidate = submission.candidateId;
    const job = submission.jobId;
    if (freelancer?._id) {
      const reviewerName = user.name || user.email || 'Company reviewer';
      const candidateName = candidate?.name || 'your candidate';
      const jobTitle = job?.title || job?.role || 'the mandate';
      await Notification.create({
        userId: freelancer._id,
        senderId: user.id,
        senderName: reviewerName,
        type: 'freelancer_submission',
        title: `Handoff restored · ${candidateName}`,
        message: `${reviewerName} restored the handoff for ${candidateName} on ${jobTitle}.`,
        candidateId: candidate?._id,
        candidateName,
        candidatePosition: jobTitle,
        relatedEmail: user.email || '',
        priority: 'medium',
        actionRequired: false,
        status: 'pending',
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Restore handoff notification failed');
  }

  return submission;
}

async function requestFeedback(user, submissionId) {
  requireFreelancer(user);
  const submission = await FreelancerSubmission.findOne({
    _id: submissionId,
    organizationId: user.organizationId,
    freelancerId: user.id,
    archivedAt: null,
  })
    .populate('candidateId', 'name email contact position')
    .populate('jobId', 'title role jobCode')
    .populate('spocUserId', 'name email role phone');
  if (!submission) throw httpError('Submission not found', 404);

  const spoc = submission.spocUserId;
  if (!spoc?._id) throw httpError('This mandate has no hiring manager to request feedback from', 400);

  const freelancerName = user.name || user.email || 'Freelance recruiter';
  const candidateName = submission.candidateId?.name || 'Candidate';
  const jobTitle = submission.jobId?.title || submission.jobId?.role || 'Open mandate';
  const jobCode = submission.jobId?.jobCode || '';

  submission.feedbackRequestedAt = new Date();
  await submission.save();

  try {
    await Notification.create({
      userId: spoc._id,
      senderId: user.id,
      senderName: freelancerName,
      type: 'freelancer_submission',
      title: `Feedback requested: ${candidateName}`,
      message: `${freelancerName} requested feedback on ${candidateName} for ${jobCode ? `${jobCode} · ` : ''}${jobTitle}.`,
      candidateId: submission.candidateId?._id,
      candidateName,
      candidatePosition: jobTitle,
      relatedEmail: user.email || '',
      priority: 'high',
      actionRequired: true,
      status: 'pending',
    });
  } catch (err) {
    logger.warn({ err }, 'Feedback request notification failed');
  }

  if (spoc.email) {
    try {
      const brand = await loadOrgEmailBrand(user.organizationId);
      const atsUrl = `${frontendUrl()}/freelance-review`;
      const html = wrapBrandedEmailHtml({
        title: 'Feedback requested',
        eyebrow: 'Freelance desk',
        orgName: brand.name,
        logoUrl: brand.logoUrl,
        brandColor: brand.brandColor,
        wordmark: brand.wordmark,
        bodyHtml: `
          <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi ${escapeHtml(spoc.name || 'there')},</p>
          <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">
            ${escapeHtml(freelancerName)} asked for feedback on a submission.
          </p>
          ${infoPanelHtml([
            { label: 'Candidate', value: candidateName },
            jobCode ? { label: 'Job ID', value: jobCode } : null,
            { label: 'Mandate', value: jobTitle },
          ].filter(Boolean), brand.brandColor)}
          <div style="text-align:center;">
            ${brandButtonHtml({ href: atsUrl, label: 'Leave feedback', brandColor: brand.brandColor })}
          </div>`,
      });
      await sendEmail(
        spoc.email,
        `Feedback requested: ${candidateName}`,
        html,
        `${freelancerName} requested feedback on ${candidateName} for ${jobTitle}. Review: ${atsUrl}`,
        {
          senderName: brand.name,
          organizationId: user.organizationId,
          system: true,
        }
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'Feedback request email failed');
    }
  }

  return submission;
}

async function listFreelancerPresence(user) {
  if (isFreelancer(user)) throw httpError('Company reviewers only', 403);
  const people = await User.find({
    organizationId: user.organizationId,
    role: 'freelancer',
    isActive: { $ne: false },
  }).select('name email lastActiveAt lastLoginAt profilePicture').sort({ name: 1 }).lean();

  return people.map((p) => {
    const seenAt = lastSeenAt(p);
    return {
      _id: p._id,
      name: p.name || p.email || 'Freelance recruiter',
      email: p.email || '',
      profilePicture: p.profilePicture || '',
      lastActiveAt: seenAt,
      lastLoginAt: p.lastLoginAt || null,
      status: presenceStatus(seenAt),
    };
  });
}

module.exports = {
  listSpocs,
  listMandates,
  listOwnCandidates,
  getDeskSummary,
  createSubmission,
  listSubmissions,
  updateSubmissionStatus,
  archiveSubmission,
  restoreSubmission,
  requestFeedback,
  resolveMandateSpoc,
  attachMandateSpoc,
  pickSpocFromStaff,
  presentSubmission,
  publicStaffContact,
  presenceStatus,
  heartbeat,
  listFreelancerPresence,
  listReviewers: ops.listReviewers,
  reassignSpoc: ops.reassignSpoc,
  bulkDeskAction: ops.bulkDeskAction,
  hardDeleteSubmission: ops.hardDeleteSubmission,
  updateCandidateFromDesk: ops.updateCandidateFromDesk,
  getPlacementStats: ops.getPlacementStats,
  getDeskSettingsForUser: ops.getDeskSettingsForUser,
  getMandateCapacity: ops.getMandateCapacity,
  previewSubmissionQuality: ops.previewSubmissionQuality,
};
