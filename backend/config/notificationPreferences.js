/**
 * Default per-user notification preferences (enterprise-style channel matrix).
 */

const NOTIFICATION_CATEGORIES = [
  'callbacks',
  'jobs',
  'announcements',
  'mentions',
  'interviews',
  'teamActivity',
  'shares',
];

const TYPE_TO_CATEGORY = {
  callback_reminder: 'callbacks',
  callback_today: 'callbacks',
  callback_overdue: 'callbacks',
  job_opening: 'jobs',
  announcement: 'announcements',
  mention: 'mentions',
  interview_reminder: 'interviews',
  team_activity: 'teamActivity',
  candidate_hired: 'teamActivity',
  candidate_update: 'teamActivity',
  freelancer_submission: 'teamActivity',
  share_request: 'shares',
  share_accepted: 'shares',
  share_declined: 'shares',
  invitation: 'shares',
  invitation_accepted: 'shares',
  invitation_declined: 'shares',
  report_shared: 'shares',
  system: 'teamActivity',
};

function defaultChannelMatrix() {
  return {
    callbacks: { inApp: true, email: true, push: true },
    jobs: { inApp: true, email: false, push: true },
    announcements: { inApp: true, email: false, push: true },
    mentions: { inApp: true, email: false, push: true },
    interviews: { inApp: true, email: true, push: true },
    teamActivity: { inApp: true, email: true, push: false },
    shares: { inApp: true, email: false, push: true },
  };
}

function defaultNotificationPreferences() {
  return {
    channels: defaultChannelMatrix(),
    callbacks: {
      /** Notify when you are SPOC on the candidate (not just creator). */
      includeAsSpoc: true,
      /** Notify managers when a direct report has a callback. */
      includeAsManager: true,
      /** Morning digest only — skip ramp-up in-app slots (still shows in widget from digest row). */
      digestOnly: false,
    },
    quietHours: {
      enabled: false,
      start: '20:00',
      end: '08:00',
      timezone: 'Asia/Kolkata',
    },
  };
}

module.exports = {
  NOTIFICATION_CATEGORIES,
  TYPE_TO_CATEGORY,
  defaultChannelMatrix,
  defaultNotificationPreferences,
};
