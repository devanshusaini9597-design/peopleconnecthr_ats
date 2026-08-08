/** Matches backend serviceProviders + hostProviders in emailSettingsRoutes / emailService */
export const EMAIL_TOUR_KEY = 'skillnix_tour_email_settings_v1';

export const EMAIL_TOUR_STEPS = [
  {
    title: 'Email Settings',
    body: 'See how SkillNix sends email, connect Gmail/Outlook (or any provider), and send a test to confirm it works.',
  },
  {
    target: '[data-tour="email-status"]',
    title: 'Delivery status',
    body: 'Shows what is currently sending your ATS emails. Use Send test email to check delivery.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="email-smtp"]',
    title: 'Connect your mailbox',
    body: 'Pick Gmail, Outlook, Zoho, or another provider — enter email and password/app password. No coding.',
    placement: 'top',
  },
  {
    target: '[data-tour="email-how"]',
    title: 'How it works',
    body: 'Platform email is used when available; your connected mailbox is a fallback for outbound ATS mail.',
    placement: 'left',
  },
];

export const SMTP_PRESETS = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587, hint: 'Use an App Password from Google', group: 'popular' },
  { id: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, hint: 'Work or school email', group: 'popular' },
  { id: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 587, hint: 'Zoho mailbox', group: 'popular' },
  { id: 'yahoo', label: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 587, hint: 'App password required', group: 'popular' },
  { id: 'hostinger', label: 'Hostinger', host: 'smtp.hostinger.com', port: 587, hint: 'Domain email', group: 'hosting' },
  { id: 'godaddy', label: 'GoDaddy', host: 'smtpout.secureserver.net', port: 465, hint: 'Workspace email', group: 'hosting' },
  { id: 'namecheap', label: 'Namecheap', host: 'mail.privateemail.com', port: 587, hint: 'Private Email', group: 'hosting' },
  { id: 'custom', label: 'Other / Custom', host: '', port: 587, hint: 'Ask IT for host & port', group: 'custom' },
];

export const PROVIDER_GROUPS = [
  { key: 'popular', label: 'Popular' },
  { key: 'hosting', label: 'Domain hosting' },
  { key: 'custom', label: 'Other' },
];

export const emptySmtp = {
  smtpEmail: '',
  smtpAppPassword: '',
  smtpProvider: 'gmail',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  isConfigured: false,
  hasPassword: false,
};

export function presetById(id) {
  return SMTP_PRESETS.find((p) => p.id === id) || SMTP_PRESETS.find((p) => p.id === 'gmail');
}
