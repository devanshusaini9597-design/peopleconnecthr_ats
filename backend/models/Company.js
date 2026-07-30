const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  domain: { 
    type: String, 
    trim: true,
    lowercase: true,
    // Company domain for validation (e.g., "company.com")
  },
  // Allow list of additional domains (for companies with multiple domains)
  allowedDomains: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
}, { timestamps: true });

CompanySchema.index({ createdBy: 1, name: 1 }, { unique: true });
CompanySchema.index({ domain: 1 });
CompanySchema.index({ createdBy: 1, domain: 1 });

// Helper method to check if an email belongs to company domain
CompanySchema.methods.isCompanyEmail = function(email) {
  if (!email || !this.domain) return false;
  const emailDomain = email.toLowerCase().split('@')[1];
  if (!emailDomain) return false;
  
  // Check primary domain
  if (emailDomain === this.domain) return true;
  
  // Check allowed domains
  if (this.allowedDomains && this.allowedDomains.includes(emailDomain)) return true;
  
  return false;
};

module.exports = mongoose.model('Company', CompanySchema);
