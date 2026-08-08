const mongoose = require('mongoose');

const criteriaSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  weight: { type: Number, default: 1, min: 0.5, max: 5 },
  suggestedQuestions: [{ type: String }]
}, { _id: true });

const scorecardTemplateSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  criteria: [criteriaSchema],
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

scorecardTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ScorecardTemplate', scorecardTemplateSchema);
