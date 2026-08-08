/**
 * Interviews domain — CRUD, cancel/complete, scorecards.
 */
const Interview = require('../models/Interview');
const Scorecard = require('../models/Scorecard');
const Application = require('../models/Application');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const populateInterview = {
  path: 'applicationId',
  populate: [{ path: 'candidateId', select: 'name email phone' }, { path: 'jobId', select: 'title role' }]
};

async function listInterviews(organizationId, query = {}) {
  const { status, interviewer } = query;
  const filter = { organizationId };
  if (status) filter.status = status;
  if (interviewer) filter.interviewers = { $elemMatch: { userId: interviewer } };

  return Interview.find(filter).sort({ scheduledAt: 1 }).populate(populateInterview);
}

async function listMyInterviews(organizationId, userId) {
  return Interview.find({
    organizationId,
    'interviewers.userId': userId
  }).sort({ scheduledAt: 1 }).populate(populateInterview);
}

async function getInterview(organizationId, id) {
  const interview = await Interview.findOne({ _id: id, organizationId }).populate('applicationId interviewers.userId');
  if (!interview) throw httpError('Not found', 404);
  return interview;
}

async function createInterview(organizationId, user, body) {
  const { applicationId, interviewers, scheduledAt, duration, type, location, meetingLink } = body;
  if (!applicationId || !scheduledAt) {
    throw httpError('applicationId and scheduledAt are required', 400);
  }

  const app = await Application.findOne({ _id: applicationId, organizationId });
  if (!app) throw httpError('Application not found', 404);

  const interview = new Interview({
    organizationId,
    applicationId,
    candidateId: app.candidateId,
    jobId: app.jobId,
    interviewers: Array.isArray(interviewers) && interviewers.length
      ? interviewers
      : [{ userId: user.id, name: user.name || '', email: user.email || '' }],
    scheduledAt,
    duration: duration || 60,
    type: type || 'video',
    location: location || '',
    meetingLink: meetingLink || '',
    status: 'scheduled',
    createdBy: user.id
  });
  await interview.save();
  await interview.populate(populateInterview);
  eventBus.emit(eventTypes.INTERVIEW_SCHEDULED, {
    organizationId,
    userId: user.id,
    resourceType: 'Interview',
    resourceId: interview._id,
    applicationId,
    scheduledAt
  });
  return interview;
}

async function updateInterview(organizationId, id, body) {
  return Interview.findOneAndUpdate(
    { _id: id, organizationId },
    { $set: body },
    { new: true }
  );
}

async function cancelInterview(organizationId, userId, id, reason) {
  const interview = await Interview.findOneAndUpdate(
    { _id: id, organizationId },
    { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: userId, cancelReason: reason } },
    { new: true }
  );
  if (interview) {
    eventBus.emit(eventTypes.INTERVIEW_CANCELLED, {
      organizationId,
      userId,
      resourceType: 'Interview',
      resourceId: interview._id,
      reason
    });
  }
  return interview;
}

async function completeInterview(organizationId, userId, id) {
  const interview = await Interview.findOneAndUpdate(
    { _id: id, organizationId },
    { $set: { status: 'completed' } },
    { new: true }
  );
  if (interview) {
    eventBus.emit(eventTypes.INTERVIEW_COMPLETED, {
      organizationId,
      userId,
      resourceType: 'Interview',
      resourceId: interview._id
    });
  }
  return interview;
}

async function listScorecards(organizationId, interviewId) {
  return Scorecard.find({ interviewId, organizationId });
}

async function submitScorecard(organizationId, user, interviewId, body) {
  const interview = await Interview.findOne({ _id: interviewId, organizationId });
  if (!interview) throw httpError('Interview not found', 404);

  const isAssigned = interview.interviewers.some(i => i.userId.toString() === user.id.toString());
  if (!isAssigned) throw httpError('Only assigned interviewers can submit scorecards', 403);

  const { criteria, overallRating, recommendation, strengths, concerns, notes, isDraft, templateId } = body;

  const normalizedCriteria = Array.isArray(criteria)
    ? criteria.map((c) => ({
        name: c.name,
        rating: Number(c.rating) || 3,
        weight: Math.min(5, Math.max(0.5, Number(c.weight) || 1)),
        comment: c.comment || ''
      }))
    : [];

  const scorecard = new Scorecard({
    organizationId,
    interviewId,
    applicationId: interview.applicationId || body.applicationId,
    interviewerId: user.id,
    templateId: templateId || null,
    criteria: normalizedCriteria,
    overallRating,
    recommendation,
    strengths,
    concerns,
    notes,
    isDraft: isDraft || false
  });
  await scorecard.save();
  if (!scorecard.isDraft) {
    eventBus.emit(eventTypes.SCORECARD_SUBMITTED, {
      organizationId,
      userId: user.id,
      resourceType: 'Scorecard',
      resourceId: scorecard._id,
      interviewId,
      recommendation
    });
  }
  return scorecard;
}

async function updateScorecard(organizationId, userId, id, body) {
  const scorecard = await Scorecard.findOne({ _id: id, organizationId });
  if (!scorecard) throw httpError('Not found', 404);
  if (scorecard.interviewerId.toString() !== userId.toString()) {
    throw httpError('Unauthorized', 403);
  }
  if (!scorecard.isDraft) throw httpError('Cannot edit submitted scorecard', 400);

  Object.assign(scorecard, body);
  await scorecard.save();
  return scorecard;
}

module.exports = {
  listInterviews,
  listMyInterviews,
  getInterview,
  createInterview,
  updateInterview,
  cancelInterview,
  completeInterview,
  listScorecards,
  submitScorecard,
  updateScorecard,
};
