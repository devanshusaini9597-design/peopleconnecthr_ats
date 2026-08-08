/**
 * Smoke contracts for inbox / email / assessment services.
 */
describe('inboxService contracts', () => {
  it('exports inbox helpers', () => {
    const svc = require('../services/inboxService');
    expect(typeof svc.getInboxStats).toBe('function');
    expect(typeof svc.listThreads).toBe('function');
    expect(typeof svc.createOutbound).toBe('function');
    expect(typeof svc.markThreadRead).toBe('function');
  });
});

describe('emailOutboundService contracts', () => {
  it('exports outbound helpers', () => {
    const svc = require('../services/emailOutboundService');
    expect(typeof svc.sendTypedEmail).toBe('function');
    expect(typeof svc.buildEmailPreview).toBe('function');
    expect(typeof svc.getEmailChannels).toBe('function');
  });

  it('buildEmailPreview requires valid type', () => {
    const { buildEmailPreview } = require('../services/emailOutboundService');
    expect(() => buildEmailPreview({ emailType: 'nope' })).toThrow(/Invalid email type/);
    const preview = buildEmailPreview({ emailType: 'interview', name: 'Ada', position: 'Eng' });
    expect(preview.subject).toMatch(/Interview/);
    expect(preview.html).toContain('Ada');
  });
});

describe('assessmentService contracts', () => {
  it('exports assessment helpers', () => {
    const svc = require('../services/assessmentService');
    expect(typeof svc.takeAssessment).toBe('function');
    expect(typeof svc.createAssessment).toBe('function');
    expect(typeof svc.inviteCandidate).toBe('function');
    expect(typeof svc.gradeInvite).toBe('function');
  });
});
