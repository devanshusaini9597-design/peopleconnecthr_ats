export const NOTIF_PREFS_TOUR_KEY = 'skillnix_tour_notification_settings_v1';

export const NOTIF_PREFS_TOUR_STEPS = [
  {
    title: 'Notification preferences',
    body: 'Control which alerts you receive in-app, by email, and on your browser — like enterprise ATS software.',
  },
  {
    target: '[data-tour="notif-matrix"]',
    title: 'Channel matrix',
    body: 'Toggle each category independently. Changes apply to your account only.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notif-quiet"]',
    title: 'Quiet hours',
    body: 'Pause non-urgent in-app and push alerts during off hours. Urgent callbacks still break through.',
    placement: 'left',
  },
];

export const CATEGORY_ROWS = [
  {
    key: 'callbacks',
    label: 'Callback reminders',
    description: 'Follow-ups on candidates with a call-back date',
    icon: 'Phone',
  },
  {
    key: 'jobs',
    label: 'Job openings',
    description: 'When new roles go live in your organization',
    icon: 'Briefcase',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Org-wide updates from admins',
    icon: 'Megaphone',
  },
  {
    key: 'mentions',
    label: '@Mentions',
    description: 'When someone tags you on a candidate',
    icon: 'AtSign',
  },
  {
    key: 'interviews',
    label: 'Interviews',
    description: 'Upcoming interview reminders',
    icon: 'Calendar',
  },
  {
    key: 'teamActivity',
    label: 'Team activity',
    description: 'Pipeline updates and manager copies',
    icon: 'Users',
  },
  {
    key: 'shares',
    label: 'Shares & invites',
    description: 'Candidate shares and team invitations',
    icon: 'Share2',
  },
];

/** Freelancer desk — only categories that apply to their workflow */
export const FREELANCER_CATEGORY_ROWS = [
  {
    key: 'callbacks',
    label: 'Callback reminders',
    description: 'Follow-ups on candidates you added with a call-back date',
    icon: 'Phone',
  },
  {
    key: 'jobs',
    label: 'Open mandates',
    description: 'When new mandates / openings are posted for freelancers',
    icon: 'Briefcase',
  },
  {
    key: 'announcements',
    label: 'Announcements',
    description: 'Notices published for freelancers (in-app only)',
    icon: 'Megaphone',
  },
  {
    key: 'teamActivity',
    label: 'Submission updates',
    description: 'When a hiring manager reviews or moves your submissions',
    icon: 'Users',
  },
];

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf (GST)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'America/Los_Angeles', label: 'US Pacific' },
  { value: 'UTC', label: 'UTC' },
];

export const defaultPreferences = () => ({
  channels: {
    callbacks: { inApp: true, email: true, push: true },
    jobs: { inApp: true, email: false, push: true },
    announcements: { inApp: true, email: false, push: true },
    mentions: { inApp: true, email: false, push: true },
    interviews: { inApp: true, email: true, push: true },
    teamActivity: { inApp: true, email: true, push: false },
    shares: { inApp: true, email: false, push: true },
  },
  callbacks: {
    includeAsSpoc: true,
    includeAsManager: true,
    digestOnly: false,
  },
  quietHours: {
    enabled: false,
    start: '20:00',
    end: '08:00',
    timezone: 'Asia/Kolkata',
  },
});
