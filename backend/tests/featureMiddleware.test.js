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
});
