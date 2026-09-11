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
  'Share your work details',
  'Our team contacts you',
  'Sign in after approval',
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

export const REGISTER_FIELD_IDS = {
  name: 'register-name',
  email: 'register-email',
  otp: 'register-otp',
  phone: 'register-phone',
  companyName: 'register-company',
  password: 'register-password',
  confirmPassword: 'register-confirm',
};

export const REGISTER_FIELD_ORDER = [
  'name',
  'email',
  'otp',
  'phone',
  'companyName',
  'password',
  'confirmPassword',
];

export function firstRegisterError(errors) {
  return REGISTER_FIELD_ORDER.find((key) => errors[key]);
}

export function focusRegisterField(field) {
  const id = REGISTER_FIELD_IDS[field];
  if (!id || typeof document === 'undefined') return;
  const focus = () => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
  };
  if (focus()) return;
  window.requestAnimationFrame(() => {
    if (focus()) return;
    window.setTimeout(focus, 60);
  });
}

function countDigits(value) {
  return String(value || '').replace(/\D/g, '').length;
}

export function validateSignupForm({ formData, emailVerified, otpSent, otpCode }) {
  const errors = {};
  const name = String(formData.name || '').trim();
  const email = String(formData.email || '').trim();
  const phone = String(formData.phone || '').trim();
  const companyName = String(formData.companyName || '').trim();
  const password = String(formData.password || '');
  const confirmPassword = String(formData.confirmPassword || '');

  if (!name) errors.name = 'Full name is required';
  else if (name.length < 2) errors.name = 'Enter your full name';
  else if (!/[a-zA-Z]/.test(name)) errors.name = 'Enter a valid name';

  if (!email) {
    errors.email = 'Work email is required';
  } else {
    const work = validateWorkEmail(email);
    if (!work.valid) {
      errors.email = work.reason;
    } else if (!emailVerified) {
      if (!otpSent) {
        errors.email = 'Send the code and verify this work email.';
      } else if (!/^\d{6}$/.test(String(otpCode || '').trim())) {
        errors.otp = 'Enter the 6-digit code from your work email.';
      }
    }
  }

  if (phone && countDigits(phone) < 7) {
    errors.phone = 'Enter a valid phone number, or leave this blank.';
  }

  if (!companyName) errors.companyName = 'Company name is required';
  else if (companyName.length < 2) errors.companyName = 'Enter your company name';

  if (!password) errors.password = 'Password is required';
  else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use at least one letter and one number.';
  }

  if (!confirmPassword) errors.confirmPassword = 'Confirm your password';
  else if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';

  return errors;
}

/** Personal / free providers blocked for enterprise work-email signup */
export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'google.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'hotmail.fr',
  'live.com', 'live.in', 'msn.com',
  'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  'icloud.com', 'me.com', 'mac.com',
  'proton.me', 'protonmail.com', 'pm.me', 'tutanota.com',
  'aol.com', 'zoho.com', 'zohomail.com',
  'mail.com', 'email.com', 'gmx.com', 'gmx.net',
  'fastmail.com', 'yandex.com', 'yandex.ru',
  'mail.ru', 'rediffmail.com', 'rediff.com', 'inbox.com',
  'mailinator.com', 'guerrillamail.com', '10minutemail.com',
  'tempmail.com', 'yopmail.com', 'trashmail.com', 'temp-mail.org',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateWorkEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized) {
    return { valid: false, reason: 'Work email is required' };
  }
  if (!EMAIL_RE.test(normalized)) {
    return { valid: false, reason: 'Invalid email format' };
  }
  const domain = normalized.split('@')[1] || '';
  if (!domain.includes('.') || domain.split('.').some((p) => !p)) {
    return { valid: false, reason: 'Invalid email domain' };
  }
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Please use your work email. Personal providers (Gmail, Yahoo, Outlook, etc.) are not allowed.',
    };
  }
  return { valid: true };
}
