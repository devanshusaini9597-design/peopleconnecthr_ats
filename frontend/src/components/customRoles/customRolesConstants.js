export const ROLES_TOUR_KEY = 'skillnix_tour_custom_roles_v1';

export const ROLES_TOUR_STEPS = [
  {
    title: 'Custom Roles',
    body: 'Build permission packs like enterprise ATS software — pick which sidebar areas a role can open, then which actions they can take.',
  },
  {
    target: '[data-tour="roles-tip"]',
    title: 'How it works',
    body: 'Turn on a module to open the page. Turn on actions for the buttons inside it. Example: MIS on, Export off. Saving a system role updates everyone on that role. Assign a custom pack from Team.',
    placement: 'bottom',
  },
];

export const emptyForm = { name: '', description: '', permissions: [] };
