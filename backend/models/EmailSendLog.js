const mongoose = require('mongoose');

/**
 * Enterprise outbound email ledger — transactional (ZeptoMail) + marketing (Zoho Campaigns).
 * One document per send action; recipients[] holds per-address engagement.
 */
const recipientSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    status: {
      type: String,
      enum: [
        'queued',
        'sent',
        'delivered',
        'opened',
        'clicked',
        'soft_bounced',
        'hard_bounced',
        'failed',
        'unsubscribed',
        'spam',
        'unopened',
        'replied',
      ],
      default: 'sent',
    },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },
    bouncedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
    openCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    bounceType: { type: String, default: '' },
    bounceReason: { type: String, default: '' },
    clickUrls: [{ type: String }],
    providerContactId: { type: String, default: '' },
  },
  { _id: false }
);

const emailSendLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
    sentByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    channel: {
      type: String,
      enum: ['transactional', 'marketing', 'system'],
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['zeptomail', 'zoho_campaigns', 'smtp', 'unknown'],
      default: 'unknown',
      index: true,
    },
    emailType: { type: String, default: '' }, // interview, rejection, custom, otp, campaign, …
    subject: { type: String, default: '' },
    fromEmail: { type: String, default: '' },
    replyToEmail: { type: String, default: '' },
    campaignName: { type: String, default: '' },
    campaignKey: { type: String, default: '', index: true },
    messageId: { type: String, default: '', index: true },
    requestId: { type: String, default: '' },
    emailReference: { type: String, default: '' },
    clientReference: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: [
        'accepted',
        'sending',
        'sent',
        'delivered',
        'partial',
        'failed',
        'bounced',
        'completed',
      ],
      default: 'accepted',
      index: true,
    },
    recipients: { type: [recipientSchema], default: [] },
    totals: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      softBounced: { type: Number, default: 0 },
      hardBounced: { type: Number, default: 0 },
      unsubscribed: { type: Number, default: 0 },
      spam: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      replied: { type: Number, default: 0 },
      unopened: { type: Number, default: 0 },
    },
    rates: {
      deliveryRate: { type: Number, default: 0 },
      openRate: { type: Number, default: 0 },
      clickRate: { type: Number, default: 0 },
      bounceRate: { type: Number, default: 0 },
      unsubscribeRate: { type: Number, default: 0 },
    },
    providerRaw: { type: mongoose.Schema.Types.Mixed, default: null },
    lastError: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now, index: true },
    lastSyncedAt: { type: Date, default: null },
    syncSource: { type: String, default: '' },
  },
  { timestamps: true }
);

emailSendLogSchema.index({ organizationId: 1, sentAt: -1 });
emailSendLogSchema.index({ organizationId: 1, channel: 1, sentAt: -1 });
emailSendLogSchema.index({ 'recipients.email': 1, organizationId: 1 });

module.exports = mongoose.model('EmailSendLog', emailSendLogSchema);
