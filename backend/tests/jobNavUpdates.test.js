const {
  openJobsSinceFilter,
  unseenOpenJobsFilter,
  markOpenJobsSeenFilter,
  isNewlyOpenTransition,
  userIdFilter,
} = require('../utils/jobNavUpdates');
const mongoose = require('mongoose');

describe('jobNavUpdates', () => {
  it('scopes open non-template jobs after since', () => {
    const since = new Date('2026-08-01T00:00:00.000Z');
    const orgId = new mongoose.Types.ObjectId();
    const q = openJobsSinceFilter(orgId, since);
    expect(q.organizationId).toEqual({ $in: [orgId, String(orgId)] });
    expect(q.status).toBe('Open');
    expect(q.isTemplate).toEqual({ $ne: true });
    expect(q.$or).toEqual([
      { createdAt: { $gt: since } },
      { openedAt: { $gt: since } },
    ]);
  });

  it('counts jobs the viewer has not seen after last Jobs visit', () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const since = new Date('2026-08-01T00:00:00.000Z');
    const q = unseenOpenJobsFilter(orgId, userId, since);
    expect(q.status).toBe('Open');
    expect(q.isTemplate).toEqual({ $ne: true });
    const seenClauses = q.$and.filter((c) => c.seenBy);
    expect(seenClauses.some((c) => String(c.seenBy.$ne) === String(userId))).toBe(true);
    const time = q.$and.find((c) => Array.isArray(c.$or));
    expect(time.$or).toEqual([
      { createdAt: { $gt: since } },
      { openedAt: { $gt: since } },
    ]);
  });

  it('does not stamp jobs posted after the user opened Jobs', () => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const seenAt = new Date('2026-08-26T03:00:00.000Z');
    const q = markOpenJobsSeenFilter(orgId, userId, seenAt);
    const time = q.$and.find((c) => Array.isArray(c.$or));
    expect(time.$or).toEqual([
      { createdAt: { $lte: seenAt } },
      { openedAt: { $lte: seenAt } },
    ]);
  });

  it('coerces string organization ids', () => {
    const since = new Date('2026-08-01T00:00:00.000Z');
    const orgId = new mongoose.Types.ObjectId();
    const q = openJobsSinceFilter(String(orgId), since);
    expect(q.organizationId.$in).toHaveLength(2);
    expect(String(q.organizationId.$in[0])).toBe(String(orgId));
  });

  it('matches userId as ObjectId or string', () => {
    const id = new mongoose.Types.ObjectId();
    expect(userIdFilter(id)).toEqual({ userId: { $in: [id, String(id)] } });
  });

  it('treats On Hold → Open as a new opening', () => {
    expect(isNewlyOpenTransition('On Hold', 'Open')).toBe(true);
    expect(isNewlyOpenTransition('Draft', 'Open')).toBe(true);
    expect(isNewlyOpenTransition('Open', 'Open')).toBe(false);
    expect(isNewlyOpenTransition('Open', 'Closed')).toBe(false);
  });
});
