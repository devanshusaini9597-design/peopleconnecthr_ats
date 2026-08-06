/**
 * Smoke contracts for skillsService.
 */
describe('skillsService contracts', () => {
  it('exports skills helpers', () => {
    const svc = require('../services/skillsService');
    expect(typeof svc.buildSkillsFilter).toBe('function');
    expect(typeof svc.listSkills).toBe('function');
    expect(typeof svc.createSkill).toBe('function');
    expect(typeof svc.seedSkills).toBe('function');
    expect(typeof svc.getCandidateSkills).toBe('function');
    expect(typeof svc.replaceCandidateSkills).toBe('function');
    expect(typeof svc.getJobSkills).toBe('function');
    expect(typeof svc.replaceJobSkills).toBe('function');
    expect(typeof svc.matchSkills).toBe('function');
    expect(typeof svc.updateSkill).toBe('function');
    expect(typeof svc.deleteSkill).toBe('function');
  });
});
