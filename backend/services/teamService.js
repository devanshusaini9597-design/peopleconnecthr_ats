/**
 * Team invite / domain helpers — keep HTTP thin in teamRoutes.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const TeamMember = require('../models/TeamMember');
const Company = require('../models/Company');
const Notification = require('../models/Notification');
const { normalizeText } = require('../utils/textNormalize');
const { sendEmailQueued } = require('./emailService');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const DEFAULT_COMPANY_DOMAIN = 'skillnixrecruitment.com';

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function getCompanyDomain(userId) {
  try {
    const company = await Company.findOne({ createdBy: userId });
    if (company && company.domain) {
      return {
        domain: company.domain.toLowerCase(),
        allowedDomains: company.allowedDomains
          ? company.allowedDomains.map((d) => d.toLowerCase())
          : [],
        companyName: company.name,
      };
    }
  } catch (err) {
    console.log('Error getting company:', err.message);
  }

  return {
    domain: DEFAULT_COMPANY_DOMAIN,
    allowedDomains: [],
    companyName: 'SkillNix Recruitment Services',
  };
}

function isValidCompanyEmail(email, companyInfo) {
  if (!companyInfo || !companyInfo.domain) {
    return { valid: true, isCompanyEmail: false };
  }

  const emailDomain = (email || '').toLowerCase().split('@')[1];
  if (!emailDomain) {
    return { valid: false, isCompanyEmail: false };
  }

  const isCompanyEmail =
    emailDomain === companyInfo.domain ||
    (companyInfo.allowedDomains && companyInfo.allowedDomains.includes(emailDomain));

  return { valid: isCompanyEmail, isCompanyEmail };
}

async function inviteTeamMember(user, body) {
  const { name, email, role, phone, department, message } = body;
  if (!name || !email) throw httpError('Name and email are required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Invalid email address');
  }

  const emailLower = email.toLowerCase().trim();
  const companyInfo = await getCompanyDomain(user.id);
  const validation = isValidCompanyEmail(emailLower, companyInfo);
  if (!validation.valid) throw httpError('Invalid email format');

  const isCompanyEmail = validation.isCompanyEmail;
  const teamScope = user.organizationId
    ? { organizationId: user.organizationId }
    : { createdBy: user.id };

  const existing = await TeamMember.findOne({
    ...teamScope,
    email: emailLower,
    $or: [
      { invitationStatus: { $in: ['Active', 'Accepted'] } },
      { invitationStatus: { $exists: false } },
      { invitationStatus: { $in: [null, ''] } },
    ],
  });
  if (existing) throw httpError('Team member with this email already exists');

  const existingPending = await TeamMember.findOne({
    ...teamScope,
    email: emailLower,
    invitationStatus: 'Pending',
  });
  if (existingPending) {
    throw httpError(
      'This user has already been invited. Please wait for them to accept or decline the request.'
    );
  }

  const User = mongoose.model('User');
  const invitedUser = await User.findOne({ email: emailLower });
  if (!invitedUser) {
    throw httpError(
      'This user does not exist in the system. They need to sign up with a company account (@skillnixrecruitment.com) first.'
    );
  }

  const invitationToken = crypto.randomBytes(32).toString('hex');
  const invitationStatus = isCompanyEmail ? 'Active' : 'Pending';

  const member = new TeamMember({
    createdBy: user.id,
    organizationId: user.organizationId,
    name: normalizeText(name),
    email: emailLower,
    role: role ? normalizeText(role) : 'Team Member',
    phone: phone?.trim() || '',
    department: department ? normalizeText(department) : '',
    invitationStatus,
    invitationToken,
    invitationMessage: message || '',
    invitedBy: user.id,
    invitedAt: new Date(),
  });

  await member.save();

  const inviterUser = await User.findById(user.id).select('name email');
  const inviterName = inviterUser?.name || inviterUser?.email || 'A team member';

  try {
    const notification = new Notification({
      userId: invitedUser._id,
      senderId: user.id,
      senderName: inviterName,
      type: 'invitation',
      title: 'Team Invitation',
      message: `${inviterName} has invited you to join their team as ${role || 'Team Member'}${department ? ` in the ${department} department` : ''}.`,
      priority: 'high',
      actionRequired: true,
      status: 'pending',
      relatedMemberId: member._id,
      relatedEmail: user.email,
    });
    await notification.save();
  } catch (notifErr) {
    console.error('Failed to create invitation notification:', notifErr.message);
  }

  try {
    const appUrl =
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    if (!appUrl) {
      console.warn('[TEAM] FRONTEND_URL not set — invite links may be incomplete');
    }
    const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px; color: white; text-align: center; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 22px;">Team Invitation</h2>
            <p style="margin: 10px 0 0; opacity: 0.9; font-size: 14px;">You've been invited to join a team</p>
          </div>
          <div style="padding: 36px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">Hello <strong>${normalizeText(name)}</strong>,</p>
            <p style="color: #6b7280; line-height: 1.7; margin: 0 0 20px;">
              <strong>${inviterName}</strong> has invited you to join their team on SkillNix as <strong>${role || 'Team Member'}</strong>${department ? ` in the <strong>${department}</strong> department` : ''}.
            </p>
            ${message ? `<div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 14px 18px; margin: 0 0 20px; border-radius: 0 8px 8px 0;"><p style="color: #1e40af; font-size: 14px; margin: 0; font-style: italic;">"${message}"</p></div>` : ''}
            <div style="text-align: center; margin: 28px 0;">
              <a href="${appUrl}/team" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                View Invitation
              </a>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0;">
              Log in to your SkillNix account to accept or decline this invitation.
            </p>
          </div>
        </div>
      `;
    const textBody = `Hello ${normalizeText(name)}, ${inviterName} has invited you to join their team on SkillNix as ${role || 'Team Member'}. Log in to your account to accept or decline.`;

    await sendEmailQueued(
      emailLower,
      `Team Invitation from ${inviterName} - SkillNix`,
      htmlBody,
      textBody,
      { userId: user.id }
    );
  } catch (emailErr) {
    console.error('Failed to send invitation email:', emailErr.message);
  }

  if (user.organizationId) {
    eventBus.emit(eventTypes.USER_INVITED, {
      organizationId: user.organizationId,
      userId: user.id,
      resourceType: 'TeamMember',
      resourceId: member._id,
      invitedEmail: emailLower,
      role: role || 'Team Member',
    });
  }

  const statusMessage = isCompanyEmail
    ? 'Team member added successfully (company email)'
    : 'Invitation sent successfully. They need to accept the invitation.';

  return {
    member,
    message: statusMessage,
    requiresAcceptance: !isCompanyEmail,
  };
}

/** Active/Accepted roster for the current user's org (or legacy per-inviter view). */
async function listTeamMembers(user) {
  const userId = user.id;
  const userEmail = (user.email || '').toLowerCase();

  if (user.organizationId) {
    const members = await TeamMember.find({
      organizationId: user.organizationId,
      $or: [
        { invitationStatus: 'Active' },
        { invitationStatus: 'Accepted' },
        { invitationStatus: { $exists: false } },
        { invitationStatus: { $in: [null, ''] } }
      ]
    }).sort({ name: 1 }).lean();

    return members
      .filter(m => (m.email || '').toLowerCase() !== userEmail)
      .map(m => ({ ...m, invitedByMe: String(m.createdBy) === String(userId) }));
  }

  // ── Legacy fallback (no organizationId on this account) ──
  const invitedByMe = await TeamMember.find({
    createdBy: userId,
    $or: [
      { invitationStatus: 'Active' },
      { invitationStatus: 'Accepted' },
      { invitationStatus: { $exists: false } },
      { invitationStatus: { $in: [null, ''] } }
    ]
  }).sort({ name: 1 }).lean();

  const invitedMe = await TeamMember.find({
    email: userEmail,
    invitationStatus: 'Accepted'
  }).lean();

  const User = mongoose.model('User');
  const inviterIds = [...new Set(invitedMe.map(m => String(m.createdBy)))];
  const inviterUsers = inviterIds.length > 0
    ? await User.find({ _id: { $in: inviterIds } }).select('name email').lean()
    : [];
  const inviterMap = {};
  inviterUsers.forEach(u => { inviterMap[String(u._id)] = u; });

  const invitedMeAsMembers = invitedMe.map(m => {
    const inviter = inviterMap[String(m.createdBy)];
    return {
      _id: m._id,
      name: inviter?.name || inviter?.email || 'Unknown',
      email: inviter?.email || '',
      role: 'Team Member',
      phone: '',
      department: '',
      invitationStatus: 'Accepted',
      invitedByMe: false,
      invitedMe: true
    };
  });

  invitedByMe.forEach(m => { m.invitedByMe = true; m.invitedMe = false; });

  const byEmail = {};
  [...invitedByMe, ...invitedMeAsMembers].forEach(m => {
    const e = (m.email || '').toLowerCase();
    if (!e) return;
    if (!byEmail[e] || m.invitedMe) byEmail[e] = m;
  });
  return Object.values(byEmail)
    .filter(m => (m.email || '').toLowerCase() !== userEmail)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

async function listPendingInvitations(user) {
  return TeamMember.find({
    email: user.email,
    invitationStatus: 'Pending'
  }).sort({ invitedAt: -1 });
}

async function updateTeamMember(user, id, body) {
  const { name, email, role, phone, department } = body;
  const teamScope = user.organizationId ? { organizationId: user.organizationId } : { createdBy: user.id };
  const member = await TeamMember.findOne({ _id: id, ...teamScope });
  if (!member) throw httpError('Team member not found', 404);

  if (name) member.name = normalizeText(name);
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw httpError('Invalid email address');
    }
    // Check duplicate (different member same email)
    const dup = await TeamMember.findOne({ ...teamScope, email: email.toLowerCase(), _id: { $ne: id } });
    if (dup) throw httpError('Another team member with this email already exists');
    member.email = email.toLowerCase().trim();
  }
  const previousRole = member.role;
  if (role !== undefined) member.role = normalizeText(role);
  if (phone !== undefined) member.phone = phone.trim();
  if (department !== undefined) member.department = normalizeText(department);

  await member.save();

  if (user.organizationId && role !== undefined && previousRole !== member.role) {
    eventBus.emit(eventTypes.USER_ROLE_CHANGED, {
      organizationId: user.organizationId,
      userId: user.id,
      resourceType: 'TeamMember',
      resourceId: member._id,
      previousRole,
      newRole: member.role
    });
  }

  return member;
}

