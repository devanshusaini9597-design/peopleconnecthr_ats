const Candidate = require('../../models/Candidate');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const LocationService = require('../../services/locationService');
const { normalizeText } = require('../../utils/textNormalize');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { orgOrOwnerScope, candidateWriteScope } = require('./candidateValidation');
const { isFreelancer } = require('../../utils/dataScope');
const { enforceSpocOnWrite, stripSpocUnlessEditor } = require('../../utils/spocIdentity');
const { normalizePan, validatePanForClient } = require('../../utils/panClientRules');
const { promoteNamesSafe } = require('../../services/skillCatalogSync');
const { promoteNamesSafe: promotePositionsSafe } = require('../../services/positionCatalogSync');

async function createCandidate(req, res) {
    try {
        // ✅ Server-side validation: 4 mandatory fields
        const { name, email, contact, ctc } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email is required' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        if (!contact || !contact.trim()) return res.status(400).json({ success: false, message: 'Contact number is required' });
        const digits = contact.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) return res.status(400).json({ success: false, message: 'Enter a valid phone number (7-15 digits)' });
        if (!ctc || !ctc.trim()) return res.status(400).json({ success: false, message: 'Current CTC is required' });

        if (isFreelancer(req.user) && !req.file && !(req.body.resume && String(req.body.resume).trim())) {
            return res.status(400).json({ success: false, message: 'CV / resume is required for freelance desk candidates' });
        }

        if (req.body.pan) req.body.pan = normalizePan(req.body.pan);
        const panScope = req.user.organizationId
          ? { organizationId: req.user.organizationId }
          : { createdBy: req.user.id };
        const panErr = await validatePanForClient(req.body.pan, req.body.client, panScope);
        if (panErr) return res.status(400).json({ success: false, message: panErr });

        // Org-wide uniqueness — email OR phone already on file
        if (req.user.organizationId) {
            const { findOrgPhoneConflict, findOrgEmailConflict } = require('../../services/dedupeService');
            const emailHit = await findOrgEmailConflict(req.user.organizationId, email);
            if (emailHit) {
                const freelancerMsg = 'The candidate is duplicate kindly check with the hiring manager';
                return res.status(400).json({
                    success: false,
                    code: 'DUPLICATE_EMAIL',
                    message: isFreelancer(req.user)
                      ? freelancerMsg
                      : `Email already exists for ${emailHit.name || 'another candidate'}${emailHit.contact ? ` (${emailHit.contact})` : ''}. Open that profile or use a different email.`,
                    existingId: emailHit._id,
                });
            }
            const phoneHit = await findOrgPhoneConflict(req.user.organizationId, contact);
            if (phoneHit) {
                const freelancerMsg = 'The candidate is duplicate kindly check with the hiring manager';
                return res.status(400).json({
                    success: false,
                    code: 'DUPLICATE_PHONE',
                    message: isFreelancer(req.user)
                      ? freelancerMsg
                      : `Phone already exists for ${phoneHit.name || 'another candidate'} (${phoneHit.email || 'no email'}). Open that profile or use a different number.`,
                    existingId: phoneHit._id,
                });
            }
        }

        if (typeof req.body.statusHistory === 'string') {
            req.body.statusHistory = JSON.parse(req.body.statusHistory);
        }
        if (typeof req.body.customFields === 'string') {
            try { req.body.customFields = JSON.parse(req.body.customFields); }
            catch (e) { req.body.customFields = {}; }
        }
        if (req.body.customFields && typeof req.body.customFields !== 'object') {
            req.body.customFields = {};
        }
        if (req.file) {
            const documentStorage = require('../../services/documentStorageService');
            const path = require('path');
            const fs = require('fs');
            const filePath = (req.file.path && fs.existsSync(req.file.path))
                ? req.file.path
                : (fs.existsSync(path.join(process.cwd(), 'uploads', req.file.filename))
                    ? path.join(process.cwd(), 'uploads', req.file.filename)
                    : path.join(__dirname, '..', '..', 'uploads', req.file.filename));
            const orgId = req.user?.organizationId;
            logger.info('[Resume] Saving resume — BYOK storage / platform S3 / local');
            const uploaded = await documentStorage.uploadResume({
                organizationId: orgId,
                localFilePath: filePath,
                originalName: req.file.originalname
            });
            if (uploaded && uploaded.key) {
                req.body.resume = uploaded.key;
                logger.info('[Resume] ✅ Stored via', uploaded.storage, '— key:', uploaded.key);
            } else {
                req.body.resume = `/uploads/${req.file.filename}`;
                logger.info('[Resume] Stored locally — path: uploads/' + req.file.filename);
            }
        }

        // ✅ Auto-detect state from location if not provided
        if (req.body.location && !req.body.state) {
            req.body.state = LocationService.detectState(req.body.location);
        }

        // ✅ Normalize text fields (BLOCK LETTERS; email stays lowercase)
        const textFields = ['name', 'position', 'companyName', 'location', 'client', 'spoc', 'source', 'noticePeriod', 'fls', 'remark', 'product', 'skills', 'ctc', 'expectedCtc', 'experience', 'status', 'feedback'];
        textFields.forEach(f => { if (req.body[f] && typeof req.body[f] === 'string') req.body[f] = normalizeText(req.body[f]); });
        if (req.body.pan) req.body.pan = normalizePan(req.body.pan);

        // Stamp SPOC from logged-in employee (locked for non owner/admin/manager)
        await enforceSpocOnWrite(req, { isCreate: true });

        // ✅ Stamp ownership: same format as GET expects (24-char hex → ObjectId, else string)
        const mongoose = require('mongoose');
        const uid = req.user && req.user.id ? String(req.user.id).trim() : null;
        if (uid) {
            req.body.createdBy = (uid.length === 24 && /^[a-fA-F0-9]+$/.test(uid))
                ? new mongoose.Types.ObjectId(uid)
                : uid;
        }
        if (req.user && req.user.organizationId) {
            req.body.organizationId = req.user.organizationId;
        }
        if (isFreelancer(req.user)) {
            req.body.source = 'Freelance';
        }

        const newCandidate = new Candidate(req.body);
        await newCandidate.save();
        await promoteNamesSafe(req.user.organizationId, req.user.id, newCandidate.product);
        await promotePositionsSafe(req.user.organizationId, req.user.id, newCandidate.position);
        try {
            const talentPoolService = require('../../services/talentPoolService');
            await talentPoolService.enrollByTrigger(req.user.organizationId, newCandidate, { trigger: 'create' });
        } catch (err) {
            logger.warn('[talentPool] create enroll skipped:', err.message);
        }
        try {
            const { notifyManagerOf } = require('../../utils/reportingScope');
            await notifyManagerOf(req.user, {
                title: 'Team candidate added',
                message: `${req.user.name || 'A teammate'} added ${newCandidate.name}`,
                candidateId: newCandidate._id,
                candidateName: newCandidate.name,
                candidatePosition: newCandidate.position || '',
                priority: 'low',
            });
        } catch { /* never block create */ }
        res.status(201).json({ success: true, message: "Candidate Added Successfully" });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                code: 'DUPLICATE_EMAIL',
                message: 'Email already exists for another candidate in your organization. Open that profile or use a different email.',
            });
        }
        res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};

