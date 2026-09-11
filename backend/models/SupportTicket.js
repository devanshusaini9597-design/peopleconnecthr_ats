const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketRef: { type: String, required: true, unique: true, trim: true, uppercase: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: {
    type: String,
    enum: ['query', 'issue', 'feedback', 'feature'],
    required: true,
    index: true,
  },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  pageUrl: { type: String, default: '', trim: true, maxlength: 500 },
  userName: { type: String, default: '', trim: true },
  userEmail: { type: String, default: '', trim: true, lowercase: true },
  userRole: { type: String, default: '', trim: true },
  orgName: { type: String, default: '', trim: true },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved'],
    default: 'open',
    index: true,
  },
  replies: [{
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    authorType: { type: String, enum: ['freelancer', 'support'], required: true },
    authorName: { type: String, default: '', trim: true },
    authorEmail: { type: String, default: '', trim: true, lowercase: true },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

supportTicketSchema.index({ userId: 1, createdAt: -1 });
supportTicketSchema.index({ organizationId: 1, status: 1, updatedAt: -1 });
supportTicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
