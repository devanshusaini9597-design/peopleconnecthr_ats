/**
 * Onboarding domain — register, verify, org create, invites.
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { sendEmail } = require('./emailService');
const logger = require('../utils/logger');
const { validateWorkEmail, getEmailDomain } = require('../utils/workEmail');
const { planForOrgDomain, validateInviteEmail } = require('../utils/orgDomain');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function buildVerificationEmailHtml(verificationUrl) {
  return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">SkillNix ATS</p>
          </div>
          <div style="padding: 30px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi there,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Verify Email</a>
            </div>
            <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">If the button doesn't work, copy and paste this URL:<br><a href="${verificationUrl}" style="color: #4F46E5; word-break: break-all;">${verificationUrl}</a></p>
          </div>
        </div>
      `;
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
    await sendEmail(
      email,
      'Verify Your Email - SkillNix ATS',
      buildVerificationEmailHtml(verificationUrl),
      `Verify your email: ${verificationUrl} (expires in 24 hours)`
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

async function register({ email, password, name, phone }) {
  if (!password || password.length < 8) {
    throw httpError('Invalid email or password (min 8 chars)', 400);
  }

  const workEmail = validateWorkEmail(email);
  if (!workEmail.valid) {
    throw httpError(workEmail.reason, 400, { code: workEmail.code || 'invalid_work_email' });
  }

  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail });

  // Verified account → tell them to log in
  if (existingUser?.isEmailVerified) {
    throw httpError('Email already exists', 400, { code: 'email_already_exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Unverified account → refresh password + resend verification (reopen verify step)
  // Only this path returns pendingVerification / "already registered but not verified"
  if (existingUser && !existingUser.isEmailVerified) {
    existingUser.password = hashedPassword;
    if (name) existingUser.name = name;
    if (phone) existingUser.phone = phone;

    const token = await issueVerificationToken(existingUser);
    const { sent } = await sendVerificationEmail(normalizedEmail, token);

    return {
      success: true,
      isNewAccount: false,
      requiresVerification: true,
      pendingVerification: true,
      emailSent: sent,
      message: sent
        ? 'This work email is already registered but not verified. We sent a new verification link.'
        : 'This work email is already registered but not verified. Verification email could not be sent — click Resend after email delivery is fixed.',
    };
  }

  let user;
  try {
    user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      name: name || '',
      phone: phone || '',
      role: 'admin', // self-signup: org creator privileges until createOrg promotes to owner
    });
    const token = await issueVerificationToken(user);
    const { sent } = await sendVerificationEmail(normalizedEmail, token);

    return {
      success: true,
      isNewAccount: true,
      requiresVerification: true,
      pendingVerification: false,
      emailSent: sent,
      message: sent
        ? 'Registration successful. Please verify your email.'
        : 'Registration successful, but verification email could not be sent. Click Resend after email delivery is fixed.',
    };
  } catch (err) {
    // Race: another request created the same email between findOne and save
    if (err && (err.code === 11000 || String(err.message || '').includes('duplicate'))) {
      const raced = await User.findOne({ email: normalizedEmail });
      if (raced && !raced.isEmailVerified) {
        raced.password = hashedPassword;
        if (name) raced.name = name;
        if (phone) raced.phone = phone;
        const token = await issueVerificationToken(raced);
        const { sent } = await sendVerificationEmail(normalizedEmail, token);
        return {
          success: true,
          isNewAccount: false,
          requiresVerification: true,
          pendingVerification: true,
          emailSent: sent,
          message: sent
            ? 'This work email is already registered but not verified. We sent a new verification link.'
            : 'This work email is already registered but not verified. Click Resend after email delivery is fixed.',
        };
      }
      if (raced?.isEmailVerified) {
        throw httpError('Email already exists', 400, { code: 'email_already_exists' });
      }
    }
    throw err;
  }
}

async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });
  if (!user) throw httpError('Invalid or expired token', 400);

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

  return { success: true, organization: org };
}

function buildInviteEmailHtml(inviteUrl, orgName, inviterName) {
  const safeOrg = orgName || 'your organization';
  const safeInviter = inviterName || 'A teammate';
  return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #0d9488, #0f766e); border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">You're invited</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0;">People Connect HR</p>
          </div>
          <div style="padding: 30px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi there,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">
              <strong>${safeInviter}</strong> invited you to join <strong>${safeOrg}</strong> on People Connect HR.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Accept invitation</a>
            </div>
            <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">This link expires in <strong>7 days</strong>.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">If the button doesn't work, copy and paste this URL:<br><a href="${inviteUrl}" style="color: #0d9488; word-break: break-all;">${inviteUrl}</a></p>
          </div>
        </div>
      `;
}

const INVITE_ROLE_ALIASES = {
  admin: 'admin',
  'hr recruiter': 'hr_recruiter',
  hr_recruiter: 'hr_recruiter',
  recruiter: 'hr_recruiter',
  'hr manager': 'hr_manager',
  hr_manager: 'hr_manager',
  sales: 'sales',
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

async function inviteTeammate(actor, { email, role, name, customRoleId }) {
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const normalizedEmail = normalizeEmail(email);
  const resolvedRole = normalizeInviteRole(role);

  const org = await Organization.findById(actor.organizationId).select('name domain allowedDomains').lean();
  if (!org) throw httpError('Organization not found', 404);

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

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteUrl = `${frontendUrl}/accept-invite?token=${inviteToken}`;

  const orgName = org.name || '';
  const inviterName = actor.name || actor.email || 'A teammate';
  let emailSent = false;
  let emailError = null;
  try {
    await sendEmail(
      normalizedEmail,
      `You're invited to ${orgName || 'People Connect HR'}`,
      buildInviteEmailHtml(inviteUrl, orgName, inviterName),
      `Accept your invitation: ${inviteUrl} (expires in 7 days)`
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
    emailFromHint: (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim() || null,
  };
}

async function acceptInvite({ token, name, password }, req) {
  const user = await User.findOne({ inviteToken: token, inviteTokenExpires: { $gt: Date.now() } });
  if (!user) throw httpError('Invalid or expired invitation', 400);

  user.name = name || user.name;
  user.password = await bcrypt.hash(password, 10);
  user.isActive = true;
  user.isEmailVerified = true;
  user.inviteToken = undefined;
  user.inviteTokenExpires = undefined;
  await user.save();

  const { issueAuthToken } = require('./sessionService');
  const authToken = await issueAuthToken(user, req);

  return { setCookieToken: authToken, body: { success: true, user } };
}

async function getInvite(token) {
  const user = await User.findOne({
    inviteToken: token,
    inviteTokenExpires: { $gt: Date.now() }
  }).populate('organizationId invitedBy');
  if (!user) throw httpError('Invalid or expired invitation', 400);

  return {
    success: true,
    data: {
      orgName: user.organizationId.name,
      inviterName: user.invitedBy.name,
      role: user.role
    }
  };
}

async function completeOnboarding(userId) {
  await User.findByIdAndUpdate(userId, { onboardingCompleted: true });
  return { success: true, message: 'Onboarding completed' };
}

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  createOrg,
  inviteTeammate,
  acceptInvite,
  getInvite,
  completeOnboarding,
};
