const Candidate = require('../../models/Candidate');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const LocationService = require('../../services/locationService');
const { normalizeText } = require('../../utils/textNormalize');
const mongoose = require('mongoose');
const Notification = require('../../models/Notification');
const logger = require('../../utils/logger');
const { orgOrOwnerScope } = require('./candidateValidation');

// Bulk create candidates from parsed resumes (no file upload)
async function bulkCreateFromParsed(req, res) {
    try {
        const { candidates } = req.body;
        if (!Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ success: false, message: 'candidates array is required and must not be empty' });
        }

        const userId = req.user.id;
        const created = [];
        const skipped = [];
        const errors = [];

        const LocationService = require('../../services/locationService');

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const name = (c.name || '').trim();
            const email = (c.email || '').trim().toLowerCase();
            const contact = (c.contact || '').toString().replace(/\D/g, '').slice(-10);

            if (!name || name.length < 2) {
                errors.push({ index: i + 1, name: name || '(empty)', reason: 'Name is required (min 2 chars)' });
                continue;
            }
            if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                errors.push({ index: i + 1, name, reason: 'Valid email is required' });
                continue;
            }
            if (!contact || contact.length < 7) {
                errors.push({ index: i + 1, name, reason: 'Valid contact (7+ digits) is required' });
                continue;
            }

            try {
                const existing = await Candidate.findOne({
                    $or: [{ email }, { contact }],
                    createdBy: userId
                });
                if (existing) {
                    skipped.push({ index: i + 1, name, reason: existing.email === email ? 'Email exists' : 'Contact exists' });
                    continue;
                }

                const payload = {
                    name: normalizeText(name),
                    email,
                    contact,
                    ctc: (c.ctc || '').trim() || 'Not disclosed',
                    position: (c.position || '').trim() || '',
                    companyName: (c.companyName || c.company || '').trim() || '',
                    experience: (c.experience || '').toString().trim() || '',
                    location: (c.location || '').trim() || '',
                    skills: (c.skills || '').trim() || '',
                    remark: (c.remark || '').trim() || '',
                    status: 'Applied',
                    createdBy: userId,
                    organizationId: req.user.organizationId || undefined,
                    date: new Date().toISOString().split('T')[0]
                };

                if (payload.location && LocationService.detectState) {
                    payload.state = LocationService.detectState(payload.location);
                }

                const doc = new Candidate(payload);
                await doc.save();
                created.push({ index: i + 1, name, email });
            } catch (err) {
                if (err.code === 11000) {
                    skipped.push({ index: i + 1, name, reason: 'Duplicate (email or contact)' });
                } else {
                    errors.push({ index: i + 1, name, reason: err.message || 'Save failed' });
                }
            }
        }

        res.status(200).json({
            success: true,
            created: created.length,
            skipped: skipped.length,
            errors: errors.length,
            details: { created, skipped, errors }
        });
    } catch (error) {
        logger.error('bulkCreateFromParsed error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

async function shareCandidate(req, res) {
    try {
        const { candidateIds, sharedWith } = req.body;
        const userId = req.user.id;

        const ids = Array.isArray(candidateIds) ? candidateIds : [candidateIds];
        if (!ids.length || !Array.isArray(sharedWith) || sharedWith.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "candidateIds (array) and sharedWith array (with at least one member) are required" 
            });
        }

        const User = require('mongoose').model('User');
        const Notification = require('../../models/Notification');
        
        // Verify all candidates belong to the logged-in user
        const candidates = await Candidate.find({ _id: { $in: ids }, createdBy: userId });
        if (candidates.length !== ids.length) {
            return res.status(404).json({ 
                success: false, 
                message: "One or more candidates not found or access denied" 
            });
        }

        const TeamMember = require('../../models/TeamMember');
        const teamMembers = await TeamMember.find({ 
            _id: { $in: sharedWith },
            createdBy: userId
        });
        if (teamMembers.length !== sharedWith.length) {
            return res.status(400).json({ 
                success: false, 
                message: "One or more team members do not exist or are not in your team" 
            });
        }

        // Add sharing entries: sharedWith.userId must be the recipient's User._id (not TeamMember._id)
        const shareEntries = [];
        for (const member of teamMembers) {
            const recipientUser = await User.findOne({ email: member.email.toLowerCase() });
            if (recipientUser) {
                shareEntries.push({
                    userId: recipientUser._id,
                    sharedAt: new Date(),
                    sharedBy: userId
                });
            }
        }

        const result = await Candidate.updateMany(
            { _id: { $in: ids } },
            { $addToSet: { sharedWith: { $each: shareEntries } } }
        );

        // Get the sharer's info
        const sharerUser = await User.findById(userId).select('name email');
        const sharerName = sharerUser?.name || sharerUser?.email || 'A team member';
        const candidateNames = candidates.map(c => c.name).slice(0, 5).join(', ');
        const candidateLabel = ids.length === 1 ? candidates[0].name : `${ids.length} candidates`;

        // Create notifications and send emails to each team member
        for (const member of teamMembers) {
            // Find if this team member has a user account
            const memberUser = await User.findOne({ email: member.email.toLowerCase() });
            
            // Create in-app notification if they have an account
            if (memberUser) {
                try {
                    const notification = new Notification({
                        userId: memberUser._id,
                        senderId: userId,
                        senderName: sharerName,
                        type: 'share_request',
                        title: 'Candidates Shared With You',
                        message: `${sharerName} shared ${candidateLabel} with you.${ids.length <= 5 ? ` (${candidateNames})` : ''}`,
                        priority: 'medium',
                        actionRequired: false,
                        status: 'pending'
                    });
                    await notification.save();
                } catch (notifErr) {
                    logger.error('Failed to create share notification:', notifErr.message);
                }
            }

            // Send email notification
            try {
                const { sendEmailQueued } = require('../../services/emailService');
                const appUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
                if (!appUrl) {
                    logger.warn('[BULK] FRONTEND_URL not set — invite/share links may be incomplete');
                }
                const candidateRows = candidates.slice(0, 10).map(c => 
                    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#374151;">${c.name}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#6b7280;">${c.position || '-'}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#6b7280;">${c.email || '-'}</td></tr>`
                ).join('');
                
                const htmlBody = `
                  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 36px; color: white; text-align: center; border-radius: 12px 12px 0 0;">
                      <h2 style="margin: 0; font-size: 20px;">Candidates Shared With You</h2>
                    </div>
                    <div style="padding: 32px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                      <p style="color: #374151; font-size: 16px; margin: 0 0 12px;">Hello <strong>${member.name}</strong>,</p>
                      <p style="color: #6b7280; line-height: 1.7; margin: 0 0 20px;">
                        <strong>${sharerName}</strong> has shared <strong>${candidateLabel}</strong> with you on SkillNix.
                      </p>
                      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;background:#f9fafb;border-radius:8px;overflow:hidden;">
                        <thead><tr style="background:#f3f4f6;"><th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;font-weight:600;">Name</th><th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;font-weight:600;">Position</th><th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;font-weight:600;">Email</th></tr></thead>
                        <tbody>${candidateRows}</tbody>
                      </table>
                      ${ids.length > 10 ? `<p style="color:#9ca3af;font-size:13px;margin:0 0 16px;">...and ${ids.length - 10} more candidates</p>` : ''}
                      <div style="text-align: center; margin: 24px 0;">
                        <a href="${appUrl}/ats" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                          View Candidates
                        </a>
                      </div>
                    </div>
                  </div>
                `;
                const textBody = `Hello ${member.name}, ${sharerName} has shared ${candidateLabel} with you on SkillNix. Log in to view.`;
                
                await sendEmailQueued(member.email, `${sharerName} shared ${candidateLabel} with you - SkillNix`, htmlBody, textBody, { userId });
            } catch (emailErr) {
                logger.error(`Failed to send share email to ${member.email}:`, emailErr.message);
            }
        }

        res.status(200).json({ 
            success: true, 
            message: `${ids.length} candidate(s) shared with ${sharedWith.length} team member(s)`,
            sharedCandidateCount: ids.length,
            sharedMemberCount: sharedWith.length,
            modifiedCount: result.modifiedCount
        });

    } catch (error) {
        logger.error('Error sharing candidate:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error sharing candidate", 
            error: error.message 
        });
    }
};

