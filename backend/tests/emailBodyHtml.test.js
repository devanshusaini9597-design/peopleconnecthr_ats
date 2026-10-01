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
    expect(html).toContain('Position');
    expect(html).toContain('Sales Officer');
    expect(html).toContain('SKILLNIX-2026-0049');
    expect(html).toContain('Chennai');
    expect(html).toContain('0–1 years');
    expect(html).toContain('View role &amp; apply');
    expect(html).toContain('em-card');
    expect(html).toContain('em-btn');
    expect(html).not.toMatch(/Role: SALES/);
    expect(html).toContain('https://www.peopleconnecthr.com/careers/skillnix-recruitment/jobs/vv9d97s5"');
    expect(html).not.toContain('vv9d97s5?');
  });

  it('uses Role details header when job title is missing', () => {
    const html = convertPlainEmailBody(
      `Dear there,

Employer: a confidential hiring partner
Location: Remote

Best regards,
Skillnix`,
      { brandColor: '#0f766e' }
    );
    expect(html).toContain('Dear Candidate,');
    expect(html).toContain('Role details');
    expect(html).not.toContain('>Position<');
    expect(html).toContain('a confidential hiring partner');
  });

  it('keeps Role / Employer / Location in one card even with blank lines between', () => {
    const html = convertPlainEmailBody(
      `Dear Candidate,

I am writing to share a new opening that may align with your experience.

Position: Cbh

Employer: a confidential hiring partner

Location: Hyderabad

Best regards,
Skillnix`,
      { brandColor: '#7c3aed' }
    );
    expect(html).toContain('Position');
    expect(html).toContain('Cbh');
    expect(html).toContain('Employer');
    expect(html).toContain('Location');
    expect(html).toContain('Hyderabad');
    // One opportunity card — not repeated Role details headers
    expect((html.match(/Role details/g) || []).length).toBe(0);
    expect((html.match(/em-card/g) || []).length).toBe(1);
  });

  it('title-cases role names', () => {
    expect(titleCasePhrase('SALES OFFICER')).toBe('Sales Officer');
    expect(titleCasePhrase('a leading bank')).toBe('a leading bank');
  });
});
