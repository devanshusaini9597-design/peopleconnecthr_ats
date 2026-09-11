#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { runBackup } = require('../services/backupService');

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUrl) {
    console.error('MONGODB_URL is required');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl);
  const result = await runBackup({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
