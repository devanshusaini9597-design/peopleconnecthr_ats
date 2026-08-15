const mongoose = require('mongoose');

const freelancerSubmissionSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  freelancerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  spocUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
  note: { type: String, default: '', trim: true, maxlength: 2000 },
  status: {
    type: String,
    enum: ['submitted', 'reviewing', 'shortlisted', 'rejected'],
    default: 'submitted',
    index: true,
  },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

freelancerSubmissionSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true });
freelancerSubmissionSchema.index({ organizationId: 1, freelancerId: 1, createdAt: -1 });
freelancerSubmissionSchema.index({ organizationId: 1, spocUserId: 1, status: 1 });

module.exports = mongoose.model('FreelancerSubmission', freelancerSubmissionSchema);
