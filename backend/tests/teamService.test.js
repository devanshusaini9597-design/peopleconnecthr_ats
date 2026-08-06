/**
 * Team domain helpers — email domain validation + invite contracts.
 */
const teamService = require('../services/teamService');
const {
  isValidCompanyEmail,
  getCompanyDomain,
  inviteTeamMember,
  listTeamMembers,
  listPendingInvitations,
  updateTeamMember,
  deleteTeamMember,
  acceptInvitation,
  declineInvitation,
  DEFAULT_COMPANY_DOMAIN,
} = teamService;

describe('teamService', () => {
  describe('exports', () => {
    it('exposes roster / invite lifecycle helpers', () => {
      expect(typeof listTeamMembers).toBe('function');
      expect(typeof listPendingInvitations).toBe('function');
      expect(typeof updateTeamMember).toBe('function');
      expect(typeof deleteTeamMember).toBe('function');
      expect(typeof acceptInvitation).toBe('function');
      expect(typeof declineInvitation).toBe('function');
      expect(typeof inviteTeamMember).toBe('function');
      expect(typeof getCompanyDomain).toBe('function');
      expect(typeof isValidCompanyEmail).toBe('function');
    });
  });

  describe('isValidCompanyEmail', () => {
    it('allows any email when company domain is unset', () => {
      expect(isValidCompanyEmail('a@b.com', null)).toEqual({
        valid: true,
        isCompanyEmail: false,
      });
    });

    it('requires matching company domain when set', () => {
      const info = { domain: 'acme.com', allowedDomains: ['partner.com'] };
      expect(isValidCompanyEmail('x@acme.com', info)).toEqual({
        valid: true,
        isCompanyEmail: true,
      });
      expect(isValidCompanyEmail('x@partner.com', info)).toEqual({
        valid: true,
        isCompanyEmail: true,
      });
      expect(isValidCompanyEmail('x@gmail.com', info).valid).toBe(false);
    });

    it('rejects malformed emails', () => {
      expect(isValidCompanyEmail('not-an-email', { domain: 'acme.com' }).valid).toBe(false);
    });
  });

  describe('getCompanyDomain', () => {
    it('falls back to default SkillNix domain', async () => {
      const info = await getCompanyDomain('000000000000000000000000');
      expect(info.domain).toBe(DEFAULT_COMPANY_DOMAIN);
      expect(info.companyName).toBeTruthy();
    });
  });

  describe('inviteTeamMember', () => {
    it('requires name and email', async () => {
      await expect(
        inviteTeamMember({ id: 'u1', email: 'a@b.com' }, { name: 'Only' })
      ).rejects.toMatchObject({ message: 'Name and email are required', statusCode: 400 });
    });

    it('rejects invalid email format', async () => {
      await expect(
        inviteTeamMember({ id: 'u1', email: 'a@b.com' }, { name: 'A', email: 'bad' })
      ).rejects.toMatchObject({ message: 'Invalid email address', statusCode: 400 });
    });
  });
});
