const {
  matchOne,
  matchExperience,
  matchCtc,
  matchEmployment,
} = require('../utils/jdPicklistMap');
const { mapFields } = require('../services/jdAiExtractService');

describe('jdPicklistMap', () => {
  it('matches location contains', () => {
    const hit = matchOne('Delhi NCR', ['DELHI', 'MUMBAI', 'HYDERABAD']);
    expect(hit.value).toBe('DELHI');
    expect(hit.confidence).toBeGreaterThan(0.7);
  });

  it('maps 4-6 years onto 3-5 / 5-8 bands', () => {
    const hit = matchExperience('4-6 years of experience in sales', [
      'FRESHER', '0-1 YEARS', '1-2 YEARS', '2-3 YEARS', '3-5 YEARS', '5-8 YEARS',
    ]);
    expect(['3-5 YEARS', '5-8 YEARS']).toContain(hit.value);
  });

  it('maps 6-10 LPA onto CTC catalog bands', () => {
    const hit = matchCtc('6-10 LPA', ['5L-6L', '6L-7L', '9L-10L', '10L-12L']);
    expect(hit.value).toMatch(/L/);
    expect(hit.confidence).toBeGreaterThan(0.5);
  });

  it('maps full-time employment', () => {
    expect(matchEmployment('Permanent / Full time').value).toBe('full_time');
    expect(matchEmployment('contractual').value).toBe('contract');
  });

  it('drops NA client-like noise', () => {
    expect(matchOne('NA', ['ACME']).value).toBe('');
  });

  it('does not collapse a full title or grade onto generic Manager', () => {
    expect(matchOne('Service & Operations Manager', ['MANAGER', 'ASSISTANT MANAGER']).value)
      .toBe('SERVICE & OPERATIONS MANAGER');
    expect(matchOne('DM/Manager', ['MANAGER', 'EXECUTIVE']).value).toBe('DM MANAGER');
  });
});

describe('mapFields confidence', () => {
  it('fills role and locations from merged scalars', () => {
    const catalogs = {
      positions: ['RELATIONSHIP MANAGER'],
      clients: ['EQUITAS'],
      industry: ['BFSI'],
      grade: ['ASSISTANT MANAGER'],
      experience: ['3-5 YEARS'],
      ctc: ['6L-7L', '9L-10L'],
      location: ['DELHI', 'NOIDA'],
      product: ['SALES', 'LIFE INSURANCE'],
    };
    const merged = {
      role: { value: 'Relationship Manager', source: 'ai', confidence: 0.9 },
      clientName: { value: 'Equitas', source: 'ai', confidence: 0.88 },
      industry: { value: 'BFSI', source: 'regex', confidence: 0.64 },
      department: { value: 'Retail', source: 'ai', confidence: 0.7 },
      grade: { value: 'Assistant Manager', source: 'ai', confidence: 0.8 },
      ctc: { value: '6-10 LPA', source: 'ai', confidence: 0.7 },
      experience: { value: '3-5 years', source: 'ai', confidence: 0.85 },
      employmentType: { value: 'full_time', source: 'ai', confidence: 0.9 },
      locations: { value: 'Delhi, Noida', source: 'ai', confidence: 0.9 },
      skills: { value: 'Sales, Life Insurance', source: 'ai', confidence: 0.8 },
      openings: { value: '2', source: 'ai', confidence: 0.6 },
      summary: { value: '<p>Lead the book.</p>', source: 'ai', confidence: 0.8 },
      responsibilities: { value: '<ul><li>Acquire customers</li></ul>', source: 'ai', confidence: 0.8 },
      requirements: { value: '<p>3 years sales</p>', source: 'ai', confidence: 0.75 },
      preferred: { value: '', source: 'none', confidence: 0 },
    };
    const mapped = mapFields(merged, catalogs);
    expect(mapped.fields.role).toBe('RELATIONSHIP MANAGER');
    expect(mapped.fields.locations).toEqual(expect.arrayContaining(['DELHI', 'NOIDA']));
    expect(mapped.fields.employmentType).toBe('full_time');
    expect(mapped.confidence.role).toBeGreaterThan(0.7);
    expect(mapped.fields.preferred).toBe('');
  });
});
