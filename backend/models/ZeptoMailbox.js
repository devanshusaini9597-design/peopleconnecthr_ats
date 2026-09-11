const mongoose = require('mongoose');

/**
 * Extra ZeptoMail mailboxes (multi-domain).
 * Default mailbox still comes from ZOHO_ZEPTOMAIL_* env.
 * Use this for additional verified domains (e.g. skillnixrecruitment.com).
 */
const zeptoMailboxSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fromEmail: { type: String, required: true, trim: true, lowercase: true },
    apiKey: { type: String, required: true, trim: true },
    apiUrl: { type: String, default: 'https://api.zeptomail.in/', trim: true },
    agentAlias: { type: String, default: '', trim: true },
    displayName: { type: String, default: '', trim: true },
    /** Domains Zepto accepts as From on this agent */
    allowedFromDomains: [{ type: String, lowercase: true, trim: true }],
    /** Domains/orgs that should use this mailbox */
    matchDomains: [{ type: String, lowercase: true, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

zeptoMailboxSchema.index({ matchDomains: 1 });
zeptoMailboxSchema.index({ isActive: 1 });

module.exports = mongoose.model('ZeptoMailbox', zeptoMailboxSchema);
