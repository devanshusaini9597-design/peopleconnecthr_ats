const {
  generatePublicId,
  normalizePublicId,
  isPublicIdToken,
  careersJobPathSegment,
  PUBLIC_ID_LEN,
} = require('../services/jobPublicIdService');

describe('jobPublicIdService', () => {
  it('generates opaque 8-char public ids', () => {
    const id = generatePublicId();
    expect(id).toHaveLength(PUBLIC_ID_LEN);
    expect(isPublicIdToken(id)).toBe(true);
  });

  it('normalizes and prefers publicId in path segment', () => {
    expect(normalizePublicId(' AbC23456 ')).toBe('abc23456');
    expect(careersJobPathSegment({ publicId: 'k7xm2p9q' })).toBe('k7xm2p9q');
    expect(careersJobPathSegment({ jobCode: 'SKILLNIX-2026-0001' })).toBe('SKILLNIX-2026-0001');
  });
});
