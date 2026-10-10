const mongoose = require('mongoose');

const freelancerApplicationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  /** Public case reference, e.g. SKILLNIX-PART-000001. Stable for the life of the record. */
  referenceCode: { type: String, default: '', trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  phone: { type: String, default: '', trim: true },
  location: { type: String, default: '', trim: true },
  linkedinUrl: { type: String, default: '', trim: true },
  currentCompany: { type: String, default: '', trim: true },
  yearsExperience: { type: String, default: '', trim: true },
  specializations: { type: String, default: '', trim: true },
  rolesHired: { type: String, default: '', trim: true },
  availability: { type: String, default: '', trim: true },
  commercialNote: { type: String, default: '', trim: true },
  coverNote: { type: String, default: '', trim: true, maxlength: 4000 },
  resumePath: { type: String, default: '' },
  resumeOriginalName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'invited', 'approved', 'joined', 'rejected'],
    default: 'pending',
    index: true,
  },
  /** When the application entered its current public status. */
  statusEnteredAt: { type: Date, default: null },
  inviteUrl: { type: String, default: '' },
  inviteEmailSent: { type: Boolean, default: false },
  reviewNote: { type: String, default: '', trim: true, maxlength: 2000 },
  /** Users who have opened this application. Unseen pending rows stay “new”. */
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  contactedAt: { type: Date, default: null },
  invitedAt: { type: Date, default: null },
  joinedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  statusHistory: [{
    status: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    actorName: { type: String, default: '', trim: true, maxlength: 120 },
  }],
}, { timestamps: true });

freelancerApplicationSchema.index({ organizationId: 1, email: 1 }, { unique: true });
freelancerApplicationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
freelancerApplicationSchema.index({ organizationId: 1, referenceCode: 1 });

module.exports = mongoose.model('FreelancerApplication', freelancerApplicationSchema);
