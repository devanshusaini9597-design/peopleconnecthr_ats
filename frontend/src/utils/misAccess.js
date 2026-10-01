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
  // Missing desk param → role default (owner: all, employees/admin: mine)
  return defaultMisDesk(user);
}

export function misPageSubtitle(user, total, formattedTotal) {
  const n = Number(total) || 0;
  const noun = n === 1 ? 'contact' : 'contacts';
  const label = formattedTotal ?? String(n);
  const role = user?.role;
  if (role === 'owner') {
    return `${label} ${noun} in the organisation directory`;
  }
  if (role === 'admin') {
    return `${label} ${noun} · organisation directory and your records`;
  }
  return `${label} ${noun} · your records and organisation directory`;
}

export function misTipCaption(user) {
  const role = user?.role;
  if (role === 'owner') {
    return 'Use All, My records, or Organisation to switch views. Select contacts to email, export, or move to Candidates.';
  }
  if (role === 'admin') {
    return 'All shows the organisation directory plus your records. Other employees’ private desks stay private.';
  }
  if (role === 'sales') {
    return 'Start on My records. Use Organisation for the shared directory. Select rows to email or message.';
  }
  return 'My records is your default desk. Organisation shows the shared directory — not other employees’ private desks.';
}
