const { locationFilter, keywordFilter } = require('../services/talentMatchService');

describe('talent match directory pull', () => {
  it('restricts Mongo to the job city so Suggested talent can score the full location set', () => {
    const filter = locationFilter({ organizationId: 'org1' }, {
      location: 'CHENNAI',
      locations: ['CHENNAI'],
    });
    expect(filter).toBeTruthy();
    const clauses = filter.$and[1].$or;
    expect(clauses).toHaveLength(2);
    expect(clauses.some((clause) => clause.location && clause.location.test('Chennai'))).toBe(true);
    expect(clauses.some((clause) => clause.location && clause.location.test('Madras'))).toBe(true);
    expect(clauses.some((clause) => clause.state)).toBe(true);
    expect(clauses.every((clause) => !clause.position)).toBe(true);
  });

  it('does not add a location filter when the job has no city', () => {
    expect(locationFilter({ organizationId: 'org1' }, { title: 'Sales Officer' })).toBeNull();
  });

  it('keeps keyword $or compact', () => {
    const keyed = keywordFilter({ organizationId: 'org1' }, [
      'casa', 'sales', 'banking', 'chennai', 'axis', 'title', 'grade', 'client', 'name', 'foo',
    ]);
    expect(keyed.$and[1].$or.length).toBeLessThanOrEqual(8 * 4);
  });
});
