const { autoDetectHeaderMapping } = require('../utils/misHeaderMap');

function headerRow(labels) {
  return {
    eachCell(cb) {
      labels.forEach((value, i) => cb({ value }, i + 1));
    },
  };
}

describe('misHeaderMap tracker aliases', () => {
  test('maps tracker labels onto MIS fields', () => {
    const map = autoDetectHeaderMapping(headerRow([
      'Name',
      'Email',
      'Role Apply',
      'Rule Apply',
      'Branch',
      'CCTC',
      'ECTC',
      'NP(days)',
      'Current Company',
    ]));

    expect(map.name).toBe(1);
    expect(map.email).toBe(2);
    expect(map.position).toBe(3);
    expect(map.location).toBe(5);
    expect(map.ctc).toBe(6);
    expect(map.expectedCtc).toBe(7);
    expect(map.noticePeriod).toBe(8);
    expect(map.companyName).toBe(9);
  });

  test('prefers Role Apply over a later Rule Apply for position', () => {
    const map = autoDetectHeaderMapping(headerRow([
      'Role Apply',
      'Rule Apply',
    ]));
    expect(map.position).toBe(1);
  });
});
