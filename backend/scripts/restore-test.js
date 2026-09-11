#!/usr/bin/env node
/**
 * Restores the latest (or given) dump onto a throwaway skillnix_restore_test_*
 * database, checks document counts, then drops that database.
 * Never writes to the source production database.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const mongoose = require('mongoose');
const { runRestoreTest, latestLocalDumpDir } = require('../services/backupService');

async function main() {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!mongoUrl) {
    console.error('MONGODB_URL is required');
    process.exit(1);
  }
  const dumpArg = process.argv.find((a) => a.startsWith('--from='));
  const dumpDir = dumpArg ? dumpArg.slice('--from='.length) : latestLocalDumpDir();
  if (!dumpDir || !require('fs').existsSync(dumpDir)) {
    console.error('No dump found. Run `npm run backup` first, or pass --from=backend/backups/<stamp>/mongo');
    process.exit(1);
  }
  await mongoose.connect(mongoUrl);
  const result = await runRestoreTest({ dumpDir: path.resolve(dumpDir) });
  console.log(JSON.stringify(result, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
