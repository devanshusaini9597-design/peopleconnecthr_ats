/**
 * Notification Listener
 * Creates in-app notifications based on events.
 */

const { on } = require('../eventBus');
const eventTypes = require('../eventTypes');
const mongoose = require('mongoose');

const initNotificationListeners = () => {
  
  // Notify job's assigned recruiters when candidate is hired
  on(eventTypes.CANDIDATE_HIRED, async (data) => {
    const { organizationId, candidateId, jobId, applicationId } = data;
    const Job = mongoose.model('Job');
    const Notification = mongoose.model('Notification');
    
    const job = await Job.findById(jobId);
    if (!job || !job.recruiters || job.recruiters.length === 0) return;
    
    const notifications = job.recruiters.map(recruiterId => ({
      organizationId,
      userId: recruiterId,
      type: 'candidate_hired',
      message: `A candidate has been hired for ${job.title}!`,
      relatedResource: candidateId,
      relatedModel: 'Candidate',
      read: false
    }));
    
    await Notification.insertMany(notifications);
  });

  // Notify interviewers when scheduled
  on(eventTypes.INTERVIEW_SCHEDULED, async (data) => {
    const { organizationId, interviewId, interviewers, jobId } = data;
    const Notification = mongoose.model('Notification');
    
    if (!interviewers || interviewers.length === 0) return;
    
    const notifications = interviewers.map(interviewerId => ({
      organizationId,
      userId: interviewerId,
      type: 'interview_scheduled',
      message: `An interview has been scheduled for you.`,
      relatedResource: interviewId,
      relatedModel: 'Interview',
      read: false
    }));
    
    await Notification.insertMany(notifications);
  });

  // Notify application's assigned recruiter when scorecard submitted
  on(eventTypes.SCORECARD_SUBMITTED, async (data) => {
    const { organizationId, applicationId, scorecardId, submitterId } = data;
    const Application = mongoose.model('Application');
    const Notification = mongoose.model('Notification');
    
    const application = await Application.findById(applicationId).populate('jobId');
    if (!application || !application.jobId) return;
    
    const recruiters = application.jobId.recruiters || [];
    
    const notifications = recruiters.filter(rId => rId.toString() !== submitterId.toString()).map(recruiterId => ({
      organizationId,
      userId: recruiterId,
      type: 'scorecard_submitted',
      message: `A new scorecard has been submitted for an application.`,
      relatedResource: scorecardId,
      relatedModel: 'Scorecard',
      read: false
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  });

  // Notify when application stage changes
  on(eventTypes.APPLICATION_STAGE_CHANGED, async (data) => {
    const { organizationId, applicationId, newStage, changedById } = data;
    const Application = mongoose.model('Application');
    const Notification = mongoose.model('Notification');
    
    const application = await Application.findById(applicationId).populate('jobId');
    if (!application || !application.jobId) return;
    
    const recruiters = application.jobId.recruiters || [];
    
    const notifications = recruiters.filter(rId => rId.toString() !== changedById.toString()).map(recruiterId => ({
      organizationId,
      userId: recruiterId,
      type: 'application_stage_changed',
      message: `An application was moved to stage ${newStage}.`,
      relatedResource: applicationId,
      relatedModel: 'Application',
      read: false
    }));
    
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  });

  // Notify inviter when invitee joins
  on(eventTypes.USER_JOINED, async (data) => {
    const { organizationId, userId, invitedById, name } = data;
    if (!invitedById) return;
    
    const Notification = mongoose.model('Notification');
    
    await Notification.create({
      organizationId,
      userId: invitedById,
      type: 'user_joined',
      message: `${name || 'A user'} has accepted your invitation and joined the team.`,
      relatedResource: userId,
      relatedModel: 'User',
      read: false
    });
  });

};

module.exports = { initNotificationListeners };
