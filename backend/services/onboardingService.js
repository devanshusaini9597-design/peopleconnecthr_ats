/**
 * Onboarding domain — register, verify, org create, invites.
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { sendEmail } = require('./emailService');
const { wrapBrandedEmailHtml, brandButtonHtml, loadPlatformEmailBrand, loadOrgEmailBrand, loadSendingEmailBrand, escapeHtml, otpCodeHtml, signupOtpResendUrl, registerPageUrl } = require('./emailBrandLayout');
const logger = require('../utils/logger');
const { validateWorkEmail, getEmailDomain, isValidEmailFormat } = require('../utils/workEmail');
const { planForOrgDomain, validateInviteEmail } = require('../utils/orgDomain');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const SIGNUP_OTP_TTL_MS = 10 * 60 * 1000;
const SIGNUP_OTP_RESEND_MS = 45 * 1000;
const SIGNUP_OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashSignupOtp(email, code) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`signup:${normalizeEmail(email)}:${String(code).trim()}`)
    .digest('hex');
}

function signupOtpMatches(email, code, storedHash) {
  if (!storedHash || !code) return false;
  const expected = hashSignupOtp(email, code);
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(String(storedHash), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signSignupOtpToken(payload) {
  return jwt.sign(
    { ...payload, purpose: 'signup_otp' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function signSignupVerifiedToken({ email, name }) {
  return jwt.sign(
    {
      email: normalizeEmail(email),
      name: name || '',
      purpose: 'signup_email_verified',
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );
}

function readSignupOtpToken(token) {
  if (!token) throw httpError('Enter the code from your work email to continue.', 400);
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw httpError('This verification code expired. Send a new code to continue.', 401);
    }
    throw httpError('This verification session expired. Send a new code to continue.', 401);
  }
  if (decoded.purpose !== 'signup_otp' || !decoded.email || !decoded.otpHash) {
    throw httpError('Invalid verification session. Send a new code to continue.', 401);
  }
  return decoded;
}

function readSignupVerifiedToken(token, expectedEmail) {
  if (!token) {
    throw httpError('Verify your work email before submitting.', 400, { code: 'email_not_verified' });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    throw httpError('Your email verification expired. Send a new code to continue.', 401, {
      code: 'email_not_verified',
    });
  }
  if (decoded.purpose !== 'signup_email_verified' || !decoded.email) {
    throw httpError('Verify your work email before submitting.', 400, { code: 'email_not_verified' });
  }
  if (normalizeEmail(decoded.email) !== normalizeEmail(expectedEmail)) {
    throw httpError('Work email does not match the verified address. Send a new code.', 400, {
      code: 'email_not_verified',
    });
  }
  return decoded;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function buildVerificationEmailHtml(verificationUrl, brand) {
  return wrapBrandedEmailHtml({
    title: 'Verify your email address',
    eyebrow: 'Account security',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    senderName: brand.name,
    senderEmail: brand.fromEmail,
    websiteUrl: brand.websiteUrl,
    supportEmail: brand.supportEmail,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi there,</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">Thanks for creating your account with <strong style="color:#0f172a;">${escapeHtml(brand.name)}</strong>. Confirm this email address to activate access and keep your workspace secure.</p>
      <div style="text-align:center;">
        ${brandButtonHtml({ href: verificationUrl, label: 'Verify email address', brandColor: brand.brandColor })}
      </div>
      <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">This one-time link expires in <strong style="color:#334155;">24 hours</strong>. If you did not create this account, you can ignore this message.</p>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Button not working? Copy and paste this link into your browser:<br><a href="${verificationUrl}" style="color:${brand.brandColor};word-break:break-all;">${verificationUrl}</a></p>
      </div>`,
  });
}

async function issueVerificationToken(user) {
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  user.emailVerificationToken = emailVerificationToken;
  user.emailVerificationExpires = emailVerificationExpires;
  await user.save();
  return emailVerificationToken;
}

/**
 * Send verification email. Returns { sent, verificationUrl }.
 * Does not throw on EMAIL_NOT_CONFIGURED — caller decides UX.
 */
