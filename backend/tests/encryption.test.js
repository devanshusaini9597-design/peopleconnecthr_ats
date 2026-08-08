process.env.INTEGRATION_ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || 'a'.repeat(64);

const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

describe('utils/encryption (AES-256-GCM field-level encryption)', () => {
  test('round-trips an object through encrypt/decrypt', () => {
    const secret = { apiKey: 'sk_test_12345', fromEmail: 'a@b.com' };
    const encrypted = encrypt(secret);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decrypt(encrypted)).toEqual(secret);
  });

  test('ciphertext never contains the plaintext secret', () => {
    const encrypted = encrypt({ apiKey: 'sk_live_super_secret_value' });
    expect(encrypted).not.toContain('sk_live_super_secret_value');
  });

  test('two encryptions of the same value produce different ciphertext (random IV per record)', () => {
    const a = encrypt({ apiKey: 'same-value' });
    const b = encrypt({ apiKey: 'same-value' });
    expect(a).not.toEqual(b);
  });

  test('isEncrypted() distinguishes encrypted strings from legacy plaintext', () => {
    expect(isEncrypted(encrypt({ a: 1 }))).toBe(true);
    expect(isEncrypted('plain-old-string')).toBe(false);
    expect(isEncrypted({ apiKey: 'legacy-plaintext-object' })).toBe(false);
  });

  test('decrypt() returns null for malformed/non-encrypted input rather than throwing', () => {
    expect(decrypt('not-an-encrypted-value')).toBeNull();
    expect(decrypt('v1:missing:parts')).toBeNull();
  });

  test('tampered ciphertext fails GCM auth tag verification (integrity protected)', () => {
    const encrypted = encrypt({ apiKey: 'value' });
    const parts = encrypted.split(':');
    // Flip a character in the ciphertext segment.
    parts[3] = parts[3].slice(0, -2) + (parts[3].slice(-2) === 'AA' ? 'BB' : 'AA');
    const tampered = parts.join(':');
    expect(() => decrypt(tampered)).toThrow();
  });
});
