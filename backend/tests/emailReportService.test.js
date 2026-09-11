const {
  recomputeTotals,
} = require('../services/emailReportService');

describe('emailReportService totals', () => {
  it('computes open/click/bounce rates from recipients', () => {
    const doc = {
      recipients: [
        { email: 'a@x.com', status: 'opened', openCount: 1, clickCount: 0 },
        { email: 'b@x.com', status: 'clicked', openCount: 2, clickCount: 1 },
        { email: 'c@x.com', status: 'hard_bounced', openCount: 0, clickCount: 0 },
        { email: 'd@x.com', status: 'sent', openCount: 0, clickCount: 0 },
      ],
      status: 'sent',
    };
    recomputeTotals(doc);
    expect(doc.totals.sent).toBe(4);
    expect(doc.totals.opened).toBe(2);
    expect(doc.totals.clicked).toBe(1);
    expect(doc.totals.bounced).toBe(1);
    expect(doc.totals.hardBounced).toBe(1);
    expect(doc.rates.openRate).toBeGreaterThan(0);
    expect(doc.status).toBe('completed');
  });
});
