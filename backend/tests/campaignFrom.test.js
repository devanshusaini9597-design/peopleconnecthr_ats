const {
  collectCampaignFromCandidates,
  isAllowedCampaignFrom,
  sharedCampaignFromAddress,
  sharedCampaignFromOrgDomains,
} = require('../services/campaignService');

describe('campaign From resolution', () => {
  const origFrom = process.env.ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM;
  const origShared = process.env.ZOHO_CAMPAIGNS_SHARED_FROM_ORG_DOMAINS;
  const origProfile = process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM;
  const origVerified = process.env.ZOHO_CAMPAIGNS_VERIFIED_SENDERS;

  afterEach(() => {
    if (origFrom == null) delete process.env.ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM;
    else process.env.ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM = origFrom;
    if (origShared == null) delete process.env.ZOHO_CAMPAIGNS_SHARED_FROM_ORG_DOMAINS;
    else process.env.ZOHO_CAMPAIGNS_SHARED_FROM_ORG_DOMAINS = origShared;
    if (origProfile == null) delete process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM;
    else process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM = origProfile;
    if (origVerified == null) delete process.env.ZOHO_CAMPAIGNS_VERIFIED_SENDERS;
    else process.env.ZOHO_CAMPAIGNS_VERIFIED_SENDERS = origVerified;
  });

  it('allows Skillnix work domains and rejects Gmail', () => {
    expect(isAllowedCampaignFrom('asmita@skillnixrecruitment.com')).toBe(true);
    expect(isAllowedCampaignFrom('alert@skillnixrecruitment.com')).toBe(true);
    expect(isAllowedCampaignFrom('devanshusaini9597@gmail.com')).toBe(false);
  });

  it('uses shared alert@ domain mapping for skillnixrecruitment.com', () => {
    delete process.env.ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM;
    delete process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM;
    delete process.env.ZOHO_CAMPAIGNS_SHARED_FROM_ORG_DOMAINS;
    expect(sharedCampaignFromOrgDomains().has('skillnixrecruitment.com')).toBe(true);
    expect(sharedCampaignFromAddress('skillnixrecruitment.com')).toBe(
      'alert@skillnixrecruitment.com'
    );
  });

  it('Skillnix mode: From candidates are login only (no alert@ fallback)', () => {
    delete process.env.ZOHO_CAMPAIGNS_VERIFIED_SENDERS;
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
      sharedFrom: 'alert@skillnixrecruitment.com',
    });
    expect(list).toEqual(['asmita@skillnixrecruitment.com']);
  });

  it('non-shared mode: login email only', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
    });
    expect(list).toEqual(['asmita@skillnixrecruitment.com']);
  });

  it('rejects Gmail login for campaigns', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'devanshusaini9597@gmail.com',
      userEmail: 'devanshusaini9597@gmail.com',
    });
    expect(list).toEqual([]);
  });
});
