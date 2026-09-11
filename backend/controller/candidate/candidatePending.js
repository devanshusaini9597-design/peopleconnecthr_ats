const mongoose = require('mongoose');
const Candidate = require('../../models/Candidate');
const PendingCandidate = require('../../models/PendingCandidate');
const logger = require('../../utils/logger');
const { promoteNamesSafe } = require('../../services/skillCatalogSync');
const { promoteNamesSafe: promotePositionsSafe } = require('../../services/positionCatalogSync');

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function savePending(req, res) {
    try {
        const { records, fileName, batchId: clientBatchId } = req.body;
        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ success: false, message: 'No records provided' });
        }

        // Reuse batchId across chunked saves from the same upload session
        const batchId = (typeof clientBatchId === 'string' && clientBatchId.trim())
            ? clientBatchId.trim()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const userId = req.user.id;
        const createdByObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

        const getVal = (r, key) => r.fixed?.[key] ?? r[key];
        const docs = records.map(r => ({
            batchId,
            fileName: fileName || '',
            category: r.category || 'review',
            rowIndex: r.rowIndex ?? 0,
            name: getVal(r, 'name') || '',
            email: getVal(r, 'email') || '',
            contact: getVal(r, 'contact') || '',
            position: getVal(r, 'position') || '',
            companyName: getVal(r, 'companyName') || '',
            location: getVal(r, 'location') || '',
            ctc: getVal(r, 'ctc') || '',
            expectedCtc: getVal(r, 'expectedCtc') || '',
            experience: getVal(r, 'experience') || '',
            noticePeriod: getVal(r, 'noticePeriod') || '',
            status: getVal(r, 'status') || 'Applied',
            source: getVal(r, 'source') || '',
            client: getVal(r, 'client') || '',
            spoc: getVal(r, 'spoc') || '',
            remark: getVal(r, 'remark') || '',
            fls: getVal(r, 'fls') || '',
            date: getVal(r, 'date') || new Date().toISOString().split('T')[0],
            skills: getVal(r, 'skills') || '',
            product: getVal(r, 'product') || '',
            pan: getVal(r, 'pan') || '',
            originalData: r.original || {},
            confidence: r.validation?.confidence || '',
            validationErrors: r.validation?.errors || [],
            validationWarnings: r.validation?.warnings || [],
            autoFixChanges: r.autoFixChanges || [],
            swaps: r.swaps || [],
            createdBy: createdByObj
        }));

        const INSERT_CHUNK = 500;
        for (let i = 0; i < docs.length; i += INSERT_CHUNK) {
            await PendingCandidate.insertMany(docs.slice(i, i + INSERT_CHUNK), { ordered: false });
        }

        res.json({ success: true, message: `Saved ${docs.length} records to pending`, batchId, count: docs.length });
    } catch (err) {
        logger.error('[PENDING-SAVE] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

async function getPending(req, res) {
    try {
        const { category, page = 1, limit = 50, search, batchId } = req.query;
        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        // Match both ObjectId and string so records show whether stored as either type
        const createdByFilter = { $in: [userIdObj, userId] };

        const filter = { createdBy: createdByFilter };
        if (category && category !== 'all') filter.category = category;
        if (batchId) filter.batchId = batchId;
        if (search && search.trim()) {
            const q = new RegExp(escapeRegex(search.trim()), 'i');
            filter.$or = [
                { name: q }, { email: q }, { contact: q },
                { companyName: q }, { location: q }, { position: q }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
        const [candidates, total] = await Promise.all([
            PendingCandidate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            PendingCandidate.countDocuments(filter)
        ]);

        const countFilter = { createdBy: createdByFilter };
        const [reviewCount, blockedCount] = await Promise.all([
            PendingCandidate.countDocuments({ ...countFilter, category: 'review' }),
            PendingCandidate.countDocuments({ ...countFilter, category: 'blocked' })
        ]);

        res.json({
            success: true,
            candidates,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            stats: { review: reviewCount, blocked: blockedCount, total: reviewCount + blockedCount }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

async function updatePending(req, res) {
    try {
        const updated = await PendingCandidate.findOneAndUpdate(
            { _id: req.params.id, createdBy: req.user.id },
            { $set: req.body },
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: 'Record not found' });
        res.json({ success: true, candidate: updated });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

async function deletePending(req, res) {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'No IDs provided' });

        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        const result = await PendingCandidate.deleteMany({ _id: { $in: ids }, createdBy: { $in: [userIdObj, userId] } });
        res.json({ success: true, deletedCount: result.deletedCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

async function clearAllPending(req, res) {
    try {
        const userId = req.user.id;
        const userIdObj = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
        const result = await PendingCandidate.deleteMany({ createdBy: { $in: [userIdObj, userId] } });
        res.json({ success: true, deletedCount: result.deletedCount, message: `Cleared ${result.deletedCount} pending records.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
}

async function importPending(req, res) {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No IDs provided' });
        }

        const userId = req.user.id;
        const pendingRecords = await PendingCandidate.find({ _id: { $in: ids }, createdBy: userId }).lean();

        if (pendingRecords.length === 0) {
            return res.status(404).json({ success: false, message: 'No matching records found' });
        }

        let imported = 0;
        let failed = 0;
        const errors = [];

        const { loadOrgEmployeeNames, resolveEmployeeSpocLabel, canEditCandidateSpoc } = require('../../utils/spocIdentity');
        const orgNames = await loadOrgEmployeeNames(req.user.organizationId);
        const mySpoc = resolveEmployeeSpocLabel(req.user, orgNames);
        const lockSpoc = !canEditCandidateSpoc(req.user);

        const { normalizeText, applyBlockLettersToObject } = require('../../utils/textNormalize');
        const bulkOps = pendingRecords.map(p => {
            const email = String(p.email || '').trim().toLowerCase();
            const setFields = {
                name: p.name, contact: p.contact, position: p.position,
                companyName: p.companyName, location: p.location, ctc: p.ctc,
                expectedCtc: p.expectedCtc, experience: p.experience,
                noticePeriod: p.noticePeriod, status: p.status || 'Applied',
                source: p.source, client: p.client,
                spoc: lockSpoc ? mySpoc : (p.spoc || mySpoc),
                remark: p.remark, fls: p.fls, date: p.date,
                skills: p.skills || '', product: p.product || '', pan: p.pan || '',
                createdBy: userId,
            };
            applyBlockLettersToObject(setFields);
            if (req.user.organizationId) {
                setFields.organizationId = req.user.organizationId;
            }
            const createdByField = userId;
            const filter = req.user.organizationId
                ? { organizationId: req.user.organizationId, email }
                : { email, createdBy: userId };
            const { createdBy: _ignoreCreatedBy, ...safeSet } = setFields;
            return {
                updateOne: {
                    filter,
                    update: {
                        $set: safeSet,
                        $setOnInsert: { email, createdBy: createdByField }
                    },
                    upsert: true
                }
            };
        });

        const WRITE_CHUNK = 500;
        for (let i = 0; i < bulkOps.length; i += WRITE_CHUNK) {
            const slice = bulkOps.slice(i, i + WRITE_CHUNK);
            try {
                const bulkResult = await Candidate.bulkWrite(slice, { ordered: false });
                imported += (bulkResult.upsertedCount || 0) + (bulkResult.modifiedCount || 0);
            } catch (bulkErr) {
                if (bulkErr.result) {
                    imported += (bulkErr.result.nUpserted || 0) + (bulkErr.result.nModified || 0);
                    failed += bulkErr.writeErrors?.length || 0;
                    errors.push(...(bulkErr.writeErrors || []).map(e => e.errmsg));
                } else {
                    throw bulkErr;
                }
            }
        }

        await promoteNamesSafe(
            req.user.organizationId,
            req.user.id,
            pendingRecords.map((p) => p.product)
        );
        await promotePositionsSafe(
            req.user.organizationId,
            req.user.id,
            pendingRecords.map((p) => p.position)
        );

        // Remove successfully imported records from pending
        if (imported > 0) {
            await PendingCandidate.deleteMany({ _id: { $in: ids }, createdBy: userId });
        }

        res.json({
            success: true,
            message: `Imported ${imported} of ${pendingRecords.length} records`,
            imported, failed, errors: errors.slice(0, 5)
        });
    } catch (err) {
        logger.error('[PENDING-IMPORT] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = {
    savePending,
    getPending,
    updatePending,
    deletePending,
    clearAllPending,
    importPending,
};
