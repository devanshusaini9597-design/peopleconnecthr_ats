const {
  collectCampaignFromCandidates,
  isAllowedCampaignFrom,
} = require('../services/campaignService');

describe('campaign From resolution', () => {
  const origFrom = process.env.ZOHO_CAMPAIGNS_FROM_EMAIL;

  afterEach(() => {
    if (origFrom == null) delete process.env.ZOHO_CAMPAIGNS_FROM_EMAIL;
    else process.env.ZOHO_CAMPAIGNS_FROM_EMAIL = origFrom;
  });

  it('allows Skillnix work domains and rejects Gmail', () => {
    expect(isAllowedCampaignFrom('asmita@skillnixrecruitment.com')).toBe(true);
    expect(isAllowedCampaignFrom('owner@peopleconnecthr.com')).toBe(true);
    expect(isAllowedCampaignFrom('devanshusaini9597@gmail.com')).toBe(false);
  });

  it('puts org verified sender first, teammate second (like ZeptoMail)', () => {
    process.env.ZOHO_CAMPAIGNS_FROM_EMAIL = 'noreply@skillnixrecruitment.com';
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
      orgFrom: 'owner@skillnixrecruitment.com',
      ownerEmail: 'owner@skillnixrecruitment.com',
    });
    // Owner/org sender should be first (verified in Zoho Campaigns)
    expect(list[0]).toBe('owner@skillnixrecruitment.com');
    // Teammate email should still be in the list
    expect(list).toContain('asmita@skillnixrecruitment.com');
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('dedupes the same mailbox', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'Owner@skillnixrecruitment.com',
      userEmail: 'owner@skillnixrecruitment.com',
      orgFrom: 'owner@skillnixrecruitment.com',
    });
    expect(list).toEqual(['owner@skillnixrecruitment.com']);
  });

  it('uses ownerEmail as primary sender for non-owner teammates', () => {
    delete process.env.ZOHO_CAMPAIGNS_FROM_EMAIL;
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
      orgFrom: '',
      ownerEmail: 'owner@skillnixrecruitment.com',
    });
    // Owner email is first (it's the verified sender)
    expect(list[0]).toBe('owner@skillnixrecruitment.com');
    // Teammate email is after (may not be individually verified)
    expect(list).toContain('asmita@skillnixrecruitment.com');
    expect(list.length).toBe(2);
  });

  it('does not duplicate ownerEmail if it matches fromEmail', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'owner@skillnixrecruitment.com',
      userEmail: 'owner@skillnixrecruitment.com',
      orgFrom: '',
      ownerEmail: 'owner@skillnixrecruitment.com',
    });
    expect(list).toEqual(['owner@skillnixrecruitment.com']);
  });

  it('rejects ownerEmail from non-allowed domain', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
      orgFrom: '',
      ownerEmail: 'owner@gmail.com',
    });
    expect(list).toEqual(['asmita@skillnixrecruitment.com']);
  });
});
