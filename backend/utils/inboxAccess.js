/**
 * Shared team@ inbox is company staff only. Freelancers and other
 * non-employee roles cannot list or open those threads.
 */
const MAILBOX_ADMIN_ROLES = ['owner', 'admin', 'hr_manager'];
const INBOX_EMPLOYEE_ROLES = ['owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales'];

function canManageSharedMailbox(user) {
  return MAILBOX_ADMIN_ROLES.includes(String(user?.role || ''));
}

function isInboxEmployee(user) {
  const role = String(user?.role || '');
  if (role === 'freelancer') return false;
  return INBOX_EMPLOYEE_ROLES.includes(role);
}

function assignedMatch(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const id = user?._id || user?.id;
  const or = [];
  if (id) {
    or.push({ assignedTo: id });
    or.push({ createdBy: id });
  }
  if (email) or.push({ assignedEmail: email });
  if (!or.length) return { assignedTo: null };
  return { $or: or };
}

function threadAssignedToUser(thread, user) {
  if (!thread || !user) return false;
  const email = String(user.email || '').trim().toLowerCase();
  const uid = String(user._id || user.id || '');
  if (uid && thread.assignedTo && String(thread.assignedTo) === uid) return true;
  if (email && String(thread.assignedEmail || '').trim().toLowerCase() === email) return true;
  if (uid && thread.createdBy && String(thread.createdBy) === uid) return true;
  return false;
}

function canViewThread(thread, user) {
  if (canManageSharedMailbox(user)) return true;
  return threadAssignedToUser(thread, user);
}

function notSnoozedMatch(now = new Date()) {
  return {
    $or: [
      { snoozedUntil: null },
      { snoozedUntil: { $exists: false } },
      { snoozedUntil: { $lte: now } },
    ],
  };
}

function snoozedMatch(now = new Date()) {
  return { snoozedUntil: { $gt: now } };
}

function assigneeFilter(assigned) {
  if (!assigned) {
    return {
      $or: [
        { assignedTo: null },
        { assignedTo: { $exists: false } },
      ],
    };
  }
  const or = [];
  if (assigned._id || assigned.id) or.push({ assignedTo: assigned._id || assigned.id });
  const email = String(assigned.email || '').trim().toLowerCase();
  if (email) or.push({ assignedEmail: email });
  if (!or.length) {
    return {
      $or: [
        { assignedTo: null },
        { assignedTo: { $exists: false } },
      ],
    };
  }
  return { $or: or };
}

module.exports = {
  MAILBOX_ADMIN_ROLES,
  INBOX_EMPLOYEE_ROLES,
  canManageSharedMailbox,
  isInboxEmployee,
  assignedMatch,
  threadAssignedToUser,
  canViewThread,
  assigneeFilter,
  notSnoozedMatch,
  snoozedMatch,
};
