const mongoose = require('mongoose');

/**
 * COMPANY-WIDE EMAIL CONFIGURATION MODEL
 * 
 * PURPOSE:
 * Stores company-wide email settings (Zoho, SMTP) that ALL employees can use.
 * This is the FALLBACK when individual users haven't configured personal settings.
 * 
 * ENTERPRISE PATTERN:
 * - Admin sets up company-wide Zoho API key ONCE
 * - All 30-50+ employees automatically get access
 * - No individual API keys needed
 * - Employees can override with personal configs if desired
 * 
 * MULTI-TENANT TODO:
 * Currently: companyId = 'default-company' (single database for one company)
 * Future: companyId = req.user.companyId (true multi-tenancy)
 * 
 * SECURITY NOTES:
 * ✅ API keys stored as plain text (TODO: add encryption)
 * ✅ Never returned in full to frontend (always masked as ••••••)
 * ✅ Only used server-side for API calls to Zoho/SMTP
 * ✅ All access requires JWT authentication
 */

const companyEmailConfigSchema = new mongoose.Schema({
  // Only one config per company
  companyId: { 
    type: String, 
    unique: true, 
    default: 'default-company',
    description: 'Company identifier (currently always "default-company" for single DB)'
  },

  // Which provider is primary (active)
  primaryProvider: { 
    type: String, 
    enum: ['zoho-zeptomail', 'smtp'],
    default: 'zoho-zeptomail',
    description: 'Which email service is currently active'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ZOHO ZEPTOMAIL CONFIGURATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  zohoZeptomailApiKey: { 
    type: String, 
    default: '',
    description: 'Zoho Zeptomail API Key - SENSITIVE, never expose to frontend'
  },

  zohoZeptomailApiUrl: { 
    type: String, 
    default: 'https://api.zeptomail.com/',
    description: 'Zoho Zeptomail API endpoint (can be .com/, .eu/, .in/, etc.)'
  },

  zohoZeptomailFromEmail: { 
    type: String, 
    default: '',
    description: 'Verified sender email in Zoho account (e.g., noreply@company.com)'
  },

  zohoZeptomailBounceAddress: { 
    type: String, 
    default: '',
    description: 'Optional bounce email for delivery reports'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SMTP CONFIGURATION (Fallback)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  smtpEmail: { 
    type: String, 
    default: '',
    description: 'SMTP Email address'
  },

  smtpAppPassword: { 
    type: String, 
    default: '',
    description: 'SMTP password or app-specific password - SENSITIVE'
  },

  smtpProvider: { 
    type: String, 
    enum: ['gmail', 'outlook', 'zoho-smtp', 'custom'],
    default: 'gmail',
    description: 'SMTP provider type'
  },

  smtpHost: { 
    type: String, 
    default: '',
    description: 'SMTP server hostname (e.g., smtp.gmail.com)'
  },

  smtpPort: { 
    type: Number, 
    default: 587,
    description: 'SMTP port (usually 587 for TLS or 465 for SSL)'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STATUS & AUDIT TRAIL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  isConfigured: { 
    type: Boolean, 
    default: false,
    description: 'Whether company has set up email configuration'
  },

  configuredBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    description: 'Which user/admin first configured this'
  },

  configuredAt: { 
    type: Date,
    description: 'When email configuration was first set up'
  },

  lastModifiedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    description: 'Which user last modified the settings'
  },

  lastModifiedAt: { 
    type: Date,
    description: 'When settings were last changed'
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // METADATA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  notes: { 
    type: String, 
    default: '',
    description: 'Admin notes about this configuration'
  }

}, { timestamps: true });

// Only one config per company
companyEmailConfigSchema.index({ companyId: 1 }, { unique: true });

module.exports = mongoose.model('CompanyEmailConfig', companyEmailConfigSchema);
