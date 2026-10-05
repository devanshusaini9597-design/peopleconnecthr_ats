const {
  tokenize, scoreOverlap, jobFitText, candidateFitText,
} = require('../utils/globalSearchMatch');

describe('globalSearchMatch', () => {
  it('tokenizes skills and drops stop words', () => {
    expect(tokenize('Hiring a React and Node recruiter for this job')).toEqual(
      expect.arrayContaining(['react', 'node', 'recruiter'])
    );
    expect(tokenize('Hiring a React and Node recruiter for this job')).not.toEqual(
      expect.arrayContaining(['for', 'this'])
    );
  });

  it('scores candidate overlap against a job', () => {
    const job = {
      title: 'HR Recruiter',
      skills: ['sourcing', 'screening'],
      location: 'Pune',
    };
    const candidate = {
      position: 'HR Recruiter',
      skills: 'Sourcing, screening, excel',
      location: 'Pune',
    };
    expect(scoreOverlap(jobFitText(job), candidateFitText(candidate))).toBeGreaterThan(1);
  });
});
