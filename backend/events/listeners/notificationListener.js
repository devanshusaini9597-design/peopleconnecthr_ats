/**
 * In-app notifications from domain events.
 * Always per-recipient (never org-wide). Managers of involved people
 * get a separate team_activity copy so intern work surfaces on "My team".
 */

const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const logger = require('../../utils/logger');
const {
  asId,
  notifyUser,
  notifyInvolvedAndManagers,
} = require('../../utils/reportingScope');

function actorId(data) {
  return asId(data?.userId || data?.changedById || data?.submitterId || data?.actorId);
}

function candidateName(value) {
  if (!value) return 'a candidate';
  if (typeof value === 'object') return value.name || 'a candidate';
  return 'a candidate';
}

function jobTitle(value) {
  if (!value) return 'a role';
  if (typeof value === 'object') return value.title || 'a role';
  return 'a role';
}

async function applicationRecipients(applicationId) {
  const Application = require('../../models/Application');
  const application = await Application.findById(applicationId)
    .populate('jobId', 'title hiringManager assignedRecruiters')
    .populate('candidateId', 'name createdBy')
    .lean();
  if (!application) return { ids: [], application: null };
  const ids = [
    application.assignedTo,
    application.jobId?.hiringManager,
    ...(application.jobId?.assignedRecruiters || []),
    application.candidateId?.createdBy,
  ];
  return { ids, application };
}

const initNotificationListeners = () => {
  on(eventTypes.CANDIDATE_HIRED, async (data) => {
    try {
      const skipId = actorId(data);
      const { ids, application } = await applicationRecipients(data.applicationId);
      const name = candidateName(application?.candidateId);
      const title = jobTitle(application?.jobId);
      await notifyInvolvedAndManagers({
        organizationId: data.organizationId,
        recipientIds: ids,
        skipId,
        payload: {
          type: 'candidate_hired',
          title: 'Candidate hired',
          message: `${name} was hired for ${title}.`,
          candidateId: application?.candidateId?._id || data.candidateId,
          candidateName: name,
          candidatePosition: title,
          senderId: skipId || null,
          priority: 'high',
        },
      });
    } catch (err) {
      logger.warn('[notificationListener] CANDIDATE_HIRED', err.message);
    }
  });

  on(eventTypes.INTERVIEW_SCHEDULED, async (data) => {
    try {
      const skipId = actorId(data);
      const Interview = require('../../models/Interview');
      const interview = await Interview.findById(data.resourceId || data.interviewId)
        .populate('candidateId', 'name')
        .lean();
      if (!interview) return;
      const ids = [
        ...(interview.interviewers || []).map((row) => row.userId),
        interview.createdBy,
      ];
      const name = candidateName(interview.candidateId);
      await notifyInvolvedAndManagers({
        organizationId: data.organizationId,
        recipientIds: ids,
        skipId,
        payload: {
          type: 'interview_reminder',
          title: 'Interview scheduled',
          message: `An interview was scheduled with ${name}.`,
          candidateId: interview.candidateId?._id || interview.candidateId,
          candidateName: name,
          senderId: skipId || null,
          priority: 'high',
        },
      });
    } catch (err) {
      logger.warn('[notificationListener] INTERVIEW_SCHEDULED', err.message);
    }
  });

  on(eventTypes.SCORECARD_SUBMITTED, async (data) => {
    try {
      const skipId = actorId(data);
      const Interview = require('../../models/Interview');
      const interview = await Interview.findById(data.interviewId).select('applicationId').lean();
      const { ids, application } = await applicationRecipients(interview?.applicationId);
      const name = candidateName(application?.candidateId);
      await notifyInvolvedAndManagers({
        organizationId: data.organizationId,
        recipientIds: ids,
        skipId,
        payload: {
          type: 'candidate_update',
          title: 'Scorecard submitted',
          message: `A scorecard was submitted for ${name}.`,
          candidateId: application?.candidateId?._id,
          candidateName: name,
          senderId: skipId || null,
          priority: 'medium',
        },
      });
    } catch (err) {
      logger.warn('[notificationListener] SCORECARD_SUBMITTED', err.message);
    }
  });

  on(eventTypes.APPLICATION_STAGE_CHANGED, async (data) => {
    try {
      if (/^(hired|joined)$/i.test(String(data.newStage || ''))) return;
      const skipId = actorId(data);
      const { ids, application } = await applicationRecipients(data.resourceId || data.applicationId);
      const name = candidateName(application?.candidateId);
      await notifyInvolvedAndManagers({
        organizationId: data.organizationId,
        recipientIds: ids,
        skipId,
        payload: {
          type: 'candidate_update',
          title: 'Pipeline update',
          message: `${name} moved to ${data.newStage || 'a new stage'}.`,
          candidateId: application?.candidateId?._id || data.candidateId,
          candidateName: name,
          senderId: skipId || null,
          priority: 'medium',
        },
      });
    } catch (err) {
      logger.warn('[notificationListener] APPLICATION_STAGE_CHANGED', err.message);
    }
  });

  on(eventTypes.USER_JOINED, async (data) => {
    try {
      if (!data.invitedById) return;
      await notifyUser(data.invitedById, {
        type: 'invitation_accepted',
        title: 'Invitation accepted',
        message: `${data.name || 'A teammate'} accepted your invitation and joined the team.`,
        senderId: data.userId || null,
        senderName: data.name || '',
        priority: 'medium',
      });
    } catch (err) {
      logger.warn('[notificationListener] USER_JOINED', err.message);
    }
  });
};

module.exports = { initNotificationListeners };
