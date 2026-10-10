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

/**
 * All / Total desk: every MIS role.
 * Owner → full org. Others (incl. admin) → shared directory + their own personal rows.
 */
export function canSeeMisAllDesk(user) {
  return Boolean(user && canAccessMis(user));
}

/**
 * Personal “My records” desk/card.
 * Owner, admin, and HR manager use the organisation directory — no personal desk.
 */
export function canSeeMisMyRecords(user) {
  return Boolean(user && canAccessMis(user) && !canViewMisOrgReports(user));
}

/** Show the desk tab switcher (All / My records / Organisation). */
export function canSeeMisDeskTabs(user) {
  return Boolean(user && canAccessMis(user));
}

/** Organisation-wide MIS reports + employee drill-down: owner, admin, and HR manager. */
export function canViewMisOrgReports(user) {
  return Boolean(user && (user.role === 'owner' || user.role === 'admin' || user.role === 'hr_manager'));
}

/** Default desk: owner, admin, and HR manager → All; everyone else → My records. */
export function defaultMisDesk(user) {
  return canViewMisOrgReports(user) ? 'all' : 'mine';
}

export function normalizeMisDesk(desk, user) {
  const view = String(desk || '').toLowerCase().trim();
  if (view === 'mine') {
    return canSeeMisMyRecords(user) ? 'mine' : defaultMisDesk(user);
  }
  if (view === 'company') return view;
  if (view === 'employees') {
    return canViewMisOrgReports(user) ? 'employees' : defaultMisDesk(user);
  }
  if (view === 'all') {
    return canSeeMisAllDesk(user) ? 'all' : 'mine';
  }
  return defaultMisDesk(user);
}

export function misPageSubtitle(user, total, formattedTotal, deskView) {
  const n = Number(total) || 0;
  const noun = n === 1 ? 'contact' : 'contacts';
  const label = formattedTotal ?? String(n);
  if (canViewMisOrgReports(user)) {
    if (deskView === 'company') return `${label} ${noun} in Organisation`;
    if (deskView === 'employees') return `${label} ${noun} added by employees`;
    return `${label} ${noun} across the organisation`;
  }
  if (deskView === 'mine') {
    return `${label} ${noun} in My records`;
  }
  if (deskView === 'company') {
    return `${label} ${noun} in Organisation`;
  }
  return `${label} ${noun} in your directory`;
}

export function misTipCaption(user) {
  const role = user?.role;
  if (canViewMisOrgReports(user)) {
    return 'Total shows every contact in the organisation, including employee records.';
  }
  if (role === 'sales') {
    return 'My records is your working desk. Organisation shows the shared directory.';
  }
  return 'My records is your default desk. Use Organisation for the shared directory.';
}

export function misDeskHint(deskView, user) {
  if (deskView === 'mine') return 'Only contacts you added';
  if (deskView === 'company') return 'Shared organisation directory';
  if (deskView === 'employees') return 'Contacts added by employees';
  if (canViewMisOrgReports(user)) return 'Full organisation directory';
  return 'Organisation directory and your records';
}

/** Owner, admin, and HR manager may mutate any MIS contact in the organisation. */
export function canEditAnyMisContact(user) {
  return Boolean(user && (user.role === 'owner' || user.role === 'admin' || user.role === 'hr_manager'));
}

/** Employees may mutate only contacts they created (not Organisation desk rows). */
export function canEditMisContact(user, row) {
  if (!user || !row) return false;
  if (canEditAnyMisContact(user)) return true;
  if (!canAccessMis(user)) return false;
  const me = String(user.id || user._id || '');
  const ownerId = String(row.createdBy?._id || row.createdBy || '');
  return Boolean(me && ownerId && me === ownerId);
}
