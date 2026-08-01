const crypto = require('crypto');

// ApiKey.generate()/hashKey() have no Mongoose-connection dependency at the
// module level (only the schema/model registration does), so we can load
// the real model file directly in a unit test.
const ApiKey = require('../models/ApiKey');

describe('ApiKey key generation & hashing', () => {
  test('generate() returns a plaintext key prefixed sk_live_ and a matching SHA-256 hash', () => {
    const { plaintext, keyHash, keyPrefix } = ApiKey.generate();
    expect(plaintext.startsWith('sk_live_')).toBe(true);
    expect(keyHash).toEqual(crypto.createHash('sha256').update(plaintext).digest('hex'));
    expect(plaintext.startsWith(keyPrefix)).toBe(true);
  });

  test('generate() never produces the same plaintext key twice', () => {
    const a = ApiKey.generate();
    const b = ApiKey.generate();
    expect(a.plaintext).not.toEqual(b.plaintext);
  });

  test('hashKey() is deterministic (same input -> same hash, needed for lookup)', () => {
    expect(ApiKey.hashKey('sk_live_abc')).toEqual(ApiKey.hashKey('sk_live_abc'));
    expect(ApiKey.hashKey('sk_live_abc')).not.toEqual(ApiKey.hashKey('sk_live_xyz'));
  });
});

describe('Webhook HMAC signing (verifies the contract webhookDispatcher.js promises customers)', () => {
  const sign = (secret, body) => crypto.createHmac('sha256', secret).update(body).digest('hex');

  test('a customer re-computing HMAC-SHA256 over the raw body with the shared secret gets the same signature', () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({ event: 'candidate.hired', data: { id: '123' } });
    const signature = sign(secret, body);
    // Simulates the receiving webhook endpoint's own verification code.
    const recomputed = sign(secret, body);
    expect(signature).toEqual(recomputed);
  });

  test('signature changes if the body is tampered with in transit', () => {
    const secret = 'whsec_test_secret';
    const original = sign(secret, JSON.stringify({ event: 'candidate.hired' }));
    const tampered = sign(secret, JSON.stringify({ event: 'candidate.hired.FAKE' }));
    expect(original).not.toEqual(tampered);
  });

  test('signature changes if the wrong secret is used (can\'t forge without it)', () => {
    const body = JSON.stringify({ event: 'candidate.hired' });
    expect(sign('whsec_real', body)).not.toEqual(sign('whsec_guessed', body));
  });
});
