const {
  canManageSharedMailbox,
  isInboxEmployee,
  assignedMatch,
  canViewThread,
} = require('../utils/inboxAccess');

describe('inboxAccess', () => {
  const manager = { _id: '1', role: 'hr_manager', email: 'mgr@co.com' };
  const recruiter = { _id: '2', role: 'hr_recruiter', email: 'asmita@co.com' };
  const freelancer = { _id: '3', role: 'freelancer', email: 'f@co.com' };

  test('only owner admin manager can edit mailbox', () => {
    expect(canManageSharedMailbox({ role: 'owner' })).toBe(true);
    expect(canManageSharedMailbox({ role: 'admin' })).toBe(true);
    expect(canManageSharedMailbox(manager)).toBe(true);
    expect(canManageSharedMailbox(recruiter)).toBe(false);
    expect(canManageSharedMailbox(freelancer)).toBe(false);
  });

  test('inbox is company employees only', () => {
    expect(isInboxEmployee(recruiter)).toBe(true);
    expect(isInboxEmployee({ role: 'sales' })).toBe(true);
    expect(isInboxEmployee(freelancer)).toBe(false);
    expect(isInboxEmployee({ role: 'other' })).toBe(false);
    expect(isInboxEmployee({ role: 'interviewer' })).toBe(false);
  });

  test('recruiters only see assigned threads', () => {
    const mine = { assignedTo: '2', assignedEmail: 'asmita@co.com' };
    const other = { assignedTo: '9', assignedEmail: 'other@co.com' };
    expect(canViewThread(mine, recruiter)).toBe(true);
    expect(canViewThread(other, recruiter)).toBe(false);
    expect(canViewThread(other, manager)).toBe(true);
    expect(assignedMatch(recruiter).$or).toEqual([
      { assignedTo: '2' },
      { createdBy: '2' },
      { assignedEmail: 'asmita@co.com' },
    ]);
  });

  test('assigneeFilter keeps two employees on separate threads', () => {
    const { assigneeFilter } = require('../utils/inboxAccess');
    expect(assigneeFilter({ _id: '1', email: 'a@co.com' })).toEqual({
      $or: [{ assignedTo: '1' }, { assignedEmail: 'a@co.com' }],
    });
    expect(assigneeFilter(null).$or).toEqual([
      { assignedTo: null },
      { assignedTo: { $exists: false } },
    ]);
  });

  test('snoozed threads are excluded until the wake time', () => {
    const { notSnoozedMatch, snoozedMatch } = require('../utils/inboxAccess');
    const now = new Date('2026-09-27T10:00:00.000Z');
    expect(snoozedMatch(now)).toEqual({ snoozedUntil: { $gt: now } });
    expect(notSnoozedMatch(now).$or).toContainEqual({ snoozedUntil: { $lte: now } });
  });
});
