const mongoose = require('mongoose');

/**
 * Platform-wide status incidents — public status page (not plan-gated).
 */
const statusIncidentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['investigating', 'identified', 'monitoring', 'resolved'],
    default: 'investigating'
  },
  impact: {
    type: String,
    enum: ['none', 'minor', 'major', 'critical'],
    default: 'minor'
  },
  affectedComponents: [{ type: String }],
  startedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  updates: [{
    message: { type: String, required: true },
    status: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

statusIncidentSchema.index({ startedAt: -1 });
statusIncidentSchema.index({ status: 1 });

module.exports = mongoose.model('StatusIncident', statusIncidentSchema);
