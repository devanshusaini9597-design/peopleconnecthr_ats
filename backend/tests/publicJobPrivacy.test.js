const { publicDomainLabel, scrubPublicJobHtml, publicEmployerLabel, isOwnCompanyHire } = require('../utils/publicJobPrivacy');

describe('public job privacy', () => {
  it('maps industry to a title-cased domain line instead of a client name', () => {
    expect(publicDomainLabel('BFSI')).toBe('For A Leading Bank');
    expect(publicDomainLabel('LIFE INSURANCE')).toBe('For A Leading Life Insurance Company');
    expect(publicDomainLabel('BANKING')).toBe('For A Leading Bank');
  });

  it('shows the organisation name for own-company hires', () => {
    expect(isOwnCompanyHire('', 'SKILLNIX RECRUITMENT SERVICES')).toBe(true);
    expect(isOwnCompanyHire('Skillnix Recruitment Services', 'SKILLNIX RECRUITMENT SERVICES')).toBe(true);
    expect(isOwnCompanyHire('HDFC BANK', 'SKILLNIX RECRUITMENT SERVICES')).toBe(false);
    expect(publicEmployerLabel({
      industry: 'LIFE INSURANCE',
      clientName: '',
      orgName: 'SKILLNIX RECRUITMENT SERVICES',
    })).toBe('Skillnix Recruitment Services');
    expect(publicEmployerLabel({
      industry: 'LIFE INSURANCE',
      clientName: 'HDFC LIFE',
      orgName: 'SKILLNIX RECRUITMENT SERVICES',
    })).toBe('For A Leading Life Insurance Company');
  });

  it('strips client-name rows from public JD html', () => {
    const html = '<p><strong>Client Name:</strong> HDFC BANK</p><p>Sell home loans.</p>';
    expect(scrubPublicJobHtml(html, 'HDFC BANK')).toBe('<p>Sell home loans.</p>');
    expect(scrubPublicJobHtml(html, 'HDFC BANK')).not.toMatch(/HDFC/i);
  });
});
