/**
 * Client-side validation helpers for forms.
 * Returns error message string or null if valid.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function required(value: string | undefined | null, fieldName?: string): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return fieldName ? `${fieldName} is required` : 'This field is required';
  return null;
}

export function email(value: string | undefined | null): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return 'Email is required';
  if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address';
  return null;
}

export function minLength(value: string | undefined | null, min: number, fieldName?: string): string | null {
  const v = typeof value === 'string' ? value : '';
  if (v.length < min) return fieldName ? `${fieldName} must be at least ${min} characters` : `Must be at least ${min} characters`;
  return null;
}

export function maxLength(value: string | undefined | null, max: number, fieldName?: string): string | null {
  const v = typeof value === 'string' ? value : '';
  if (v.length > max) return fieldName ? `${fieldName} must be at most ${max} characters` : `Must be at most ${max} characters`;
  return null;
}
