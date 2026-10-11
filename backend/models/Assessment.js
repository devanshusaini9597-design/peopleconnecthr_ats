/**
 * Assessment Model — tenant-scoped skills test template (feature: assessments)
 *
 * Questions stay on the working copy. Publish freezes publishedSnapshot so
 * in-progress attempts never pick up silent edits. Code may be scored through
 * an optional isolated Judge0 sandbox; otherwise evaluators score it.
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
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
  hiddenTests: [{
    name: { type: String, default: '' },
    input: { type: String, default: '' },
    expected: { type: String, default: '' },
  }],
  visibleTests: [{
    name: { type: String, default: '' },
    input: { type: String, default: '' },
    expected: { type: String, default: '' },
  }],
}, { _id: true });

const rulesSchema = new mongoose.Schema({
  passingScorePercent: { type: Number, default: 0, min: 0, max: 100 },
  negativeMarkPercent: { type: Number, default: 0, min: 0, max: 100 },
  maxAttempts: { type: Number, default: 1, min: 1, max: 5 },
  randomizeQuestions: { type: Boolean, default: false },
  allowBack: { type: Boolean, default: true },
  requireAll: { type: Boolean, default: true },
  resultVisibility: { type: String, enum: ['hidden', 'score', 'detailed'], default: 'hidden' },
  autoSubmit: { type: Boolean, default: true },
  windowStart: { type: Date, default: null },
  windowEnd: { type: Date, default: null },
}, { _id: false });

const assessmentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  candidateInstructions: { type: String, default: '', trim: true },
  durationMinutes: { type: Number, default: 45, min: 5 },
  questions: [questionSchema],
  rules: { type: rulesSchema, default: () => ({}) },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null, index: true },
  pipelineStage: { type: String, default: '', trim: true },
  advanceStage: { type: String, default: 'Interview', trim: true },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
  version: { type: Number, default: 1 },
  publishedAt: { type: Date, default: null },
  publishedSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  proctoring: {
    enabled: { type: Boolean, default: false },
    strictness: { type: String, enum: ['off', 'standard', 'strict'], default: 'standard' },
    trackTabSwitch: { type: Boolean, default: true },
    trackCopyPaste: { type: Boolean, default: true },
    trackFullscreen: { type: Boolean, default: true }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

assessmentSchema.index({ organizationId: 1, createdAt: -1 });
assessmentSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

assessmentSchema.virtual('maxScore').get(function () {
  return (this.questions || []).reduce((sum, q) => sum + (q.points || 0), 0);
});
assessmentSchema.set('toJSON', { virtuals: true });
assessmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Assessment', assessmentSchema);
