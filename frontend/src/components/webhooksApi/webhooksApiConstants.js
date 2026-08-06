export const WH_TOUR_KEY = 'skillnix_tour_webhooks_api_v1';

export const WH_TOUR_STEPS = [
  {
    title: 'Webhooks & API',
    body: 'This page is for connecting SkillNix to other tools (Zapier, HRIS, custom systems). Recruiters usually do not need it day to day — IT or an integration partner does.',
  },
  {
    target: '[data-tour="wh-endpoints"]',
    title: 'Webhook endpoints',
    body: 'Tell SkillNix where to send updates (new application, hire, etc.). Your IT team provides the destination address.',
    placement: 'top',
  },
  {
    target: '[data-tour="wh-keys"]',
    title: 'API keys',
    body: 'Like a password for other software to talk to SkillNix. Create a key, copy it once, and hand it to your IT / Zapier setup.',
    placement: 'top',
  },
  {
    target: '[data-tour="wh-auth"]',
    title: 'For developers',
    body: 'Technical auth details live here for whoever builds the connection. You do not need to write code to manage keys on this page.',
    placement: 'top',
  },
];