// Bulk create candidates from parsed resumes (no file upload)
exports.bulkCreateFromParsed = async (req, res) => {
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
        const { loadOrgEmployeeNames, resolveEmployeeSpocLabel, canEditCandidateSpoc } = require('../../utils/spocIdentity');
        const orgNames = await loadOrgEmployeeNames(req.user.organizationId);
        const forcedSpoc = canEditCandidateSpoc(req.user)
          ? null
          : resolveEmployeeSpocLabel(req.user, orgNames);
        const defaultManagerSpoc = resolveEmployeeSpocLabel(req.user, orgNames);

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
                const orgScope = req.user.organizationId
                    ? { organizationId: req.user.organizationId }
                    : { createdBy: userId };
                const existing = await Candidate.findOne({
                    $or: [{ email }, { contact }],
                    ...orgScope,
                });
                if (existing) {
                    skipped.push({ index: i + 1, name, reason: existing.email === email ? 'Email already exists' : 'Phone already exists' });
                    continue;
                }
                if (req.user.organizationId) {
                    const { findOrgPhoneConflict, findOrgEmailConflict } = require('../../services/dedupeService');
                    const emailHit = await findOrgEmailConflict(req.user.organizationId, email);
                    if (emailHit) {
                        skipped.push({ index: i + 1, name, reason: `Email already exists (${emailHit.name || emailHit.email})` });
                        continue;
                    }
                    const phoneHit = await findOrgPhoneConflict(req.user.organizationId, contact);
                    if (phoneHit) {
                        skipped.push({ index: i + 1, name, reason: `Phone already exists (${phoneHit.email || phoneHit.name})` });
                        continue;
                    }
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
                    product: (c.product || '').trim() || '',
                    pan: normalizePan(c.pan || ''),
                    remark: (c.remark || '').trim() || '',
                    status: 'Applied',
                    createdBy: userId,
                    organizationId: req.user.organizationId || undefined,
                    date: new Date().toISOString().split('T')[0],
                    spoc: forcedSpoc
                      || normalizeText((c.spoc || '').trim())
                      || defaultManagerSpoc,
                };

                if (payload.location && LocationService.detectState) {
                    payload.state = LocationService.detectState(payload.location);
                }

                const doc = new Candidate(payload);
                await doc.save();
                created.push({ index: i + 1, name, email });
                await promoteNamesSafe(req.user.organizationId, userId, payload.product);
                await promotePositionsSafe(req.user.organizationId, userId, payload.position);
            } catch (err) {
                if (err.code === 11000) {
                    skipped.push({ index: i + 1, name, reason: 'Duplicate (email or contact)' });
                } else {
                    errors.push({ index: i + 1, name, reason: err.message || 'Save failed' });
                }
            }
        }

        if (created.length > 0) {
            try {
                const { notifyManagerOf } = require('../../utils/reportingScope');
                await notifyManagerOf(req.user, {
                    title: 'Team candidates added',
                    message: `${req.user.name || 'A teammate'} added ${created.length} candidate${created.length === 1 ? '' : 's'}`,
                    priority: 'low',
                });
            } catch { /* never block create */ }
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

async function updateCandidate(req, res) {
    try {
        const { id } = req.params;
        // Freelancer status is company-driven (submission review). Do not accept client edits.
        if (isFreelancer(req.user) && 'status' in req.body) {
            delete req.body.status;
        }
        if (isFreelancer(req.user)) {
            req.body.source = 'Freelance';
        }
        if ('pan' in req.body || 'client' in req.body) {
            if (req.body.pan != null) req.body.pan = normalizePan(req.body.pan);
            let clientForPan = req.body.client;
            let panForCheck = req.body.pan;
            if (clientForPan === undefined || panForCheck === undefined) {
                const scopePeek = { _id: id, ...candidateWriteScope(req) };
                const existing = await Candidate.findOne(scopePeek).select('client pan').lean();
                if (clientForPan === undefined) clientForPan = existing?.client || '';
                if (panForCheck === undefined) panForCheck = existing?.pan || '';
            }
            const panScope = req.user.organizationId
              ? { organizationId: req.user.organizationId }
              : { createdBy: req.user.id };
            const panErr = await validatePanForClient(panForCheck, clientForPan, panScope);
            if (panErr) return res.status(400).json({ success: false, message: panErr });
        }

        if (typeof req.body.statusHistory === 'string') {
            try { req.body.statusHistory = JSON.parse(req.body.statusHistory); } 
            catch (e) { req.body.statusHistory = []; }
        }
        if (typeof req.body.customFields === 'string') {
            try { req.body.customFields = JSON.parse(req.body.customFields); }
            catch (e) { req.body.customFields = {}; }
        }
        if (req.body.customFields && typeof req.body.customFields !== 'object') {
            delete req.body.customFields;
        }
        if (req.file) {
            const documentStorage = require('../../services/documentStorageService');
            const path = require('path');
            const fs = require('fs');
            const filePath = (req.file.path && fs.existsSync(req.file.path))
                ? req.file.path
                : (fs.existsSync(path.join(process.cwd(), 'uploads', req.file.filename))
                    ? path.join(process.cwd(), 'uploads', req.file.filename)
                    : path.join(__dirname, '..', '..', 'uploads', req.file.filename));
            const orgId = req.user?.organizationId;
            logger.info('[Resume] Saving resume (update) — BYOK storage / platform S3 / local');
            const uploaded = await documentStorage.uploadResume({
                organizationId: orgId,
                localFilePath: filePath,
                originalName: req.file.originalname
            });
            if (uploaded && uploaded.key) {
                req.body.resume = uploaded.key;
                logger.info('[Resume] ✅ Stored via', uploaded.storage, '— key:', uploaded.key);
            } else {
                req.body.resume = `/uploads/${req.file.filename}`;
                logger.info('[Resume] Stored locally — path: uploads/' + req.file.filename);
            }
        }

        // ✅ Auto-detect state from location if location is being updated
        if (req.body.location && !req.body.state) {
            req.body.state = LocationService.detectState(req.body.location);
        }

        // ✅ Normalize text fields (BLOCK LETTERS; email stays lowercase)
        const textFields = ['name', 'position', 'companyName', 'location', 'client', 'spoc', 'source', 'noticePeriod', 'fls', 'remark', 'product', 'skills', 'ctc', 'expectedCtc', 'experience', 'status', 'feedback'];
        textFields.forEach(f => { if (req.body[f] && typeof req.body[f] === 'string') req.body[f] = normalizeText(req.body[f]); });
        if (req.body.pan) req.body.pan = normalizePan(req.body.pan);

        // Employees cannot reassign SPOC; managers/owners/admins can.
        stripSpocUnlessEditor(req);

        // ✅ Sanitize boolean fields — FormData sends empty strings which Mongoose can't cast to Boolean
        const booleanFields = ['legalHold'];
        booleanFields.forEach(f => {
            if (f in req.body) {
                const val = req.body[f];
                if (val === true || val === 'true' || val === '1') {
                    req.body[f] = true;
                } else if (val === '' || val === null || val === undefined || val === false || val === 'false' || val === '0') {
                    delete req.body[f]; // Remove empty/false values so they don't trigger cast errors
                }
            }
        });

        // Desk-scoped writes for recruiters; org-wide for owner/admin/manager.
        const { createdBy, organizationId, _id, __v, ...safeBody } = req.body;
        const scope = { _id: id, ...candidateWriteScope(req) };

        if (req.user.organizationId && (safeBody.email || safeBody.contact || safeBody.phone)) {
            const { findOrgPhoneConflict, findOrgEmailConflict } = require('../../services/dedupeService');
            if (safeBody.email) {
                const emailHit = await findOrgEmailConflict(
                    req.user.organizationId,
                    safeBody.email,
                    { excludeId: id }
                );
                if (emailHit) {
                    return res.status(400).json({
                        success: false,
                        code: 'DUPLICATE_EMAIL',
                        message: `Email already exists for ${emailHit.name || 'another candidate'}${emailHit.contact ? ` (${emailHit.contact})` : ''}. Open that profile or use a different email.`,
                        existingId: emailHit._id,
                    });
                }
            }
            if (safeBody.contact || safeBody.phone) {
                const phoneHit = await findOrgPhoneConflict(
                    req.user.organizationId,
                    safeBody.contact || safeBody.phone,
                    { excludeId: id }
                );
                if (phoneHit) {
                    return res.status(400).json({
                        success: false,
                        code: 'DUPLICATE_PHONE',
                        message: `Phone already exists for ${phoneHit.name || 'another candidate'} (${phoneHit.email || 'no email'}). Open that profile or use a different number.`,
                        existingId: phoneHit._id,
                    });
                }
            }
        }

        const before = await Candidate.findOne(scope).select('status').lean();
        const updatedCandidate = await Candidate.findOneAndUpdate(
            scope,
            { $set: safeBody },
            { new: true, runValidators: true }
        );
        if (!updatedCandidate) return res.status(404).json({ success: false, message: "Candidate not found" });
        await promoteNamesSafe(req.user.organizationId, req.user.id, updatedCandidate.product);
        await promotePositionsSafe(req.user.organizationId, req.user.id, updatedCandidate.position);
        try {
            const { canonCandidateStatus } = require('../../utils/statusCanon');
            const prev = canonCandidateStatus(before?.status);
            const next = canonCandidateStatus(updatedCandidate.status);
            if (prev !== next && (next === 'Rejected' || next === 'Dropped')) {
                const talentPoolService = require('../../services/talentPoolService');
                await talentPoolService.enrollByTrigger(
                    req.user.organizationId,
                    updatedCandidate,
                    { trigger: next === 'Dropped' ? 'dropped' : 'reject' }
                );
            }
        } catch (err) {
            logger.warn('[talentPool] status enroll skipped:', err.message);
        }
        res.status(200).json({ success: true, message: "Updated Successfully", data: updatedCandidate });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                code: 'DUPLICATE_EMAIL',
                message: 'Email already exists for another candidate in your organization. Open that profile or use a different email.',
            });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};


