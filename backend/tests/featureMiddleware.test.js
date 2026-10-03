jest.mock('mongoose', () => ({
  model: jest.fn()
}));

const mongoose = require('mongoose');
const { requireFeature } = require('../middleware/featureMiddleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('featureMiddleware.requireFeature', () => {
  afterEach(() => jest.clearAllMocks());

  test('401s with no organization context', async () => {
    const req = { user: null };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('analytics.advanced')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('404s if the organization cannot be found', async () => {
    mongoose.model.mockReturnValue({ findById: () => ({ select: () => Promise.resolve(null) }) });
    const req = { user: { organizationId: 'org1' } };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('analytics.advanced')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('403s with UPGRADE_REQUIRED when the org\'s plan does not include the feature', async () => {
    mongoose.model.mockReturnValue({ findById: () => ({ select: () => Promise.resolve({ plan: 'starter' }) }) });
    const req = { user: { organizationId: 'org1' } };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('analytics.advanced')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('UPGRADE_REQUIRED');
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when the org\'s plan includes the feature', async () => {
    mongoose.model.mockReturnValue({ findById: () => ({ select: () => Promise.resolve({ plan: 'professional' }) }) });
    const req = { user: { organizationId: 'org1' } };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('analytics.advanced')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('403s FEATURE_UNAVAILABLE for unfinished modules on customer orgs', async () => {
    mongoose.model.mockReturnValue({
      findById: () => ({
        select: () => Promise.resolve({ plan: 'enterprise', domain: 'acme-staffing.com', isDemo: false }),
      }),
    });
    const req = { user: { organizationId: 'org1', email: 'ada@acme-staffing.com', isDemo: false } };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('analytics.dei')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('FEATURE_UNAVAILABLE');
    expect(next).not.toHaveBeenCalled();
  });

  test('allows unfinished modules for Skillnix Recruitment orgs', async () => {
    mongoose.model.mockReturnValue({
      findById: () => ({
        select: () => Promise.resolve({
          plan: 'enterprise',
          domain: 'skillnixrecruitment.com',
          isDemo: false,
        }),
      }),
    });
    const req = { user: { organizationId: 'org1', email: 'recruiter@skillnixrecruitment.com', isDemo: false } };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('analytics.dei')(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks unfinished modules for demo accounts even on enterprise', async () => {
    mongoose.model.mockReturnValue({
      findById: () => ({
        select: () => Promise.resolve({
          plan: 'enterprise',
          domain: 'demo.peopleconnecthr.com',
          isDemo: true,
        }),
      }),
    });
    const req = { user: { organizationId: 'org1', email: 'owner@demo.peopleconnecthr.com', isDemo: true } };
    const res = mockRes();
    const next = jest.fn();
    await requireFeature('messaging.sequences')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
