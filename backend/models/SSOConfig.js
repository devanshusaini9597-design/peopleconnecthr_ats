const logger = require('../utils/logger');
const mongoose = require('mongoose');

const { encrypt, decrypt, isEncrypted } = require('../utils/encryption');



/**

 * SSOConfig — Enterprise-only SSO configuration (SAML 2.0 or OIDC), one per org.

 */

const ssoConfigSchema = new mongoose.Schema({

  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },

  enabled: { type: Boolean, default: false },

  protocol: { type: String, enum: ['saml', 'oidc'], default: 'saml' },

  // SAML fields

  entryPoint: { type: String, trim: true, default: '' },

  idpIssuer: { type: String, trim: true, default: '' },

  idpCert: { type: mongoose.Schema.Types.Mixed, default: null },

  wantAssertionsSigned: { type: Boolean, default: true },

  // OIDC fields

  oidc: {

    clientId: { type: String, trim: true, default: '' },

    clientSecret: { type: mongoose.Schema.Types.Mixed, default: null },

    issuer: { type: String, trim: true, default: '' },

    authorizationURL: { type: String, trim: true, default: '' },

    tokenURL: { type: String, trim: true, default: '' },

    userInfoURL: { type: String, trim: true, default: '' },

    redirectUri: { type: String, trim: true, default: '' }

  },

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

  lastValidatedAt: { type: Date },

  scimTokenHash: { type: String, default: null },

  scimTokenIssuedAt: { type: Date }

}, { timestamps: true });



ssoConfigSchema.pre('save', function (next) {

  if (this.isModified('idpCert') && this.idpCert != null && !isEncrypted(this.idpCert)) {

    this.idpCert = encrypt(this.idpCert);

  }

  if (this.isModified('oidc.clientSecret') && this.oidc?.clientSecret != null && !isEncrypted(this.oidc.clientSecret)) {

    this.oidc.clientSecret = encrypt(this.oidc.clientSecret);

  }

  next();

});



ssoConfigSchema.methods.getDecryptedCert = function () {

  if (!this.idpCert) return '';

  if (!isEncrypted(this.idpCert)) return this.idpCert;

  try {

    return decrypt(this.idpCert) || '';

  } catch (err) {

    logger.error(`[SSOConfig] Failed to decrypt idpCert for ${this._id}:`, err.message);

    return '';

  }

};



ssoConfigSchema.methods.getDecryptedClientSecret = function () {

  const secret = this.oidc?.clientSecret;

  if (!secret) return '';

  if (!isEncrypted(secret)) return secret;

  try {

    return decrypt(secret) || '';

  } catch (err) {

    logger.error(`[SSOConfig] Failed to decrypt OIDC clientSecret for ${this._id}:`, err.message);

    return '';

  }

};



module.exports = mongoose.model('SSOConfig', ssoConfigSchema);