async function sendVerificationEmail(email, emailVerificationToken) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-email?token=${emailVerificationToken}`;

  try {
    const sender = await User.findOne({ email: normalizeEmail(email) })
      .select('_id organizationId')
      .lean();
    const brand = await loadSendingEmailBrand({
      userId: sender?._id,
      organizationId: sender?.organizationId,
      system: true,
    });
    await sendEmail(
      email,
      `Verify your email – ${brand.name}`,
      buildVerificationEmailHtml(verificationUrl, brand),
      `Verify your email: ${verificationUrl} (expires in 24 hours)`,
      {
        senderName: brand.name,
        userId: sender?._id,
        organizationId: sender?.organizationId,
        system: true,
      }
    );
    logger.info(`Verification email sent to ${email}`);
    return { sent: true, verificationUrl };
  } catch (emailErr) {
    logger.error({ err: emailErr }, 'VERIFICATION email send failed');
    if (emailErr.message === 'EMAIL_NOT_CONFIGURED') {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn({ verificationUrl }, 'Dev-only verification URL (NOT sent to client)');
      }
      return { sent: false, verificationUrl, reason: 'EMAIL_NOT_CONFIGURED' };
    }
    return { sent: false, verificationUrl, reason: 'SEND_FAILED' };
  }
}

function pendingApprovalPayload({ isNewAccount, isUpdate }) {
  return {
    success: true,
    isNewAccount,
    pendingApproval: true,
    requiresVerification: false,
    pendingVerification: false,
    emailSent: true,
    message: isUpdate
      ? 'We already have your request. Our sales team will contact you, then you can sign in after approval.'
      : 'Request received. Our sales team will contact you shortly. You can sign in after they approve access.',
  };
}

function signupPayloadFromDecoded(decoded, overrides = {}) {
  return {
    email: decoded.email,
    name: decoded.name || '',
    otpHash: decoded.otpHash,
    otpSentAt: decoded.otpSentAt,
    attempts: decoded.attempts || 0,
    ...overrides,
  };
}

function buildSignupOtpEmailHtml({ name, code, brand, signupOtpToken, email }) {
  const first = escapeHtml((name || 'there').split(' ')[0] || 'there');
  const resendUrl = signupOtpResendUrl({ signupOtpToken, email });
  const registerUrl = registerPageUrl({ email });
  return wrapBrandedEmailHtml({
    title: 'Verify your work email',
    eyebrow: 'Account security',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    senderName: brand.name,
    senderEmail: brand.fromEmail,
    websiteUrl: brand.websiteUrl,
    supportEmail: brand.supportEmail,
    socialLinks: brand.socialLinks,
    bodyHtml: `
      <p style="margin:0 0 12px 0;font-size:16px;color:#0f172a;">Hi ${first},</p>
      <p style="margin:0 0 4px 0;color:#475569;line-height:1.7;">
        Use this one-time code to confirm you own this work email. We will then send your trial request to our team.
      </p>
      ${otpCodeHtml(code, brand.brandColor)}
      <p style="margin:16px 0 0 0;color:#64748b;font-size:13px;line-height:1.65;">
        If you did not request access, you can ignore this email. Do not forward this code to anyone.
      </p>
      <div style="text-align:center;">
        ${brandButtonHtml({ href: resendUrl, label: 'Resend a new code', brandColor: brand.brandColor })}
      </div>
      <p style="margin:0 0 8px 0;text-align:center;color:#64748b;font-size:13px;line-height:1.6;">
        Already have the code?
        <a href="${escapeHtml(registerUrl)}" style="color:${brand.brandColor};font-weight:600;text-decoration:none;">Return to request access</a>
      </p>`,
  });
}

async function sendSignupOtpEmail({ email, name, code, signupOtpToken }) {
  const brand = await loadSendingEmailBrand({ system: true });
  const html = buildSignupOtpEmailHtml({ name, code, brand, signupOtpToken, email });
  const text = [
    `Your ${brand.name} work-email verification code is ${code}. It expires in 10 minutes.`,
    `Need a new code? ${signupOtpResendUrl({ signupOtpToken, email })}`,
  ].join('\n');
  try {
    await sendEmail(
      email,
      `Your ${brand.name} verification code`,
      html,
      text,
      {
        senderName: brand.name,
        senderEmail: brand.fromEmail,
        system: true,
      }
    );
    return { sent: true };
  } catch (err) {
    logger.error({ err: err.message, email }, 'Signup OTP email failed');
    if (process.env.NODE_ENV === 'production') {
      throw httpError(
        'We could not send your verification code. Please try again in a moment.',
        503
      );
    }
    if (err.message === 'EMAIL_NOT_CONFIGURED' && process.env.NODE_ENV !== 'test') {
      logger.warn({ email, otp: code }, 'Dev-only signup OTP (email not configured)');
    }
    return { sent: false };
  }
}

async function createPendingUserFromSignup({ email, name, phone, companyName, passwordHash }) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });
  const { afterRequestSaved } = require('./trialRequestService');

  const applyDetails = (user) => {
    user.password = passwordHash;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (companyName) user.companyName = companyName;
    user.signupStatus = 'pending_approval';
    user.isEmailVerified = true;
    user.isActive = true;
    user.role = user.role || 'admin';
  };

  if (existingUser?.signupStatus === 'active' && (existingUser.isEmailVerified || existingUser.organizationId)) {
    throw httpError('Email already exists', 400, { code: 'email_already_exists' });
  }

  if (existingUser) {
    applyDetails(existingUser);
    await existingUser.save();
    await afterRequestSaved(existingUser, { isUpdate: true });
    return pendingApprovalPayload({ isNewAccount: false, isUpdate: true });
  }

  try {
    const user = new User({
      email: normalizedEmail,
      password: passwordHash,
      name: name || '',
      phone: phone || '',
      companyName: companyName || '',
      role: 'admin',
      signupStatus: 'pending_approval',
      isEmailVerified: true,
    });
    await user.save();
    await afterRequestSaved(user, { isUpdate: false });
    return pendingApprovalPayload({ isNewAccount: true, isUpdate: false });
  } catch (err) {
    if (err && (err.code === 11000 || String(err.message || '').includes('duplicate'))) {
      const raced = await User.findOne({ email: normalizedEmail });
      if (raced && raced.signupStatus === 'active' && (raced.isEmailVerified || raced.organizationId)) {
        throw httpError('Email already exists', 400, { code: 'email_already_exists' });
      }
      if (raced) {
        applyDetails(raced);
        await raced.save();
        await afterRequestSaved(raced, { isUpdate: true });
        return pendingApprovalPayload({ isNewAccount: false, isUpdate: true });
      }
    }
    throw err;
  }
}

async function assertSignupEmailAvailable(normalizedEmail) {
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser?.signupStatus === 'active' && (existingUser.isEmailVerified || existingUser.organizationId)) {
    throw httpError('Email already exists', 400, { code: 'email_already_exists' });
  }

  if (existingUser?.signupStatus === 'rejected') {
    throw httpError(
      'This trial request was not approved. Please contact our sales team if you have questions.',
      403,
      { code: 'signup_rejected' }
    );
  }

  return existingUser;
}

async function sendSignupOtp({ email, name }) {
  const workEmail = validateWorkEmail(email);
  if (!workEmail.valid) {
    throw httpError(workEmail.reason, 400, { code: workEmail.code || 'invalid_work_email' });
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await assertSignupEmailAvailable(normalizedEmail);
  if (existingUser) {
    return pendingApprovalPayload({ isNewAccount: false, isUpdate: true });
  }

  const trimmedName = String(name || '').trim();
  const code = generateOtp();
  const signupOtpToken = signSignupOtpToken({
    email: normalizedEmail,
    name: trimmedName,
    otpHash: hashSignupOtp(normalizedEmail, code),
    otpSentAt: Date.now(),
    attempts: 0,
  });

  await sendSignupOtpEmail({
    email: normalizedEmail,
    name: trimmedName,
    code,
    signupOtpToken,
  });

  return {
    success: true,
    requiresOtp: true,
    signupOtpToken,
    message: 'Enter the 6-digit code we sent to your work email.',
    user: { email: normalizedEmail, name: trimmedName },
  };
}

async function register({ email, password, name, phone, companyName, signupVerifiedToken }) {
  if (!password || password.length < 8) {
    throw httpError('Invalid email or password (min 8 chars)', 400);
  }

  const workEmail = validateWorkEmail(email);
  if (!workEmail.valid) {
    throw httpError(workEmail.reason, 400, { code: workEmail.code || 'invalid_work_email' });
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmedName = String(name || '').trim();
  const trimmedCompany = String(companyName || '').trim();
  if (!trimmedName || trimmedName.length < 2) {
    throw httpError('Full name is required', 400, { code: 'name_required' });
  }
  if (!trimmedCompany || trimmedCompany.length < 2) {
    throw httpError('Company name is required', 400, { code: 'company_required' });
  }
  readSignupVerifiedToken(signupVerifiedToken, normalizedEmail);

  const existingUser = await assertSignupEmailAvailable(normalizedEmail);
  if (existingUser) {
    return pendingApprovalPayload({ isNewAccount: false, isUpdate: true });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  return createPendingUserFromSignup({
    email: normalizedEmail,
    name: trimmedName,
    phone: String(phone || '').trim(),
    companyName: trimmedCompany,
    passwordHash: hashedPassword,
  });
}

async function verifySignupOtp({ signupOtpToken, code }) {
  const decoded = readSignupOtpToken(signupOtpToken);
  const attempts = Number(decoded.attempts || 0);
  if (attempts >= SIGNUP_OTP_MAX_ATTEMPTS) {
    throw httpError('Too many incorrect codes. Send a new code to continue.', 429);
  }
  if (decoded.otpSentAt && Date.now() - Number(decoded.otpSentAt) > SIGNUP_OTP_TTL_MS) {
    throw httpError('This verification code expired. Send a new code to continue.', 401);
  }
  if (!signupOtpMatches(decoded.email, String(code || '').trim(), decoded.otpHash)) {
    const nextToken = signSignupOtpToken(
      signupPayloadFromDecoded(decoded, { attempts: attempts + 1 })
    );
    throw httpError('That code is incorrect. Check your work email and try again.', 401, {
      signupOtpToken: nextToken,
    });
  }

  return {
    success: true,
    emailVerified: true,
    signupVerifiedToken: signSignupVerifiedToken({
      email: decoded.email,
      name: decoded.name,
    }),
    message: 'Work email verified. Finish the form to submit your request.',
    user: { email: decoded.email, name: decoded.name || '' },
  };
}

async function resendSignupOtp({ signupOtpToken }) {
  const decoded = readSignupOtpToken(signupOtpToken);
  if (decoded.otpSentAt && Date.now() - Number(decoded.otpSentAt) < SIGNUP_OTP_RESEND_MS) {
    throw httpError('Please wait a few seconds before requesting another code.', 429);
  }

  const code = generateOtp();
  const nextToken = signSignupOtpToken(
    signupPayloadFromDecoded(decoded, {
      otpHash: hashSignupOtp(decoded.email, code),
      otpSentAt: Date.now(),
      attempts: 0,
    })
  );
  await sendSignupOtpEmail({
    email: decoded.email,
    name: decoded.name,
    code,
    signupOtpToken: nextToken,
  });
  return {
    success: true,
    signupOtpToken: nextToken,
    message: 'A new verification code is on its way.',
    user: { email: decoded.email, name: decoded.name || '' },
  };
}

async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });
  if (!user) throw httpError('Invalid or expired token', 400);
  if (user.signupStatus === 'pending_approval') {
    throw httpError('Your trial request is still under review. Our team will contact you shortly.', 403, {
      code: 'signup_pending_approval',
    });
  }
  if (user.signupStatus === 'rejected') {
    throw httpError('This trial request was not approved. Please contact sales.', 403, { code: 'signup_rejected' });
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  return { success: true, message: 'Email verified successfully' };
}

async function resendVerification({ email }) {
  if (!email) {
    throw httpError('Email is required', 400);
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw httpError('User not found', 404);
  }

  if (user.signupStatus === 'pending_approval') {
    throw httpError('Your trial request is still under review. Our team will contact you shortly.', 403, {
      code: 'signup_pending_approval',
    });
  }
  if (user.signupStatus === 'rejected') {
    throw httpError('This trial request was not approved. Please contact sales.', 403, { code: 'signup_rejected' });
  }

  if (user.isEmailVerified) {
    throw httpError('Email is already verified', 400);
  }

  const token = await issueVerificationToken(user);
  const { sent, reason } = await sendVerificationEmail(normalizedEmail, token);

  if (!sent) {
    if (reason === 'EMAIL_NOT_CONFIGURED') {
      throw httpError('Email service not configured. Please contact support.', 500);
    }
    throw httpError('Failed to resend verification email. Please try again later.', 500);
  }

  return { success: true, message: 'Verification email sent successfully.' };
}

async function createOrg(userId, { name, domain: domainInput }) {
  if (!name || name.length < 2) throw httpError('Organization name required', 400);

  const user = await User.findById(userId);
  if (user.signupStatus === 'pending_approval') {
    throw httpError('Your trial request is still under review. You can create a workspace after approval.', 403, {
      code: 'signup_pending_approval',
    });
  }
  if (!user.isEmailVerified) throw httpError('Email not verified', 403);
  if (user.organizationId) throw httpError('User already has an organization', 400);

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const emailDomain = getEmailDomain(user.email);
  const domain = String(domainInput || emailDomain || '')
    .toLowerCase()
    .trim()
    .replace(/^@/, '');

  const plan = planForOrgDomain(domain, 'free_trial');
  const org = new Organization({
    name,
    slug,
    ownerId: user._id,
    domain: domain || undefined,
    allowedDomains: domain ? [domain] : [],
    plan,
    productPlans: { ats: plan },
  });
  await org.save();

  user.organizationId = org._id;
  user.role = 'owner';
  await user.save();

  // Seed org-scoped enterprise email template pack
  try {
    const { ensureDefaultCatalog } = require('./emailTemplateService');
    await ensureDefaultCatalog(user._id, org._id);
  } catch (seedErr) {
    logger.warn({ err: seedErr }, 'Org email template seed failed (non-blocking)');
  }

  return { success: true, organization: org };
}

async function buildInviteEmailHtml(inviteUrl, orgName, inviterName, organizationId) {
  const safeOrg = escapeHtml(orgName || 'your organization');
  const safeInviter = escapeHtml(inviterName || 'A teammate');
  const brand = organizationId ? await loadOrgEmailBrand(organizationId) : loadPlatformEmailBrand();
  return wrapBrandedEmailHtml({
    title: "You've been invited to join the team",
    eyebrow: 'Team invitation',
    orgName: brand.name,
    logoUrl: brand.logoUrl,
    brandColor: brand.brandColor,
    wordmark: brand.wordmark,
    senderName: inviterName,
    bodyHtml: `
      <p style="margin:0 0 16px 0;font-size:16px;color:#0f172a;">Hi there,</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;"><strong style="color:#0f172a;">${safeInviter}</strong> has invited you to join <strong style="color:#0f172a;">${safeOrg}</strong>.</p>
      <p style="margin:0 0 8px 0;color:#475569;line-height:1.7;">Accept the invitation to set up your account and start collaborating with the hiring team.</p>
      <div style="text-align:center;">
        ${brandButtonHtml({ href: inviteUrl, label: 'Accept invitation', brandColor: brand.brandColor })}
      </div>
      <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">This invitation expires in <strong style="color:#334155;">7 days</strong>.</p>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">Button not working? Copy and paste this link into your browser:<br><a href="${inviteUrl}" style="color:${brand.brandColor};word-break:break-all;">${inviteUrl}</a></p>
      </div>`,
  });
}

const INVITE_ROLE_ALIASES = {
  admin: 'admin',
  'hr recruiter': 'hr_recruiter',
  hr_recruiter: 'hr_recruiter',
  recruiter: 'hr_recruiter',
  'hr manager': 'hr_manager',
  hr_manager: 'hr_manager',
  sales: 'sales',
  freelancer: 'freelancer',
  'freelance recruiter': 'freelancer',
  freelance: 'freelancer',
  other: 'other',
  interviewer: 'other',
  readonly: 'other',
  'read-only': 'other',
  'read only': 'other',
};

function normalizeInviteRole(role) {
  const key = String(role || 'hr_recruiter').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const compact = key.replace(/\s/g, '_');
  return INVITE_ROLE_ALIASES[key] || INVITE_ROLE_ALIASES[compact] || 'hr_recruiter';
}

async function inviteTeammate(actor, { email, role, name, customRoleId, reportsTo }) {
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const normalizedEmail = normalizeEmail(email);
  const resolvedRole = normalizeInviteRole(role);

  const org = await Organization.findById(actor.organizationId).select('name domain allowedDomains').lean();
  if (!org) throw httpError('Organization not found', 404);

  const isFreelancerInvite = resolvedRole === 'freelancer';
  if (isFreelancerInvite) {
    if (!isValidEmailFormat(normalizedEmail)) {
      throw httpError('Invalid email format', 400, { code: 'email_invalid' });
    }
  } else {
    const domainCheck = validateInviteEmail({
      email: normalizedEmail,
      orgDomain: org.domain,
      allowedDomains: org.allowedDomains,
      actorEmail: actor.email,
    });
    if (!domainCheck.valid) {
      throw httpError(domainCheck.reason, 400, { code: domainCheck.code });
    }

    // Persist domain on org if missing (first invite / older orgs)
    if (!org.domain && domainCheck.domain) {
      await Organization.findByIdAndUpdate(actor.organizationId, {
        $set: { domain: domainCheck.domain },
        $addToSet: { allowedDomains: domainCheck.domain },
      });
    }
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (existing.organizationId && existing.organizationId.toString() !== actor.organizationId.toString()) {
      throw httpError('Email belongs to another organization', 400);
    }
    if (existing.organizationId && existing.organizationId.toString() === actor.organizationId.toString()) {
      throw httpError('User already in organization', 400);
    }
  }

  let resolvedCustomRoleId = null;
  if (customRoleId) {
    const CustomRole = require('../models/CustomRole');
    const pack = await CustomRole.findOne({ _id: customRoleId, organizationId: actor.organizationId });
    if (!pack) throw httpError('Custom role not found', 400);
    resolvedCustomRoleId = pack._id;
  }

  const invitee = new User({
    email: normalizedEmail,
    role: resolvedRole,
    name: name || '',
    // Placeholder until invitee sets their own password on accept
    password: crypto.randomBytes(32).toString('hex'),
    inviteToken,
    inviteTokenExpires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    organizationId: actor.organizationId,
    invitedBy: actor.id,
    isActive: false,
    customRoleId: resolvedCustomRoleId,
  });
  await invitee.save();

  if (reportsTo && resolvedRole !== 'freelancer') {
    try {
      const { setReportsTo } = require('../utils/reportingScope');
      await setReportsTo({
        organizationId: actor.organizationId,
        targetUserId: invitee._id,
        managerId: reportsTo,
      });
    } catch (err) {
      logger.warn(`[invite] reportsTo skipped for ${normalizedEmail}: ${err.message}`);
    }
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptPath = isFreelancerInvite ? 'accept-freelancer-invite' : 'accept-invite';
  const inviteUrl = `${frontendUrl}/${acceptPath}?token=${inviteToken}`;

  const orgName = org.name || '';
  const inviterName = actor.name || actor.email || 'A teammate';
  let emailSent = false;
  let emailError = null;
  try {
    const inviteHtml = await buildInviteEmailHtml(inviteUrl, orgName, inviterName, actor.organizationId);
    await sendEmail(
      normalizedEmail,
      `You're invited to join ${orgName || 'the team'}`,
      inviteHtml,
      `Accept your invitation: ${inviteUrl} (expires in 7 days)`,
      {
        senderName: orgName || 'Skillnix Recruitment',
        userId: actor.id,
        organizationId: actor.organizationId,
        senderEmail: actor.email,
        system: true,
      }
    );
    emailSent = true;
    logger.info(`Invite email sent to ${normalizedEmail}`);
  } catch (emailErr) {
    emailError = emailErr.message || 'Failed to send invite email';
    logger.warn(`Invite created but email failed for ${normalizedEmail}: ${emailError}`);
  }

  return {
    success: true,
    message: emailSent
      ? 'Invitation sent'
      : 'Invitation created, but the email could not be delivered. Share the invite link manually.',
    inviteUrl,
    emailSent,
    emailError,
    email: normalizedEmail,
    userId: invitee._id,
    emailFromHint: (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim() || null,
  };
}

