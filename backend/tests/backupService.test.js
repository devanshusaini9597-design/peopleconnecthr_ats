const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const {
  dbNameFromUri,
  assertSafeRestoreTarget,
  dumpMongoToDir,
  restoreMongoFromDir,
  runBackup,
  runRestoreTest,
  RESTORE_DB_PREFIX,
} = require('../services/backupService');

describe('backup and restore', () => {
  it('refuses to restore onto the source database', () => {
    expect(() => assertSafeRestoreTarget('ats', 'ats')).toThrow(/source database/);
  });

  it('refuses restore onto a non-test database name', () => {
    expect(() => assertSafeRestoreTarget('ats', 'production')).toThrow(/skillnix_restore_test/);
  });

  it('allows restore onto a throwaway test database', () => {
    expect(() => assertSafeRestoreTarget('ats', `${RESTORE_DB_PREFIX}_123`)).not.toThrow();
  });

  it('parses the database name from a connection string', () => {
    expect(dbNameFromUri('mongodb://localhost:27017/allinone')).toBe('allinone');
    expect(dbNameFromUri('mongodb+srv://u:p@cluster.mongodb.net/skillnix?retryWrites=true')).toBe('skillnix');
  });

  it('dumps MongoDB and restores matching counts onto a throwaway database', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const col = mongoose.connection.db.collection('backup_probe_candidates');
    await col.deleteMany({});
    await col.insertMany([
      { name: 'KETAN', email: 'ketan@example.test', resume: 'resumes/ketan.pdf' },
      { name: 'PRASANTA', email: 'prasanta@example.test', resume: 'resumes/prasanta.doc' },
    ]);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillnix-backup-'));
    const dumped = await dumpMongoToDir(mongoose.connection.db, tmp);
    const probe = dumped.find((c) => c.name === 'backup_probe_candidates');
    expect(probe.count).toBe(2);

    const destName = `${RESTORE_DB_PREFIX}_jest`;
    const dest = mongoose.connection.client.db(destName);
    const restored = await restoreMongoFromDir(dest, tmp);
    const row = restored.find((c) => c.name === 'backup_probe_candidates');
    expect(row.dumped).toBe(2);
    expect(row.restored).toBe(2);
    const sample = await dest.collection('backup_probe_candidates').findOne({ email: 'ketan@example.test' });
    expect(sample.name).toBe('KETAN');
    await dest.dropDatabase();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('runRestoreTest drops the throwaway database after a successful check', async () => {
    if (mongoose.connection.readyState !== 1) return;
    const col = mongoose.connection.db.collection('backup_probe_jobs');
    await col.deleteMany({});
    await col.insertOne({ title: 'Restore probe', status: 'Open' });

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skillnix-backup-run-'));
    const result = await runBackup({ connection: mongoose.connection });
    expect(result.collections.some((c) => c.name === 'backup_probe_jobs' && c.count >= 1)).toBe(true);

    const dumpDir = path.join(result.localDir, 'mongo');
    const restore = await runRestoreTest({
      connection: mongoose.connection,
      dumpDir,
      targetDbName: `${RESTORE_DB_PREFIX}_dropcheck`,
    });
    expect(restore.ok).toBe(true);
    const leftover = await mongoose.connection.client.db(`${RESTORE_DB_PREFIX}_dropcheck`).listCollections().toArray();
    expect(leftover).toEqual([]);
    fs.rmSync(result.localDir, { recursive: true, force: true });
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
