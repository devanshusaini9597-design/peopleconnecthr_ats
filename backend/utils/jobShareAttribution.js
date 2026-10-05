const crypto = require('crypto');

function shareSecret() {
  return process.env.JWT_SECRET || process.env.JOB_SHARE_SECRET || 'dev-only-secret-CHANGE-IN-PRODUCTION';
}

function signJobShareToken({ organizationId, jobId, userId }) {
  const org = String(organizationId || '').trim();
  const job = String(jobId || '').trim();
  const user = String(userId || '').trim();
  if (!org || !job || !user) return '';
  const payload = `${org}.${job}.${user}`;
  const sig = crypto.createHmac('sha256', shareSecret()).update(payload).digest('hex').slice(0, 20);
  return `${user}.${sig}`;
}

function verifyJobShareToken(token, { organizationId, jobId }) {
  const raw = String(token || '').trim();
  const match = raw.match(/^([a-fA-F0-9]{24})\.([a-f0-9]{20})$/);
  if (!match) return null;
  const userId = match[1];
  const expected = signJobShareToken({ organizationId, jobId, userId });
  const a = Buffer.from(String(expected));
  const b = Buffer.from(raw);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

function attachShareVia(jobs, user) {
  const list = Array.isArray(jobs) ? jobs : [];
  const organizationId = user?.organizationId;
  const userId = user?.id || user?._id;
  if (!organizationId || !userId) return list;
  return list.map((row) => {
    const job = row && typeof row.toObject === 'function' ? row.toObject() : { ...(row || {}) };
    const jobId = job._id || job.id;
    if (jobId) {
      job.shareVia = signJobShareToken({ organizationId, jobId, userId });
    }
    return job;
  });
}

module.exports = {
  signJobShareToken,
  verifyJobShareToken,
  attachShareVia,
};
