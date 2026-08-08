export const ROLES_TOUR_KEY = 'skillnix_tour_custom_roles_v1';

export const ROLES_TOUR_STEPS = [
  {
    title: 'Custom Roles',
    body: 'Build permission packs like enterprise ATS software — pick which sidebar areas a role can open, then which actions they can take.',
  },
  {
    target: '[data-tour="roles-tip"]',
    title: 'How it works',
    body: 'Modules control sidebar visibility. Actions control create / edit / delete inside those areas. Assign the role to a teammate from Organization → Team.',
    placement: 'bottom',
  },
];

export const emptyForm = { name: '', description: '', permissions: [] };
