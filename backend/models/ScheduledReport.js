const mongoose = require('mongoose');

/**
 * ScheduledReport — Enterprise, gated by 'reports.custom'. Runs on the
 * cadence below via services/reportScheduler.js and emails a download link
 * for the generated file to `recipients`.
 */
const scheduledReportSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  reportType: {
    type: String,
    required: true,
    enum: ['recruitment-summary', 'source-performance', 'position-report', 'client-report', 'pipeline-status']
  },
  format: { type: String, enum: ['xlsx', 'pdf'], default: 'xlsx' },
  dateRange: { type: String, default: 'month' }, // same values buildDateFilter() in exportController.js accepts
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  recipients: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  lastRunAt: { type: Date },
  lastRunStatus: { type: String, enum: ['success', 'failed', null], default: null },
  lastRunError: { type: String, default: '' },
  nextRunAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

scheduledReportSchema.index({ nextRunAt: 1, isActive: 1 });
scheduledReportSchema.index({ organizationId: 1 });

/** Advances nextRunAt by one cycle of `frequency`, from `from` (default: now). */
scheduledReportSchema.methods.computeNextRun = function (from = new Date()) {
  const next = new Date(from);
  if (this.frequency === 'daily') next.setDate(next.getDate() + 1);
  else if (this.frequency === 'weekly') next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1); // monthly
  return next;
};

module.exports = mongoose.model('ScheduledReport', scheduledReportSchema);
