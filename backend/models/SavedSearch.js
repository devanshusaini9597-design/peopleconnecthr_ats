const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  query: { type: String, default: '' },
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  alertFrequency: { type: String, enum: ['none', 'instant', 'daily', 'weekly'], default: 'none' },
  lastAlertAt: { type: Date },
  lastResultCount: { type: Number, default: 0 }
}, { timestamps: true });

savedSearchSchema.index({ organizationId: 1, userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
