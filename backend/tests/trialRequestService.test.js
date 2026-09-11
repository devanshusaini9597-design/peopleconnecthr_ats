const { isPlatformOperator, isPlatformOperatorEmail } = require('../utils/orgDomain');

describe('trialRequestService', () => {
  const prevSales = process.env.SALES_TEAM_EMAIL;
  const prevSupport = process.env.SUPPORT_TEAM_EMAIL;

  afterEach(() => {
    if (prevSales === undefined) delete process.env.SALES_TEAM_EMAIL;
    else process.env.SALES_TEAM_EMAIL = prevSales;
    if (prevSupport === undefined) delete process.env.SUPPORT_TEAM_EMAIL;
    else process.env.SUPPORT_TEAM_EMAIL = prevSupport;
    jest.resetModules();
  });

  it('exports trial-request helpers', () => {
    const svc = require('../services/trialRequestService');
    expect(typeof svc.salesInbox).toBe('function');
    expect(typeof svc.afterRequestSaved).toBe('function');
    expect(typeof svc.listTrialRequests).toBe('function');
    expect(typeof svc.approveTrialRequest).toBe('function');
    expect(typeof svc.rejectTrialRequest).toBe('function');
    expect(typeof svc.approveWithToken).toBe('function');
    expect(typeof svc.assertPlatformOperator).toBe('function');
    expect(svc.SALES_INBOX).toBe('contact@skillnixrecruitment.com');
  });

  it('defaults the sales inbox to contact@skillnixrecruitment.com', () => {
    delete process.env.SALES_TEAM_EMAIL;
    delete process.env.SUPPORT_TEAM_EMAIL;
    jest.resetModules();
    const { salesInbox } = require('../services/trialRequestService');
    expect(salesInbox()).toEqual(['contact@skillnixrecruitment.com']);
  });

  it('salesInbox prefers SALES_TEAM_EMAIL over SUPPORT_TEAM_EMAIL', () => {
    process.env.SUPPORT_TEAM_EMAIL = 'support@example.com';
    process.env.SALES_TEAM_EMAIL = 'sales@peopleconnecthr.com, hello@skillnix.app';
    jest.resetModules();
    const { salesInbox } = require('../services/trialRequestService');
    expect(salesInbox()).toEqual(['sales@peopleconnecthr.com', 'hello@skillnix.app']);
  });

  it('assertPlatformOperator rejects customer emails', () => {
    const { assertPlatformOperator } = require('../services/trialRequestService');
    expect(() => assertPlatformOperator({ email: 'buyer@acme.com', role: 'owner' })).toThrow(/sales team/i);
  });

  it('signApproveToken is a JWT with trial_approve purpose', () => {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/authMiddleware');
    const { signApproveToken } = require('../services/trialRequestService');
    const token = signApproveToken('507f1f77bcf86cd799439011');
    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.purpose).toBe('trial_approve');
    expect(decoded.id).toBe('507f1f77bcf86cd799439011');
  });

  it('publicApproveUrl puts the JWT in a frontend hash, not an API query', () => {
    process.env.FRONTEND_URL = 'https://www.peopleconnecthr.com';
    jest.resetModules();
    const { publicApproveUrl, signApproveToken } = require('../services/trialRequestService');
    const url = publicApproveUrl('507f1f77bcf86cd799439011');
    expect(url.startsWith('https://www.peopleconnecthr.com/trial-approve#')).toBe(true);
    expect(url).not.toMatch(/\?token=/);
    expect(url).not.toMatch(/\/api\/onboarding\/trial-requests\/approve/);
    const token = decodeURIComponent(url.split('#')[1]);
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/authMiddleware');
    expect(jwt.verify(token, JWT_SECRET).purpose).toBe('trial_approve');
    expect(typeof signApproveToken).toBe('function');
  });
});

describe('platform operator domains', () => {
  it('treats peopleconnecthr.com owners as operators', () => {
    expect(isPlatformOperatorEmail('ada@peopleconnecthr.com')).toBe(true);
    expect(isPlatformOperator({ email: 'ada@peopleconnecthr.com', role: 'owner' })).toBe(true);
    expect(isPlatformOperator({ email: 'ada@peopleconnecthr.com', role: 'sales' })).toBe(true);
  });

  it('does not treat customer domains as operators', () => {
    expect(isPlatformOperatorEmail('buyer@acme-staffing.com')).toBe(false);
    expect(isPlatformOperator({ email: 'buyer@acme-staffing.com', role: 'owner' })).toBe(false);
  });
});
