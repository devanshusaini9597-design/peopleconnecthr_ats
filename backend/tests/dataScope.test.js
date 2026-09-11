const mongoose = require('mongoose');
const {
  isFreelancer,
  rejectFreelancerCompanyMail,
  candidateListFilter,
  orgOrOwnerScope,
  masterDataScope,
  jobListFilter,
  applicationListFilter,
  withoutUnsharedFreelancerDesks,
  canViewOrgAnalytics,
  analyticsScope,
  analyticsScopeMeta,
  applicationAnalyticsScope,
} = require('../utils/dataScope');

const orgId = new mongoose.Types.ObjectId();
const freelancerId = new mongoose.Types.ObjectId();
const recruiterId = new mongoose.Types.ObjectId();

describe('dataScope', () => {
  test('isFreelancer', () => {
    expect(isFreelancer({ role: 'freelancer' })).toBe(true);
    expect(isFreelancer({ role: 'hr_recruiter' })).toBe(false);
    expect(isFreelancer(null)).toBe(false);
  });

  test('rejectFreelancerCompanyMail blocks freelance recruiters from Zepto/Zoho send', () => {
    const res = {
      status: jest.fn(function status(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function json(body) {
        this.body = body;
        return this;
      }),
    };
    const next = jest.fn();
    rejectFreelancerCompanyMail({ user: { role: 'freelancer' } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.code).toBe('FREELANCER_NATIVE_MAIL');

    rejectFreelancerCompanyMail({ user: { role: 'hr_recruiter' } }, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('freelancer list filter ignores view=all and stays own-only', () => {
    const req = { user: { id: freelancerId, role: 'freelancer', organizationId: orgId } };
    const filter = candidateListFilter(req, 'all');
    expect(filter.organizationId).toEqual(orgId);
    expect(filter.createdBy.$in).toEqual(expect.arrayContaining([freelancerId, String(freelancerId)]));
    expect(filter).not.toEqual({ organizationId: orgId });
  });

  test('recruiter view=all stays org-wide in list helper', () => {
    const req = { user: { id: recruiterId, role: 'hr_recruiter', organizationId: orgId } };
    expect(candidateListFilter(req, 'all')).toEqual({ organizationId: orgId });
  });

  test('recruiter view=mine includes SPOC desk OR sharedWith handoffs', () => {
    const req = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
    };
    const filter = candidateListFilter(req, 'mine');
    expect(filter.$or).toBeDefined();
    expect(JSON.stringify(filter)).toContain('sharedWith.userId');
    const deskBranch = filter.$or.find((b) => b.$and || b.$or);
    expect(deskBranch).toBeTruthy();
  });

  test('recruiter candidateListScope includes shared freelancer handoffs', async () => {
    const { candidateListScope } = require('../utils/dataScope');
    const req = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
      query: {},
    };
    const scope = await candidateListScope(req, 'mine');
    expect(JSON.stringify(scope)).toContain('sharedWith.userId');
  });

  test('recruiter view=mine uses SPOC desk', () => {
    const req = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
    };
    const filter = candidateListFilter(req, 'mine');
    const desk = filter.$or?.[0]?.$and?.[0] || filter.$and?.[0];
    const spocBranch = desk.$or.find((b) => b.$or && b.$or[0]?.spoc);
    expect(spocBranch.$or.every((c) => c.spoc instanceof RegExp)).toBe(true);
  });

  test('freelancer master data is own-only', () => {
    const req = { user: { id: freelancerId, role: 'freelancer', organizationId: orgId } };
    const scope = masterDataScope(req);
    expect(scope.organizationId).toEqual(orgId);
    expect(scope.createdBy).toBeDefined();
  });

  test('freelancer write scope includes createdBy', () => {
    const req = { user: { id: freelancerId, role: 'freelancer', organizationId: orgId } };
    const scope = orgOrOwnerScope(req);
    expect(scope.organizationId).toEqual(orgId);
    expect(scope.createdBy).toBeDefined();
  });

  test('admin write scope is org-only (can see freelancer rows)', () => {
    const req = { user: { id: recruiterId, role: 'admin', organizationId: orgId } };
    expect(orgOrOwnerScope(req)).toEqual({ organizationId: orgId });
  });

  test('freelancer job list is Open non-template only', () => {
    const req = { user: { id: freelancerId, role: 'freelancer', organizationId: orgId } };
    const filter = jobListFilter(req);
    expect(filter.status).toEqual({ $regex: /^open$/i });
    expect(filter.isTemplate).toEqual({ $ne: true });
    expect(filter.organizationId).toEqual(orgId);
  });

  test('recruiter job list is not status-restricted', () => {
    const req = { user: { id: recruiterId, role: 'hr_recruiter', organizationId: orgId } };
    expect(jobListFilter(req).status).toBeUndefined();
  });

  test('freelancer applications filtered by metadata.submittedBy', () => {
    const filter = applicationListFilter(orgId, { id: freelancerId, role: 'freelancer' });
    expect(filter['metadata.submittedBy']).toBe(String(freelancerId));
  });

  test('withoutUnsharedFreelancerDesks is a no-op for freelancer', async () => {
    const req = { user: { id: freelancerId, role: 'freelancer', organizationId: orgId } };
    const base = { organizationId: orgId };
    await expect(withoutUnsharedFreelancerDesks(req, base)).resolves.toEqual(base);
  });

  test('canViewOrgAnalytics is owner/admin/manager only', () => {
    expect(canViewOrgAnalytics({ role: 'owner' })).toBe(true);
    expect(canViewOrgAnalytics({ role: 'admin' })).toBe(true);
    expect(canViewOrgAnalytics({ role: 'hr_manager' })).toBe(true);
    expect(canViewOrgAnalytics({ role: 'hr_recruiter' })).toBe(false);
    expect(canViewOrgAnalytics({ role: 'sales' })).toBe(false);
    expect(canViewOrgAnalytics({ role: 'freelancer' })).toBe(false);
  });

  test('recruiter analytics use SPOC name only (not createdBy)', async () => {
    const otherId = new mongoose.Types.ObjectId();
    const req = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
      query: { userId: String(otherId) },
    };
    const scope = await analyticsScope(req);
    expect(scope.$and).toBeDefined();
    const desk = scope.$and[0];
    const spocBranch = desk.$or.find((b) => b.$or && b.$or[0]?.spoc);
    const deskOr = spocBranch.$or;
    expect(deskOr.every((c) => c.spoc instanceof RegExp)).toBe(true);
    expect(deskOr.some((c) => c.createdBy)).toBe(false);
    expect(deskOr.some((c) => c['sharedWith.userId'])).toBe(false);
    expect(analyticsScopeMeta(req)).toMatchObject({
      canSelectEmployee: false,
      scope: 'employee',
    });
  });

  test('manager analytics default to org-wide', async () => {
    const req = { user: { id: recruiterId, role: 'hr_manager', organizationId: orgId }, query: {} };
    const scope = await analyticsScope(req);
    expect(scope.organizationId.$in).toEqual(expect.arrayContaining([orgId, String(orgId)]));
    expect(analyticsScopeMeta(req)).toMatchObject({
      canSelectEmployee: true,
      scope: 'organization',
      scopedUserId: null,
    });
  });

  test('manager analytics for self uses SPOC filter', async () => {
    const req = {
      user: {
        id: recruiterId,
        role: 'admin',
        organizationId: orgId,
        name: 'Test Admin',
        email: 'admin@example.com',
      },
      query: { userId: String(recruiterId) },
    };
    const scope = await analyticsScope(req);
    const spocBranch = scope.$and[0].$or.find((b) => b.$or && b.$or[0]?.spoc);
    expect(spocBranch.$or.every((c) => c.spoc instanceof RegExp)).toBe(true);
    expect(analyticsScopeMeta(req).scope).toBe('employee');
  });

  test('spocOwnershipClauses matches first name used in Skillnix SPOC field', () => {
    const { spocOwnershipClauses } = require('../utils/dataScope');
    const clauses = spocOwnershipClauses({
      name: 'RANGOLI NEGI',
      email: 'rangoli@skillnixrecruitment.com',
    });
    expect(clauses.length).toBeGreaterThanOrEqual(2);
    expect(clauses.some((c) => c.spoc.test('RANGOLI'))).toBe(true);
    expect(clauses.some((c) => c.spoc.test('RANGOLI NEGI'))).toBe(true);
    expect(clauses.some((c) => c.spoc.test('PAYAL'))).toBe(false);
  });

  test('spocOwnershipClauses tolerates single-letter typo and blank createdBy rows', () => {
    const { spocOwnershipClauses, employeeDeskFilter } = require('../utils/dataScope');
    const clauses = spocOwnershipClauses({
      name: 'AMANPREET KAUR',
      email: 'amanpreet@skillnixrecruitment.com',
    });
    expect(clauses.some((c) => c.spoc.test('AMANPRREET KAUR'))).toBe(true);
    expect(clauses.some((c) => c.spoc.test('AMANPREET KAUR'))).toBe(true);

    const desk = employeeDeskFilter(
      {
        id: recruiterId,
        role: 'hr_recruiter',
        name: 'AMANPREET KAUR',
        email: 'amanpreet@skillnixrecruitment.com',
      },
      orgId
    );
    // Desk is SPOC variants OR blank-SPOC createdBy — not raw createdBy of others
    expect(JSON.stringify(desk)).toContain('createdBy');
    expect(JSON.stringify(desk)).toContain('$or');
  });

  test('manager analytics reject invalid employee ids', async () => {
    const req = {
      user: { id: recruiterId, role: 'owner', organizationId: orgId },
      query: { userId: 'not-an-id' },
    };
    await expect(analyticsScope(req)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('recruiter application analytics are assigned-to self', async () => {
    const req = { user: { id: recruiterId, role: 'hr_recruiter', organizationId: orgId } };
    const scope = await applicationAnalyticsScope(req);
    expect(scope.organizationId).toEqual(orgId);
    expect(scope.$or).toEqual(expect.arrayContaining([
      { assignedTo: { $in: [recruiterId, String(recruiterId)] } },
      { 'metadata.submittedBy': String(recruiterId) },
    ]));
  });

  test('manager application analytics default to org-wide', async () => {
    const req = { user: { id: recruiterId, role: 'owner', organizationId: orgId }, query: {} };
    await expect(applicationAnalyticsScope(req)).resolves.toEqual({ organizationId: orgId });
  });

  test('manager candidate list with userId uses that employee SPOC desk', async () => {
    const { candidateListScope } = require('../utils/dataScope');
    const req = {
      user: {
        id: recruiterId,
        role: 'owner',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'owner@example.com',
      },
      query: { userId: String(recruiterId), view: 'mine' },
    };
    const scope = await candidateListScope(req, 'mine');
    expect(scope.$or).toBeDefined();
    expect(JSON.stringify(scope)).toContain('sharedWith.userId');
    const desk = scope.$or[0];
    const spocBranch = (desk.$and?.[0] || desk).$or?.find((b) => b.$or && b.$or[0]?.spoc)
      || desk.$or?.find((b) => b.$or && b.$or[0]?.spoc);
    expect(spocBranch.$or.every((c) => c.spoc instanceof RegExp)).toBe(true);
    expect(spocBranch.$or.some((c) => c.spoc.test('RANGOLI'))).toBe(true);
  });

  test('manager candidate list without userId stays org-wide for view=all', async () => {
    const { candidateListScope } = require('../utils/dataScope');
    const req = {
      user: { id: recruiterId, role: 'admin', organizationId: orgId, name: 'Admin' },
      query: { view: 'all' },
    };
    const scope = await candidateListScope(req, 'all');
    expect(scope.organizationId?.$in || scope.$and?.[0]?.organizationId?.$in)
      .toEqual(expect.arrayContaining([orgId, String(orgId)]));
    // Leadership must see freelancer desks too (no sharedWith gate)
    expect(JSON.stringify(scope)).not.toContain('sharedWith.userId');
  });

  test('recruiter never gets full org candidate list', async () => {
    const { candidateListScope } = require('../utils/dataScope');
    const req = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
      query: { view: 'all' },
    };
    const scope = await candidateListScope(req, 'all');
    expect(JSON.stringify(scope)).toContain('sharedWith.userId');
    expect(scope.organizationId).toBeUndefined();
  });

  test('withoutUnsharedFreelancerDesks is a no-op for owner/admin/manager', async () => {
    const req = { user: { id: recruiterId, role: 'owner', organizationId: orgId } };
    const base = { organizationId: orgId };
    await expect(withoutUnsharedFreelancerDesks(req, base)).resolves.toEqual(base);
  });

  test('recruiter write scope is desk or shared, not full org', () => {
    const { candidateWriteScope } = require('../utils/dataScope');
    const req = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
    };
    const scope = candidateWriteScope(req);
    expect(scope.$or).toBeDefined();
    expect(JSON.stringify(scope)).not.toContain('"organizationId":"' + String(orgId) + '"');
  });

  test('manager write scope is org-wide', () => {
    const { candidateWriteScope } = require('../utils/dataScope');
    const req = {
      user: { id: recruiterId, role: 'owner', organizationId: orgId, name: 'Owner' },
    };
    const scope = candidateWriteScope(req);
    expect(scope.organizationId?.$in || scope.organizationId).toBeTruthy();
  });

  test('resume preview follows list view, not write scope', () => {
    const { candidateResumeScope } = require('../utils/dataScope');
    const recruiter = {
      user: {
        id: recruiterId,
        role: 'hr_recruiter',
        organizationId: orgId,
        name: 'RANGOLI NEGI',
        email: 'rangoli@example.com',
      },
    };
    const allView = candidateResumeScope({ ...recruiter, query: { view: 'all' } });
    expect(allView).toEqual({ organizationId: orgId });

    const freelancerReq = {
      user: { id: freelancerId, role: 'freelancer', organizationId: orgId },
      query: { view: 'all' },
    };
    const ownOnly = candidateResumeScope(freelancerReq);
    expect(ownOnly.organizationId).toEqual(orgId);
    expect(ownOnly.createdBy).toBeDefined();
  });

  test('org A resume scope never matches org B', () => {
    const { candidateResumeScope } = require('../utils/dataScope');
    const orgB = new mongoose.Types.ObjectId();
    const scope = candidateResumeScope({
      user: { id: recruiterId, role: 'admin', organizationId: orgId },
      query: { view: 'all' },
    });
    expect(scope.organizationId).toEqual(orgId);
    expect(scope.organizationId).not.toEqual(orgB);
  });
});
