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

/** All-desk tab: owner and admin only. */
export function canSeeMisAllDesk(user) {
  return Boolean(user && (user.role === 'owner' || user.role === 'admin'));
}

/** Default desk: owner → All; everyone else (incl. admin) → My records. */
export function defaultMisDesk(user) {
  return user?.role === 'owner' ? 'all' : 'mine';
}

export function normalizeMisDesk(desk, user) {
  const view = String(desk || '').toLowerCase().trim();
  if (view === 'mine' || view === 'company') return view;
  if (view === 'all') return canSeeMisAllDesk(user) ? 'all' : 'mine';
  return defaultMisDesk(user);
}

export function misPageSubtitle(user, total, formattedTotal) {
  const n = Number(total) || 0;
  const noun = n === 1 ? 'contact' : 'contacts';
  const label = formattedTotal ?? String(n);
  const role = user?.role;
  if (role === 'owner') {
    return `${label} ${noun} across the organisation`;
  }
  if (role === 'admin') {
    return `${label} ${noun} in your authorised desks`;
  }
  return `${label} ${noun} in your directory`;
}

export function misTipCaption(user) {
  const role = user?.role;
  if (role === 'owner') {
    return 'Switch desks to review the directory. Select contacts to email, export, or move to Candidates.';
  }
  if (role === 'admin') {
    return 'Switch desks to work across the shared directory and your own records. Select contacts for outreach or to move to Candidates.';
  }
  if (role === 'sales') {
    return 'My records is your working desk. Organisation shows the shared directory. Select contacts to outreach or move to Candidates.';
  }
  return 'My records is your default desk. Use Organisation for the shared directory. Select contacts to outreach or move to Candidates.';
}

export function misDeskHint(deskView) {
  if (deskView === 'mine') return 'Contacts you created';
  if (deskView === 'company') return 'Shared organisation directory';
  return 'Organisation directory and your records';
}
