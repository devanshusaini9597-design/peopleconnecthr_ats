const mongoose = require('mongoose');
const { PERMISSIONS } = require('../config/permissions');

/**
 * CustomRole — Enterprise-only permission sets an org can define and assign
 * to users on top of the fixed owner/admin/recruiter/interviewer/readonly
 * roles. A user with a customRoleId uses that role's permission list
 * instead of the DEFAULT_ROLE_PERMISSIONS fallback for their base `role`.
 */
const customRoleSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  permissions: {
    type: [String],
    default: [],
    validate: {
      validator: (arr) => arr.every((p) => PERMISSIONS.includes(p)),
      message: 'permissions must only contain known permission keys'
    }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

customRoleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomRole', customRoleSchema);
