const mongoose = require('mongoose');

const PendingCandidateSchema = new mongoose.Schema({
  // Import batch info
  batchId: { type: String, required: true, index: true },
  fileName: { type: String, default: '' },
  importedAt: { type: Date, default: Date.now },

  // Category: 'review' or 'blocked'
  category: { type: String, enum: ['review', 'blocked'], required: true, index: true },

  // Row info from Excel
  rowIndex: { type: Number },
  
  // Detected/fixed fields (same as Candidate fields)
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  contact: { type: String, default: '' },
  position: { type: String, default: '' },
  companyName: { type: String, default: '' },
  location: { type: String, default: '' },
  ctc: { type: String, default: '' },
  expectedCtc: { type: String, default: '' },
  experience: { type: String, default: '' },
  noticePeriod: { type: String, default: '' },
  status: { type: String, default: 'Applied' },
  source: { type: String, default: '' },
  client: { type: String, default: '' },
  spoc: { type: String, default: '' },
  remark: { type: String, default: '' },
  fls: { type: String, default: '' },
  date: { type: String, default: '' },

  // Original Excel data for reference
  originalData: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Validation info
  confidence: { type: String, default: '' },
  validationErrors: [{ type: mongoose.Schema.Types.Mixed }],
  validationWarnings: [{ type: mongoose.Schema.Types.Mixed }],
  autoFixChanges: [{ type: mongoose.Schema.Types.Mixed }],
  swaps: [{ type: mongoose.Schema.Types.Mixed }],

  // Owner
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
}, { timestamps: true });

PendingCandidateSchema.index({ createdBy: 1, category: 1, batchId: 1 });
PendingCandidateSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('PendingCandidate', PendingCandidateSchema);
