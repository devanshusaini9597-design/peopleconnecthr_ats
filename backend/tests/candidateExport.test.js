const { DEFAULT_ROLE_PERMISSIONS } = require('../config/permissions');
const {
  canExportCandidates,
  sanitizeIds,
  rowFromCandidate,
  ownerNotifyRecipients,
} = require('../services/candidateExportService');
const { requireCandidateExport } = require('../middleware/rbacMiddleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('candidate export RBAC', () => {
  it('allows owner, admin, and hr_manager only', () => {
    expect(canExportCandidates('owner')).toBe(true);
    expect(canExportCandidates('admin')).toBe(true);
    expect(canExportCandidates('hr_manager')).toBe(true);
    expect(canExportCandidates('hr_recruiter')).toBe(false);
    expect(canExportCandidates('recruiter')).toBe(false);
    expect(canExportCandidates('sales')).toBe(false);
    expect(canExportCandidates('freelancer')).toBe(false);
  });

  it('does not grant candidates.export to recruiter or sales defaults', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.hr_recruiter).not.toContain('candidates.export');
    expect(DEFAULT_ROLE_PERMISSIONS.recruiter).not.toContain('candidates.export');
    expect(DEFAULT_ROLE_PERMISSIONS.sales).not.toContain('candidates.export');
    expect(DEFAULT_ROLE_PERMISSIONS.owner).toContain('candidates.export');
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain('candidates.export');
    expect(DEFAULT_ROLE_PERMISSIONS.hr_manager).toContain('candidates.export');
  });

  it('middleware blocks recruiters and allows managers', () => {
    const deny = jest.fn();
    const denied = mockRes();
    requireCandidateExport({ user: { role: 'hr_recruiter' } }, denied, deny);
    expect(deny).not.toHaveBeenCalled();
    expect(denied.status).toHaveBeenCalledWith(403);

    const allow = jest.fn();
    requireCandidateExport({ user: { role: 'hr_manager' } }, mockRes(), allow);
    expect(allow).toHaveBeenCalledTimes(1);
  });
});

describe('candidateExportService helpers', () => {
  it('sanitizes ids and drops invalid values', () => {
    const a = '507f1f77bcf86cd799439011';
    expect(sanitizeIds([a, a, 'nope', '', null])).toEqual([a]);
  });

  it('maps candidate fields for excel rows', () => {
    const row = rowFromCandidate({
      name: 'Ada',
      email: 'ada@example.com',
      contact: '9999999999',
      date: '2026-08-17',
    });
    expect(row.name).toBe('Ada');
    expect(row.email).toBe('ada@example.com');
    expect(row.contact).toBe('9999999999');
    expect(row.date).toBe('17 Aug 2026');
  });

  it('formats export time in IST, not the server clock', () => {
    const { formatOrgDateTime, formatOrgDate, formatOrgTime, buildExportNoticeFields } = require('../services/candidateExportService');
    const utc = new Date('2026-08-17T16:48:00.000Z'); // 10:18 PM IST
    expect(formatOrgDate(utc)).toBe('17 Aug 2026');
    expect(formatOrgTime(utc)).toBe('10:18 PM IST');
    expect(formatOrgDateTime(utc)).toBe('17 Aug 2026, 10:18 PM IST');

    const fields = buildExportNoticeFields({
      orgName: 'People Connect HR',
      actorName: 'Jane Admin',
      actorRole: 'Admin',
      actorEmail: 'jane@org.com',
      count: 12,
      selected: true,
      filename: 'Candidates_17-Aug-2026.xlsx',
      exportedAt: utc,
      timeZone: 'Asia/Kolkata',
    });
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f.value]));
    expect(byLabel.Organization).toBe('People Connect HR');
    expect(byLabel['Exported by']).toBe('Jane Admin');
    expect(byLabel.Role).toBe('Admin');
    expect(byLabel['Login ID']).toBe('jane@org.com');
    expect(byLabel.Records).toBe('12 candidates');
    expect(byLabel.Date).toBe('17 Aug 2026');
    expect(byLabel.Time).toBe('10:18 PM IST');
    expect(byLabel.When).toBe('17 Aug 2026, 10:18 PM IST');
    expect(byLabel.File).toBe('Candidates_17-Aug-2026.xlsx');
  });

  it('emails other owners, not the exporter', () => {
    const owners = [
      { _id: 'owner-1', email: 'owner@org.com' },
      { _id: 'admin-acting-as-owner', email: 'other@org.com' },
    ];
    expect(ownerNotifyRecipients(owners, 'owner-1')).toEqual([
      { _id: 'admin-acting-as-owner', email: 'other@org.com' },
    ]);
    expect(ownerNotifyRecipients(owners, 'someone-else')).toHaveLength(2);
  });
});
