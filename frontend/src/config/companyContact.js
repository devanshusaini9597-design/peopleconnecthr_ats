/** Public People Connect HR inboxes and phone. Never store mailbox passwords in the app. */
export const INFO_EMAIL = 'info@peopleconnecthr.com';
export const SALES_EMAIL = 'sales@peopleconnecthr.com';
export const CONTACT_PHONE = '+917078658582';
export const CONTACT_PHONE_DISPLAY = '+91 70786 58582';

export const infoMailto = (subject = '', body = '') => {
  const q = new URLSearchParams();
  if (subject) q.set('subject', subject);
  if (body) q.set('body', body);
  const qs = q.toString();
  return `mailto:${INFO_EMAIL}${qs ? `?${qs}` : ''}`;
};

export const salesMailto = (subject = '', body = '') => {
  const q = new URLSearchParams();
  if (subject) q.set('subject', subject);
  if (body) q.set('body', body);
  const qs = q.toString();
  return `mailto:${SALES_EMAIL}${qs ? `?${qs}` : ''}`;
};
