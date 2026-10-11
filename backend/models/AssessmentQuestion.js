/**
 * Reusable question bank records, tenant-scoped.
 */
const mongoose = require('mongoose');

const assessmentQuestionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  type: {
    type: String,
    enum: ['multiple_choice', 'text', 'code', 'communication'],
    required: true,
  },
  prompt: { type: String, required: true, trim: true },
  language: { type: String, default: '' },
  options: [{ type: String, trim: true }],
  correctOptionIndex: { type: Number },
  points: { type: Number, default: 10, min: 0 },
  required: { type: Boolean, default: true },
  skillTag: { type: String, default: '', trim: true },
  section: { type: String, default: '', trim: true },
  rubric: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
  hiddenTests: [{
    name: { type: String, default: '' },
    input: { type: String, default: '' },
    expected: { type: String, default: '' },
  }],
  archivedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

assessmentQuestionSchema.index({ organizationId: 1, skillTag: 1, createdAt: -1 });
assessmentQuestionSchema.index({ organizationId: 1, prompt: 1 });

module.exports = mongoose.model('AssessmentQuestion', assessmentQuestionSchema);
