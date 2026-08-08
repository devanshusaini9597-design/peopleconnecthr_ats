const mongoose = require('mongoose');

const candidateCommentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPrivate: { type: Boolean, default: false }
}, { timestamps: true });

candidateCommentSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 });

module.exports = mongoose.model('CandidateComment', candidateCommentSchema);
