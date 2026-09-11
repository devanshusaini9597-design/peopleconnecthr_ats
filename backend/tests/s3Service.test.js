const {
  storedToKey,
  kindFromKey,
  publicPathForKey,
  isS3Resume,
  isS3Asset,
} = require('../services/s3Service');

describe('s3Service path helpers', () => {
  it('strips /uploads and host from stored values', () => {
    expect(storedToKey('/uploads/logos/org-logo-1.png')).toBe('logos/org-logo-1.png');
    expect(storedToKey('https://cdn.example.com/uploads/profiles/a.jpg')).toBe('profiles/a.jpg');
  });

  it('maps keys to asset kinds', () => {
    expect(kindFromKey('/uploads/logos/org-logo-1.png')).toBe('logo');
    expect(kindFromKey('profiles/profile-2.jpg')).toBe('profile');
    expect(kindFromKey('resumes/file.pdf')).toBe('resume');
    expect(kindFromKey('org-logo-legacy.png')).toBe('logo');
    expect(kindFromKey('profile-legacy.jpg')).toBe('profile');
    expect(kindFromKey('')).toBeNull();
  });

  it('builds a public /uploads path', () => {
    expect(publicPathForKey('logos/org-logo-1.png')).toBe('/uploads/logos/org-logo-1.png');
  });

  it('detects resume vs other S3 assets', () => {
    expect(isS3Resume('resumes/a.pdf')).toBe(true);
    expect(isS3Resume('/uploads/logos/x.png')).toBe(false);
    expect(isS3Asset('/uploads/profiles/x.jpg')).toBe(true);
  });
});
