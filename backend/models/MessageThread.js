/**
 * Unified inbox — conversation threads across email / SMS / WhatsApp.
 */

const mongoose = require('mongoose');

const messageThreadSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    default: null,
    index: true
  },
  subject: { type: String, default: '', trim: true },
  channel: {
    type: String,
    enum: ['email', 'sms', 'whatsapp', 'mixed'],
    default: 'email'
  },
  participants: {
    candidateName: { type: String, default: '' },
    candidateEmail: { type: String, default: '' },
    candidatePhone: { type: String, default: '' }
  },
  unreadCount: { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessagePreview: { type: String, default: '' },
  lastDirection: { type: String, enum: ['inbound', 'outbound'], default: 'outbound' },
  starred: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  snoozedUntil: { type: Date, default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  source: { type: String, enum: ['ats', 'imap'], default: 'ats' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedName: { type: String, default: '', trim: true },
  assignedEmail: { type: String, default: '', trim: true, lowercase: true },
  isDraft: { type: Boolean, default: false, index: true },
  draftTo: { type: String, default: '', trim: true },
  draftBody: { type: String, default: '' },
}, { timestamps: true });

messageThreadSchema.index({ organizationId: 1, lastMessageAt: -1 });
messageThreadSchema.index({ organizationId: 1, archived: 1, lastMessageAt: -1 });
messageThreadSchema.index({ organizationId: 1, snoozedUntil: 1, lastMessageAt: -1 });

module.exports = mongoose.model('MessageThread', messageThreadSchema);
