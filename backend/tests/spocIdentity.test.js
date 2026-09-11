const {
  resolveEmployeeSpocLabel,
  canEditCandidateSpoc,
  firstNameOf,
} = require('../utils/spocIdentity');

describe('spocIdentity', () => {
  test('uses first name when unique', () => {
    expect(
      resolveEmployeeSpocLabel(
        { name: 'Rohit Rajbhar', email: 'rohitrajbhar@skillnixrecruitment.com' },
        ['Rohit Rajbhar', 'Payal Sharma', 'Rangoli Negi']
      )
    ).toBe('ROHIT');
  });

  test('uses full name when first name collides', () => {
    expect(
      resolveEmployeeSpocLabel(
        { name: 'Rohit Rajbhar', email: 'rohitrajbhar@skillnixrecruitment.com' },
        ['Rohit Rajbhar', 'Rohit Sharma', 'Payal']
      )
    ).toBe('ROHIT RAJBHAR');
  });

  test('falls back to email local-part when name missing', () => {
    expect(
      resolveEmployeeSpocLabel({ email: 'rohitrajbhar@skillnixrecruitment.com' }, [])
    ).toBe('ROHITRAJBHAR');
  });

  test('only owner/admin/manager can edit SPOC', () => {
    expect(canEditCandidateSpoc({ role: 'owner' })).toBe(true);
    expect(canEditCandidateSpoc({ role: 'admin' })).toBe(true);
    expect(canEditCandidateSpoc({ role: 'hr_manager' })).toBe(true);
    expect(canEditCandidateSpoc({ role: 'hr_recruiter' })).toBe(false);
    expect(canEditCandidateSpoc({ role: 'sales' })).toBe(false);
  });

  test('firstNameOf', () => {
    expect(firstNameOf('Rohit Rajbhar')).toBe('Rohit');
    expect(firstNameOf('  PAYAL  ')).toBe('PAYAL');
  });
});
