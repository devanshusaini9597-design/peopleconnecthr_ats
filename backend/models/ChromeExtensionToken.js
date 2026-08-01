const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * ChromeExtensionToken — Add-on: Chrome LinkedIn Import (always available,
 * no plan gate — a "fix-and-flip" differentiator, not a paywalled feature).
 *
 * Deliberately separate from the ApiKey model (/api/v1/public/*, gated by
 * 'integrations.webhooksReadOnly'): the extension is meant to work on every
 * plan, so it can't share that gated key type. One active token per org —
 * regenerating invalidates the previous one, same UX as the API Keys page.
 */
const chromeExtensionTokenSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  tokenPrefix: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUsedAt: { type: Date },
  importCount: { type: Number, default: 0 }
}, { timestamps: true });

const hashToken = (plaintext) => crypto.createHash('sha256').update(plaintext).digest('hex');

chromeExtensionTokenSchema.statics.generate = () => {
  const plaintext = `cext_${crypto.randomBytes(24).toString('hex')}`;
  return { plaintext, tokenHash: hashToken(plaintext), tokenPrefix: plaintext.slice(0, 14) };
};

chromeExtensionTokenSchema.statics.hashToken = hashToken;

module.exports = mongoose.model('ChromeExtensionToken', chromeExtensionTokenSchema);
