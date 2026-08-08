const mongoose = require('mongoose');

const MERGE_FIELDS = [
  'candidate.name', 'candidate.email', 'candidate.phone',
  'job.title', 'job.department', 'job.location',
  'offer.salary', 'offer.startDate', 'offer.benefits',
  'company.name', 'today'
];

const offerTemplateSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true },
  subject: { type: String, default: 'Offer Letter — {{job.title}}' },
  body: { type: String, default: '' },
  mergeFields: { type: [String], default: MERGE_FIELDS },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

offerTemplateSchema.statics.MERGE_FIELDS = MERGE_FIELDS;

module.exports = mongoose.model('OfferTemplate', offerTemplateSchema);
