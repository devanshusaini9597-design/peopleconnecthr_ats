/**
 * Smoke contracts for newly thinned route services.
 */
describe('approvalService contracts', () => {
  it('exports approval helpers', () => {
    const svc = require('../services/approvalService');
    expect(typeof svc.listWorkflows).toBe('function');
    expect(typeof svc.createWorkflow).toBe('function');
    expect(typeof svc.updateWorkflow).toBe('function');
    expect(typeof svc.listInstances).toBe('function');
    expect(typeof svc.submitForApproval).toBe('function');
    expect(typeof svc.approveInstance).toBe('function');
    expect(typeof svc.rejectInstance).toBe('function');
  });
});

describe('billingService contracts', () => {
  it('exports billing helpers and plans catalog shape', () => {
    const svc = require('../services/billingService');
    expect(typeof svc.getBillingStatus).toBe('function');
    expect(typeof svc.getPlansCatalog).toBe('function');
    expect(typeof svc.listOrgInvoices).toBe('function');
    expect(typeof svc.createCheckout).toBe('function');
    expect(typeof svc.createPortal).toBe('function');
    expect(typeof svc.cancelOrgSubscription).toBe('function');
    expect(typeof svc.getUsageAddons).toBe('function');
    expect(typeof svc.incrementUsageAddon).toBe('function');

    const plans = svc.getPlansCatalog();
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.map((p) => p.id)).toEqual(
      expect.arrayContaining(['free_trial', 'starter', 'professional', 'enterprise'])
    );
  });
});

describe('chatbotService contracts', () => {
  it('exports chatbot helpers', () => {
    const svc = require('../services/chatbotService');
    expect(typeof svc.getAdminSettings).toBe('function');
    expect(typeof svc.updateAdminSettings).toBe('function');
    expect(typeof svc.getPublicConfig).toBe('function');
    expect(typeof svc.ask).toBe('function');
  });
});

describe('offerTemplateService contracts', () => {
  it('exports template helpers and renderMerge', () => {
    const svc = require('../services/offerTemplateService');
    expect(typeof svc.renderMerge).toBe('function');
    expect(typeof svc.listTemplates).toBe('function');
    expect(typeof svc.createTemplate).toBe('function');
    expect(typeof svc.updateTemplate).toBe('function');
    expect(typeof svc.deleteTemplate).toBe('function');
    expect(typeof svc.renderTemplate).toBe('function');
    expect(typeof svc.sendTemplate).toBe('function');

    const out = svc.renderMerge('Hello {{candidate.name}}', {
      candidate: { name: 'Ada' }
    });
    expect(out).toBe('Hello Ada');
  });
});

describe('deiService contracts', () => {
  it('exports DEI helpers', () => {
    const svc = require('../services/deiService');
    expect(typeof svc.getSettings).toBe('function');
    expect(typeof svc.updateSettings).toBe('function');
    expect(typeof svc.getMetrics).toBe('function');
    expect(typeof svc.recordSelfId).toBe('function');
    expect(typeof svc.getBlindMode).toBe('function');
  });
});

describe('publicSubscribeService contracts', () => {
  it('exports subscribe helpers', () => {
    const svc = require('../services/publicSubscribeService');
    expect(typeof svc.subscribe).toBe('function');
    expect(typeof svc.confirmSubscribe).toBe('function');
    expect(typeof svc.unsubscribe).toBe('function');
    expect(typeof svc.confirmUnsubscribe).toBe('function');
  });
});
