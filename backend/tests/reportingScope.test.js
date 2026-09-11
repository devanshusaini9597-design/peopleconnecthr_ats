const mongoose = require('mongoose');
const {
  canAssignReportsTo,
  extractMentionIds,
  notificationChannelFilter,
  asId,
} = require('../utils/reportingScope');

describe('reportingScope', () => {
  test('only owner/admin/hr_manager can assign reportsTo', () => {
    expect(canAssignReportsTo({ role: 'owner' })).toBe(true);
    expect(canAssignReportsTo({ role: 'admin' })).toBe(true);
    expect(canAssignReportsTo({ role: 'hr_manager' })).toBe(true);
    expect(canAssignReportsTo({ role: 'hr_recruiter' })).toBe(false);
    expect(canAssignReportsTo({ role: 'sales' })).toBe(false);
    expect(canAssignReportsTo({ role: 'freelancer' })).toBe(false);
    expect(canAssignReportsTo(null)).toBe(false);
  });

  test('extractMentionIds stays inside the org teammate list', () => {
    const orgId = new mongoose.Types.ObjectId();
    const otherOrgId = new mongoose.Types.ObjectId();
    const intern = { id: String(orgId), name: 'Priya Intern', email: 'priya@acme.com' };
    const recruiter = { id: String(new mongoose.Types.ObjectId()), name: 'Ravi Recruiter', email: 'ravi@acme.com' };
    const outsider = { id: String(otherOrgId), name: 'Other Co', email: 'x@other.com' };
    const teammates = [intern, recruiter];

    const ids = extractMentionIds('hey @Priya and <@' + outsider.id + '>', teammates);
    expect(ids).toContain(intern.id);
    expect(ids).not.toContain(outsider.id);
  });

  test('extractMentionIds matches <@userId> only when that user is a teammate', () => {
    const allowed = String(new mongoose.Types.ObjectId());
    const blocked = String(new mongoose.Types.ObjectId());
    const teammates = [{ id: allowed, name: 'Ada', email: 'ada@acme.com' }];
    const ids = extractMentionIds(`ping <@${allowed}> and <@${blocked}>`, teammates);
    expect(ids).toEqual([allowed]);
  });

  test('notification channels never mix mention/team/company with personal', () => {
    expect(notificationChannelFilter('mention')).toEqual({ type: 'mention' });
    expect(notificationChannelFilter('team')).toEqual({ type: 'team_activity' });
    expect(notificationChannelFilter('company')).toEqual({ type: 'announcement' });
    expect(notificationChannelFilter('me').type.$nin).toEqual(
      expect.arrayContaining(['mention', 'team_activity', 'announcement', 'system'])
    );
    expect(notificationChannelFilter('all')).toEqual({});
  });

  test('tag handles stay alphanumeric and extract only tagged org members', () => {
    const { tagHandleFromName, extractTagMemberIds } = require('../utils/reportingScope');
    expect(tagHandleFromName('Campus Interns')).toBe('campus-interns');
    const intern = String(new mongoose.Types.ObjectId());
    const outsider = String(new mongoose.Types.ObjectId());
    const tags = [{ handle: 'interns', memberIds: [intern] }];
    const ids = extractTagMemberIds('please review @interns also <@' + outsider + '>', tags);
    expect(ids).toContain(intern);
    expect(ids).not.toContain(outsider);
  });

  test('asId rejects non-objectids', () => {
    expect(asId('not-an-id')).toBe('');
    expect(asId(null)).toBe('');
    const id = String(new mongoose.Types.ObjectId());
    expect(asId(id)).toBe(id);
  });
});
