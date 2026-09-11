const {
  renameStageLinked,
  mergeStagesLinked,
  stageKey,
} = require('../services/pipelineStageSync');

jest.mock('../models/Organization');
jest.mock('../models/Candidate');
jest.mock('../models/Application');
jest.mock('../models/Job');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
}));

const Organization = require('../models/Organization');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const Job = require('../models/Job');

describe('pipeline rename/merge', () => {
  const orgId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
    Candidate.distinct = jest.fn().mockResolvedValue(['APPLIED', 'SCREENING']);
    Candidate.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
    Application.distinct = jest.fn().mockResolvedValue(['Applied', 'Screening']);
    Application.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    Job.find = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
  });

  test('renameStageLinked updates org list and cascades candidate statuses', async () => {
    const save = jest.fn();
    const orgDoc = {
      atsSettings: { pipelineStages: ['Applied', 'Screening', 'Interview'] },
      markModified: jest.fn(),
      save,
    };
    Organization.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(orgDoc),
    });

    const result = await renameStageLinked(orgId, 'Applied', 'New Applied');

    expect(result.stages).toEqual(['New Applied', 'Screening', 'Interview']);
    expect(save).toHaveBeenCalled();
    expect(Candidate.updateMany).toHaveBeenCalledWith(
      { organizationId: orgId, status: 'APPLIED' },
      { $set: { status: stageKey('New Applied') } }
    );
    expect(result.candidatesUpdated).toBe(2);
  });

  test('mergeStagesLinked combines stages and remaps all sources', async () => {
    const save = jest.fn();
    const orgDoc = {
      atsSettings: { pipelineStages: ['Applied', 'Screening', 'Interview'] },
      markModified: jest.fn(),
      save,
    };
    Organization.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(orgDoc),
    });

    const result = await mergeStagesLinked(orgId, ['Applied', 'Screening'], 'Initial Review');

    expect(result.stages).toEqual(['Initial Review', 'Interview']);
    expect(result.mergedFrom).toEqual(['Applied', 'Screening']);
    expect(save).toHaveBeenCalled();
    expect(Candidate.updateMany).toHaveBeenCalled();
    expect(result.candidatesUpdated).toBeGreaterThan(0);
  });

  test('mergeStagesLinked rejects a single source', async () => {
    await expect(mergeStagesLinked(orgId, ['Applied'], 'Only One')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('renameStageLinked rejects duplicate target name', async () => {
    Organization.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        atsSettings: { pipelineStages: ['Applied', 'Screening'] },
        markModified: jest.fn(),
        save: jest.fn(),
      }),
    });

    await expect(renameStageLinked(orgId, 'Applied', 'Screening')).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
