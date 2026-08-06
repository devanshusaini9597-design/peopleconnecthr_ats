export const validateAndFixEmail = (email) => {
  if (!email) return { isValid: false, value: '' };
  let fixed = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(fixed);
  return { isValid, value: fixed };
};

export const validateAndFixMobile = (mobile, country) => {
  if (!mobile) return { isValid: false, value: '' };
  let digitsOnly = String(mobile).replace(/\D/g, '');

  if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(-10);
  }
  if (digitsOnly.startsWith('1') && digitsOnly.length > 10) {
    digitsOnly = digitsOnly.slice(-10);
  }
  if (digitsOnly.length > 11) {
    digitsOnly = digitsOnly.slice(-10);
  }

  let isValid = false;
  const len = digitsOnly.length;

  if (country === '+91') {
    isValid = len === 10;
  } else if (country === '+1') {
    isValid = len === 10;
  } else if (country === '+44') {
    isValid = len >= 10 && len <= 11;
  } else if (country === '+61') {
    isValid = len >= 9 && len <= 10;
  } else if (country === '+7') {
    isValid = len === 10;
  } else {
    isValid = len >= 9;
  }

  return { isValid, value: digitsOnly };
};

export const validateAndFixName = (name) => {
  if (!name) return { isValid: false, value: '' };
  let fixed = String(name).replace(/[0-9!@#$%^&*()_+=\[\]{};:'",.<>?/\\|`~-]/g, '').trim();
  fixed = fixed.split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  const isValid = fixed.length >= 2 && /^[a-zA-Z\s]+$/.test(fixed);
  return { isValid, value: fixed };
};

export const stripCountryCode = (phone) => {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) digits = digits.slice(-10);
  else if (digits.startsWith('1') && digits.length > 10) digits = digits.slice(-10);
  else if (digits.length > 11) digits = digits.slice(-10);
  return digits;
};

export const VALID_EMAIL_DOMAINS = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.in', 'rediffmail.com',
  'icloud.com', 'protonmail.com', 'zoho.com', 'aol.com', 'live.com', 'msn.com', 'ymail.com',
  'mail.com', 'proton.me', 'tutanota.com', 'fastmail.com', 'hey.com', 'pm.me',
];

export const VALID_TLDS = [
  'com', 'in', 'org', 'net', 'co', 'io', 'edu', 'gov', 'info', 'biz', 'us', 'uk', 'ca',
  'au', 'de', 'fr', 'jp', 'cn', 'tech', 'ai', 'dev',
];

export function validateCandidateForm(trimmed, countryCode) {
  const errors = {};

  if (!trimmed.name) {
    errors.name = 'Name is required';
  } else if (trimmed.name.length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else if (!/^[a-zA-Z\s.'\-]+$/.test(trimmed.name)) {
    errors.name = 'Name can only contain letters, spaces, and hyphens';
  }

  if (!trimmed.email) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed.email)) {
    errors.email = 'Please enter a valid email address';
  } else {
    const domain = trimmed.email.split('@')[1]?.toLowerCase();
    if (!VALID_EMAIL_DOMAINS.includes(domain)) {
      const domainParts = domain.split('.');
      const tld = domainParts[domainParts.length - 1];
      const domainName = domainParts[0];
      if (domainParts.length < 2 || domainName.length < 3 || !VALID_TLDS.includes(tld)) {
        errors.email = 'Please enter a valid email domain (e.g. gmail.com, outlook.com, company.com)';
      }
    }
  }

  if (!trimmed.contact) {
    errors.contact = 'Contact number is required';
  } else {
    const digits = trimmed.contact.replace(/\D/g, '');
    if (countryCode === '+91' && digits.length !== 10) {
      errors.contact = 'Enter a valid 10-digit mobile number';
    } else if (countryCode === '+1' && digits.length !== 10) {
      errors.contact = 'Enter a valid 10-digit phone number';
    } else if (digits.length < 7 || digits.length > 15) {
      errors.contact = 'Enter a valid phone number';
    }
  }

  if (!trimmed.companyName) errors.companyName = 'Company is required';
  if (!trimmed.ctc) errors.ctc = 'Current CTC is required';

  return errors;
}
