/**
 * Set Skillnix org logo to the hosted public asset used in emails.
 * Usage: node scripts/set-skillnix-email-logo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');

// Cache-bust so inbox clients pick up the full wordmark logo.
const LOGO_URL =
  process.env.SKILLNIX_LOGO_URL ||
  `${String(process.env.FRONTEND_URL || 'https://www.peopleconnecthr.com').replace(/\/$/, '')}/skillnix-logo.png?v=3`;

async function main() {
  if (!process.env.MONGODB_URL) throw new Error('MONGODB_URL missing');
  await mongoose.connect(process.env.MONGODB_URL);

  const filter = {
    $or: [
      { name: /skillnix/i },
      { domain: /skillnix/i },
      { allowedDomains: { $elemMatch: { $regex: /skillnix/i } } },
    ],
  };

  const orgs = await Organization.find(filter).select('name domain logo').lean();
  console.log('Matched orgs:', orgs.map((o) => ({ id: o._id, name: o.name, domain: o.domain })));

  const res = await Organization.updateMany(filter, {
    $set: {
      logo: LOGO_URL,
      'atsSettings.brandColor': '#5b21b6',
    },
  });

  console.log('Updated:', res.modifiedCount, 'logo ->', LOGO_URL);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
