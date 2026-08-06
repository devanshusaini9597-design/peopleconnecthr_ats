/**
 * Smoke contracts for organizationService.
 */
describe('organizationService contracts', () => {
  it('exports org/member/audit helpers', () => {
    const svc = require('../services/organizationService');
    expect(typeof svc.getOrganization).toBe('function');
    expect(typeof svc.updateOrganization).toBe('function');
    expect(typeof svc.getCandidateFields).toBe('function');
    expect(typeof svc.listMembers).toBe('function');
    expect(typeof svc.listAuditLog).toBe('function');
    expect(typeof svc.exportAuditLogCsv).toBe('function');
  });
});

describe('companyEmailSettingsService contracts', () => {
  it('exports company email helpers', () => {
    const svc = require('../services/companyEmailSettingsService');
    expect(typeof svc.getCompanyEmailConfig).toBe('function');
    expect(typeof svc.saveZohoConfig).toBe('function');
    expect(typeof svc.saveSmtpConfig).toBe('function');
    expect(typeof svc.testCompanyEmailConfig).toBe('function');
    expect(typeof svc.clearCompanyEmailConfig).toBe('function');
  });
});