async function acceptInvite({ token, name, password }, req) {
  const user = await User.findOne({ inviteToken: token, inviteTokenExpires: { $gt: Date.now() } });
  if (!user) throw httpError('Invalid or expired invitation', 400);

  const normalizedName = String(name || user.name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
  user.name = normalizedName || user.name;
  user.password = await bcrypt.hash(password, 10);
  user.isActive = true;
  user.isEmailVerified = true;
  // Invited users already belong to an org — never send them through org-create setup
  user.onboardingCompleted = true;
  user.inviteToken = undefined;
  user.inviteTokenExpires = undefined;
  await user.save();

  try {
    const eventBus = require('../events/eventBus');
    const eventTypes = require('../events/eventTypes');
    eventBus.emit(eventTypes.USER_JOINED, {
      organizationId: user.organizationId,
      userId: user._id,
      invitedById: user.invitedBy,
      name: user.name || user.email,
    });
  } catch { /* invite accept still succeeds */ }

  const { issueAuthToken } = require('./sessionService');
  const authToken = await issueAuthToken(user, req);

  return { setCookieToken: authToken, body: { success: true, user } };
}

async function getInvite(token) {
  const user = await User.findOne({
    inviteToken: token,
    inviteTokenExpires: { $gt: Date.now() },
  })
    .populate('organizationId', 'name domain')
    .populate('invitedBy', 'name email');
  if (!user) throw httpError('Invalid or expired invitation', 400);

  const orgName = user.organizationId?.name || '';
  const inviterName = user.invitedBy?.name || user.invitedBy?.email || 'A teammate';
  const invite = {
    email: user.email,
    role: user.role,
    organization: {
      name: orgName,
      domain: user.organizationId?.domain || '',
    },
    inviter: {
      name: inviterName,
      email: user.invitedBy?.email || '',
    },
    expiresAt: user.inviteTokenExpires,
  };

  return {
    success: true,
    invite,
    // Backward-compatible shape
    data: {
      orgName,
      inviterName,
      role: user.role,
      email: user.email,
    },
  };
}

async function completeOnboarding(userId) {
  await User.findByIdAndUpdate(userId, { onboardingCompleted: true });
  return { success: true, message: 'Onboarding completed' };
}

module.exports = {
  register,
  sendSignupOtp,
  verifySignupOtp,
  resendSignupOtp,
  hashSignupOtp,
  signupOtpMatches,
  verifyEmail,
  resendVerification,
  createOrg,
  inviteTeammate,
  acceptInvite,
  getInvite,
  completeOnboarding,
};
