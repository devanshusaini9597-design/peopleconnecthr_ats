/**
 * Smoke contracts for organizationService.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { resetMemberPassword, generateTempPassword } = require('../services/organizationService');

jest.mock('../services/sessionService', () => ({
  revokeAllSessionsForUser: jest.fn().mockResolvedValue(1),
  revokeOtherSessions: jest.fn().mockResolvedValue(1),
}));

jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../services/emailBrandLayout', () => ({
  wrapBrandedEmailHtml: jest.fn(({ bodyHtml }) => bodyHtml || '<html/>'),
  brandButtonHtml: jest.fn(() => '<a>Sign in</a>'),
  loadSendingEmailBrand: jest.fn().mockResolvedValue({
    name: 'Test Org',
    logoUrl: '',
    brandColor: '#0f766e',
    wordmark: 'Test',
    fromEmail: 'noreply@test.example',
    websiteUrl: '',
    supportEmail: '',
    socialLinks: [],
  }),
  escapeHtml: (s) => String(s || ''),
}));

describe('organizationService contracts', () => {
  it('exports org/member/audit helpers', () => {
    const svc = require('../services/organizationService');
    expect(typeof svc.getOrganization).toBe('function');
    expect(typeof svc.updateOrganization).toBe('function');
    expect(typeof svc.getCandidateFields).toBe('function');
    expect(typeof svc.listMembers).toBe('function');
    expect(typeof svc.resetMemberPassword).toBe('function');
    expect(typeof svc.listAuditLog).toBe('function');
    expect(typeof svc.exportAuditLogCsv).toBe('function');
    expect(typeof svc.renamePipelineStage).toBe('function');
    expect(typeof svc.mergePipelineStages).toBe('function');
  });
});

describe('resetMemberPassword', () => {
  it('generates a strong temporary password', () => {
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(12);
    expect(generateTempPassword()).toMatch(/^Tmp-/);
  });

  it('lets an owner reset a teammate and refuses self-reset', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const orgId = new mongoose.Types.ObjectId();
    const stamp = Date.now();
    const owner = await User.create({
      name: 'OWNER TEST',
      email: `owner-${stamp}@example.test`,
      password: 'Password123!',
      organizationId: orgId,
      role: 'owner',
      isEmailVerified: true,
    });
    const recruiter = await User.create({
      name: 'REC TEST',
      email: `rec-${stamp}@example.test`,
      password: 'OldPass123!',
      organizationId: orgId,
      role: 'hr_recruiter',
      isEmailVerified: true,
    });

    await expect(
      resetMemberPassword(orgId, { id: String(owner._id), role: 'owner' }, String(owner._id))
    ).rejects.toThrow(/own password/);

    const result = await resetMemberPassword(
      orgId,
      { id: String(owner._id), role: 'owner' },
      String(recruiter._id)
    );
    expect(result.email).toBe(recruiter.email);
    expect(result.temporaryPassword).toMatch(/^Tmp-/);
    expect(result.emailSent).toBe(true);

    const reloaded = await User.findById(recruiter._id);
    expect(reloaded.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(result.temporaryPassword, reloaded.password)).toBe(true);
  });

  it('does not let an admin reset the owner', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const orgId = new mongoose.Types.ObjectId();
    const stamp = Date.now();
    const owner = await User.create({
      name: 'OWNER TWO',
      email: `owner2-${stamp}@example.test`,
      password: 'Password123!',
      organizationId: orgId,
      role: 'owner',
      isEmailVerified: true,
    });
    const admin = await User.create({
      name: 'ADMIN TWO',
      email: `admin2-${stamp}@example.test`,
      password: 'Password123!',
      organizationId: orgId,
      role: 'admin',
      isEmailVerified: true,
    });
    await expect(
      resetMemberPassword(orgId, { id: String(admin._id), role: 'admin' }, String(owner._id))
    ).rejects.toThrow(/Only the owner/);
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
