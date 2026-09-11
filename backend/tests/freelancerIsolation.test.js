/**
 * Freelancer isolation — deny-only checks. No payloads, no live writes.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const {
  isFreelancer,
  candidateListFilter,
  candidateWriteScope,
  jobListFilter,
  applicationListFilter,
  orgOrOwnerScope,
} = require('../utils/dataScope');

const orgA = new mongoose.Types.ObjectId();
const orgB = new mongoose.Types.ObjectId();
const freelancerId = new mongoose.Types.ObjectId();
const employeeId = new mongoose.Types.ObjectId();
const otherFreelancerId = new mongoose.Types.ObjectId();

const freelancer = {
  id: freelancerId,
  _id: freelancerId,
  role: 'freelancer',
  organizationId: orgA,
};

describe('freelancer isolation', () => {
  it('treats freelancer as a contractor inside the org, not org-wide staff', () => {
    expect(isFreelancer(freelancer)).toBe(true);
    expect(isFreelancer({ role: 'hr_recruiter' })).toBe(false);
  });

  it('cannot list another employee or freelancer desk via view=all', () => {
    const filter = candidateListFilter({ user: freelancer }, 'all');
    expect(filter.organizationId).toEqual(orgA);
    expect(filter.createdBy.$in).toEqual(expect.arrayContaining([freelancerId, String(freelancerId)]));
    expect(filter.hiddenFromFreelancerIds?.$nin).toEqual(
      expect.arrayContaining([freelancerId, String(freelancerId)])
    );
    expect(JSON.stringify(filter)).not.toContain(String(employeeId));
    expect(JSON.stringify(filter)).not.toContain(String(otherFreelancerId));
  });

  it('resume preview scope ignores view=all and stays own desk', () => {
    const { candidateResumeScope } = require('../utils/dataScope');
    const scope = candidateResumeScope({
      user: freelancer,
      query: { view: 'all' },
    });
    expect(scope.organizationId).toEqual(orgA);
    expect(scope.createdBy.$in).toEqual(expect.arrayContaining([freelancerId, String(freelancerId)]));
    expect(JSON.stringify(scope)).not.toContain(String(orgB));
    expect(JSON.stringify(scope)).not.toContain(String(employeeId));
  });

  it('cannot write another person\'s candidate (write scope is own createdBy)', () => {
    const scope = candidateWriteScope({ user: freelancer });
    expect(scope.organizationId).toEqual(orgA);
    expect(scope.createdBy).toBeDefined();
    expect(orgOrOwnerScope({ user: freelancer }).createdBy).toBeDefined();
  });

  it('cannot read another org\'s jobs, and only Open mandates in own org', () => {
    const own = jobListFilter({ user: freelancer });
    expect(own.organizationId).toEqual(orgA);
    expect(own.status).toEqual({ $regex: /^open$/i });
    const other = jobListFilter({
      user: { ...freelancer, organizationId: orgB },
    });
    expect(other.organizationId).toEqual(orgB);
    expect(other.organizationId).not.toEqual(orgA);
  });

  it('application list is only rows they submitted', () => {
    const filter = applicationListFilter(orgA, freelancer, {});
    expect(filter.organizationId).toEqual(orgA);
    expect(filter['metadata.submittedBy']).toBe(String(freelancerId));
  });

  it('SPOC picker does not expose staff emails', () => {
    const src = fs.readFileSync(require.resolve('../services/freelancerService'), 'utf8');
    expect(src).toMatch(/listSpocs[\s\S]*?\.select\('_id name role'\)/);
  });

  it('mandate payload helper strips staff email and phone', () => {
    const { publicStaffContact, attachMandateSpoc } = require('../services/freelancerService');
    expect(publicStaffContact({ _id: '1', name: 'A', email: 'a@x.com', phone: '999', role: 'admin' })).toEqual({
      _id: '1',
      name: 'A',
      role: 'admin',
    });
    const row = attachMandateSpoc(
      {
        hiringManager: { _id: '1', name: 'HM', email: 'hm@org.com', phone: '1', role: 'recruiter' },
        createdBy: { _id: '2', name: 'Poster', email: 'p@org.com', role: 'admin' },
      }
    );
    expect(row.mandateSpoc.email).toBeUndefined();
    expect(row.mandateSpoc.phone).toBeUndefined();
  });

  it('company applications API is staff-only', () => {
    const src = fs.readFileSync(require.resolve('../routes/applicationRoutes'), 'utf8');
    expect(src).toMatch(/router\.get\('\/',\s*requireRecruiterOrAbove/);
    expect(src).toMatch(/router\.get\('\/:id',\s*requireRecruiterOrAbove/);
  });

  it('import-all-to-mine stays staff-only; bulk upload allows freelancers on private desk', () => {
    const src = fs.readFileSync(require.resolve('../routes/candidateRoutes'), 'utf8');
    expect(src).toMatch(/import-all-to-mine',\s*requireRecruiterOrAbove/);
    // Freelancer desk Excel import (same flow as company; scoped in controllers)
    expect(src).toMatch(/bulk-upload-auto',\s*requireFreelancerOrRecruiter/);
    expect(src).toMatch(/bulk-upload',\s*requireFreelancerOrRecruiter/);
    expect(src).toMatch(/bulk-delete',\s*requireFreelancerOrRecruiter/);
  });

  it('org member directory and usage are blocked for freelancers', () => {
    const orgSrc = fs.readFileSync(require.resolve('../routes/organizationRoutes'), 'utf8');
    expect(orgSrc).toMatch(/router\.get\('\/members'[\s\S]*isFreelancer/);
    expect(orgSrc).toMatch(/router\.get\('\/usage',\s*requireRecruiterOrAbove/);
    const teamSrc = fs.readFileSync(require.resolve('../routes/teamRoutes'), 'utf8');
    expect(teamSrc).toMatch(/role === 'freelancer'/);
  });

  it('resume upload allowlist rejects executable and script types', () => {
    const { isAllowedUploadFilename } = require('../utils/uploadAllowlist');
    expect(isAllowedUploadFilename('cv.pdf')).toBe(true);
    expect(isAllowedUploadFilename('cv.docx')).toBe(true);
    expect(isAllowedUploadFilename('malware.exe')).toBe(false);
    expect(isAllowedUploadFilename('payload.js')).toBe(false);
    expect(isAllowedUploadFilename('page.html')).toBe(false);
    expect(isAllowedUploadFilename('run.bat')).toBe(false);
  });

  it('frontend forbids freelancer URL guessing of staff pages', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../frontend/src/components/ProtectedRoute.jsx'),
      'utf8'
    );
    expect(src).toMatch(/freelancerCanOpen/);
    expect(src).toMatch(/\/mandates/);
    expect(src).toMatch(/\/my-pipeline/);
    expect(src).not.toMatch(/'\/jobs'/);
    expect(src).not.toMatch(/'\/organization'/);
    expect(src).not.toMatch(/'\/applications'/);
  });
});
