/**
 * TalentPool Model — Add-on: Talent Pools (candidates.talentPools)
 *
 * A talent pool is a named, org-scoped bucket of candidates that is
 * independent of any single job requisition — e.g. "Frontend Bench",
 * "Referrals 2026", "Past Interviewees — Strong No-Hire-Yet". Candidates
 * reference pools via Candidate.talentPoolIds (many-to-many); this model
 * only holds pool metadata so membership stays a single source of truth
 * on the Candidate document.
 */

const mongoose = require('mongoose');

const talentPoolSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  color: { type: String, default: '#6366f1' }, // hex, used as a chip color in the UI
  // Automation (candidates.talentPoolAutomation)
  addOnReject: { type: Boolean, default: false }, // silver-medalist: auto-add on reject
  isDefaultRejectPool: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

talentPoolSchema.index({ organizationId: 1, name: 1 }, { unique: true });

talentPoolSchema.plugin(require('../utils/tenantPlugin'));

module.exports = mongoose.model('TalentPool', talentPoolSchema);
