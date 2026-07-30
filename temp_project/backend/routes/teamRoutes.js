const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const TeamMember = require('../models/TeamMember');
const Company = require('../models/Company');
const Notification = require('../models/Notification');
const { normalizeText } = require('../utils/textNormalize');
const { sendEmail } = require('../services/emailService');

// All routes require auth
router.use(verifyToken);

// Default company domain for testing phase (SkillNix Recruitment Services)
const DEFAULT_COMPANY_DOMAIN = 'skillnixrecruitment.com';

// Helper function to get company domain
const getCompanyDomain = async (userId) => {
  try {
    // First try to get from company settings
    const company = await Company.findOne({ createdBy: userId });
    if (company && company.domain) {
      return {
        domain: company.domain.toLowerCase(),
        allowedDomains: company.allowedDomains ? company.allowedDomains.map(d => d.toLowerCase()) : [],
        companyName: company.name
      };
    }
  } catch (err) {
    console.log('Error getting company:', err.message);
  }
  
  // Testing phase: enforce company domain so only @skillnixrecruitment.com can be invited
  return {
    domain: DEFAULT_COMPANY_DOMAIN,
    allowedDomains: [],
    companyName: 'SkillNix Recruitment Services'
  };
};

// Helper function to validate email domain (only company emails allowed when domain is set)
const isValidCompanyEmail = (email, companyInfo) => {
  if (!companyInfo || !companyInfo.domain) {
    return { valid: true, isCompanyEmail: false };
  }
  
  const emailDomain = (email || '').toLowerCase().split('@')[1];
  if (!emailDomain) {
    return { valid: false, isCompanyEmail: false };
  }
  
  const isCompanyEmail = emailDomain === companyInfo.domain ||
    (companyInfo.allowedDomains && companyInfo.allowedDomains.includes(emailDomain));
  
  // Require company email: only @skillnixrecruitment.com (or configured domain) allowed
  return { valid: isCompanyEmail, isCompanyEmail };
};

// GET all team members for current user: people I invited + people who invited me (so both sides see each other)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = (req.user.email || '').toLowerCase();

    // 1) People I invited (createdBy me, Active or Accepted)
    const invitedByMe = await TeamMember.find({
      createdBy: userId,
      $or: [
        { invitationStatus: 'Active' },
        { invitationStatus: 'Accepted' },
        { invitationStatus: { $exists: false } },
        { invitationStatus: { $in: [null, ''] } }
      ]
    }).sort({ name: 1 }).lean();

    // 2) People who invited me (where I am the invitee and I accepted)
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

    // Build "members who invited me" as synthetic members so both sides see each other
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

    // Mark my list as invitedByMe: true
    invitedByMe.forEach(m => { m.invitedByMe = true; m.invitedMe = false; });

    // Combine and dedupe by email (in case same person invited me and I invited them)
    const byEmail = {};
    [...invitedByMe, ...invitedMeAsMembers].forEach(m => {
      const e = (m.email || '').toLowerCase();
      if (!e) return;
      if (!byEmail[e] || m.invitedMe) byEmail[e] = m;
    });
    // Exclude current user from team directory — show only other members
    const members = Object.values(byEmail)
      .filter(m => (m.email || '').toLowerCase() !== userEmail)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json({ success: true, members });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET pending invitations (for the current user)
