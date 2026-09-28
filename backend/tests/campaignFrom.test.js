const {
  collectCampaignFromCandidates,
  isAllowedCampaignFrom,
  sharedCampaignFromAddress,
  sharedCampaignFromOrgDomains,
  plusTagReplyTo,
  appendCampaignOwnerStamp,
  campaignFromDisplayName,
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
    expect(isAllowedCampaignFrom('team@skillnixrecruitment.com')).toBe(true);
    expect(isAllowedCampaignFrom('devanshusaini9597@gmail.com')).toBe(false);
  });

  it('uses shared team@ domain mapping for skillnixrecruitment.com', () => {
    delete process.env.ZOHO_CAMPAIGNS_FROM_SKILLNIXRECRUITMENT_COM;
    delete process.env.MAIL_PROFILE_SKILLNIXRECRUITMENT_FROM;
    delete process.env.ZOHO_CAMPAIGNS_SHARED_FROM_ORG_DOMAINS;
    expect(sharedCampaignFromOrgDomains().has('skillnixrecruitment.com')).toBe(true);
    expect(sharedCampaignFromAddress('skillnixrecruitment.com')).toBe(
      'team@skillnixrecruitment.com'
    );
  });

  it('Skillnix mode: From is the shared mailbox, not the employee login', () => {
    delete process.env.ZOHO_CAMPAIGNS_VERIFIED_SENDERS;
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
      sharedFrom: 'team@skillnixrecruitment.com',
    });
    expect(list).toEqual(['team@skillnixrecruitment.com']);
  });

  it('non-shared mode: login email only', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'asmita@skillnixrecruitment.com',
      userEmail: 'asmita@skillnixrecruitment.com',
    });
    expect(list).toEqual(['asmita@skillnixrecruitment.com']);
  });

  it('Gmail login still sends From the shared mailbox', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'devanshusaini9597@gmail.com',
      userEmail: 'devanshusaini9597@gmail.com',
      sharedFrom: 'team@skillnixrecruitment.com',
    });
    expect(list).toEqual(['team@skillnixrecruitment.com']);
  });

  it('rejects Gmail when there is no shared From', () => {
    const list = collectCampaignFromCandidates({
      fromEmail: 'devanshusaini9597@gmail.com',
      userEmail: 'devanshusaini9597@gmail.com',
    });
    expect(list).toEqual([]);
  });

  it('tags the shared mailbox so Zoho Mail can forward replies per employee', () => {
    expect(plusTagReplyTo('team@skillnixrecruitment.com', 'asmita@skillnixrecruitment.com'))
      .toBe('team+asmita@skillnixrecruitment.com');
    expect(plusTagReplyTo('team@skillnixrecruitment.com', 'team@skillnixrecruitment.com'))
      .toBe('team@skillnixrecruitment.com');
  });

  it('shared mailbox From display is the company, not the employee', () => {
    expect(campaignFromDisplayName({
      sharedFrom: true,
      orgName: 'Skillnix Recruitment Services',
      senderName: 'ROHIT RAJBHAR',
      userName: 'ROHIT RAJBHAR',
    })).toBe('Skillnix Recruitment Services');
    expect(campaignFromDisplayName({
      sharedFrom: false,
      senderName: 'ROHIT RAJBHAR',
      orgName: 'Skillnix Recruitment Services',
    })).toBe('ROHIT RAJBHAR');
  });

  it('adds a hidden owner marker, not a visible Kind regards stamp', () => {
    const html = appendCampaignOwnerStamp('<p>Hello</p></body>', {
      name: 'Sarbjeet Singh',
      email: 'sarbjeet@skillnixrecruitment.com',
    });
    expect(html).toContain('pc-hiring-contact:sarbjeet@skillnixrecruitment.com');
    expect(html).not.toContain('Hiring contact:');
    expect(html).not.toContain('Kind regards');
    expect(html).not.toContain('Sarbjeet Singh');
  });
});
