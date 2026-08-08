/**
 * Event Types for SkillNix SaaS
 */
module.exports = {
  // Candidate events
  CANDIDATE_CREATED: 'candidate.created',
  CANDIDATE_UPDATED: 'candidate.updated',
  CANDIDATE_DELETED: 'candidate.deleted',
  
  // Application/Pipeline events
  APPLICATION_CREATED: 'application.created',
  APPLICATION_STAGE_CHANGED: 'application.stage_changed',
  APPLICATION_REJECTED: 'application.rejected',
  CANDIDATE_HIRED: 'candidate.hired',
  
  // Job events
  JOB_CREATED: 'job.created',
  JOB_PUBLISHED: 'job.published',
  JOB_CLOSED: 'job.closed',
  
  // Interview events
  INTERVIEW_SCHEDULED: 'interview.scheduled',
  INTERVIEW_COMPLETED: 'interview.completed',
  INTERVIEW_CANCELLED: 'interview.cancelled',
  SCORECARD_SUBMITTED: 'scorecard.submitted',
  
  // Team events
  USER_INVITED: 'user.invited',
  USER_JOINED: 'user.joined',
  USER_ROLE_CHANGED: 'user.role_changed',
  USER_REMOVED: 'user.removed',
  
  // Integration events
  INTEGRATION_CONFIGURED: 'integration.configured',
  INTEGRATION_KEY_CHANGED: 'integration.key_changed',
  EMAIL_SENT: 'email.sent',
  EMAIL_FAILED: 'email.failed',
  
  // Organization events
  ORG_CREATED: 'organization.created',
  ORG_PLAN_CHANGED: 'organization.plan_changed',
  ORG_PLAN_LIMIT_REACHED: 'organization.plan_limit_reached',
};
