/** Company staff who may use MIS. Freelancers, interviewers, and read-only users cannot. */
export const MIS_COMPANY_ROLES = [
  'owner',
  'admin',
  'hr_manager',
  'hr_recruiter',
  'recruiter',
  'sales',
];

export function canAccessMis(user) {
  return Boolean(user && MIS_COMPANY_ROLES.includes(user.role));
}

export function misPageSubtitle(user, total, formattedTotal) {
  const n = Number(total) || 0;
  const noun = n === 1 ? 'contact' : 'contacts';
  const label = formattedTotal ?? String(n);
  const role = user?.role;
  if (role === 'owner') {
    return `${label} ${noun} across the organisation`;
  }
  if (role === 'admin' || role === 'hr_manager') {
    return `${label} organisation ${noun}`;
  }
  if (role === 'sales') {
    return `${label} ${noun} · organisation directory and records you added`;
  }
  return `${label} ${noun} · shared directory and records you added`;
}

export function misTipCaption(user) {
  const role = user?.role;
  if (role === 'owner') {
    return 'Select contacts to email, export, or move into Candidates. Import a spreadsheet with Name and Email.';
  }
  if (role === 'admin' || role === 'hr_manager') {
    return 'Select contacts to email, message, or update. Import a spreadsheet with Name and Email.';
  }
  if (role === 'sales') {
    return 'Use the organisation directory and records you added for outreach. Select rows to email or message.';
  }
  return 'Search the shared directory and records you added. Select rows to email or message.';
}
