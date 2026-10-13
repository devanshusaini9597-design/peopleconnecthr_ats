const {
  emailKey,
  phoneKey,
  nameKey,
  namesLikelySame,
  evaluateRecordDate,
  applyIdentityFields,
} = require('../utils/misIdentity');

describe('misIdentity', () => {
  test('collapses Gmail dots, plus tags, and googlemail', () => {
    expect(emailKey('A.B+hire@Gmail.com')).toBe(emailKey('ab@googlemail.com'));
    expect(emailKey('ab@gmail.com')).toBe('ab@gmail.com');
    expect(emailKey('person@company.com')).toBe('person@company.com');
  });

  test('normalises Indian phone variants to the same key', () => {
    expect(phoneKey('+91 98765 43210')).toBe(phoneKey('09876543210'));
    expect(phoneKey('919876543210')).toBe('9876543210');
  });

  test('name keys ignore case and punctuation', () => {
    expect(nameKey('Ravi Kumar')).toBe(nameKey('ravi-kumar'));
    expect(namesLikelySame('Ravi Kumar', 'Ravi Kumar')).toBe(true);
  });

  test('rejects a contact date after the import day', () => {
    const createdAt = new Date('2026-09-10T10:00:00.000Z');
    const later = evaluateRecordDate({
      recordDate: new Date('2026-10-02T00:00:00.000Z'),
      createdAt,
    });
    expect(later.ok).toBe(false);
    expect(later.code).toBe('DATE_AFTER_IMPORT');
  });

  test('locks contact date to the recorded month', () => {
    const locked = evaluateRecordDate({
      recordDate: new Date('2026-10-05T00:00:00.000Z'),
      createdAt: new Date('2026-10-12T00:00:00.000Z'),
      previousRecordDate: new Date('2026-09-20T00:00:00.000Z'),
    });
    expect(locked.ok).toBe(false);
    expect(locked.code).toBe('DATE_LOCKED');
  });

  test('allows a contact date on or before import day', () => {
    const ok = evaluateRecordDate({
      recordDate: new Date('2026-10-01T00:00:00.000Z'),
      createdAt: new Date('2026-10-13T08:00:00.000Z'),
    });
    expect(ok.ok).toBe(true);
  });

  test('applyIdentityFields stores collapsed keys', () => {
    const row = applyIdentityFields({
      name: 'Anita Sharma',
      email: 'anita.sharma+mis@gmail.com',
      phone: '+91 90000 11122',
      companyName: 'HDFC Life',
    });
    expect(row.emailKey).toBe('anitasharma@gmail.com');
    expect(row.phoneKey).toBe('9000011122');
    expect(row.nameKey).toContain('anita');
  });
});
