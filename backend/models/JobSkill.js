const mongoose = require('mongoose');

const jobSkillSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  skillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true,
    index: true
  },
  required: { type: Boolean, default: true },
  minProficiency: { type: Number, min: 1, max: 5, default: 2 },
  weight: { type: Number, min: 0.5, max: 5, default: 1 }
}, { timestamps: true });

jobSkillSchema.index({ jobId: 1, skillId: 1 }, { unique: true });
jobSkillSchema.index({ organizationId: 1, skillId: 1 });

module.exports = mongoose.model('JobSkill', jobSkillSchema);