async function deleteTeamMember(user, id) {
  const teamScope = user.organizationId ? { organizationId: user.organizationId } : { createdBy: user.id };
  const result = await TeamMember.findOneAndDelete({ _id: id, ...teamScope });
  if (!result) throw httpError('Team member not found', 404);

  if (user.organizationId) {
    eventBus.emit(eventTypes.USER_REMOVED, {
      organizationId: user.organizationId,
      userId: user.id,
      resourceType: 'TeamMember',
      resourceId: result._id,
      removedEmail: result.email
    });
  }

  return result;
}

async function acceptInvitation(user, id) {
  const member = await TeamMember.findById(id);
  if (!member) throw httpError('Invitation not found', 404);

  // Verify this is the right user
  if (member.email !== user.email.toLowerCase()) {
    throw httpError('Not authorized to accept this invitation', 403);
  }

  if (member.invitationStatus !== 'Pending') {
    throw httpError('This invitation is no longer pending');
  }

  // Accept the invitation
  member.invitationStatus = 'Accepted';
  member.acceptedAt = new Date();
  member.invitationToken = null;
  await member.save();

  const accepterName = user.name || user.email;

  // Notify the person who sent the invitation
  const notification = new Notification({
    userId: member.createdBy,
    senderId: user.id,
    senderName: accepterName,
    type: 'invitation_accepted',
    title: 'Invitation Accepted',
    message: `${member.name} (${member.email}) has accepted your invitation to join your team.`,
    priority: 'medium',
    actionRequired: false,
    status: 'accepted',
    relatedMemberId: member._id,
    relatedEmail: member.email
  });
  await notification.save();

  // Also mark the original invitation notification as accepted
  try {
    await Notification.updateMany(
      { userId: user.id, type: 'invitation', relatedMemberId: member._id, status: 'pending' },
      { status: 'accepted', actionRequired: false, isRead: true }
    );
  } catch (err) { /* silent */ }

  return member;
}

