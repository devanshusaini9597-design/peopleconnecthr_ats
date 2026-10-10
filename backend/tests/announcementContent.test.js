const {
  rolesForAudience,
  validateAnnouncementContent,
  sanitizeAnnouncementHtml,
  userMatchesTargets,
  cleanLabels,
} = require('../utils/announcementContent');

describe('announcement content rules', () => {
  test('hiring team and recruiters exclude interviewer, readonly, and other', () => {
    expect(rolesForAudience('all')).toEqual([
      'owner', 'admin', 'hr_manager', 'hr_recruiter', 'recruiter', 'sales',
    ]);
    expect(rolesForAudience('recruiters')).toEqual(rolesForAudience('all'));
    expect(rolesForAudience('admins')).toEqual(['owner', 'admin', 'hr_manager']);
    expect(rolesForAudience('freelancers')).toEqual(['freelancer']);
    expect(rolesForAudience('public')).toEqual([]);
  });

  test('strips scripts and enforces length', () => {
    const cleaned = sanitizeAnnouncementHtml('<p onclick="x">Hi</p><script>alert(1)</script>');
    expect(cleaned).not.toMatch(/script/i);
    expect(cleaned).not.toMatch(/onclick/);
    expect(validateAnnouncementContent({ title: '', body: '<p></p>' }).error).toMatch(/required/i);
    expect(validateAnnouncementContent({ title: 'A'.repeat(141), body: 'Hello' }).error).toMatch(/140/);
    const ok = validateAnnouncementContent({ title: 'Office closed', body: '<p>Friday</p>' });
    expect(ok.title).toBe('Office closed');
    expect(ok.plain).toBe('Friday');
  });

  test('targeting requires every selected dimension', () => {
    const person = {
      id: 'aaa',
      reportsTo: 'mgr',
      department: 'Engineering',
      location: 'Bengaluru',
      office: 'HQ',
    };
    expect(userMatchesTargets(person, {})).toBe(true);
    expect(userMatchesTargets(person, { departments: ['engineering'] })).toBe(true);
    expect(userMatchesTargets(person, { departments: ['Sales'] })).toBe(false);
    expect(userMatchesTargets(person, { departments: ['Engineering'], offices: ['Remote'] })).toBe(false);
    expect(userMatchesTargets(person, { teamManagerIds: ['mgr'] })).toBe(true);
    expect(userMatchesTargets(person, { teamManagerIds: ['other'] })).toBe(false);
    expect(userMatchesTargets({ ...person, id: 'mgr' }, { teamManagerIds: ['mgr'] })).toBe(true);
    expect(cleanLabels(['  HQ ', 'hq', 'Plant'])).toEqual(['HQ', 'Plant']);
  });
});
