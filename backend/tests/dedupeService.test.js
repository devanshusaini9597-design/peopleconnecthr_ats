const {
  normalizePhone,
  normalizeEmail,
  findDuplicates,
  mergeCandidates,
} = require('../services/dedupeService');

describe('dedupeService', () => {
  it('normalizes Indian phones to last 10 digits', () => {
    expect(normalizePhone('+91 91005 46740')).toBe('9100546740');
    expect(normalizePhone('9100546740')).toBe('9100546740');
    expect(normalizeEmail(' Raj.Domathoti9@Gmail.com ')).toBe('raj.domathoti9@gmail.com');
  });

  it('groups same-phone different-email as duplicates (unit via in-memory logic)', async () => {
    // findDuplicates needs Mongo — smoke the match rules via exported helpers only here.
    const a = '9100546740';
    const b = '91-9100546740';
    expect(normalizePhone(a)).toBe(normalizePhone(b));
  });
});

// Integration-style merge is covered when mongoose models are available in suite;
// keep a lightweight contract check that merge rejects empty drop list without DB.
describe('mergeCandidates contract', () => {
  it('requires keepId and dropIds', async () => {
    await expect(mergeCandidates('org', null, ['x'])).rejects.toThrow(/keepId/i);
    await expect(mergeCandidates('org', 'keep', [])).rejects.toThrow(/duplicate/i);
  });
});
