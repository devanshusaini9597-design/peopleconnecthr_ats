const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

positionSchema.index({ createdBy: 1, name: 1 }, { unique: true });
positionSchema.index({ organizationId: 1, name: 1 });

positionSchema.plugin(require('../utils/tenantPlugin'));

module.exports = mongoose.model('Position', positionSchema);
