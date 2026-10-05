/**
 * Append-only stage transition log.
 * Reporting (activity, cohort, time-in-stage) reads this collection.
 * The live pipeline reads Candidate.status — never this log.
 */
const mongoose = require('mongoose');

const StageHistorySchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  fromStage: { type: String, default: null },
  toStage: { type: String, required: true },
  changedAt: { type: Date, required: true },
  changedBy: { type: String, default: 'System' },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  /** Fields copied so desk-scoped reports can match Candidate filters. */
  createdBy: { type: mongoose.Schema.Types.Mixed, default: null },
  spoc: { type: String, default: '' },
  source: { type: String, default: '' },
  /** create | status_change | backfill */
  origin: { type: String, default: 'status_change' },
  /** True when reconstructed from an older statusHistory timestamp. */
  approximate: { type: Boolean, default: false },
  eventKey: { type: String, required: true },
}, { timestamps: false, versionKey: false });

StageHistorySchema.index({ eventKey: 1 }, { unique: true });
StageHistorySchema.index({ organizationId: 1, changedAt: -1 });
StageHistorySchema.index({ organizationId: 1, candidateId: 1, changedAt: 1 });
StageHistorySchema.index({ candidateId: 1, changedAt: 1 });

function rejectMutation(next) {
  next(new Error('StageHistory is append-only'));
}

StageHistorySchema.pre('updateOne', rejectMutation);
StageHistorySchema.pre('updateMany', rejectMutation);
StageHistorySchema.pre('findOneAndUpdate', rejectMutation);
StageHistorySchema.pre('replaceOne', rejectMutation);
StageHistorySchema.pre('deleteOne', rejectMutation);
StageHistorySchema.pre('deleteMany', rejectMutation);
StageHistorySchema.pre('findOneAndDelete', rejectMutation);

module.exports = mongoose.model('StageHistory', StageHistorySchema);
