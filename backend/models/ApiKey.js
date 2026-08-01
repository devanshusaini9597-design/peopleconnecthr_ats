const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * ApiKey — org-issued key for the public REST API (/api/v1/public/*).
 *
 * We store only a SHA-256 hash of the key (`keyHash`), never the plaintext —
 * same principle as password storage. The plaintext is shown to the user
 * exactly once, at creation time, prefixed `sk_live_` for easy recognition
 * in logs/support tickets without revealing the secret itself.
 */
const apiKeySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  keyHash: { type: String, required: true, unique: true },
  keyPrefix: { type: String, required: true }, // first 12 chars, shown in UI so admins can tell keys apart
  scopes: { type: [String], default: ['read'] }, // 'read' | 'write'
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

apiKeySchema.index({ organizationId: 1, isActive: 1 });

const hashKey = (plaintext) => crypto.createHash('sha256').update(plaintext).digest('hex');

/** Generates a new plaintext key + its hash, returns both. Caller stores only the hash. */
apiKeySchema.statics.generate = () => {
  const plaintext = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  return { plaintext, keyHash: hashKey(plaintext), keyPrefix: plaintext.slice(0, 16) };
};

apiKeySchema.statics.hashKey = hashKey;

module.exports = mongoose.model('ApiKey', apiKeySchema);
