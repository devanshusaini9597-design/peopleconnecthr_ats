/**
 * Assessment Model — Add-on: Coding/Skills Assessments (feature: assessments)
 *
 * A reusable test template built by a recruiter/admin: a mix of multiple
 * choice (auto-graded), free-text, and code questions. Deliberately does
 * NOT execute candidate code server-side — running arbitrary candidate
 * code is a real security boundary (sandboxing, resource limits, escape
 * prevention) that this product does not take on by default; code answers
 * are stored as text and graded manually by the recruiter, same posture
 * as the reference product's "coding runner off by default, use Judge0
 * for production sandboxes" stance.
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['multiple_choice', 'text', 'code'], required: true },
  prompt: { type: String, required: true, trim: true },
  language: { type: String, default: '' }, // hint only for 'code' type, e.g. "javascript"
  options: [{ type: String, trim: true }], // 'multiple_choice' only
  correctOptionIndex: { type: Number }, // 'multiple_choice' only — never sent to candidates
  points: { type: Number, default: 10, min: 0 }
}, { _id: true });

const assessmentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  durationMinutes: { type: Number, default: 45, min: 5 },
  questions: [questionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

assessmentSchema.index({ organizationId: 1, createdAt: -1 });

assessmentSchema.virtual('maxScore').get(function () {
  return (this.questions || []).reduce((sum, q) => sum + (q.points || 0), 0);
});
assessmentSchema.set('toJSON', { virtuals: true });
assessmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Assessment', assessmentSchema);
