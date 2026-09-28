const { nearbyCityNames, resolveCityKey } = require('../data/cityCoordinates');
const { ctcCapLpa, ctcWithinUpto } = require('../utils/ctcNumeric');
const { parsePeopleFilters, peopleFilterParts, rowMatchesRange, rowMatchesLocation } = require('../utils/peopleSearchFilters');

describe('global search people filters', () => {
  it('parses multi-select position query values', () => {
    const filters = parsePeopleFilters({ position: ['HR Recruiter', 'Sales'] });
    expect(filters.position).toEqual(['HR Recruiter', 'Sales']);
    const parts = peopleFilterParts(filters);
    expect(parts[0].$or).toHaveLength(2);
  });

  it('treats Current CTC as up to the cap, not a regex on the band label', () => {
    expect(ctcCapLpa('10')).toBe(10);
    expect(ctcCapLpa('Up to 10 LPA')).toBe(10);
    expect(ctcWithinUpto('8L-9L', 10)).toBe(true);
    expect(ctcWithinUpto('9L-10L', 10)).toBe(true);
    expect(ctcWithinUpto('10L-12L', 10)).toBe(false);
    expect(ctcWithinUpto('12L-15L', 10)).toBe(false);
    expect(rowMatchesRange({ ctc: '6L-7L', experience: '4 YEARS' }, { ctcMax: '10' })).toBe(true);
    expect(rowMatchesRange({ ctc: '12L-15L', experience: '4 YEARS' }, { ctcMax: '10' })).toBe(false);
  });

  it('treats Current CTC minimum as at least the floor', () => {
    expect(rowMatchesRange({ ctc: '15L-18L' }, { ctcMin: '15' })).toBe(true);
    expect(rowMatchesRange({ ctc: '18L-20L' }, { ctcMin: '15' })).toBe(true);
    expect(rowMatchesRange({ ctc: '10L-12L' }, { ctcMin: '15' })).toBe(false);
    expect(rowMatchesRange({ ctc: '15L-18L' }, { ctcMin: '15', ctcMax: '25' })).toBe(true);
    expect(rowMatchesRange({ ctc: '30L-40L' }, { ctcMin: '15', ctcMax: '25' })).toBe(false);
  });

  it('splits comma-separated location cities', () => {
    const filters = parsePeopleFilters({ location: 'Delhi, Pune' });
    expect(filters.location).toEqual(['Delhi', 'Pune']);
  });

  it('expands Delhi to nearby NCR cities within 50 km', () => {
    const names = nearbyCityNames('delhi', 50).map((n) => n.toLowerCase());
    expect(names).toEqual(expect.arrayContaining(['delhi', 'noida', 'gurugram', 'gurgaon', 'ghaziabad', 'faridabad']));
    expect(names).not.toContain('meerut');
  });

  it('resolves Delhi NCR and Gurgaon aliases', () => {
    const names = nearbyCityNames('Delhi NCR', 50).map((n) => n.toLowerCase());
    expect(names).toEqual(expect.arrayContaining(['delhi', 'noida', 'gurgaon', 'gurugram']));
    const gurgaon = nearbyCityNames('Gurgaon', 50).map((n) => n.toLowerCase());
    expect(gurgaon).toEqual(expect.arrayContaining(['gurugram', 'delhi']));
  });

  it('keeps this-city-only from pulling in Noida', () => {
    const names = nearbyCityNames('Delhi', 0).map((n) => n.toLowerCase());
    expect(names).toEqual(expect.arrayContaining(['delhi', 'new delhi', 'ncr']));
    expect(names).not.toContain('noida');
  });

  it('matches location with word boundaries so Goa does not hit Alagoas-style text', () => {
    const clause = peopleFilterParts({ location: ['Goa'], locationRadiusKm: '0' })[0];
    const loc = clause.$or.find((part) => part.location);
    expect(loc.location.$regex).toMatch(/\(\^\|\[\^A-Za-z0-9\]\)/);
  });

  it('does not apply CTC as AND of min and max text matches', () => {
    const parts = peopleFilterParts({ ctcMax: '10', position: 'Sales' });
    expect(JSON.stringify(parts)).not.toMatch(/ctc/);
  });

  it('only scans rows in memory for CTC / experience, not for position or location', () => {
    const { needsRowRangeFilter } = require('../utils/peopleSearchFilters');
    expect(needsRowRangeFilter({ position: ['Sales'], location: ['Delhi'] })).toBe(false);
    expect(needsRowRangeFilter({ ctcMax: '10' })).toBe(true);
    expect(needsRowRangeFilter({ expMin: '2' })).toBe(true);
  });

  it('maps close spellings of Rishikesh and expands 100 km to neighbouring towns', () => {
    expect(resolveCityKey('rishtkesh')).toBe('rishikesh');
    const names = nearbyCityNames('rishtkesh', 100).map((n) => n.toLowerCase());
    expect(names).toEqual(expect.arrayContaining(['rishikesh', 'dehradun', 'haridwar', 'roorkee']));
    expect(names).not.toContain('delhi');
  });

  it('keeps records in nearby towns when the search city is Rishikesh', () => {
    const filters = { location: ['Rishikesh'], locationRadiusKm: '100' };
    expect(rowMatchesLocation({ location: 'Dehradun' }, filters)).toBe(true);
    expect(rowMatchesLocation({ location: 'Haridwar, Uttarakhand' }, filters)).toBe(true);
    expect(rowMatchesLocation({ location: 'Roorkee' }, filters)).toBe(true);
    expect(rowMatchesLocation({ location: 'Delhi' }, filters)).toBe(false);
    expect(rowMatchesRange({ location: 'Dehradun', ctc: '6L-7L' }, filters)).toBe(true);
  });

  it('ANDs different filters and ORs values inside the same filter', () => {
    const parts = peopleFilterParts({
      position: ['Sales'],
      product: ['Azure', 'Banca'],
      location: ['Rishikesh'],
      locationRadiusKm: '100',
    });
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const blob = JSON.stringify(parts);
    expect(blob).toMatch(/position/);
    expect(blob).toMatch(/product/);
    expect(blob).toMatch(/location/);
    const productPart = parts.find((p) => p.$or && JSON.stringify(p).includes('product'));
    expect(productPart.$or).toHaveLength(2);
    const salesOnly = { position: 'Sales Manager', product: 'Azure', location: 'Dehradun' };
    const otherRole = { position: 'Accountant', product: 'Azure', location: 'Dehradun' };
    const filters = {
      position: ['Sales'],
      product: ['Azure', 'Banca'],
      location: ['Rishikesh'],
      locationRadiusKm: '100',
    };
    expect(rowMatchesRange(salesOnly, filters)).toBe(true);
    expect(rowMatchesRange(otherRole, filters)).toBe(false);
    expect(rowMatchesRange({ position: 'Sales', product: 'CASA', location: 'Dehradun' }, filters)).toBe(false);
  });

  it('splits comma-separated skills into separate tokens', () => {
    const filters = parsePeopleFilters({ skills: 'Banking, Sales' });
    expect(filters.skills).toEqual(['Banking', 'Sales']);
  });
});
