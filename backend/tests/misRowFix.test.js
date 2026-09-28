const { autoFixMisRow, looksLikeEmail, parsePhoneDigits } = require('../utils/misRowFix');

describe('misRowFix', () => {
  test('swaps phone-in-email with email-in-phone', () => {
    const { row, fixes } = autoFixMisRow({
      name: 'Riya',
      email: '9876543210',
      contact: 'riya@gmail.com',
    });
    expect(row.email).toBe('riya@gmail.com');
    expect(row.phone).toBe('9876543210');
    expect(fixes.length).toBeGreaterThan(0);
  });

  test('moves phone from email column and finds email in company', () => {
    const { row } = autoFixMisRow({
      name: 'Aman',
      email: '9988776655',
      contact: '',
      companyName: 'aman@company.com',
    });
    expect(row.email).toBe('aman@company.com');
    expect(row.phone).toBe('9988776655');
    expect(row.companyName).toBe('');
  });

  test('moves email from contact column', () => {
    const { row } = autoFixMisRow({
      name: 'Neha',
      email: '',
      contact: 'neha@test.com',
    });
    expect(row.email).toBe('neha@test.com');
    expect(row.phone).toBe('');
  });

  test('leaves correct rows alone', () => {
    const { row, fixes } = autoFixMisRow({
      name: 'Ok',
      email: 'ok@test.com',
      contact: '9123456789',
      companyName: 'Acme',
    });
    expect(row.email).toBe('ok@test.com');
    expect(row.phone).toBe('9123456789');
    expect(row.companyName).toBe('Acme');
    expect(fixes).toEqual([]);
  });

  test('helpers', () => {
    expect(looksLikeEmail('a@b.com')).toBe(true);
    expect(parsePhoneDigits('+91 98765-43210')).toBe('9876543210');
  });
});
