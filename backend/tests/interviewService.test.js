/**
 * Smoke contracts for interviewService.
 */
describe('interviewService contracts', () => {
  it('exports interview helpers', () => {
    const svc = require('../services/interviewService');
    expect(typeof svc.listInterviews).toBe('function');
    expect(typeof svc.listMyInterviews).toBe('function');
    expect(typeof svc.getInterview).toBe('function');
    expect(typeof svc.createInterview).toBe('function');
    expect(typeof svc.updateInterview).toBe('function');
    expect(typeof svc.cancelInterview).toBe('function');
    expect(typeof svc.completeInterview).toBe('function');
    expect(typeof svc.listScorecards).toBe('function');
    expect(typeof svc.submitScorecard).toBe('function');
    expect(typeof svc.updateScorecard).toBe('function');
  });
});
