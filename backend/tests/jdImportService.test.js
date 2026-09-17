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

  it('extracts flattened bank JD paste with Designation and Grade', () => {
    const parsed = parseJdText(
      'Prepared by: Ankur Jain Ref. No.: Role Description Designation: Business Development Manager Grade: EB3/EB4 Legal Entity: Equitas Small Finance Bank Business Unit: Retail Banking Division: Branch Banking Department: Liability Sales Travel required: Yes Level of travel: Extensive Level: Managerial Job Dimension Reporting To Branch Manager Direct Reports 6 Indirect Reports 0 Geographic spread 01 Retail Branch Banking offices Purpose of the role: Responsible for selling banking products to its retail customers. Team Building Key Responsibilities: Achieving assigned month on month target, acquiring NTB, campaign activities, zero fraud compliance. Desired Experience & Qualification: 4-6 years of experience in sales. Type of companies/sector worked for: Banking Graduation: Must ( Any Graduation )'
    );
    expect(parsed.role).toMatch(/Business Development Manager/i);
    expect(parsed.grade).toMatch(/EB3\/EB4/i);
    expect(parsed.clientName).toMatch(/Equitas Small Finance Bank/i);
    expect(parsed.department).toMatch(/Liability Sales/i);
    expect(parsed.experience).toMatch(/4-6\s*years/i);
    expect(parsed.industry).toMatch(/Banking/i);
    expect(parsed.responsibilities.length + parsed.summary.length).toBeGreaterThan(40);
  });
});
