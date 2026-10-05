const {
  personalizeBulkText,
  ensureCandidateNameToken,
} = require('../utils/bulkPersonalize');

describe('bulkPersonalize', () => {
  it('replaces {{candidateName}} per recipient', () => {
    expect(personalizeBulkText('Dear {{candidateName}},', 'Ada')).toBe('Dear Ada,');
    expect(personalizeBulkText('Hi {{name}}', 'Bob')).toBe('Hi Bob');
  });

  it('un-bakes the preview name when the token was already substituted', () => {
    const draft = 'Dear Priya,\n\nWe have a role for you.';
    expect(personalizeBulkText(draft, 'Amit', ['Priya'])).toBe(
      'Dear Amit,\n\nWe have a role for you.'
    );
    expect(personalizeBulkText(draft, 'Priya', ['Priya'])).toBe(draft);
  });

  it('ensureCandidateNameToken restores the merge tag from a baked name', () => {
    expect(ensureCandidateNameToken('Dear Priya,', ['Priya'])).toBe('Dear {{candidateName}},');
    expect(ensureCandidateNameToken('Dear {{candidateName}},', ['Priya'])).toBe(
      'Dear {{candidateName}},'
    );
  });
});
