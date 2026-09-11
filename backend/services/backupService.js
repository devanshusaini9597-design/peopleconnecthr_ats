/**
 * App-level backups: MongoDB collections + resume files.
 * Restore is only allowed onto skillnix_restore_test_* databases unless
 * BACKUP_ALLOW_RESTORE=1. Never overwrites the source database.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { finished } = require('stream/promises');
const { EJSON } = require('bson');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const SKIP_COLLECTIONS = new Set(['system.views', 'system.profile', 'system.users']);
const RESTORE_DB_PREFIX = 'skillnix_restore_test';

function backupRootDir() {
  return path.join(__dirname, '..', 'backups');
}

function stampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function dbNameFromUri(uri) {
  const raw = String(uri || '').trim();
  if (!raw) return '';
  const withoutProto = raw.replace(/^mongodb(\+srv)?:\/\//i, '');
  const afterAt = withoutProto.includes('@') ? withoutProto.slice(withoutProto.lastIndexOf('@') + 1) : withoutProto;
  const pathPart = afterAt.split('/')[1] || '';
  return pathPart.split('?')[0] || '';
}

function assertSafeRestoreTarget(sourceDbName, targetDbName) {
  const source = String(sourceDbName || '').trim();
  const target = String(targetDbName || '').trim();
  if (!target) throw new Error('Restore target database name is required');
  if (source && target === source) {
    throw new Error('Refuse to restore onto the source database');
  }
  const allow = process.env.BACKUP_ALLOW_RESTORE === '1';
  if (!allow && !target.startsWith(RESTORE_DB_PREFIX)) {
    throw new Error(`Restore target must start with ${RESTORE_DB_PREFIX}_ (or set BACKUP_ALLOW_RESTORE=1)`);
  }
}

function shouldSkipCollection(name) {
  return !name || SKIP_COLLECTIONS.has(name) || name.startsWith('system.');
}

async function dumpMongoToDir(db, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const names = await db.listCollections().toArray();
  const collections = [];
  for (const info of names) {
    const name = info.name;
    if (shouldSkipCollection(name)) continue;
    const col = db.collection(name);
    const filePath = path.join(outDir, `${name}.jsonl.gz`);
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(filePath);
    gzip.pipe(out);
    let count = 0;
    for await (const doc of col.find({})) {
      gzip.write(`${EJSON.stringify(doc)}\n`);
      count += 1;
    }
    gzip.end();
    await finished(out);
    collections.push({ name, count, file: path.basename(filePath) });
  }
  return collections;
}

async function restoreMongoFromDir(db, dumpDir) {
  const files = fs.readdirSync(dumpDir).filter((f) => f.endsWith('.jsonl.gz'));
  const collections = [];
  for (const file of files) {
    const name = file.replace(/\.jsonl\.gz$/, '');
    if (shouldSkipCollection(name)) continue;
    const buf = zlib.gunzipSync(fs.readFileSync(path.join(dumpDir, file)));
    const lines = buf.toString('utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const docs = lines.map((line) => EJSON.parse(line));
    if (docs.length) {
      await db.collection(name).insertMany(docs, { ordered: false });
    }
    const count = await db.collection(name).countDocuments();
    collections.push({ name, dumped: docs.length, restored: count });
  }
  return collections;
}

function copyLocalUploads(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return { copied: 0 };
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name);
      const toRel = path.join(rel, entry.name);
      const to = path.join(destDir, toRel);
      if (entry.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        walk(from, toRel);
      } else {
        fs.copyFileSync(from, to);
        copied += 1;
      }
    }
  };
  walk(srcDir);
  return { copied };
}

async function copyResumesToS3Backup(stamp) {
  if (process.env.NODE_ENV === 'test' && process.env.BACKUP_TEST_S3 !== '1') {
    return { copied: 0, skipped: true };
  }
  const s3 = require('./s3Service');
  if (!s3.isS3Configured()) return { copied: 0, skipped: true };
  const prefix = s3.S3_RESUME_PREFIX || 'resumes';
  const keys = await s3.listKeys(`${prefix}/`);
  const destPrefix = `${process.env.BACKUP_S3_PREFIX || 'backups'}/${stamp}/resumes`;
  let copied = 0;
  for (const key of keys) {
    if (!key || key.endsWith('/')) continue;
    const destKey = `${destPrefix}/${key.replace(/^resumes\//, '')}`;
    await s3.copyKey({ sourceKey: key, destKey });
    copied += 1;
  }
  return { copied, skipped: false, destPrefix };
}

async function uploadDumpDirToS3(stamp, dumpDir) {
  if (process.env.NODE_ENV === 'test' && process.env.BACKUP_TEST_S3 !== '1') {
    return { uploaded: 0, skipped: true };
  }
  const s3 = require('./s3Service');
  if (!s3.isS3Configured()) return { uploaded: 0, skipped: true };
  const destPrefix = `${process.env.BACKUP_S3_PREFIX || 'backups'}/${stamp}/mongo`;
  let uploaded = 0;
  for (const file of fs.readdirSync(dumpDir)) {
    const body = fs.readFileSync(path.join(dumpDir, file));
    await s3.putObject({
      key: `${destPrefix}/${file}`,
      body,
      contentType: file.endsWith('.gz') ? 'application/gzip' : 'application/json',
    });
    uploaded += 1;
  }
  return { uploaded, skipped: false, destPrefix };
}

async function runBackup({ connection, dryRun = false } = {}) {
  const conn = connection || mongoose.connection;
  if (!conn?.db) throw new Error('MongoDB is not connected');
  const stamp = stampId();
  const sourceDb = conn.name;
  const localDir = path.join(backupRootDir(), stamp);
  const mongoDir = path.join(localDir, 'mongo');
  const uploadsDir = path.join(localDir, 'uploads');

  if (dryRun) {
    const names = (await conn.db.listCollections().toArray())
      .map((c) => c.name)
      .filter((n) => !shouldSkipCollection(n));
    return { dryRun: true, stamp, sourceDb, collections: names };
  }

  const collections = await dumpMongoToDir(conn.db, mongoDir);
  const localUploads = copyLocalUploads(path.join(__dirname, '..', 'uploads'), uploadsDir);
  const resumes = await copyResumesToS3Backup(stamp).catch((err) => {
    logger.warn('[backup] S3 resume copy failed:', err.message);
    return { copied: 0, skipped: true, error: err.message };
  });
  const manifest = {
    stamp,
    createdAt: new Date().toISOString(),
    sourceDb,
    collections,
    localUploads,
    resumes,
  };
  fs.writeFileSync(path.join(mongoDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const s3Dump = await uploadDumpDirToS3(stamp, mongoDir).catch((err) => {
    logger.warn('[backup] S3 dump upload failed:', err.message);
    return { uploaded: 0, skipped: true, error: err.message };
  });
  manifest.s3Dump = s3Dump;
  fs.writeFileSync(path.join(mongoDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  pruneOldLocalBackups(stamp);
  logger.info({ stamp, sourceDb, collections: collections.length, resumes: resumes.copied }, '[backup] complete');
  return { ...manifest, localDir };
}

function pruneOldLocalBackups(keepStamp) {
  const root = backupRootDir();
  if (!fs.existsSync(root)) return;
  for (const name of fs.readdirSync(root)) {
    if (name === keepStamp) continue;
    fs.rmSync(path.join(root, name), { recursive: true, force: true });
  }
}

async function runRestoreTest({ connection, dumpDir, targetDbName } = {}) {
  const conn = connection || mongoose.connection;
  if (!conn?.client) throw new Error('MongoDB is not connected');
  const sourceDb = conn.name;
  const target = targetDbName || `${RESTORE_DB_PREFIX}_${Date.now()}`;
  assertSafeRestoreTarget(sourceDb, target);

  const resolvedDump = dumpDir || latestLocalDumpDir();
  if (!resolvedDump) throw new Error('No dump directory found. Run a backup first.');

  const dest = conn.client.db(target);
  const restored = await restoreMongoFromDir(dest, resolvedDump);
  const mismatches = restored.filter((row) => row.dumped !== row.restored);
  await dest.dropDatabase();

  const ok = mismatches.length === 0;
  const result = { ok, sourceDb, targetDb: target, restored, mismatches, dumpDir: resolvedDump };
  if (!ok) {
    throw new Error(`Restore test failed: ${JSON.stringify(mismatches)}`);
  }
  logger.info({ target, collections: restored.length }, '[backup] restore test passed');
  return result;
}

function latestLocalDumpDir() {
  const root = backupRootDir();
  if (!fs.existsSync(root)) return null;
  const stamps = fs.readdirSync(root).sort().reverse();
  for (const stamp of stamps) {
    const mongoDir = path.join(root, stamp, 'mongo');
    if (fs.existsSync(mongoDir)) return mongoDir;
  }
  return null;
}

module.exports = {
  RESTORE_DB_PREFIX,
  dbNameFromUri,
  assertSafeRestoreTarget,
  dumpMongoToDir,
  restoreMongoFromDir,
  runBackup,
  runRestoreTest,
  latestLocalDumpDir,
  stampId,
};
