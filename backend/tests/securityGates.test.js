const crypto = require('crypto');
const { consentTokenForCandidate, consentTokenValid } = require('../utils/consentToken');
const { verifySlackSignature } = require('../routes/slackAppRoutes');
const { isDevTempPasswordLogin } = require('../utils/devTempPassword');
const { isLoginOtpPaused } = require('../services/loginOtpService');

describe('consent HMAC tokens', () => {
  const id = '507f1f77bcf86cd799439011';

  it('rejects ObjectId prefixes that used to be accepted', () => {
    const token = consentTokenForCandidate(id);
    expect(token).toHaveLength(32);
    expect(token).not.toBe(id.slice(0, 16));
    expect(consentTokenValid(id, token)).toBe(true);
    expect(consentTokenValid(id, id.slice(0, 16))).toBe(false);
    expect(consentTokenValid(id, 'nope')).toBe(false);
    expect(consentTokenValid(id, '')).toBe(false);
  });

  it('does not accept another candidate id token', () => {
    const other = '507f1f77bcf86cd799439012';
    expect(consentTokenValid(id, consentTokenForCandidate(other))).toBe(false);
  });
});

describe('production auth bypasses stay off', () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    if (prevEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevEnv.NODE_ENV;
    if (prevEnv.LOGIN_OTP_PAUSED === undefined) delete process.env.LOGIN_OTP_PAUSED;
    else process.env.LOGIN_OTP_PAUSED = prevEnv.LOGIN_OTP_PAUSED;
    if (prevEnv.DEV_TEMP_PASSWORD === undefined) delete process.env.DEV_TEMP_PASSWORD;
    else process.env.DEV_TEMP_PASSWORD = prevEnv.DEV_TEMP_PASSWORD;
    if (prevEnv.DEV_TEMP_PASSWORD_DOMAIN === undefined) delete process.env.DEV_TEMP_PASSWORD_DOMAIN;
    else process.env.DEV_TEMP_PASSWORD_DOMAIN = prevEnv.DEV_TEMP_PASSWORD_DOMAIN;
    if (prevEnv.DEV_TEMP_PASSWORD_IN_PRODUCTION === undefined) delete process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION;
    else process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION = prevEnv.DEV_TEMP_PASSWORD_IN_PRODUCTION;
    if (prevEnv.DEV_TEMP_PASSWORD_ORGANIZATION_ID === undefined) delete process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID;
    else process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID = prevEnv.DEV_TEMP_PASSWORD_ORGANIZATION_ID;
  });

  it('ignores LOGIN_OTP_PAUSED in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOGIN_OTP_PAUSED = '1';
    expect(isLoginOtpPaused()).toBe(false);
  });

  it('ignores DEV_TEMP_PASSWORD in production without the testing-phase flag', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_TEMP_PASSWORD = 'SkillnixCheck2026!';
    process.env.DEV_TEMP_PASSWORD_DOMAIN = 'skillnixrecruitment.com';
    expect(isDevTempPasswordLogin('adarsh@skillnixrecruitment.com', 'SkillnixCheck2026!')).toBe(false);
  });
});

describe('importAllToMine stays tenant-scoped', () => {
  it('does not query Candidate.find({})', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../controller/candidate/candidateBulk.js'), 'utf8');
    expect(src).toMatch(/candidateListScope/);
    expect(src).not.toMatch(/Candidate\.find\(\{\}\)/);
  });
});

describe('subscribe HMAC has no hard-coded fallback', () => {
  it('uses JWT_SECRET or SUBSCRIBE_SECRET only', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../utils/subscribeSign.js'), 'utf8');
    expect(src).not.toMatch(/skillnix-subscribe-secret/);
  });
});

describe('slack signature helper', () => {
  it('rejects missing secret and stale timestamps', () => {
    const secret = 'slack-signing';
    const rawBody = 'token=x&command=%2Fskillnix';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = `v0=${crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
    const req = {
      headers: { 'x-slack-request-timestamp': timestamp, 'x-slack-signature': sig },
      rawBody,
    };
    expect(verifySlackSignature(req, secret)).toBe(true);
    expect(verifySlackSignature(req, '')).toBe(false);
    expect(verifySlackSignature({ ...req, headers: { ...req.headers, 'x-slack-signature': 'v0=deadbeef' } }, secret)).toBe(false);
    expect(verifySlackSignature({
      ...req,
      headers: { ...req.headers, 'x-slack-request-timestamp': String(Math.floor(Date.now() / 1000) - 10 * 60) },
    }, secret)).toBe(false);
  });
});

describe('CSP does not allow inline scripts', () => {
  it('API helmet scriptSrc is self only', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../server.js'), 'utf8');
    expect(src).toMatch(/scriptSrc:\s*\[["']'self'["']\]/);
    expect(src).not.toMatch(/scriptSrc:[^\n]*unsafe-inline/);
  });

  it('Vercel CSP has script-src self and no script unsafe-inline', () => {
    const fs = require('fs');
    const path = require('path');
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/vercel.json'), 'utf8'));
    const csp = cfg.headers
      .flatMap((h) => h.headers || [])
      .find((h) => h.key === 'Content-Security-Policy');
    expect(csp).toBeTruthy();
    expect(csp.value).toMatch(/script-src 'self'/);
    expect(csp.value).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});

describe('trial GET approve does not consume the token', () => {
  it('redirects to the frontend hash page instead of approving', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../routes/onboardingRoutes.js'), 'utf8');
    expect(src).toMatch(/trial-approve#/);
    expect(src).toMatch(/approve-with-token/);
    expect(src).not.toMatch(/approveWithToken\(req\.query\.token\)/);
  });
});

describe('xlsx is not a direct app dependency', () => {
  it('backend package.json does not list xlsx', () => {
    const pkg = require('../package.json');
    expect(pkg.dependencies.xlsx).toBeUndefined();
    expect(pkg.devDependencies?.xlsx).toBeUndefined();
  });

  it('frontend package.json does not list xlsx', () => {
    const fs = require('fs');
    const path = require('path');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/package.json'), 'utf8'));
    expect(pkg.dependencies.xlsx).toBeUndefined();
  });
});
