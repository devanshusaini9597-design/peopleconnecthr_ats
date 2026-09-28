const mongoose = require('mongoose');
const { signJobShareToken, verifyJobShareToken } = require('../utils/jobShareAttribution');

describe('job share attribution token', () => {
  const organizationId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();

  test('round-trips a signed via token for the same job', () => {
    const token = signJobShareToken({ organizationId, jobId, userId });
    expect(verifyJobShareToken(token, { organizationId, jobId })).toBe(String(userId));
  });

  test('rejects a token for a different job or user', () => {
    const token = signJobShareToken({ organizationId, jobId, userId });
    expect(verifyJobShareToken(token, { organizationId, jobId: new mongoose.Types.ObjectId() })).toBeNull();
    expect(verifyJobShareToken(`${new mongoose.Types.ObjectId()}.${token.split('.')[1]}`, { organizationId, jobId })).toBeNull();
    expect(verifyJobShareToken(String(userId), { organizationId, jobId })).toBeNull();
  });
});
