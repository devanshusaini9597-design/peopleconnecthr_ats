require('dotenv').config();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Candidate = require('../models/Candidate');
const MisContact = require('../models/MisContact');
const EmailSendLog = require('../models/EmailSendLog');

async function main() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URL || process.env.MONGO_URI);

  const job = await Job.findOne({ jobCode: 'SKILLNIX-2026-0049', isTemplate: { $ne: true } })
    .select('_id organizationId jobCode')
    .lean();
  if (!job) throw new Error('job not found');
  const orgId = job.organizationId;

  const since = new Date('2026-09-24T18:30:00.000Z'); // 25 Sep IST start-ish
  const until = new Date('2026-09-25T18:30:00.000Z');

  const createdToday = await Candidate.find({
    organizationId: orgId,
    createdAt: { $gte: since, $lte: until },
  }).select('_id email name source status createdAt createdBy').lean();

  const candIds = createdToday.map((c) => c._id);
  const stillApps = candIds.length
    ? await Application.find({ organizationId: orgId, candidateId: { $in: candIds } }).select('candidateId jobId source').lean()
    : [];
  const withApp = new Set(stillApps.map((a) => String(a.candidateId)));

  const logs = await EmailSendLog.find({
    organizationId: orgId,
    createdAt: { $gte: since, $lte: until },
    $or: [
      { subject: /SKILLNIX-2026-0049|SALES OFFICER/i },
      { textBody: /SKILLNIX-2026-0049/i },
      { htmlBody: /SKILLNIX-2026-0049/i },
      { campaignName: /SKILLNIX-2026-0049/i },
    ],
  }).select('subject createdAt recipients').lean();

  const mailed = new Set();
  for (const log of logs) {
    for (const r of log.recipients || []) {
      const e = String(r.email || '').trim().toLowerCase();
      if (e) mailed.add(e);
    }
  }

  const orphans = createdToday.filter((c) => !withApp.has(String(c._id)));
  const mailedOrphans = orphans.filter((c) => mailed.has(String(c.email || '').trim().toLowerCase()));
  const allOrphansIfNoMail = mailed.size ? mailedOrphans : orphans;

  const emails = allOrphansIfNoMail.map((c) => String(c.email || '').trim().toLowerCase()).filter(Boolean);
  const misHits = emails.length
    ? await MisContact.find({
      organizationId: orgId,
      email: { $in: emails },
    }).select('email').lean()
    : [];
  const misEmails = new Set(misHits.map((m) => String(m.email || '').trim().toLowerCase()));
  const misBacked = allOrphansIfNoMail.filter((c) => misEmails.has(String(c.email || '').trim().toLowerCase()));

  const sources = {};
  for (const c of misBacked) {
    const k = String(c.source || '(blank)');
    sources[k] = (sources[k] || 0) + 1;
  }

  console.log(JSON.stringify({
    createdToday: createdToday.length,
    createdTodayWithApps: withApp.size,
    createdTodayNoApps: orphans.length,
    emailLogs: logs.length,
    mailedAddresses: mailed.size,
    mailedOrphans: mailedOrphans.length,
    misBackedNoApps: misBacked.length,
    sources,
    sample: misBacked.slice(0, 8).map((c) => ({
      name: c.name,
      email: c.email,
      source: c.source,
      status: c.status,
      createdAt: c.createdAt,
    })),
    dryRun: !apply,
  }, null, 2));

  if (!apply) {
    await mongoose.disconnect();
    return;
  }

  const ids = misBacked.map((c) => c._id);
  if (!ids.length) {
    console.log('Nothing to delete');
    await mongoose.disconnect();
    return;
  }
  const res = await Candidate.deleteMany({
    _id: { $in: ids },
    organizationId: orgId,
  });
  console.log(JSON.stringify({ deleted: res.deletedCount }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
