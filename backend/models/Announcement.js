const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true },
  severity: { type: String, enum: ['info', 'success', 'warning', 'critical'], default: 'info' },
  audience: { type: String, enum: ['all', 'admins', 'recruiters'], default: 'all' },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dismissedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

announcementSchema.index({ organizationId: 1, isActive: 1, startsAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
