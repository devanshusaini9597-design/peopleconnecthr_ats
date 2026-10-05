/**
 * Untag Campaign-created applications for one Job ID (bulk-mail accident).
 * Does not touch careers applies, recruiter adds, or anyone moved past Applied.
 *
 *   node scripts/untag-campaign-job.js --job SKILLNIX-2026-0049
 *   node scripts/untag-campaign-job.js --job SKILLNIX-2026-0049 --apply
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const jobIdx = args.findIndex((a) => a === '--job' || a === '--jobCode');
  const jobCode = String(args[jobIdx + 1] || 'SKILLNIX-2026-0049').trim().toUpperCase();
  const uri = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!uri) {
    console.error('Set MONGODB_URL in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const job = await Job.findOne({ jobCode, isTemplate: { $ne: true } })
    .select('_id jobCode title role organizationId applicationCount')
    .lean();
  if (!job) {
    console.error(`Job not found: ${jobCode}`);
    process.exit(1);
  }

  const filter = {
    organizationId: job.organizationId,
    jobId: job._id,
    source: 'Campaign',
    stage: 'Applied',
    isHired: { $ne: true },
    isRejected: { $ne: true },
  };
  const apps = await Application.find(filter)
    .select('_id candidateId appliedAt stageHistory source stage')
    .lean();

  const safe = apps.filter((app) => {
    const history = Array.isArray(app.stageHistory) ? app.stageHistory : [];
    if (history.length > 1) return false;
    const remark = String(history[0]?.remark || '');
    return /via campaign/i.test(remark) || history.length <= 1;
  });

  console.log(JSON.stringify({
    jobCode: job.jobCode,
    title: job.title || job.role,
    applicationCount: job.applicationCount,
    campaignApplied: apps.length,
    willUntag: safe.length,
    skippedMoved: apps.length - safe.length,
    dryRun: !apply,
  }, null, 2));

  if (!apply) {
    console.log('Re-run with --apply to remove those Campaign tags.');
    await mongoose.disconnect();
    return;
  }

  const ids = safe.map((a) => a._id);
  const candidateIds = [...new Set(safe.map((a) => String(a.candidateId)))];
  if (ids.length) {
    await Application.deleteMany({ _id: { $in: ids } });
    await Job.findByIdAndUpdate(job._id, { $inc: { applicationCount: -ids.length } });
  }

  const leftover = await Application.find({
    organizationId: job.organizationId,
    candidateId: { $in: candidateIds },
  }).select('candidateId').lean();
  const stillLinked = new Set(leftover.map((a) => String(a.candidateId)));
  const orphanMis = [];
  for (const id of candidateIds) {
    if (stillLinked.has(id)) continue;
    const cand = await Candidate.findById(id).select('source status createdAt').lean();
    if (!cand) continue;
    const created = new Date(cand.createdAt).getTime();
    const recent = Date.now() - created < 1000 * 60 * 60 * 48;
    if (recent && /^mis$/i.test(String(cand.source || '')) && String(cand.status || '').toUpperCase() === 'APPLIED') {
      orphanMis.push(id);
    }
  }
  if (orphanMis.length) {
    await Candidate.deleteMany({ _id: { $in: orphanMis } });
  }

  const remaining = await Application.countDocuments({ organizationId: job.organizationId, jobId: job._id });
  console.log(JSON.stringify({
    untagged: ids.length,
    misOnlyCandidatesRemoved: orphanMis.length,
    remainingApplicationsOnJob: remaining,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
