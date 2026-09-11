const {
  poolMatchesContext,
  selectPoolsForReject,
  selectPoolsForJob,
  selectPoolsForTrigger,
} = require('../utils/talentPoolMatch');

describe('talentPoolMatch', () => {
  const banking = { _id: 'b', name: 'Banking', industry: 'BANKING' };
  const finance = { _id: 'f', name: 'Finance', industry: 'FINANCE' };
  const warm = { _id: 'w', name: 'Warm bench', isDefaultRejectPool: true };
  const frontend = { _id: 'fe', name: 'Frontend Bench', industry: 'IT / SOFTWARE' };

  it('matches job industry to the same pool', () => {
    expect(poolMatchesContext(banking, { industry: 'Banking', title: 'RM' })).toBe(true);
    expect(poolMatchesContext(finance, { industry: 'Banking', title: 'RM' })).toBe(false);
  });

  it('matches a crossover profile into both industry pools', () => {
    const candidate = {
      position: 'Relationship Manager',
      skills: 'Banking, Finance, Credit analysis',
    };
    expect(poolMatchesContext(banking, candidate)).toBe(true);
    expect(poolMatchesContext(finance, candidate)).toBe(true);
    expect(poolMatchesContext(frontend, candidate)).toBe(false);
  });

  it('on banking reject, keeps warm + banking + finance when the profile overlaps', () => {
    const selected = selectPoolsForReject(
      [banking, finance, warm, frontend],
      {
        industry: 'Banking',
        title: 'Branch RM',
        skills: 'Banking and Finance products',
        position: 'RM',
      }
    );
    const ids = selected.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining(['b', 'f', 'w']));
    expect(ids).not.toContain('fe');
  });

  it('matches a product/skill pool from the candidate profile', () => {
    const homeLoan = { _id: 'hl', name: 'Home Loan', product: 'HOME LOAN' };
    expect(poolMatchesContext(homeLoan, { product: 'Home Loan', skills: 'Home loan, sales' })).toBe(true);
    expect(poolMatchesContext(homeLoan, { industry: 'Banking', title: 'RM' })).toBe(false);
  });

  it('for a home-loan job, reusable pools include the product pool and warm bench', () => {
    const homeLoan = { _id: 'hl', name: 'Home Loan', product: 'HOME LOAN' };
    const selected = selectPoolsForJob(
      [banking, finance, warm, homeLoan],
      { industry: 'BFSI', skills: ['Home Loan'], title: 'Home Loan RM' }
    );
    const ids = selected.map((p) => p._id);
    expect(ids).toEqual(expect.arrayContaining(['hl', 'w']));
    expect(ids).not.toContain('f');
  });

  it('addOnInterview catch-all fires on interview even without catalog match', () => {
    const interviewBench = { _id: 'iv', name: 'Interview bench', addOnInterview: true };
    const selected = selectPoolsForTrigger(
      [banking, interviewBench],
      { industry: 'Pharma', title: 'Chemist' },
      'interview'
    );
    expect(selected.map((p) => p._id)).toEqual(['iv']);
  });
});
