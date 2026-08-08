import { describe, it, expect } from 'vitest';
import { computeSkillMatch, slugifySkill } from '@/lib/skills';

describe('skills taxonomy', () => {
  it('slugifies skill names', () => {
    expect(slugifySkill('C#')).toBe('c#');
    expect(slugifySkill('Next.js')).toBe('next.js');
    expect(slugifySkill('CI/CD')).toContain('ci');
  });

  it('computes weighted skill match', () => {
    const result = computeSkillMatch(
      [
        { skillId: '1', required: true, minProficiency: 2, weight: 2, skill: { id: '1', name: 'React' } },
        { skillId: '2', required: true, minProficiency: 1, weight: 1, skill: { id: '2', name: 'AWS' } },
        { skillId: '3', required: false, minProficiency: 1, weight: 1, skill: { id: '3', name: 'Go' } },
      ],
      [
        { skillId: '1', proficiency: 4 },
        { skillId: '3', proficiency: 2 },
      ],
    );
    expect(result.requiredCount).toBe(2);
    expect(result.matchedCount).toBe(2); // React + Go
    expect(result.requiredMatchPercent).toBe(50); // only React of required
    expect(result.matchPercent).toBe(75); // weight 2+1 of 4
  });

  it('returns 100% when job has no skills', () => {
    const result = computeSkillMatch([], []);
    expect(result.matchPercent).toBe(100);
    expect(result.requiredMatchPercent).toBe(100);
  });
});
