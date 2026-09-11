process.env.FRONTEND_URL = 'https://www.peopleconnecthr.com';

describe('emailBrandLayout', () => {
  const {
    identityForFromEmail,
    wrapBrandedEmailHtml,
    loginOtpResendUrl,
    loadPlatformEmailBrand,
  } = require('../services/emailBrandLayout');

  it('uses the connected From domain as the company name', () => {
    expect(identityForFromEmail('noreply@peopleconnecthr.com').name).toBe('People Connect HR');
    expect(identityForFromEmail('noreply@skillnixrecruitment.com').name).toBe(
      'Skillnix Recruitment Services'
    );
    expect(identityForFromEmail('noreply@devlumiq.com').name).toBe('Devlumiq');
    expect(identityForFromEmail('noreply@skillnix.com').name).toBe('Skillnix');
  });

  it('lets MAIL_PROFILE_*_NAME override the mapped company name', () => {
    const prev = process.env.MAIL_PROFILE_PEOPLECONNECTHR_NAME;
    process.env.MAIL_PROFILE_PEOPLECONNECTHR_NAME = 'People Connect HR ATS';
    expect(identityForFromEmail('noreply@peopleconnecthr.com').name).toBe('People Connect HR ATS');
    if (prev === undefined) delete process.env.MAIL_PROFILE_PEOPLECONNECTHR_NAME;
    else process.env.MAIL_PROFILE_PEOPLECONNECTHR_NAME = prev;
  });

  it('matches platform brand to the default Zepto From mailbox', () => {
    const prev = process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL;
    process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL = 'noreply@peopleconnecthr.com';
    expect(loadPlatformEmailBrand().name).toBe('People Connect HR');
    if (prev === undefined) delete process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL;
    else process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL = prev;
  });

  it('renders an enterprise footer with working product links', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Your sign-in code',
      orgName: 'People Connect HR',
      senderEmail: 'noreply@peopleconnecthr.com',
      websiteUrl: 'https://www.peopleconnecthr.com',
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).toContain('People Connect HR');
    expect(html).toContain('Privacy policy');
    expect(html).toContain('Help');
    expect(html).toContain('https://www.peopleconnecthr.com/privacy');
    expect(html).toContain('https://www.peopleconnecthr.com/contact');
    expect(html).toContain('You have received this email because you are registered at People Connect HR, to ensure the implementation of our Terms of Service and (or) for other legitimate matters.');
    expect(html).not.toContain('Sent from');
    expect(html).not.toContain('noreply@peopleconnecthr.com');
  });

  it('uses Skillnix website for Privacy and Help when websiteUrl is set', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Stay connected',
      orgName: 'Skillnix Recruitment Services',
      websiteUrl: 'https://skillnixrecruitment.com',
      bodyHtml: '<p>Hi</p>',
      publicLogo: true,
    });
    expect(html).toContain('https://skillnixrecruitment.com/privacy');
    expect(html).toContain('https://skillnixrecruitment.com/contact');
    expect(html).toContain('https://skillnixrecruitment.com');
    expect(html).not.toContain('peopleconnecthr.com/privacy');
    expect(html).not.toContain('peopleconnecthr.com/contact');
  });

  it('keeps tenant branding even when the sending mailbox is another company', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Your sign-in code',
      orgName: 'Acme Staffing',
      logoUrl: '',
      senderEmail: 'noreply@devlumiq.com',
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).toContain('Acme Staffing');
    expect(html).not.toContain('Skillnix');
    expect(html).not.toContain('Devlumiq');
    expect(html).not.toContain('skillnix-logo');
  });

  it('puts the Skillnix email wordmark in the footer instead of plain text', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Your sign-in code',
      orgName: 'Skillnix Recruitment Services',
      logoUrl: 'https://www.peopleconnecthr.com/skillnix-logo-email.png',
      wordmark: true,
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).toContain('cid:skillnix-logo');
    expect(html.match(/cid:skillnix-logo/g).length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('background-color:#111827');
  });

  it('renders Hostinger-style social icons when profile URLs are set', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Your sign-in code',
      orgName: 'People Connect HR',
      bodyHtml: '<p>Hi</p>',
      socialLinks: {
        linkedin: 'https://www.linkedin.com/company/skillnix-recruitment-services',
        facebook: 'https://www.facebook.com/skillnix',
        instagram: 'https://www.instagram.com/skillnixrecruitment',
        twitter: 'https://x.com/skillnix',
        youtube: 'https://www.youtube.com/@skillnix',
      },
    });
    expect(html).toContain('email-brand/social/linkedin.png');
    expect(html).toContain('email-brand/social/facebook.png');
    expect(html).toContain('email-brand/social/instagram.png');
    expect(html).toContain('email-brand/social/twitter.png');
    expect(html).toContain('email-brand/social/youtube.png');
    expect(html).toContain('https://www.linkedin.com/company/skillnix-recruitment-services');
    expect(html).not.toContain('>LinkedIn<');
  });

  it('does not invent social icons for a tenant with no profiles', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Your sign-in code',
      orgName: 'Acme Staffing',
      bodyHtml: '<p>Hi</p>',
    });
    expect(html).not.toContain('email-brand/social/');
    expect(html).not.toContain('linkedin.com');
  });

  it('builds a working resend deep link for OTP emails', () => {
    const url = loginOtpResendUrl({
      otpToken: 'abc.def',
      email: 'ada@peopleconnecthr.com',
    });
    expect(url.startsWith('https://www.peopleconnecthr.com/login?')).toBe(true);
    expect(url).toContain('otpResend=1');
    expect(url).toContain('otpToken=abc.def');
    expect(url).toContain('email=ada%40peopleconnecthr.com');
  });

  it('builds a working resend deep link for signup OTP emails', () => {
    const { signupOtpResendUrl } = require('../services/emailBrandLayout');
    const url = signupOtpResendUrl({
      signupOtpToken: 'abc.def',
      email: 'ada@acme.com',
    });
    expect(url.startsWith('https://www.peopleconnecthr.com/register?')).toBe(true);
    expect(url).toContain('otpResend=1');
    expect(url).toContain('signupOtpToken=abc.def');
    expect(url).toContain('email=ada%40acme.com');
  });

  it('uses https logo URLs for Zoho Campaigns public HTML (not cid)', () => {
    const html = wrapBrandedEmailHtml({
      title: 'Stay connected',
      orgName: 'Skillnix Recruitment Services',
      logoUrl: 'https://www.peopleconnecthr.com/skillnix-logo-email.png',
      wordmark: true,
      publicLogo: true,
      category: 'marketing',
      bodyHtml: '<p>Hi</p>',
      subscribeCtaHtml: '<a href="https://example.com/sub">Subscribe</a>',
      unsubscribeFooterHtml: '<a href="https://example.com/unsub">Unsubscribe</a>',
    });
    expect(html).not.toContain('cid:skillnix-logo');
    expect(html).toMatch(/https?:\/\/[^"']+skillnix-logo/);
    expect(html).toContain('Subscribe');
    expect(html).toContain('Unsubscribe');
    expect(html).toContain('https://example.com/sub');
    expect(html).toContain('https://example.com/unsub');
  });
});
