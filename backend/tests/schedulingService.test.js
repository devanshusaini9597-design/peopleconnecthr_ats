/**
 * Smoke contracts for schedulingService.
 */
describe('schedulingService contracts', () => {
  it('exports scheduling helpers', () => {
    const svc = require('../services/schedulingService');
    expect(typeof svc.generateSlots).toBe('function');
    expect(typeof svc.resolveLink).toBe('function');
    expect(typeof svc.getPublicLink).toBe('function');
    expect(typeof svc.bookPublicSlot).toBe('function');
    expect(typeof svc.createSchedulingLink).toBe('function');
    expect(typeof svc.listSchedulingLinks).toBe('function');
  });
});
