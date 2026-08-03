/**
 * Custom application form per job — careers.formBuilder (Professional+)
 */

const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'multiselect', 'checkbox', 'radio', 'file', 'url', 'yes_no'],
    default: 'text'
  },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  options: [{ type: String }],
  order: { type: Number, default: 0 },
  // Conditional visibility: show when another field equals value
  showWhen: {
    fieldKey: { type: String, default: '' },
    equals: { type: String, default: '' }
  }
}, { _id: true });

const jobApplicationFormSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
    index: true
  },
  title: { type: String, default: 'Application Form', trim: true },
  fields: [fieldSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

jobApplicationFormSchema.index({ organizationId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('JobApplicationForm', jobApplicationFormSchema);
