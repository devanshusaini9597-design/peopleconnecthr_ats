jest.mock('../services/s3Service', () => {
  const actual = jest.requireActual('../services/s3Service');
  return {
    ...actual,
    isEmailArchiveConfigured: jest.fn(() => true),
    putObject: jest.fn(async () => true),
    getAssetBuffer: jest.fn(async () => null),
    resolveBucketForKey: jest.fn(() => 'test-mail-archive'),
    kindConfig: jest.fn((kind) => {
      if (kind === 'email') return { kind: 'email', bucket: 'test-mail-archive', prefix: 'mail-archive' };
      return actual.kindConfig(kind);
    }),
  };
});

const s3 = require('../services/s3Service');
const {
  buildKeys,
  storeOutbound,
  storeInbound,
  clipHtmlForMongo,
} = require('../services/emailArchiveService');

describe('emailArchiveService', () => {
  beforeEach(() => {
    s3.putObject.mockClear();
    s3.putObject.mockResolvedValue(true);
    s3.isEmailArchiveConfigured.mockReturnValue(true);
  });

  it('builds sent/inbox keys under mail-archive/{org}/{folder}/{yyyy}/{mm}/', () => {
    const keys = buildKeys({
      organizationId: '507f1f77bcf86cd799439011',
      folder: 'sent',
      id: 'abc123def456',
      at: new Date('2026-09-30T10:00:00Z'),
    });
    expect(keys.htmlKey).toBe(
      'mail-archive/507f1f77bcf86cd799439011/sent/2026/09/abc123def456.html'
    );
    expect(keys.metaKey).toBe(
      'mail-archive/507f1f77bcf86cd799439011/sent/2026/09/abc123def456.meta.json'
    );
  });

  it('storeOutbound writes html + meta and returns archive keys', async () => {
    const result = await storeOutbound({
      organizationId: '507f1f77bcf86cd799439011',
      sendLogId: '507f1f77bcf86cd799439022',
      subject: 'Open opportunity – Sales Officer',
      html: '<p>Hello</p>',
      text: 'Hello',
      from: 'team@skillnixrecruitment.com',
      recipients: [{ email: 'ada@example.com' }],
      provider: 'zeptomail',
      channel: 'marketing',
      sentAt: new Date('2026-09-30T10:00:00Z'),
    });
    expect(result).toEqual(
      expect.objectContaining({
        archiveKey: expect.stringContaining('/sent/2026/09/'),
        archiveMetaKey: expect.stringContaining('.meta.json'),
      })
    );
    expect(s3.putObject).toHaveBeenCalled();
    expect(s3.putObject.mock.calls.some((c) => /text\/html/.test(c[0].contentType))).toBe(true);
  });

  it('storeInbound soft-fails when S3 put fails', async () => {
    s3.putObject.mockResolvedValue(false);
    const result = await storeInbound({
      organizationId: '507f1f77bcf86cd799439011',
      messageId: '507f1f77bcf86cd799439033',
      html: '<p>Reply</p>',
      from: 'ada@example.com',
    });
    expect(result).toBeNull();
  });

  it('clips mongo html preview', () => {
    const big = 'x'.repeat(60_000);
    const clipped = clipHtmlForMongo(big);
    expect(clipped.length).toBeLessThan(big.length);
    expect(clipped).toContain('truncated');
  });

  it('skips archive when not configured', async () => {
    s3.isEmailArchiveConfigured.mockReturnValue(false);
    const result = await storeOutbound({
      organizationId: '507f1f77bcf86cd799439011',
      html: '<p>Hi</p>',
    });
    expect(result).toBeNull();
    expect(s3.putObject).not.toHaveBeenCalled();
  });
});