router.get('/pending', async (req, res) => {
  try {
    // Get pending invitations where user was invited
    const invitations = await TeamMember.find({
      email: req.user.email,
      invitationStatus: 'Pending'
    }).sort({ invitedAt: -1 });
    res.json({ success: true, invitations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET company domain info
router.get('/domain-info', async (req, res) => {
  try {
    const companyInfo = await getCompanyDomain(req.user.id);
    res.json({ 
      success: true, 
      domainInfo: companyInfo,
      userEmail: req.user.email
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Invite a team member (with domain validation)
router.post('/', async (req, res) => {
  try {
    const { name, email, role, phone, department, message, forceInvite } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const emailLower = email.toLowerCase().trim();
    
    // Get company domain info
    const companyInfo = await getCompanyDomain(req.user.id);
    
    // Validate email domain
    const validation = isValidCompanyEmail(emailLower, companyInfo);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    
    // Check if email is from company domain
    const isCompanyEmail = validation.isCompanyEmail;
    
    // Check for existing member (active) - include backward compatibility for members without invitationStatus field
    const existing = await TeamMember.findOne({ 
      createdBy: req.user.id, 
      email: emailLower,
      $or: [
        { invitationStatus: { $in: ['Active', 'Accepted'] } },
        { invitationStatus: { $exists: false } },
        { invitationStatus: { $in: [null, ''] } }
      ]
    });
    if (existing) return res.status(400).json({ success: false, message: 'Team member with this email already exists' });

    // Check for pending invitation
    const existingPending = await TeamMember.findOne({
      createdBy: req.user.id,
      email: emailLower,
      invitationStatus: 'Pending'
    });
    
    if (existingPending) {
      return res.status(400).json({ success: false, message: 'This user has already been invited. Please wait for them to accept or decline the request.' });
    }

    // Require that the invited email exists as a registered user (company member)
    const User = mongoose.model('User');
    const invitedUser = await User.findOne({ email: emailLower });
    if (!invitedUser) {
      return res.status(400).json({
        success: false,
        message: 'This user does not exist in the system. They need to sign up with a company account (@skillnixrecruitment.com) first.'
      });
    }

    // Generate invitation token
    const invitationToken = require('crypto').randomBytes(32).toString('hex');
    
    // Determine if this should be auto-active or pending
    // Company emails are auto-active, external emails require acceptance
    const invitationStatus = isCompanyEmail ? 'Active' : 'Pending';
    
    const member = new TeamMember({
      createdBy: req.user.id,
      name: normalizeText(name),
      email: emailLower,
      role: role ? normalizeText(role) : 'Team Member',
      phone: phone?.trim() || '',
      department: department ? normalizeText(department) : '',
      invitationStatus,
      invitationToken,
      invitationMessage: message || '',
      invitedBy: req.user.id,
      invitedAt: new Date()
    });
    
    await member.save();
    
    const inviterUser = await User.findById(req.user.id).select('name email');
    const inviterName = inviterUser?.name || inviterUser?.email || 'A team member';

    // Create in-app notification for the invited user (if they have an account)
    if (invitedUser) {
      try {
        const notification = new Notification({
          userId: invitedUser._id,
          senderId: req.user.id,
          senderName: inviterName,
          type: 'invitation',
          title: 'Team Invitation',
          message: `${inviterName} has invited you to join their team as ${role || 'Team Member'}${department ? ` in the ${department} department` : ''}.`,
          priority: 'high',
          actionRequired: true,
          status: 'pending',
          relatedMemberId: member._id,
          relatedEmail: req.user.email
        });
        await notification.save();
      } catch (notifErr) {
        console.error('Failed to create invitation notification:', notifErr.message);
      }
    }

    // Send invitation email to the invited person
    try {
      const appUrl = process.env.FRONTEND_URL || 'https://skillnix.vercel.app';
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
      
      await sendEmail(emailLower, `Team Invitation from ${inviterName} - SkillNix`, htmlBody, textBody, { userId: req.user.id });
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr.message);
    }

    const statusMessage = isCompanyEmail 
      ? 'Team member added successfully (company email)'
      : 'Invitation sent successfully. They need to accept the invitation.';

    res.status(201).json({ 
      success: true, 
      member, 
      message: statusMessage,
      requiresAcceptance: !isCompanyEmail
    });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Team member with this email already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT - Update a team member
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, phone, department } = req.body;
    const member = await TeamMember.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });

    if (name) member.name = normalizeText(name);
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email address' });
      }
      // Check duplicate (different member same email)
      const dup = await TeamMember.findOne({ createdBy: req.user.id, email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ success: false, message: 'Another team member with this email already exists' });
      member.email = email.toLowerCase().trim();
    }
    if (role !== undefined) member.role = normalizeText(role);
    if (phone !== undefined) member.phone = phone.trim();
    if (department !== undefined) member.department = normalizeText(department);

    await member.save();
    res.json({ success: true, member, message: 'Team member updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE - Remove a team member
router.delete('/:id', async (req, res) => {
  try {
    const result = await TeamMember.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
    if (!result) return res.status(404).json({ success: false, message: 'Team member not found' });
    res.json({ success: true, message: 'Team member removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Accept invitation (for the invited user)
router.post('/accept-invitation/:id', async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Invitation not found' });
    
    // Verify this is the right user
    if (member.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Not authorized to accept this invitation' });
    }
    
    if (member.invitationStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'This invitation is no longer pending' });
    }
    
    // Accept the invitation
    member.invitationStatus = 'Accepted';
    member.acceptedAt = new Date();
    member.invitationToken = null;
    await member.save();
    
    const accepterName = req.user.name || req.user.email;
    
    // Notify the person who sent the invitation
    const notification = new Notification({
      userId: member.createdBy,
      senderId: req.user.id,
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
        { userId: req.user.id, type: 'invitation', relatedMemberId: member._id, status: 'pending' },
        { status: 'accepted', actionRequired: false, isRead: true }
      );
    } catch (err) { /* silent */ }
    
    res.json({ success: true, message: 'Invitation accepted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST - Decline invitation (for the invited user)
router.post('/decline-invitation/:id', async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Invitation not found' });
    
    // Verify this is the right user
    if (member.email !== req.user.email.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Not authorized to decline this invitation' });
    }
    
    if (member.invitationStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'This invitation is no longer pending' });
    }
    
    // Decline the invitation
    member.invitationStatus = 'Declined';
    member.declinedAt = new Date();
    member.invitationToken = null;
    await member.save();
    
    const declinerName = req.user.name || req.user.email;
    
    // Notify the person who sent the invitation
    const notification = new Notification({
      userId: member.createdBy,
      senderId: req.user.id,
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
        { userId: req.user.id, type: 'invitation', relatedMemberId: member._id, status: 'pending' },
        { status: 'declined', actionRequired: false, isRead: true }
      );
    } catch (err) { /* silent */ }
    
    res.json({ success: true, message: 'Invitation declined' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
