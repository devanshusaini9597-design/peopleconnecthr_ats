const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MessageThread',
    required: true,
    index: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    default: null
  },
  channel: {
    type: String,
    enum: ['email', 'sms', 'whatsapp'],
    default: 'email'
  },
  direction: {
    type: String,
    enum: ['inbound', 'outbound'],
    required: true
  },
  fromName: { type: String, default: '' },
  fromAddress: { type: String, default: '' },
  toAddress: { type: String, default: '' },
  subject: { type: String, default: '' },
  body: { type: String, default: '' },
  bodyHtml: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'queued', 'sent', 'delivered', 'failed', 'received'],
    default: 'sent'
  },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  errorMessage: { type: String, default: '' },
  sentAt: { type: Date, default: Date.now }
}, { timestamps: true });

messageSchema.index({ threadId: 1, sentAt: 1 });
messageSchema.index({ organizationId: 1, sentAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
