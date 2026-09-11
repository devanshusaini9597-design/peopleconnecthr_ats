const mongoose = require('mongoose');

const teamTagSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  handle: { type: String, required: true, trim: true, lowercase: true, maxlength: 32 },
  color: {
    type: String,
    enum: ['brand', 'teal', 'amber', 'sky', 'rose', 'violet'],
    default: 'brand',
  },
  memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

teamTagSchema.index({ organizationId: 1, handle: 1 }, { unique: true });
teamTagSchema.index({ organizationId: 1, createdBy: 1 });
teamTagSchema.plugin(require('../utils/tenantPlugin'));

module.exports = mongoose.model('TeamTag', teamTagSchema);
