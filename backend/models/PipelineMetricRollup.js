/**
 * Precomputed pipeline metrics. The dashboard reads this document
 * instead of aggregating candidates on every poll.
 */
const mongoose = require('mongoose');

const PipelineMetricRollupSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, index: true, default: null },
  scopeKey: { type: String, required: true },
  periodKey: { type: String, required: true },
  cohortMonth: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  computedAt: { type: Date, required: true, index: true },
}, { versionKey: false });

PipelineMetricRollupSchema.index(
  { scopeKey: 1, periodKey: 1, cohortMonth: 1 },
  { unique: true }
);

module.exports = mongoose.model('PipelineMetricRollup', PipelineMetricRollupSchema);
