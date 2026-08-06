/**
 * Smoke contracts for sequenceService.
 */
describe('sequenceService contracts', () => {
  it('exports sequence helpers', () => {
    const svc = require('../services/sequenceService');
    expect(typeof svc.interpolate).toBe('function');
    expect(typeof svc.sendStep).toBe('function');
    expect(typeof svc.listSequences).toBe('function');
    expect(typeof svc.createSequence).toBe('function');
    expect(typeof svc.updateSequence).toBe('function');
    expect(typeof svc.deleteSequence).toBe('function');
    expect(typeof svc.enrollCandidates).toBe('function');
    expect(typeof svc.listEnrollments).toBe('function');
    expect(typeof svc.processDueEnrollments).toBe('function');
  });
});
