const {
  nameKey,
  splitSkillNames,
  mergePickerItems,
} = require('../services/skillCatalogSync');

describe('skillCatalogSync', () => {
  it('normalizes picker names to block letters', () => {
    expect(nameKey('  Home Loan ')).toBe('HOME LOAN');
    expect(nameKey('JavaScript')).toBe('JAVASCRIPT');
  });

  it('splits comma/slash skill strings', () => {
    expect(splitSkillNames('React, Node; Python | Go')).toEqual(['React', 'Node', 'Python', 'Go']);
    expect(splitSkillNames(['Home Loan', 'Credit Cards'])).toEqual(['Home Loan', 'Credit Cards']);
    expect(splitSkillNames('A')).toEqual([]);
  });

  it('unions org picklist and catalog skills without duplicate names', () => {
    const merged = mergePickerItems(
      [{ _id: 'org1', name: 'Home Loan', createdBy: 'u1' }],
      [
        { _id: 'sys1', name: 'JavaScript', isSystem: true },
        { _id: 'sys2', name: 'HOME LOAN', isSystem: false },
      ],
      { userId: 'u1' }
    );
    expect(merged.map((row) => row.name)).toEqual(['HOME LOAN', 'JAVASCRIPT']);
    expect(merged[0].catalog).toBe(false);
    expect(merged[0].isMine).toBe(true);
    expect(merged[1].catalog).toBe(true);
    expect(merged[1]._id).toBe('catalog:sys1');
  });
});
