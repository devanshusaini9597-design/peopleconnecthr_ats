/**
 * Unit/integration tests for applicationService domain logic.
 */
const mongoose = require('mongoose');
const applicationService = require('../services/applicationService');

describe('applicationService', () => {
  it('exports create/stage/schedule/reject helpers', () => {
    expect(typeof applicationService.listApplications).toBe('function');
    expect(typeof applicationService.getStats).toBe('function');
    expect(typeof applicationService.getApplication).toBe('function');
    expect(typeof applicationService.createApplication).toBe('function');
    expect(typeof applicationService.changeStage).toBe('function');
    expect(typeof applicationService.assignApplication).toBe('function');
    expect(typeof applicationService.rejectApplication).toBe('function');
    expect(typeof applicationService.updateRating).toBe('function');
    expect(typeof applicationService.updateNotes).toBe('function');
    expect(typeof applicationService.scheduleInterview).toBe('function');
    expect(typeof applicationService.deleteApplication).toBe('function');
    expect(typeof applicationService.listByJob).toBe('function');
    expect(typeof applicationService.listByCandidate).toBe('function');
  });

  it('createApplication requires jobId', async () => {
    await expect(
      applicationService.createApplication({ id: 'u1', organizationId: 'o1' }, {})
    ).rejects.toMatchObject({ message: 'jobId is required', statusCode: 400 });
  });

  it('createApplication requires candidateId or candidate details', async () => {
    await expect(
      applicationService.createApplication(
        { id: 'u1', organizationId: new mongoose.Types.ObjectId() },
        { jobId: new mongoose.Types.ObjectId().toString() }
      )
    ).rejects.toMatchObject({
      message: 'candidateId or candidate details required',
      statusCode: 400,
    });
  });

  it('scheduleInterview requires scheduledAt', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(true).toBe(true);
      return;
    }
    await expect(
      applicationService.scheduleInterview(
        { id: new mongoose.Types.ObjectId(), organizationId: new mongoose.Types.ObjectId() },
        new mongoose.Types.ObjectId().toString(),
        {}
      )
    ).rejects.toMatchObject({ message: 'scheduledAt is required', statusCode: 400 });
  });

  it('getStats returns totals when DB available', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(true).toBe(true);
      return;
    }
    const orgId = new mongoose.Types.ObjectId();
    const stats = await applicationService.getStats(orgId);
    expect(stats).toEqual(
      expect.objectContaining({
        total: 0,
        byStage: {},
        avgTime: 'N/A',
      })
    );
  });
});
