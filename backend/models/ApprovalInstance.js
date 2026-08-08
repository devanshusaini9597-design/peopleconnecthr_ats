const mongoose = require('mongoose');

const instanceStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  name: { type: String, required: true },
  approverRole: { type: String },
  approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped'], default: 'pending' },
  actedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actedAt: { type: Date },
  comment: { type: String, default: '' }
}, { _id: true });

const approvalInstanceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalWorkflow', required: true },
  entityType: { type: String, enum: ['job_req', 'offer'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  entityLabel: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  currentStepIndex: { type: Number, default: 0 },
  steps: { type: [instanceStepSchema], default: [] },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

approvalInstanceSchema.index({ organizationId: 1, status: 1 });
approvalInstanceSchema.index({ organizationId: 1, entityType: 1, entityId: 1 });

module.exports = mongoose.model('ApprovalInstance', approvalInstanceSchema);
