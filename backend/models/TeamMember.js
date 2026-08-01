/**
 * TeamMember — org roster/directory entry, NOT a duplicate identity system.
 *
 * DECISION (recorded per production-readiness review): `TeamMember` and
 * `User` are kept as two intentionally distinct concepts, not two competing
 * systems for "who's on the team":
 *
 * - `User` is the login identity and the ONLY source of truth for RBAC.
 *   `User.role` (owner/admin/recruiter/interviewer/readonly) is what
 *   `rbacMiddleware.requireRole()` actually checks on every protected route.
 *   It is changed exclusively via `PUT /api/organization/members/:userId/role`
 *   (owner-only, in organizationRoutes.js).
 * - `TeamMember` is a roster/directory row layered on top of an *existing*
 *   User (invites require `User.findOne({ email })` to already exist — see
 *   teamRoutes.js — this never creates a login account). Its `role` field is
 *   a free-text job title/category ("Team Lead", "HR Manager", "SPOC", ...)
 *   used purely for grouping/display in the Team page UI, plus invitation
 *   workflow state (`invitationStatus`, tokens, timestamps) that has no
 *   equivalent on `User`.
 *
 * Do NOT read `TeamMember.role` for any permission decision — it is display
 * metadata only and is never synced with `User.role` on purpose (they answer
 * different questions: "what do we call this person on the roster?" vs.
 * "what can this person do?").
 *
 * Not deprecated: TeamMember is kept because it's the only place invitation
 * workflow + directory metadata lives today. If a future refactor merges it
 * into User (e.g. `User.title`, `User.invitationStatus`), do it as a single
 * migration touching teamRoutes.js + this model + TeamPage.jsx together.
 */
const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  role: { type: String, default: 'Team Member', trim: true },
  phone: { type: String, default: '', trim: true },
  department: { type: String, default: '', trim: true },
  
  // Invitation system fields for enterprise security
  invitationStatus: { 
    type: String, 
    enum: ['Pending', 'Accepted', 'Declined', 'Active'], 
    default: 'Active' // Existing members are Active by default
  },
  invitedAt: { type: Date, default: null },
  acceptedAt: { type: Date, default: null },
  declinedAt: { type: Date, default: null },
  invitationToken: { type: String, default: null },
  invitationMessage: { type: String, default: '' },
  
  // For tracking who invited this member
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Compound index: unique email per user (legacy, kept for records without an org)
teamMemberSchema.index({ createdBy: 1, email: 1 }, { unique: true });
// Unique email per organization — the correct multi-tenant scope
teamMemberSchema.index({ organizationId: 1, email: 1 }, { unique: true, sparse: true });
// Index for finding pending invitations
teamMemberSchema.index({ invitationStatus: 1 });
teamMemberSchema.index({ invitationToken: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
