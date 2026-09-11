const { parseCatalogQuery, nameContainsFilter } = require('../utils/paginatedCatalog');

describe('paginatedCatalog', () => {
  test('unpaged when page and limit are omitted', () => {
    expect(parseCatalogQuery({})).toEqual({
      q: '',
      page: 1,
      limit: 20,
      skip: 0,
      paged: false,
    });
  });

  test('paged when page or limit is present', () => {
    expect(parseCatalogQuery({ page: '2', limit: '20' })).toMatchObject({
      page: 2,
      limit: 20,
      skip: 20,
      paged: true,
    });
    expect(parseCatalogQuery({ limit: '80' }).paged).toBe(true);
  });

  test('caps limit and trims search', () => {
    const parsed = parseCatalogQuery({ q: '  sa  ', limit: '999', page: '0' });
    expect(parsed.q).toBe('sa');
    expect(parsed.limit).toBe(100);
    expect(parsed.page).toBe(1);
  });

  test('name filter is empty without q and regex-safe with q', () => {
    expect(nameContainsFilter('')).toEqual({});
    expect(nameContainsFilter('C++')).toEqual({ name: { $regex: 'C\\+\\+', $options: 'i' } });
  });
});
