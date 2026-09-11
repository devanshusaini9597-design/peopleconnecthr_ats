const { resolveSystemFromAddress } = require('../services/emailService');

describe('resolveSystemFromAddress', () => {
  it('uses noreply@org-domain when that domain is verified on the mailbox', () => {
    expect(
      resolveSystemFromAddress({
        mailbox: {
          fromEmail: 'noreply@devlumiq.com',
          allowedFromDomains: ['devlumiq.com', 'skillnixrecruitment.com'],
        },
        orgDomain: 'skillnixrecruitment.com',
      })
    ).toBe('noreply@skillnixrecruitment.com');
  });

  it('keeps the agent address when the org domain is not verified', () => {
    expect(
      resolveSystemFromAddress({
        mailbox: {
          fromEmail: 'noreply@devlumiq.com',
          allowedFromDomains: ['devlumiq.com'],
        },
        orgDomain: 'skillnixrecruitment.com',
      })
    ).toBe('noreply@devlumiq.com');
  });

  it('uses the agent domain when it already matches the org', () => {
    expect(
      resolveSystemFromAddress({
        mailbox: {
          fromEmail: 'noreply@skillnixrecruitment.com',
          allowedFromDomains: ['skillnixrecruitment.com'],
        },
        userEmail: 'sarbjeet@skillnixrecruitment.com',
      })
    ).toBe('noreply@skillnixrecruitment.com');
  });
});
