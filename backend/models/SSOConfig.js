const mongoose = require('mongoose');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');

/**
 * SSOConfig — Enterprise-only SAML 2.0 Single Sign-On configuration, one per
 * organization. The org's IdP admin (Okta/Azure AD/OneLogin/etc.) provides
 * entryPoint + idpCert; we expose /sso/:orgSlug/metadata for them to
 * configure the other side of the trust relationship.
 */
const ssoConfigSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  entryPoint: { type: String, required: true, trim: true }, // IdP SSO URL
  idpIssuer: { type: String, trim: true, default: '' }, // IdP entity ID (optional, for logout validation)
  // Encrypted at rest like IntegrationConfig.credentials — an IdP cert isn't
  // itself secret, but stored consistently with the rest of the BYOK config
  // surface to avoid a second unencrypted-blob pattern in the codebase.
  idpCert: { type: mongoose.Schema.Types.Mixed, required: true },
  wantAssertionsSigned: { type: Boolean, default: true },
  attributeMap: {
    email: { type: String, default: 'email' },
    name: { type: String, default: 'name' }
  },
  defaultRole: {
    type: String,
    enum: ['admin', 'recruiter', 'interviewer', 'readonly'],
    default: 'recruiter'
  },
  jitProvisioning: { type: Boolean, default: true },
  configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastValidatedAt: { type: Date }
}, { timestamps: true });

ssoConfigSchema.pre('save', function (next) {
  if (this.isModified('idpCert') && this.idpCert != null && !isEncrypted(this.idpCert)) {
    this.idpCert = encrypt(this.idpCert);
  }
  next();
});

ssoConfigSchema.methods.getDecryptedCert = function () {
  if (!this.idpCert) return '';
  if (!isEncrypted(this.idpCert)) return this.idpCert;
  try {
    return decrypt(this.idpCert) || '';
  } catch (err) {
    console.error(`[SSOConfig] Failed to decrypt idpCert for ${this._id}:`, err.message);
    return '';
  }
};

module.exports = mongoose.model('SSOConfig', ssoConfigSchema);
