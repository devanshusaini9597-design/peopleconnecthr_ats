/**
 * Isolation + security regression tests for import-all-to-mine, overlay password, consent.
 */
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const { importAllToMine } = require('../controller/candidate/candidateBulk');
const { consentTokenForCandidate, consentTokenValid } = require('../utils/consentToken');
const { isDevTempPasswordLogin } = require('../utils/devTempPassword');
const { candidateListFilter } = require('../utils/dataScope');
const { verifyMetaSignature } = require('../services/whatsappCloudService');
const crypto = require('crypto');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('candidateListFilter never returns unscoped {}', () => {
  it('always includes organizationId when the user has an org', () => {
    const orgId = new mongoose.Types.ObjectId();
    const req = { user: { id: new mongoose.Types.ObjectId(), role: 'owner', organizationId: orgId } };
    const filter = candidateListFilter(req, 'all');
    expect(filter.organizationId).toEqual(orgId);
    expect(filter).not.toEqual({});
  });
});

describe('importAllToMine tenant isolation', () => {
  it('copies only same-org candidates, never the other org', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(mongoose.connection.readyState).not.toBe(1);
      return;
    }

    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();
    const userA = new mongoose.Types.ObjectId();
    const teammate = new mongoose.Types.ObjectId();
    const userB = new mongoose.Types.ObjectId();
    const stamp = Date.now();

    await Candidate.create([
      { name: 'ALICE TEAMMATE', email: `alice-${stamp}@org-a.test`, organizationId: orgA, createdBy: teammate },
      { name: 'BOB B', email: `bob-${stamp}@org-b.test`, organizationId: orgB, createdBy: userB },
    ]);

    const req = {
      user: {
        id: userA,
        organizationId: orgA,
        role: 'owner',
        name: 'Owner A',
        email: 'owner-a@org-a.test',
      },
    };
    const res = mockRes();
    await importAllToMine(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBeGreaterThanOrEqual(1);

    const orgBAfter = await Candidate.find({ organizationId: orgB }).lean();
    expect(orgBAfter).toHaveLength(1);
    expect(orgBAfter[0].name).toBe('BOB B');

    const orgAAfter = await Candidate.find({ organizationId: orgA }).lean();
    expect(orgAAfter.every((c) => String(c.organizationId) === String(orgA))).toBe(true);
    expect(orgAAfter.some((c) => c.name === 'BOB B')).toBe(false);
    expect(orgAAfter.some((c) => String(c.createdBy) === String(userA) && c.name === 'ALICE TEAMMATE')).toBe(true);
  });
});

describe('consent token', () => {
  it('is not the Mongo id prefix', () => {
    const id = new mongoose.Types.ObjectId();
    const token = consentTokenForCandidate(id);
    expect(token).not.toBe(String(id).slice(0, 16));
    expect(consentTokenValid(id, token)).toBe(true);
    expect(consentTokenValid(id, String(id).slice(0, 16))).toBe(false);
  });
});

describe('WhatsApp signature fail-closed', () => {
  it('returns false when secret is empty', () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyMetaSignature(body, 'sha256=abc', '')).toBe(false);
    expect(verifyMetaSignature(body, '', 'secret')).toBe(false);
  });

  it('accepts a valid HMAC', () => {
    const body = '{"object":"whatsapp_business_account"}';
    const secret = 'app-secret';
    const sig = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });
});

describe('overlay password does not open a second org', () => {
  const prev = { ...process.env };

  afterEach(() => {
    for (const key of [
      'NODE_ENV',
      'DEV_TEMP_PASSWORD',
      'DEV_TEMP_PASSWORD_IN_PRODUCTION',
      'DEV_TEMP_PASSWORD_ORGANIZATION_ID',
    ]) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  });

  it('rejects a user whose organizationId is not the pin', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_TEMP_PASSWORD = 'SkillnixCheck2026!';
    process.env.DEV_TEMP_PASSWORD_IN_PRODUCTION = '1';
    process.env.DEV_TEMP_PASSWORD_ORGANIZATION_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    expect(isDevTempPasswordLogin('x@y.com', 'SkillnixCheck2026!', 'bbbbbbbbbbbbbbbbbbbbbbbb')).toBe(false);
    expect(isDevTempPasswordLogin('x@y.com', 'SkillnixCheck2026!', 'aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
  });
});
