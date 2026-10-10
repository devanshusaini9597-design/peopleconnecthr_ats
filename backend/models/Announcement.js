const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  storedName: { type: String, required: true },
  mime: { type: String, default: '' },
  size: { type: Number, default: 0 },
}, { _id: true });

const receiptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seenAt: { type: Date },
  readAt: { type: Date },
  dismissedAt: { type: Date },
  ackedAt: { type: Date },
}, { _id: false });

const announcementSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  body: { type: String, required: true, trim: true },
  severity: { type: String, enum: ['info', 'success', 'warning', 'critical'], default: 'info' },
  audience: { type: String, enum: ['all', 'admins', 'recruiters', 'freelancers', 'public'], default: 'all' },
  /** draft stays off banners. published can still be scheduled via startsAt. */
  status: { type: String, enum: ['draft', 'published'], default: 'published', index: true },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date },
  isActive: { type: Boolean, default: true },
  pinned: { type: Boolean, default: false },
  /** Reader must acknowledge before the banner can be dismissed. */
  requiresAck: { type: Boolean, default: false },
  targets: {
    departments: [{ type: String, trim: true }],
    locations: [{ type: String, trim: true }],
    offices: [{ type: String, trim: true }],
    teamManagerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  attachments: [attachmentSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  /** Hid the in-app banner for this user (does not clear sidebar badge). */
  dismissedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  /** Opened the Announcements page — clears the sidebar badge only. */
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  /** Opened this notice or clicked Mark as read. */
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  ackedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  receipts: [receiptSchema],
  emailDelivery: {
    status: { type: String, enum: ['skipped', 'queued', 'sent', 'partial', 'failed'], default: 'skipped' },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    finishedAt: { type: Date },
  },
}, { timestamps: true });

announcementSchema.index({ organizationId: 1, isActive: 1, pinned: -1, startsAt: -1 });
announcementSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
