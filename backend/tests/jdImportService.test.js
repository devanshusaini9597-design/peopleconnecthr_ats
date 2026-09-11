const { parseJdText } = require('../services/jdImportService');

describe('parseJdText', () => {
  it('splits agency JD sections and metadata', () => {
    const parsed = parseJdText(`
ASSISTANT BRANCH HEAD
Job Title: ASSISTANT BRANCH HEAD
Client Name - EQUITAS
Locations: DELHI, DEHRADUN
Skills: LIFE INSURANCE, SALES

## Job Summary
We are looking for an experienced branch head.

## Key Responsibilities
* Drive branch sales
* Lead the team

## Candidate Requirements
* Minimum 2 years in life insurance

## Preferred Candidate Profile
Consistent performers preferred
`);
    expect(parsed.role).toMatch(/ASSISTANT BRANCH HEAD/i);
    expect(parsed.clientName).toMatch(/EQUITAS/i);
    expect(parsed.locations).toEqual(expect.arrayContaining(['DELHI', 'DEHRADUN']));
    expect(parsed.skills.join(' ')).toMatch(/LIFE INSURANCE/i);
    expect(parsed.summary).toMatch(/experienced branch head/i);
    expect(parsed.responsibilities).toMatch(/Drive branch sales/i);
    expect(parsed.requirements).toMatch(/life insurance/i);
    expect(parsed.preferred).toMatch(/Consistent/i);
  });
});
