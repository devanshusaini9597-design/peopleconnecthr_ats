const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('../middleware/rbacMiddleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('rbacMiddleware.requireRole', () => {
  test('401s with no authenticated user', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();
    requireOwner(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('403s when role is not in the allowed list', () => {
    const req = { user: { role: 'readonly' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when role is allowed', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('requireRecruiterOrAbove allows owner/admin/recruiter but not interviewer/readonly', () => {
    for (const role of ['owner', 'admin', 'recruiter']) {
      const next = jest.fn();
      requireRecruiterOrAbove({ user: { role } }, mockRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
    }
    for (const role of ['interviewer', 'readonly']) {
      const res = mockRes();
      const next = jest.fn();
      requireRecruiterOrAbove({ user: { role } }, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }
  });

  test('custom requireRole(...) only allows exactly the roles listed', () => {
    const gate = requireRole('interviewer');
    const allow = jest.fn();
    gate({ user: { role: 'interviewer' } }, mockRes(), allow);
    expect(allow).toHaveBeenCalledTimes(1);

    const deny = jest.fn();
    gate({ user: { role: 'recruiter' } }, mockRes(), deny);
    expect(deny).not.toHaveBeenCalled();
  });
});

describe('rbacMiddleware.checkPlanLimit', () => {
  test('401s with no organization context', async () => {
    const req = { user: {} };
    const res = mockRes();
    const next = jest.fn();
    await checkPlanLimit('jobs')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('500s on an invalid resource name (fails closed, not silently allowed)', async () => {
    const req = { user: { organizationId: 'org1' } };
    const res = mockRes();
    const next = jest.fn();
    await checkPlanLimit('not-a-real-resource')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
