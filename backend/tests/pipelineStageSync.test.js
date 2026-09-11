const {
  resolveStage,
  stageKey,
  displayStage,
} = require('../services/pipelineStageSync');

describe('pipelineStageSync', () => {
  const orgStages = [
    'Applied',
    'Cv Received',
    'Call Back',
    'Hold',
    'First Round Done',
    'Interview Reject',
    'Rejected',
  ];

  test('exact match ignores case and spacing', () => {
    const r = resolveStage('CV  RECEIVED', orgStages);
    expect(r.matched).toBe(true);
    expect(r.isNew).toBe(false);
    expect(r.label).toBe('Cv Received');
    expect(stageKey(r.label)).toBe('CV RECEIVED');
  });

  test('fuzzy merges near typos onto existing stage', () => {
    const r = resolveStage('Cv Recevied', orgStages);
    expect(r.matched).toBe(true);
    expect(r.fuzzy).toBe(true);
    expect(r.label).toBe('Cv Received');
  });

  test('unknown stage falls back to Rejected on import', () => {
    const r = resolveStage('30 Days', orgStages, { unknownFallback: 'Rejected' });
    expect(r.fallback).toBe(true);
    expect(r.isNew).toBe(false);
    expect(r.label).toBe('Rejected');
    expect(stageKey(r.label)).toBe('REJECTED');
  });

  test('unknown without fallback still marked new', () => {
    const r = resolveStage('30 Days', orgStages);
    expect(r.isNew).toBe(true);
    expect(r.label).toBe('30 Days');
  });

  test('displayStage title-cases free text', () => {
    expect(displayStage('attended interview')).toBe('Attended Interview');
  });

  test('normalizeStageKeys dedupes case variants', () => {
    const { stageKey } = require('../services/pipelineStageSync');
    expect(stageKey('Applied')).toBe(stageKey('APPLIED'));
  });
});
