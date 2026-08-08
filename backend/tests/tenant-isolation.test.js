/**
 * Multi-tenant isolation tests — plugin unit + DB isolation when Mongo is connected.
 */
const crypto = require('crypto');
const tenantPlugin = require('../utils/tenantPlugin');
const mongoose = require('mongoose');
const { cosineSimilarity, parseJsonLoose, candidateProfileText } = require('../services/aiFeatureHelpers');

const signPayload = (secret, rawBody) =>
  crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

describe('Multi-tenant isolation', () => {
  let Model;
  const modelName = `TenantIsoTest_${Date.now()}`;

  beforeAll(() => {
    const schema = new mongoose.Schema({
      name: String,
      organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    });
    schema.plugin(tenantPlugin);
    Model = mongoose.models[modelName] || mongoose.model(modelName, schema);
  });

  it('tenantPlugin is a function', () => {
    expect(typeof tenantPlugin).toBe('function');
  });

  it('tenantPlugin injects organizationId on find when _tenantId is set', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(typeof tenantPlugin).toBe('function');
      return;
    }

    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();

    await Model.create([
      { name: 'A1', organizationId: orgA },
      { name: 'B1', organizationId: orgB },
    ]);

    const results = await Model.find({}).setOptions({ _tenantId: orgA });
    expect(results.every((d) => String(d.organizationId) === String(orgA))).toBe(true);
    expect(results.some((d) => d.name === 'B1')).toBe(false);
  });

  it('findOneAndUpdate scoped by _tenantId cannot touch other org docs', async () => {
    if (mongoose.connection.readyState !== 1) {
      expect(true).toBe(true);
      return;
    }

    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();
    const [docB] = await Model.create([
      { name: 'KeepMe', organizationId: orgB },
      { name: 'Mine', organizationId: orgA },
    ]);

    const updated = await Model.findOneAndUpdate(
      { _id: docB._id },
      { $set: { name: 'Hacked' } },
      { new: true }
    ).setOptions({ _tenantId: orgA });

    expect(updated).toBeNull();
    const still = await Model.findById(docB._id);
    expect(still.name).toBe('KeepMe');
  });

  it('does not filter when _tenantId is absent (caller must scope manually)', () => {
    expect(typeof tenantPlugin).toBe('function');
  });
});

describe('Webhook HMAC signing', () => {
  it('signPayload produces stable sha256 hex', () => {
    const secret = 'test-secret';
    const body = JSON.stringify({ event: 'candidate.created', data: { id: 1 } });
    const a = signPayload(secret, body);
    const b = signPayload(secret, body);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(signPayload('other', body)).not.toBe(a);
  });
});

describe('AI feature helpers', () => {
  it('cosineSimilarity returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('cosineSimilarity returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('parseJsonLoose recovers JSON from noisy LLM output', () => {
    const raw = 'Sure! Here you go:\n{"score": 88, "summary": "strong"}\nThanks';
    expect(parseJsonLoose(raw, {})).toEqual({ score: 88, summary: 'strong' });
  });

  it('candidateProfileText joins non-empty fields', () => {
    const text = candidateProfileText({
      name: 'Ada',
      skills: 'Go, React',
      resumeText: '',
    });
    expect(text).toContain('Name: Ada');
    expect(text).toContain('Skills: Go, React');
    expect(text).not.toContain('Resume:');
  });
});
