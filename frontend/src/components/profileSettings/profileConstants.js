import API_URL from '../../config';

export const BASE = API_URL;
export const PROFILE_TOUR_KEY = 'skillnix_tour_profile_v1';
export const PROFILE_TOUR_STEPS = [
  {
    title: 'Your profile',
    body: 'Manage identity, password, and account preferences from one place.',
  },
  {
    target: '[data-tour="profile-tip"]',
    title: 'Tips',
    body: 'Use the tabs to switch between Profile, Security, and Account.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="profile-tabs"]',
    title: 'Sections',
    body: 'Profile covers name and phone. Security is password. Account has shortcuts and sign out.',
    placement: 'bottom',
  },
];
