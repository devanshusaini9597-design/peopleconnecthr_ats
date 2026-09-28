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
    expect(parsed.locations.map((v) => v.toUpperCase())).toEqual(
      expect.arrayContaining(['DELHI', 'DEHRADUN'])
    );
    expect(parsed.skills.join(' ')).toMatch(/LIFE INSURANCE/i);
    expect(parsed.summary).toMatch(/experienced branch head/i);
    expect(parsed.responsibilities).toMatch(/Drive branch sales/i);
    expect(parsed.requirements).toMatch(/life insurance/i);
    expect(parsed.preferred).toMatch(/Consistent/i);
  });

  it('extracts flattened bank JD paste with Designation and Grade', () => {
    const parsed = parseJdText(
      'Prepared by: Ankur Jain Ref. No.: Role Description Designation: Business Development Manager Grade: EB3/EB4 Legal Entity: Equitas Small Finance Bank Business Unit: Retail Banking Division: Branch Banking Department: Liability Sales Travel required: Yes Level of travel: Extensive Level: Managerial Job Dimension Reporting To Branch Manager Direct Reports 6 Indirect Reports 0 Geographic spread 01 Retail Branch Banking offices Purpose of the role: Responsible for selling banking products to its retail customers. Team Building Key Responsibilities: Achieving assigned month on month target, acquiring NTB, campaign activities, zero fraud compliance. Desired Experience & Qualification: 4-6 years of experience in sales. Type of companies/sector worked for: Banking Graduation: Must ( Any Graduation ) Location: Delhi, Noida'
    );
    expect(parsed.role).toMatch(/Business Development Manager/i);
    expect(parsed.grade).toMatch(/EB3\/EB4/i);
    expect(parsed.clientName).toMatch(/Equitas Small Finance Bank/i);
    expect(parsed.department).toMatch(/Liability Sales/i);
    expect(parsed.experience).toMatch(/4-6\s*years/i);
    expect(parsed.locations.join(' ').toUpperCase()).toMatch(/DELHI/i);
    expect(parsed.responsibilities.length + parsed.summary.length).toBeGreaterThan(40);
  });

  it('parses Premium Account Manager JD without client-facing false positives', () => {
    const parsed = parseJdText(`JOB DIMENSIONS Job Title: Premium Account Manager Location : NA Function: Sales/BD Department: Retail Branch Banking Typical Grade: Assistant Manager/ Deputy Manager CTC : NA Reporting Manager: NA Direct Reports: NA JOB SUMMARY As a Client Access and Support Analyst (CASA), you will leverage your experience in Privileged Access Management (PAM) to ensure efficient, secure, and user-friendly access to our systems and services. You will be responsible for managing client access requests, providing technical support, and ensuring compliance with security policies. This role involves close collaboration with IT, security, and client-facing teams to enhance client satisfaction and system security. KEY RESPONSIBILITIES Client Access Management: Process and validate client access requests. EDUCATION and EXPERIENCE Experience: 3 years of experience in sales, preferably in CASA. Education: Bachelor's degree. Location Location : Hyderabad , Bangalore .`);
    expect(parsed.role).toMatch(/Premium Account Manager/i);
    expect(parsed.grade).toMatch(/Assistant Manager/i);
    expect(parsed.industry).toMatch(/Sales/i);
    expect(parsed.department).toMatch(/Retail Branch Banking/i);
    expect(parsed.clientName).toBe('');
    expect(parsed.ctc).toBe('');
    expect(parsed.experience).toMatch(/3\s*years/i);
    expect(parsed.locations.map((v) => v.toUpperCase())).toEqual(
      expect.arrayContaining(['HYDERABAD', 'BANGALORE'])
    );
    expect(parsed.locations.join(' ').toUpperCase()).not.toMatch(/\bNA\b/);
  });

  it('extracts Equitas Service & Operations Manager bank JD paste onto structured fields', () => {
    const parsed = parseJdText(
      'Prepared by: Sanju Singh Ref. No.: Role Description Designation: Service & Operations Manager Grade: DM/Manager Legal Entity: Equitas Small Finance Bank Business Unit: Retail Banking Division: Branch Banking Department: Branch Banking Travel required: Yes/No Level of travel: Moderate Level: Supervisory Job Dimension Reporting To Branch Manager Direct Reports 1 Purpose of the role: To ensure high quality delivery of all banking services and products to our clients in a fair and transparent manner. Key Responsibilities: Manage a team of branch operations staff (Teller/Customer Support Officer) and ensure smooth running of the branch. Ensure compliance with KYC, AML, audit and other regulations in all branch banking operations. Key Results Area KRA KEY PERFORMANCE INDICATOR Audit Ratings: Branch Low Risk or below Desired Experience & Qualification: Number of years of experience (range): 5-8 years Type of companies/sector worked for: Banking – private sector banks, cooperative banks, PSU banks, rural banks. Responsibilities managed in the previous organizations: The applicant should have been in a customer-facing role in a bank branch, with experience in branch operations. Languages: Fluency in English and regional language of the state applying for. Computer/technical skills (if any): Good in MS Office, Banking Software'
    );
    expect(parsed.role).toMatch(/Service & Operations Manager/i);
    expect(parsed.grade).toMatch(/DM\/Manager/i);
    expect(parsed.clientName).toMatch(/Equitas Small Finance Bank/i);
    expect(parsed.department).toMatch(/Branch Banking/i);
    expect(parsed.reportingTo).toMatch(/Branch Manager/i);
    expect(parsed.directReports).toBe('1');
    expect(parsed.experience).toMatch(/5-8/i);
    expect(parsed.industry).toMatch(/BFSI|BANKING/i);
    expect(parsed.skills.join(' ')).toMatch(/MS Office/i);
    expect(parsed.skills.join(' ')).toMatch(/Banking Software/i);
    expect(parsed.skills.join(' ')).toMatch(/KYC/i);
    expect(parsed.skills.some((s) => s.length > 80)).toBe(false);
    expect(parsed.languages).toMatch(/English/i);
    expect(parsed.responsibilities).toMatch(/branch operations staff/i);
    expect(parsed.requirements).toMatch(/customer-facing role|branch operations/i);
    expect(parsed.kpis).toMatch(/Audit Ratings/i);
    expect(parsed.internalNotes).toMatch(/Retail Banking/i);
    expect(parsed.locations).toEqual([]);
    expect(parsed.employmentType).toBe('full_time');
  });
});
