const { jobCampaignFields } = require('../services/applicationService');

describe('jobCampaignFields', () => {
  it('fills summary from the JD when summary is blank, and keeps CTC', () => {
    const fields = jobCampaignFields({
      title: 'SALES OFFICER',
      jobCode: 'SKILLNIX-2026-0049',
      location: 'CHENNAI',
      clientName: 'AXIS BANK',
      experience: '0-1 YEARS',
      ctc: '2L-3L',
      summary: '',
      description: 'Job Title: SALES OFFICER. Client Name - AXIS BANK. Industry: BANKING. CTC: 2L-3L. Locations: CHENNAI.',
    });
    expect(fields.jobTitle).toBe('SALES OFFICER');
    expect(fields.jobCode).toBe('SKILLNIX-2026-0049');
    expect(fields.jobClient).toBe('a leading bank');
    expect(fields.jobCtc).toBe('2L-3L');
    expect(fields.jobLocation).toMatch(/CHENNAI/i);
    expect(fields.jobSummary).toBe('');
    expect(JSON.stringify(fields)).not.toMatch(/AXIS BANK/i);
  });
});
