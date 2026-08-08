describe('talentPoolService contracts', () => {
  it('exports pool CRUD and campaign helpers', () => {
    const svc = require('../services/talentPoolService');
    expect(typeof svc.listPools).toBe('function');
    expect(typeof svc.createPool).toBe('function');
    expect(typeof svc.updatePool).toBe('function');
    expect(typeof svc.suggestCandidates).toBe('function');
    expect(typeof svc.runCampaign).toBe('function');
    expect(typeof svc.deletePool).toBe('function');
    expect(typeof svc.listPoolCandidates).toBe('function');
    expect(typeof svc.addCandidates).toBe('function');
    expect(typeof svc.removeCandidate).toBe('function');
  });
});

describe('emailTemplateService contracts', () => {
  it('exports template CRUD and seed helpers', () => {
    const svc = require('../services/emailTemplateService');
    expect(typeof svc.listTemplates).toBe('function');
    expect(typeof svc.ensureSubscribe).toBe('function');
    expect(typeof svc.getTemplate).toBe('function');
    expect(typeof svc.createTemplate).toBe('function');
    expect(typeof svc.updateTemplate).toBe('function');
    expect(typeof svc.deleteTemplate).toBe('function');
    expect(typeof svc.seedDefaults).toBe('function');
  });
});
