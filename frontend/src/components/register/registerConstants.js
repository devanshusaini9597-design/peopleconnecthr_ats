import { Users, ShieldCheck, Zap } from 'lucide-react';

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export const FEATURES = [
  {
    icon: Users,
    title: 'Multi-tenant ATS',
    description: 'Secure data isolation for your organization',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    description: 'Granular permissions for your entire team',
  },
  {
    icon: Zap,
    title: 'BYOK integrations',
    description: 'Bring your own keys for custom integrations',
  },
];

export const CHECKLIST = [
  'Create your workspace',
  'Invite your hiring team',
  'Publish your first job',
];

export const strengthLabels = ['Weak', 'Weak', 'Medium', 'Strong', 'Strong'];
export const strengthBarColors = [
  'bg-red-400',
  'bg-red-400',
  'bg-amber-400',
  'bg-emerald-500',
  'bg-teal-500',
];
export const strengthTextColors = [
  'text-red-500',
  'text-red-500',
  'text-amber-600',
  'text-emerald-600',
  'text-teal-700',
];

export const calculateStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};
