/**
 * Single source of truth for resolving the MongoDB connection string.
 *
 * In production we REFUSE to fall back to a local database: a missing
 * MONGODB_URL almost always means a misconfigured deploy, and silently
 * connecting to `mongodb://localhost/...` risks writing tenant data to the
 * wrong place (or losing it). Fail fast instead.
 *
 * Outside production we keep a localhost fallback for convenience.
 */
const DEV_FALLBACK = 'mongodb://localhost:27017/allinone';

function resolveMongoUrl() {
  const url =
    process.env.MONGODB_URL ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL;

  if (url && url.trim()) return url.trim();

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FATAL: MONGODB_URL is not set. Refusing to start in production without an ' +
      'explicit database connection string (set MONGODB_URL / MONGODB_URI / DATABASE_URL).'
    );
  }

  return DEV_FALLBACK;
}

/** Mask credentials for safe logging. */
function maskMongoUrl(url) {
  return String(url || '').replace(/^(mongodb(?:\+srv)?:\/\/[^:]+):[^@]+@/, '$1:****@');
}

module.exports = { resolveMongoUrl, maskMongoUrl, DEV_FALLBACK };
