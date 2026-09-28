require('dotenv').config();
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const MisContact = require('../models/MisContact');
const Application = require('../models/Application');
const Job = require('../models/Job');
const StageHistory = require('../models/StageHistory');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGO_URI);
  const job = await Job.findOne({ jobCode: 'SKILLNIX-2026-0049' }).select('_id organizationId').lean();
  const orgId = job.organizationId;

  const burstStart = new Date('2026-09-25T09:04:00.000Z');
  const burstEnd = new Date('2026-09-25T09:06:00.000Z');
  const beforeBurst = new Date('2026-09-25T09:04:00.000Z');

  const candidatesBefore = await Candidate.countDocuments({
    organizationId: orgId,
    createdAt: { $lt: beforeBurst },
  });
  const oldest = await Candidate.find({ organizationId: orgId })
    .sort({ createdAt: 1 })
    .limit(3)
    .select('name email createdAt source')
    .lean();
  const misCount = await MisContact.countDocuments({ organizationId: orgId });
  const remainingBurstCands = await Candidate.countDocuments({
    organizationId: orgId,
    createdAt: { $gte: burstStart, $lte: burstEnd },
  });
  const appsOnJob = await Application.find({ organizationId: orgId, jobId: job._id })
    .populate('candidateId', 'name email createdAt source')
    .lean();

  const creates = await StageHistory.find({
    organizationId: orgId,
    origin: 'create',
    changedAt: { $gte: burstStart, $lte: burstEnd },
  }).select('candidateId changedAt toStage source').lean();

  const stillExist = creates.length
    ? await Candidate.countDocuments({ _id: { $in: creates.map((e) => e.candidateId) } })
    : 0;

  const sampleOlderEmails = oldest.map((c) => String(c.email || '').toLowerCase()).filter(Boolean);
  const olderStill = sampleOlderEmails.length
    ? await Candidate.find({ organizationId: orgId, email: { $in: sampleOlderEmails } }).select('email name createdAt').lean()
    : [];

  console.log(JSON.stringify({
    candidatesCreatedBeforeBulkTag: candidatesBefore,
    remainingCandidatesFromBulkTagMinute: remainingBurstCands,
    misDirectoryCount: misCount,
    stageHistoryCreatesInBurst: creates.length,
    thoseCreateIdsStillInCandidates: stillExist,
    realAppsStillOnJob: appsOnJob.map((a) => ({
      email: a.candidateId?.email,
      name: a.candidateId?.name,
      candidateCreatedAt: a.candidateId?.createdAt,
      source: a.source,
      stage: a.stage,
    })),
    oldestCandidatesStillThere: olderStill.length ? olderStill : oldest,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
