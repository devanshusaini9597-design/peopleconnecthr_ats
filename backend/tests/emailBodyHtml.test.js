const { convertPlainEmailBody, titleCasePhrase } = require('../utils/emailBodyHtml');

describe('emailBodyHtml', () => {
  it('renders a role card instead of stacked labels', () => {
    const html = convertPlainEmailBody(
      `Dear {{candidateName}},

A new opening is live that may interest you.

Role: SALES OFFICER
Job ID: SKILLNIX-2026-0049
Employer: a leading bank
CTC: 2L-3L
Experience: 0-1 YEARS
Location: CHENNAI

Apply using the link below:
https://www.peopleconnecthr.com/careers/skillnix-recruitment/jobs/vv9d97s5?

Best regards,
Skillnix Recruitment Services`,
      { sampleName: 'Jadhav Kumar', brandColor: '#0f766e' }
    );
    expect(html).toContain('Dear Jadhav Kumar,');
    expect(html).toContain('Opportunity');
    expect(html).toContain('Sales Officer');
    expect(html).toContain('SKILLNIX-2026-0049');
    expect(html).toContain('Chennai');
    expect(html).toContain('0–1 years');
    expect(html).toContain('View role &amp; apply');
    expect(html).not.toMatch(/Role: SALES/);
    expect(html).not.toMatch(/\?/);
  });

  it('title-cases role names', () => {
    expect(titleCasePhrase('SALES OFFICER')).toBe('Sales Officer');
    expect(titleCasePhrase('a leading bank')).toBe('a leading bank');
  });
});
