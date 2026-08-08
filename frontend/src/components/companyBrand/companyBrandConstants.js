export const BRAND_TOUR_KEY = 'skillnix_tour_company_brand_v1';

export const BRAND_TOUR_STEPS = [
  {
    title: 'Company Brand',
    body: 'Shape how your careers page looks — color, tagline, benefits, team, SEO, and social links.',
  },
  {
    target: '[data-tour="brand-identity"]',
    title: 'Brand identity',
    body: 'Set brand color, tagline, and careers page title/description shown to candidates.',
    placement: 'right',
  },
  {
    target: '[data-tour="brand-content"]',
    title: 'Benefits & team',
    body: 'Add perks and team members that tell your employer story on the careers site.',
    placement: 'right',
  },
  {
    target: '[data-tour="brand-preview"]',
    title: 'Live preview',
    body: 'See a quick mock of how branding reads for candidates before you save.',
    placement: 'left',
  },
  {
    target: '[data-tour="brand-save"]',
    title: 'Save brand pack',
    body: 'Publish changes so careers and SEO pick up the new brand pack.',
    placement: 'bottom',
  },
];

export const SOCIAL_KEYS = [
  { key: 'website', label: 'Website' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'github', label: 'GitHub' },
];

export const emptyBrand = () => ({
  tagline: '',
  benefits: [],
  teamMembers: [],
  socialLinks: {},
  seoTitle: '',
  seoDescription: '',
  customCss: ''
});