// Import shared candidates into current user's database (copy as own candidates)
async function importSharedCandidates(req, res) {
    try {
        const mongoose = require('mongoose');
        const { candidateIds } = req.body;
        const userId = req.user.id;
        const rawIds = Array.isArray(candidateIds) ? candidateIds : (candidateIds != null ? [candidateIds] : []);
        if (!rawIds.length) {
            return res.status(400).json({ success: false, message: 'candidateIds array is required' });
        }
        // Convert to ObjectIds with 'new' to avoid "Class constructor ObjectId cannot be invoked without 'new'"
        const ids = rawIds
            .filter(id => id != null && id !== '')
            .map(id => (mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null))
            .filter(Boolean);
        if (ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid candidate IDs provided' });
        }

        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        const shared = await Candidate.find({
            _id: { $in: ids },
            'sharedWith.userId': userIdObj
        }).lean();

        if (shared.length === 0) {
            return res.status(400).json({ success: false, message: 'No shared candidates found or you do not have access' });
        }

        const created = [];
        for (const c of shared) {
            const { _id, createdBy, sharedWith, createdAt, __v, ...rest } = c;
            const doc = new Candidate({
                ...rest,
                createdBy: userId,
                sharedWith: []
            });
            await doc.save();
            created.push({ id: doc._id, name: doc.name });
        }

        res.status(200).json({
            success: true,
            message: `Imported ${created.length} candidate(s) to your database`,
            imported: created.length,
            details: created
        });
    } catch (error) {
        logger.error('Import shared error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

// Import all candidates (from database) into current user's list (copy as own). Skips already-owned.
async function importAllToMine(req, res) {
    try {
        const mongoose = require('mongoose');
        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        const allCandidates = await Candidate.find({}).lean();
        const toImport = allCandidates.filter(c => {
            const owner = c.createdBy != null ? String(c.createdBy) : '';
            return owner !== String(userId);
        });

        const created = [];
        for (const c of toImport) {
            const { _id, createdBy, sharedWith, createdAt, __v, ...rest } = c;
            const doc = new Candidate({
                ...rest,
                createdBy: userId,
                sharedWith: []
            });
            await doc.save();
            created.push({ id: doc._id, name: doc.name });
        }

        res.status(200).json({
            success: true,
            message: `Imported ${created.length} candidate(s) to your database`,
            imported: created.length,
            details: created
        });
    } catch (error) {
        logger.error('Import all to mine error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

async function bulkDeleteCandidates(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No candidate IDs provided' });
        }

        const result = await Candidate.deleteMany({ _id: { $in: ids }, ...orgOrOwnerScope(req) });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} of ${ids.length} candidates`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error deleting candidates', error: err.message });
    }
}

async function clearAllCandidates(req, res) {
    try {
        logger.info('⚠️  Clearing all candidates for user:', req.user.id);
        const result = await Candidate.deleteMany({ createdBy: req.user.id });

        res.status(200).json({
            success: true,
            message: "All candidates deleted successfully",
            deletedCount: result.deletedCount || 0
        });

        logger.info(`✅ Cleared ${result.deletedCount || 0} records from database`);
    } catch (err) {
        logger.error('❌ Error clearing database:', err.message);
        res.status(500).json({ success: false, message: "Error clearing database", error: err.message });
    }
}

module.exports = {
    bulkCreateFromParsed,
    shareCandidate,
    importSharedCandidates,
    importAllToMine,
    bulkDeleteCandidates,
    clearAllCandidates,
};
