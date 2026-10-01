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

/** All-desk tab: owner + admin only (not other employees or freelancers). */
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
    return `${label} ${noun} in your visible desks`;
  }
  return `${label} ${noun} in your desk`;
}

export function misTipCaption(user) {
  const role = user?.role;
  if (role === 'owner') {
    return 'Switch desks to review organisation-wide or personal records. Select contacts to email, export, or move to Candidates.';
  }
  if (role === 'admin') {
    return 'All combines the shared directory with your own records. Other employees’ personal desks remain private.';
  }
  if (role === 'sales') {
    return 'My records is your working desk. Organisation shows the shared company directory for outreach.';
  }
  return 'My records is your default desk. Organisation shows the shared directory — not other employees’ personal records.';
}

export function misDeskHint(deskView) {
  if (deskView === 'mine') return 'Contacts you created';
  if (deskView === 'company') return 'Shared organisation directory';
  return 'Organisation directory and your records';
}