async function getCandidateById(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
        const candidate = await Candidate.findOne({ _id: req.params.id, ...candidateWriteScope(req) });
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }
        res.status(200).json(candidate);
    } catch (err) {
        logger.error('Error fetching candidate:', err);
        res.status(500).json({ message: 'Server error' });
    }
}

async function deleteCandidate(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { id } = req.params;

        // Freelancers: soft-hide from their desk only — keep the org/company record.
        if (isFreelancer(req.user)) {
            const scope = candidateWriteScope(req);
            const userId = req.user.id || req.user._id;
            const hidden = await Candidate.findOneAndUpdate(
                { _id: id, ...scope },
                {
                    $addToSet: { hiddenFromFreelancerIds: userId },
                    $set: { freelancerHiddenAt: new Date() },
                },
                { new: true }
            ).select('_id name').lean();

            if (!hidden) {
                return res.status(404).json({ success: false, message: 'Candidate not found' });
            }

            try {
                const { dismissHandoffsForFreelancer } = require('../../services/freelancerService');
                await dismissHandoffsForFreelancer(req.user, [id]);
            } catch (dismissErr) {
                logger.warn({ err: dismissErr }, 'Freelancer handoff dismiss skipped');
            }

            return res.status(200).json({
                success: true,
                soft: true,
                message: 'Candidate removed.',
            });
        }

        const deletedCandidate = await Candidate.findOneAndDelete({ _id: id, ...candidateWriteScope(req) });

        if (!deletedCandidate) {
            return res.status(404).json({ success: false, message: "Candidate not found" });
        }

        res.status(200).json({ success: true, message: "Candidate deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting candidate", error: err.message });
    }
}

module.exports = { createCandidate, updateCandidate, getCandidateById, deleteCandidate };
