require('dotenv').config();
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const MisContact = require('../models/MisContact');
const Application = require('../models/Application');
const Job = require('../models/Job');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGO_URI);
  const samples = [
    'suriya.ram14@gmail.com',
    'sk6197573@gmail.com',
    'gowtham446525@gmail.com',
    'prsnajanakiraman199@gmail.com',
    'rajeswari244@gmail.com',
    'monikrish939@gmail.com',
    'roshinijaladeeba2000@gmail.com',
    'shafir1997@gmail.com',
  ];
  const job = await Job.findOne({ jobCode: 'SKILLNIX-2026-0049' }).select('_id organizationId').lean();
  const orgId = job.organizationId;
  const mis = await MisContact.find({ organizationId: orgId, email: { $in: samples } })
    .select('email name source createdAt')
    .lean();
  const cands = await Candidate.find({ organizationId: orgId, email: { $in: samples } })
    .select('email name createdAt source')
    .lean();
  const remainingInBurst = await Candidate.countDocuments({
    organizationId: orgId,
    createdAt: { $gte: new Date('2026-09-25T09:00:00.000Z'), $lte: new Date('2026-09-25T09:10:00.000Z') },
  });
  const apps = await Application.countDocuments({ organizationId: orgId, jobId: job._id });
  console.log(JSON.stringify({
    sampleMisStillThere: mis.map((m) => ({
      email: m.email,
      name: m.name,
      source: m.source,
      misCreatedAt: m.createdAt,
    })),
    sampleStillInCandidates: cands,
    candidatesStillInBulkTagMinute: remainingInBurst,
    applicationsLeftOnJob: apps,
  }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
