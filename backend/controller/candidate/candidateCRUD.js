const Candidate = require('../../models/Candidate');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const LocationService = require('../../services/locationService');
const { normalizeText } = require('../../utils/textNormalize');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');
const { orgOrOwnerScope } = require('./candidateValidation');

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

        // ✅ Normalize text fields (Title Case + single spaces)
        const textFields = ['name', 'position', 'companyName', 'location', 'client', 'spoc', 'source', 'noticePeriod', 'fls', 'remark'];
        textFields.forEach(f => { if (req.body[f] && typeof req.body[f] === 'string') req.body[f] = normalizeText(req.body[f]); });

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

        const newCandidate = new Candidate(req.body);
        await newCandidate.save();
        res.status(201).json({ success: true, message: "Candidate Added Successfully" });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: "Email already exists!" });
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

async function updateCandidate(req, res) {
    try {
        const { id } = req.params;
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

        // ✅ Normalize text fields (Title Case + single spaces)
        const textFields = ['name', 'position', 'companyName', 'location', 'client', 'spoc', 'source', 'noticePeriod', 'fls', 'remark'];
        textFields.forEach(f => { if (req.body[f] && typeof req.body[f] === 'string') req.body[f] = normalizeText(req.body[f]); });

        // Any authenticated user in the SAME organization can update the candidate.
        // Do not allow changing ownership or the org a candidate belongs to.
        const { createdBy, organizationId, _id, __v, ...safeBody } = req.body;
        const scope = { _id: id, ...(req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id }) };
        const updatedCandidate = await Candidate.findOneAndUpdate(
            scope,
            { $set: safeBody },
            { new: true, runValidators: true }
        );
        if (!updatedCandidate) return res.status(404).json({ success: false, message: "Candidate not found" });
        res.status(200).json({ success: true, message: "Updated Successfully", data: updatedCandidate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


async function getCandidateById(req, res) {
    try {
        if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
        const candidate = await Candidate.findOne({ _id: req.params.id, ...orgOrOwnerScope(req) });
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
        const deletedCandidate = await Candidate.findOneAndDelete({ _id: id, ...orgOrOwnerScope(req) });

        if (!deletedCandidate) {
            return res.status(404).json({ success: false, message: "Candidate not found" });
        }

        res.status(200).json({ success: true, message: "Candidate deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting candidate", error: err.message });
    }
}

module.exports = { createCandidate, updateCandidate, getCandidateById, deleteCandidate };
