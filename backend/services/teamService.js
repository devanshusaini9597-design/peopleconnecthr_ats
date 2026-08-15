/**
 * Team invite / domain helpers — keep HTTP thin in teamRoutes.
 */
const mongoose = require('mongoose');
const TeamMember = require('../models/TeamMember');
const Company = require('../models/Company');
const Notification = require('../models/Notification');
const { normalizeText } = require('../utils/textNormalize');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const { isFreelancer } = require('../utils/dataScope');

const SYSTEM_ROLE_DIRECTORY = {
  owner: 'Admin',
  admin: 'Admin',
  hr_manager: 'HR Manager',
  hr_recruiter: 'Recruiter',
  recruiter: 'Recruiter',
  sales: 'Team Member',
  freelancer: 'External',
  interviewer: 'Team Member',
  other: 'Team Member',
  readonly: 'Team Member',
};

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
  const { name, email, role, phone, department } = body;
  if (!name || !email) throw httpError('Name and email are required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw httpError('Invalid email address');
  }

  const emailLower = email.toLowerCase().trim();
  const User = mongoose.model('User');
  if (user.organizationId) {
    const orgUser = await User.findOne({
      organizationId: user.organizationId,
      email: emailLower,
    }).select('_id');
    if (orgUser) {
      throw httpError(
        'This person already has workspace access. Use Invite teammate to grant a Skillnix seat.',
        409
      );
    }
  }

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
  if (existing) throw httpError('This email is already in your directory');

  const existingPending = await TeamMember.findOne({
    ...teamScope,
    email: emailLower,
    invitationStatus: 'Pending',
  });
  if (existingPending) {
    throw httpError('This email already has a pending directory invite');
  }

  const member = new TeamMember({
    createdBy: user.id,
    organizationId: user.organizationId,
    name: normalizeText(name),
    email: emailLower,
    role: role ? normalizeText(role) : 'External',
    phone: phone?.trim() || '',
    department: department ? normalizeText(department) : '',
    invitationStatus: 'Active',
    invitedBy: user.id,
    invitedAt: new Date(),
  });

  await member.save();

  if (user.organizationId) {
    eventBus.emit(eventTypes.USER_INVITED, {
      organizationId: user.organizationId,
      userId: user.id,
      resourceType: 'TeamMember',
      resourceId: member._id,
      invitedEmail: emailLower,
      role: member.role,
    });
  }

  return {
    member,
    message: 'Stakeholder added to your directory',
    requiresAcceptance: false,
    kind: 'contact',
  };
}

function mapWorkspaceUser(u, currentUser) {
  const email = (u.email || '').toLowerCase();
  const currentEmail = (currentUser.email || '').toLowerCase();
  const pending = u.isActive === false;
  return {
    _id: u._id,
    userId: u._id,
    name: u.name || email.split('@')[0] || 'Teammate',
    email: u.email,
    role: SYSTEM_ROLE_DIRECTORY[u.role] || 'Team Member',
    systemRole: u.role,
    phone: u.phone || '',
    department: '',
    invitationStatus: pending ? 'Pending' : 'Active',
    kind: 'workspace',
    isYou: String(u._id) === String(currentUser.id) || email === currentEmail,
    isActive: !pending,
    lastLoginAt: u.lastLoginAt || null,
    customRoleName: u.customRoleId?.name || '',
    invitedByMe: false,
  };
}

/** Org users (seats) plus stakeholder contacts for CC/BCC. */
async function listTeamMembers(user) {
  if (isFreelancer(user)) return [];
  const userId = user.id;
  const userEmail = (user.email || '').toLowerCase();

  if (user.organizationId) {
    const User = mongoose.model('User');
    const orgUsers = await User.find({ organizationId: user.organizationId })
      .select('name email role phone isActive lastLoginAt customRoleId')
      .populate('customRoleId', 'name')
      .sort({ name: 1 })
      .lean();
    const workspace = orgUsers.map((u) => mapWorkspaceUser(u, user));
    const workspaceEmails = new Set(
      workspace.map((row) => String(row.email || '').toLowerCase()).filter(Boolean)
    );

    const contacts = await TeamMember.find({
      organizationId: user.organizationId,
      $or: [
        { invitationStatus: 'Active' },
        { invitationStatus: 'Accepted' },
        { invitationStatus: { $exists: false } },
        { invitationStatus: { $in: [null, ''] } },
      ],
    }).sort({ name: 1 }).lean();

    const stakeholders = contacts
      .filter((m) => !workspaceEmails.has(String(m.email || '').toLowerCase()))
      .map((m) => ({
        ...m,
        kind: 'contact',
        systemRole: null,
        isYou: false,
        isActive: true,
        invitedByMe: String(m.createdBy) === String(userId),
      }));

    return [...workspace, ...stakeholders].sort((a, b) => {
      if (a.isYou && !b.isYou) return -1;
      if (!a.isYou && b.isYou) return 1;
      if (a.kind !== b.kind) return a.kind === 'workspace' ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
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
  if (!member) {
    throw httpError('Workspace members are managed from Organization settings', 404);
  }

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
  if (!result) {
    throw httpError('Workspace members are managed from Organization settings', 404);
  }

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
