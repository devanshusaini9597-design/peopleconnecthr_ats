const mongoose = require('mongoose');

const candidateSkillSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
    index: true
  },
  skillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true,
    index: true
  },
  proficiency: { type: Number, min: 1, max: 5, default: 3 },
  yearsUsed: { type: Number, min: 0, default: null }
}, { timestamps: true });

candidateSkillSchema.index({ candidateId: 1, skillId: 1 }, { unique: true });
candidateSkillSchema.index({ organizationId: 1, skillId: 1 });

module.exports = mongoose.model('CandidateSkill', candidateSkillSchema);
