export const PIPELINE_STAGES = ['Sourced', 'Screening', 'Interview', 'Offer', 'Hired'];

// Illustrative rows for the sign-in panel's "live pipeline" signature visual.
// Sample data only — not real candidates.
export const PIPELINE_SEED = [
  { name: 'A. Sharma', role: 'Frontend Engineer', stage: 2 },
  { name: 'R. Iyer', role: 'Product Designer', stage: 1 },
  { name: 'M. Chen', role: 'Data Analyst', stage: 3 },
  { name: 'T. Osei', role: 'Sales Lead', stage: 4 },
];

export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
