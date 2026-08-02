const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema({
  order: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  approverRole: { type: String, enum: ['owner', 'admin', 'recruiter'], default: 'admin' },
  approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const approvalWorkflowSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  entityType: { type: String, enum: ['job_req', 'offer'], required: true },
  steps: { type: [approvalStepSchema], default: [] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

approvalWorkflowSchema.index({ organizationId: 1, entityType: 1, isActive: 1 });

module.exports = mongoose.model('ApprovalWorkflow', approvalWorkflowSchema);
