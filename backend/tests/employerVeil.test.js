const { veiledEmployer, stripClientName, outboundCompany, jobEmailSummary, cleanApplyUrl } = require('../utils/employerVeil');

describe('employerVeil', () => {
  it('never puts the client brand in outbound copy', () => {
    expect(veiledEmployer('BANKING', 'AXIS BANK')).toBe('a leading bank');
    expect(veiledEmployer('Insurance', 'HDFC Life')).toBe('a leading insurance company');
    expect(stripClientName('Client Name - AXIS BANK. Sales officer in Chennai.', 'AXIS BANK'))
      .not.toMatch(/AXIS BANK/i);
  });

  it('uses the recruiting organization for company / sign-off', () => {
    expect(outboundCompany({ company: 'a leading bank', jobClient: 'AXIS BANK' }, 'Skillnix Recruitment Services'))
      .toBe('Skillnix Recruitment Services');
  });

  it('drops pasted JD dumps from mail summaries', () => {
    expect(jobEmailSummary(
      'Job Title: SALES OFFICER Industry: BANKING Employment Type: FULL-TIME Locations: CHENNAI',
      'AXIS BANK'
    )).toBe('');
  });

  it('strips a trailing question mark from apply URLs', () => {
    expect(cleanApplyUrl('https://www.peopleconnecthr.com/careers/skillnix-recruitment/jobs/vv9d97s5?'))
      .toBe('https://www.peopleconnecthr.com/careers/skillnix-recruitment/jobs/vv9d97s5');
  });
});
