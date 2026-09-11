const mongoose = require('mongoose');
const {
  nameKey,
  splitNames,
  exactNameQuery,
} = require('../services/positionCatalogSync');
const {
  pickKeepPosition,
  groupKey,
  ensurePositionOrgUniqueness,
} = require('../services/ensurePositionOrgUniqueness');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');

describe('positionCatalogSync', () => {
  it('normalizes picker names to block letters', () => {
    expect(nameKey('  Sales Executive ')).toBe('SALES EXECUTIVE');
    expect(nameKey('relationship manager')).toBe('RELATIONSHIP MANAGER');
  });

  it('keeps a single position name intact and does not split on commas or slashes', () => {
    expect(splitNames('ASSISTANT BRANCH HEAD – LIFE INSURANCE')).toEqual([
      'ASSISTANT BRANCH HEAD – LIFE INSURANCE',
    ]);
    expect(splitNames('SALES / RELATIONSHIP MANAGER')).toEqual(['SALES / RELATIONSHIP MANAGER']);
    expect(splitNames(['Team Leader', 'Branch Manager'])).toEqual(['Team Leader', 'Branch Manager']);
    expect(splitNames('')).toEqual([]);
  });

  it('builds a case-insensitive exact name query', () => {
    const q = exactNameQuery('Sales Executive');
    expect(q.$regex.test('SALES EXECUTIVE')).toBe(true);
    expect(q.$regex.test('sales executive')).toBe(true);
    expect(q.$regex.test('SALES EXECUTIVE - MUMBAI')).toBe(false);
    expect(exactNameQuery('')).toBeNull();
  });
});

describe('ensurePositionOrgUniqueness helpers', () => {
  it('groups the same title in one org regardless of case or spacing', () => {
    const orgId = 'org1';
    expect(groupKey(orgId, 'Sales Executive')).toBe(groupKey(orgId, '  sales   executive '));
    expect(groupKey(orgId, 'Sales Executive')).not.toBe(groupKey('org2', 'Sales Executive'));
    expect(groupKey(null, 'Sales Executive')).toBeNull();
  });

  it('keeps one catalog row: active first, then oldest, then lowest id', () => {
    const keep = pickKeepPosition([
      { _id: 'c', isActive: false, createdAt: new Date('2024-01-01') },
      { _id: 'b', isActive: true, createdAt: new Date('2024-06-01') },
      { _id: 'a', isActive: true, createdAt: new Date('2024-01-01') },
    ]);
    expect(keep._id).toBe('a');
  });

  it('deletes extra catalog rows and leaves candidate position strings unchanged', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const orgId = new mongoose.Types.ObjectId();
    const userA = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    await Position.collection.insertMany([
      {
        name: 'Sales Executive',
        organizationId: orgId,
        createdBy: userA,
        isActive: true,
        createdAt: new Date('2024-01-01'),
      },
      {
        name: 'SALES EXECUTIVE',
        organizationId: orgId,
        createdBy: userB,
        isActive: true,
        createdAt: new Date('2024-06-01'),
      },
    ]);
    await Candidate.collection.insertOne({
      name: 'TEST CAND',
      email: 'dup-pos@example.com',
      position: 'SALES EXECUTIVE',
      organizationId: orgId,
      createdBy: userB,
    });

    const result = await ensurePositionOrgUniqueness(mongoose.connection);
    expect(result.org.removed).toBe(1);

    const left = await Position.collection.find({ organizationId: orgId }).toArray();
    expect(left).toHaveLength(1);
    expect(left[0].name).toBe('SALES EXECUTIVE');
    expect(String(left[0].createdBy)).toBe(String(userA));

    const cand = await Candidate.collection.findOne({ email: 'dup-pos@example.com' });
    expect(cand.position).toBe('SALES EXECUTIVE');
  });
});
