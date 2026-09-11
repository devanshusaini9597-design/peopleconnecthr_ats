const { SEEDS } = require('../controller/orgListController');
const OrgListItem = require('../models/OrgListItem');

describe('org list keys for candidate + job picklists', () => {
  test('SEEDS covers every OrgListItem listKey', () => {
    const keys = OrgListItem.schema.path('listKey').enumValues;
    expect(keys).toEqual(
      expect.arrayContaining(['ctc', 'notice', 'product', 'grade', 'industry', 'location', 'experience'])
    );
    for (const key of keys) {
      expect(Array.isArray(SEEDS[key])).toBe(true);
      expect(SEEDS[key].length).toBeGreaterThan(0);
    }
  });

  test('grade / industry / location / experience starters are block letters', () => {
    for (const key of ['grade', 'industry', 'location', 'experience']) {
      for (const name of SEEDS[key]) {
        expect(name).toBe(String(name).toUpperCase());
      }
    }
  });
});