async function declineInvitation(user, id) {
  const member = await TeamMember.findById(id);
  if (!member) throw httpError('Invitation not found', 404);

  // Verify this is the right user
  if (member.email !== user.email.toLowerCase()) {
    throw httpError('Not authorized to decline this invitation', 403);
  }

  if (member.invitationStatus !== 'Pending') {
    throw httpError('This invitation is no longer pending');
  }

  // Decline the invitation
  member.invitationStatus = 'Declined';
  member.declinedAt = new Date();
  member.invitationToken = null;
  await member.save();

  const declinerName = user.name || user.email;

  // Notify the person who sent the invitation
  const notification = new Notification({
    userId: member.createdBy,
    senderId: user.id,
    senderName: declinerName,
    type: 'invitation_declined',
    title: 'Invitation Declined',
    message: `${member.name} (${member.email}) has declined your invitation.`,
    priority: 'medium',
    actionRequired: false,
    status: 'declined',
    relatedMemberId: member._id,
    relatedEmail: member.email
  });
  await notification.save();

  // Also mark the original invitation notification as declined
  try {
    await Notification.updateMany(
      { userId: user.id, type: 'invitation', relatedMemberId: member._id, status: 'pending' },
      { status: 'declined', actionRequired: false, isRead: true }
    );
  } catch (err) { /* silent */ }

  return member;
}

module.exports = {
  DEFAULT_COMPANY_DOMAIN,
  getCompanyDomain,
  isValidCompanyEmail,
  inviteTeamMember,
  listTeamMembers,
  listPendingInvitations,
  updateTeamMember,
  deleteTeamMember,
  acceptInvitation,
  declineInvitation,
};
