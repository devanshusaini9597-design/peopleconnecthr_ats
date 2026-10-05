const { scorePerson, bandFor, jobCtcConstraint, jobDomainRequirement, jobSearchTokens, jobLocationTokens } = require('../utils/talentMatchScore');

const job = {
  title: 'Home Loan Sales Manager',
  location: 'Pune',
  experience: '5-8 years',
  skills: ['Home Loan', 'Sales', 'DSA'],
  description: 'Lead a home loan sales team across Pune.',
};

describe('talentMatchScore', () => {
  it('ranks a close profile above an unrelated one', () => {
    const close = scorePerson(job, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales, DSA, Channel management',
      product: 'Home Loan',
    });
    const far = scorePerson(job, {
      position: 'Java Developer',
      location: 'Chennai',
      experience: '1 year',
      skills: 'Java, Spring',
    });
    expect(close.score).toBeGreaterThan(far.score);
    expect(close.band === 'Strong' || close.band === 'Good').toBe(true);
    expect(close.why).toMatch(/Skills:/);
    expect(close.factors.map((factor) => factor.label)).toEqual(
      expect.arrayContaining(['Skills', 'Experience', 'Location', 'Role'])
    );
    expect(far.score).toBeLessThan(50);
  });

  it('uses MIS product text as a skill signal', () => {
    const withProduct = scorePerson(job, {
      position: 'Relationship Manager',
      location: 'Pune',
      experience: '5 years',
      product: 'Home Loan',
      skills: 'DSA',
    });
    const without = scorePerson(job, {
      position: 'Relationship Manager',
      location: 'Pune',
      experience: '5 years',
      skills: 'Credit cards',
    });
    expect(withProduct.score).toBeGreaterThan(without.score);
  });

  it('reads resume text when structured skills are thin', () => {
    const bare = scorePerson(job, {
      position: 'Manager',
      location: 'Pune',
      experience: '6 years',
      skills: '',
    });
    const withResume = scorePerson(job, {
      position: 'Manager',
      location: 'Pune',
      experience: '6 years',
      skills: '',
      resumeText: 'Managed a home loan sales desk and a DSA channel for six years.',
    });
    expect(withResume.score).toBeGreaterThan(bare.score);
  });

  it('drops a different city even when the role is similar', () => {
    const fit = scorePerson(job, {
      position: 'Home Loan Sales Manager',
      location: 'Nagpur, Maharashtra',
      experience: '7 years',
      skills: 'Home Loan, Sales, DSA',
      product: 'Home Loan',
    });
    expect(fit.qualified).toBe(false);
    expect(fit.qualifyReason).toMatch(/Location/);
  });

  it('drops blank location when the job has a city', () => {
    const fit = scorePerson(job, {
      position: 'Home Loan Sales Manager',
      location: '',
      experience: '7 years',
      skills: 'Home Loan, Sales, DSA',
      product: 'Home Loan',
    });
    expect(fit.qualified).toBe(false);
    expect(fit.qualifyReason).toMatch(/Location/);
  });

  it('drops a different domain even in the right city', () => {
    const fit = scorePerson({ ...job, industry: 'Banking' }, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Java, Spring',
      product: 'Java',
    });
    expect(fit.qualified).toBe(false);
    expect(fit.qualifyReason).toMatch(/Domain/);
  });

  it('keeps banking profiles when JD names banking industry only', () => {
    const bankingJob = {
      ...job,
      industry: 'Banking',
      description: 'Hiring for the banking industry only. Home loan sales in Pune.',
    };
    const bank = scorePerson(bankingJob, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales',
      product: 'Banking',
    });
    const pharma = scorePerson(bankingJob, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales',
      product: 'Pharma',
    });
    expect(bank.qualified).toBe(true);
    expect(pharma.qualified).toBe(false);
    expect(jobDomainRequirement(bankingJob).domains).toContain('banking');
  });

  it('allows banking or insurance when JD lists both domains', () => {
    const multi = {
      ...job,
      industry: 'Banking / Insurance',
      description: 'Open to banking or insurance domain candidates.',
    };
    expect(jobDomainRequirement(multi).domains).toEqual(
      expect.arrayContaining(['banking', 'insurance'])
    );
    const insurance = scorePerson(multi, {
      position: 'Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Sales',
      product: 'Life Insurance',
    });
    expect(insurance.qualified).toBe(true);
  });

  it('does not hard-gate domain when JD says any domain', () => {
    const open = {
      ...job,
      description: 'Any domain welcome. Lead a sales team across Pune.',
    };
    expect(jobDomainRequirement(open).mode).toBe('any');
    const pharma = scorePerson(open, {
      position: 'Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Sales',
      product: 'Pharma',
    });
    expect(pharma.qualified).toBe(true);
  });

  it('parses minimum CTC from the JD and drops lower packages', () => {
    const paid = {
      ...job,
      description: 'Lead home loan sales in Pune. Minimum CTC 3 LPA.',
    };
    expect(jobCtcConstraint(paid)).toEqual({ min: 3, max: null });
    const low = scorePerson(paid, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales',
      product: 'Home Loan',
      ctc: '2L',
    });
    const ok = scorePerson(paid, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales',
      product: 'Home Loan',
      ctc: '4L-5L',
    });
    expect(low.qualified).toBe(false);
    expect(low.qualifyReason).toMatch(/CTC/);
    expect(ok.qualified).toBe(true);
  });

  it('parses upto CTC from the JD and drops higher packages', () => {
    const capped = {
      ...job,
      description: 'Home loan sales. CTC up to 10 LPA.',
    };
    expect(jobCtcConstraint(capped).max).toBe(10);
    const high = scorePerson(capped, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales',
      product: 'Home Loan',
      ctc: '12L-15L',
    });
    expect(high.qualified).toBe(false);
    expect(high.qualifyReason).toMatch(/CTC/);
  });

  it('keeps a related sales profile in the same city', () => {
    const fit = scorePerson(job, {
      position: 'Branch Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Sales, Channel management',
      product: 'Home Loan',
    });
    expect(fit.qualified).toBe(true);
  });

  it('keeps a profile that matches city, role, and skills', () => {
    const fit = scorePerson(job, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Home Loan, Sales, DSA',
      product: 'Home Loan',
    });
    expect(fit.qualified).toBe(true);
  });

  it('ranks higher when the profile matches the job description', () => {
    const jdJob = {
      ...job,
      description: 'Lead home loan sales, manage DSA partners, drive disbursals and branch channel performance across Pune.',
      responsibilities: ['Manage DSA channel', 'Drive home loan disbursals'],
    };
    const aligned = scorePerson(jdJob, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Sales',
      product: 'Home Loan',
      remark: 'Handles DSA partners and home loan disbursals',
    });
    const thin = scorePerson(jdJob, {
      position: 'Home Loan Sales Manager',
      location: 'Pune',
      experience: '6 years',
      skills: 'Sales',
      product: 'Home Loan',
    });
    expect(aligned.factors.map((f) => f.label)).toEqual(
      expect.arrayContaining(['Job description'])
    );
    expect(aligned.score).toBeGreaterThanOrEqual(thin.score);
  });

  it('labels bands', () => {
    expect(bandFor(80)).toBe('Strong');
    expect(bandFor(60)).toBe('Good');
    expect(bandFor(40)).toBe('Partial');
    expect(bandFor(10)).toBe('Low');
  });

  it('pulls the job city and ignores JD label words as search tokens', () => {
    const jdJob = {
      title: 'SALES OFFICER',
      location: 'CHENNAI',
      locations: ['CHENNAI'],
      industry: 'BANKING',
      clientName: 'AXIS BANK',
      ctc: '2L-3L',
      skills: ['CASA'],
      description: `Job Title: SALES OFFICER , Grade SENIOR EXECUTIVE
Client Name - AXIS BANK
Industry: BANKING
CTC: 2L-3L
Experience: 0-1 YEARS
Employment Type: FULL-TIME
Locations: CHENNAI
## Compensation
CTC: 2L-3L, depending on experience, performance, and current compensation.`,
    };
    expect(jobLocationTokens(jdJob)).toEqual(expect.arrayContaining(['chennai', 'madras']));
    const tokens = jobSearchTokens(jdJob, 18);
    expect(tokens).toContain('casa');
    expect(tokens).toContain('sales');
    expect(tokens).toContain('chennai');
    expect(tokens).toContain('banking');
    expect(tokens).not.toContain('title');
    expect(tokens).not.toContain('grade');
    expect(tokens).not.toContain('client');
    expect(tokens).not.toContain('name');
    expect(tokens).not.toContain('depending');
    expect(tokens).not.toContain('compensation');
  });

  it('treats Madras as Chennai for location gates', () => {
    const chennaiJob = {
      title: 'SALES OFFICER',
      location: 'CHENNAI',
      industry: 'BANKING',
      skills: ['CASA'],
      description: 'Sales officer for Axis Bank in Chennai. Banking industry. CTC 2L-3L.',
    };
    const fit = scorePerson(chennaiJob, {
      position: 'Sales Officer',
      location: 'Madras',
      experience: '1 year',
      skills: 'CASA, Sales',
      product: 'Banking',
      ctc: '2.5 LPA',
    });
    expect(fit.qualified).toBe(true);
  });
});
