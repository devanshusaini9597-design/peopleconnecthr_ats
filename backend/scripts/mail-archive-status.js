/**
 * Quick status for mail-archive backfill.
 * Usage: railway run node scripts/mail-archive-status.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EmailSendLog = require('../models/EmailSendLog');
const Message = require('../models/Message');

async function main() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI || process.env.MONGODB_URI;
  await mongoose.connect(mongoUrl);
  const noArch = { $or: [{ archiveKey: { $exists: false } }, { archiveKey: null }, { archiveKey: '' }] };
  const outLeft = await EmailSendLog.countDocuments({
    $and: [
      noArch,
      { $or: [{ htmlBody: { $exists: true, $nin: [null, ''] } }, { textBody: { $exists: true, $nin: [null, ''] } }] },
    ],
  });
  const outDone = await EmailSendLog.countDocuments({ archiveKey: { $exists: true, $nin: [null, ''] } });
  const inLeft = await Message.countDocuments({
    channel: 'email',
    $and: [
      noArch,
      { $or: [{ bodyHtml: { $exists: true, $nin: [null, ''] } }, { body: { $exists: true, $nin: [null, ''] } }] },
    ],
  });
  const inDone = await Message.countDocuments({ channel: 'email', archiveKey: { $exists: true, $nin: [null, ''] } });
  console.log(JSON.stringify({ outboundDone: outDone, outboundLeft: outLeft, inboundDone: inDone, inboundLeft: inLeft }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
