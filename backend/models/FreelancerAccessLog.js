const mongoose = require('mongoose');

const freelancerAccessLogSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  action: { type: String, enum: ['suspended', 'restored', 'removed'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, default: '' },
}, { timestamps: true });

freelancerAccessLogSchema.index({ organizationId: 1, freelancerId: 1, createdAt: -1 });

module.exports = mongoose.model('FreelancerAccessLog', freelancerAccessLogSchema);
