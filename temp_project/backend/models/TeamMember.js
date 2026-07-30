const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema({
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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

// Compound index: unique email per user
teamMemberSchema.index({ createdBy: 1, email: 1 }, { unique: true });
// Index for finding pending invitations
teamMemberSchema.index({ invitationStatus: 1 });
teamMemberSchema.index({ invitationToken: 1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
