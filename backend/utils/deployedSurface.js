/**
 * Railway / People Connect hosts hold real tenant data.
 * OTP skip, personal-email signup, and auto-approve stay local/test only.
 */
function isDeployedLoginSurface() {
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  if (nodeEnv === 'production') return true;
  if (String(process.env.RAILWAY_ENVIRONMENT || '').trim()) return true;
  const urls = `${process.env.FRONTEND_URL || ''} ${process.env.APP_PUBLIC_URL || ''}`;
  return /peopleconnecthr|up\.railway\.app/i.test(urls);
}

function envFlagOn(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isAutoApproveSignupEnabled() {
  if (isDeployedLoginSurface()) return false;
  return envFlagOn('AUTO_APPROVE_SIGNUP');
}

function isPersonalEmailSignupAllowed() {
  if (isDeployedLoginSurface()) return false;
  return envFlagOn('ALLOW_PERSONAL_EMAIL_SIGNUP');
}

module.exports = {
  isDeployedLoginSurface,
  envFlagOn,
  isAutoApproveSignupEnabled,
  isPersonalEmailSignupAllowed,
};
