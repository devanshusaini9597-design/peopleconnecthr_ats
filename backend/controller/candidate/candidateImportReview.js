const mongoose = require('mongoose');
const Candidate = require('../../models/Candidate');
const logger = require('../../utils/logger');
const {
    loadOrgEmployeeNames,
    resolveEmployeeSpocLabel,
    canEditCandidateSpoc,
} = require('../../utils/spocIdentity');
const { promoteNamesSafe } = require('../../services/skillCatalogSync');
const { promoteNamesSafe: promotePositionsSafe } = require('../../services/positionCatalogSync');
const {
    loadOrgStages,
    resolveStage,
    stageKey,
} = require('../../services/pipelineStageSync');
const { parseRecordDate, resolveAppliedAt } = require('../../utils/candidateActivityDate');
const { canViewOrgAnalytics } = require('../../utils/dataScope');

const ALLOWED_FIELDS = [
    'name', 'email', 'contact', 'position', 'companyName', 'location', 'state',
    'ctc', 'expectedCtc', 'experience', 'noticePeriod', 'status', 'source',
    'client', 'spoc', 'remark', 'fls', 'date', 'skills', 'product', 'pan',
];

function toObjectId(id) {
    if (!id) return null;
    if (id instanceof mongoose.Types.ObjectId) return id;
    const s = String(id).trim();
    if (s.length === 24 && /^[a-fA-F0-9]+$/.test(s)) {
        try { return new mongoose.Types.ObjectId(s); } catch { return null; }
    }
    return null;
}

function cleanString(value, max = 500) {
    if (value == null) return '';
    return String(value).trim().replace(/\s+/g, ' ').slice(0, max);
}

/** Block letters for every field except email. */
function cleanBlock(value, max = 500) {
    return normalizeText(cleanString(value, max));
}

async function revalidateRecord(req, res) {
    try {
        const { record } = req.body;
        if (!record) {
            return res.status(400).json({ success: false, message: 'No record provided' });
        }

        const { validateCandidate, autoFix } = require('../../utils/globalValidation');
        const normalizedRecord = { ...record };
        if (normalizedRecord.contact && !normalizedRecord.phone) {
            normalizedRecord.phone = normalizedRecord.contact;
        }

        const { fixed, changes } = autoFix(normalizedRecord);
        const validation = validateCandidate(fixed, 0);
        if (fixed.phone) {
            fixed.contact = fixed.phone;
            delete fixed.phone;
        }

        res.json({
            success: true,
            fixed,
            autoFixChanges: changes,
            validation: {
                category: validation.category,
                confidence: validation.confidence,
                errors: validation.errors,
                warnings: validation.warnings,
            },
        });
    } catch (error) {
        logger.error({ err: error }, '[REVALIDATE] ERROR');
        res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Reliable bulk import:
 * - whitelist fields
 * - dedupe by email
 * - update existing org/orphan docs by _id (avoids duplicate-key fights)
 * - insert only when truly missing
 * - cleanup leftover orphans
 * - do not block on catalog promote
 */
async function importReviewedCandidates(req, res) {
    try {
        const { readyRecords, reviewRecords } = req.body;
        const recordsToImport = [
            ...(Array.isArray(readyRecords) ? readyRecords : []),
            ...(Array.isArray(reviewRecords) ? reviewRecords : []),
        ];

        if (recordsToImport.length === 0) {
            return res.json({
                success: true,
                imported: 0,
                upserted: 0,
                modified: 0,
                message: 'No ready records to import',
            });
        }

        const userIdStr = String(req.user.id || req.user._id || '').trim();
        const userIdObj = toObjectId(userIdStr);
        if (!userIdObj) {
            return res.status(401).json({ success: false, message: 'Invalid user session for import' });
        }

        const orgIdObj = toObjectId(req.user.organizationId);
        if (!orgIdObj) {
            return res.status(400).json({
                success: false,
                message: 'Your account has no organization — cannot import candidates.',
            });
        }

        const orgNames = await loadOrgEmployeeNames(orgIdObj);
        const mySpoc = resolveEmployeeSpocLabel(req.user, orgNames);
        const lockSpoc = !canEditCandidateSpoc(req.user);
        const orgStages = await loadOrgStages(orgIdObj);

        const byEmail = new Map();
        let skippedNoEmail = 0;
        let statusFallbackRejected = 0;

        for (let idx = 0; idx < recordsToImport.length; idx += 1) {
            const raw = recordsToImport[idx] || {};
            const src = raw.fixed && typeof raw.fixed === 'object' ? raw.fixed : raw;

            const email = cleanString(src.email || '', 200).toLowerCase();
            if (!email || !email.includes('@')) {
                skippedNoEmail += 1;
                continue;
            }

            let contact = cleanBlock(src.contact || src.phone || '', 40);
            let companyName = cleanBlock(src.companyName || src.company || '', 200);
            let name = cleanBlock(src.name || '', 200);
            if (!name) name = cleanBlock(email.split('@')[0] || 'Candidate', 200);

            // Only keep statuses that match the org ATS pipeline (exact/fuzzy).
            // Unknown Excel stages → Rejected (never invent new pipeline stages).
            const rawStatus = cleanString(src.status || '', 60);
            const statusResolved = resolveStage(
                rawStatus || 'Applied',
                orgStages,
                { unknownFallback: 'Rejected' }
            );
            if (statusResolved.fallback) statusFallbackRejected += 1;
            const statusStored = stageKey(statusResolved.label) || 'REJECTED';

            const doc = {
                name,
                email,
                contact,
                position: cleanBlock(src.position || '', 200),
                companyName,
                location: cleanBlock(src.location || '', 200),
                ctc: cleanBlock(src.ctc || '', 80),
                expectedCtc: cleanBlock(src.expectedCtc || '', 80),
                experience: cleanBlock(src.experience != null ? String(src.experience) : '', 40),
                noticePeriod: cleanBlock(src.noticePeriod || '', 40),
                status: statusStored,
                source: cleanBlock(src.source || '', 120),
                client: cleanBlock(src.client || '', 120),
                remark: cleanBlock(src.remark || '', 1000),
                fls: cleanBlock(src.fls || '', 120),
                date: cleanString(src.date || '', 40),
                skills: cleanBlock(src.skills || '', 1000),
                product: cleanBlock(src.product || '', 200),
                pan: cleanString(src.pan || '', 20).replace(/\s+/g, '').toUpperCase(),
                spoc: lockSpoc
                    ? cleanBlock(mySpoc, 120)
                    : (cleanBlock(src.spoc || '', 120) || cleanBlock(mySpoc, 120)),
                createdBy: userIdObj,
                organizationId: orgIdObj,
            };
            const appliedAt = resolveAppliedAt(doc);
            if (appliedAt) doc.appliedAt = appliedAt;

            // last row wins for duplicate emails in the same upload
            byEmail.set(email, doc);
        }

        const uniqueDocs = [...byEmail.values()];
        if (uniqueDocs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid records to import (all missing email)',
                skippedNoEmail,
            });
        }

        logger.info(
            { count: uniqueDocs.length, skippedNoEmail, dupesDropped: recordsToImport.length - skippedNoEmail - uniqueDocs.length },
            '[IMPORT] Prepared unique records'
        );

        const emails = uniqueDocs.map((d) => d.email);
        const createdByFilter = { $in: [userIdObj, userIdStr] };
        const orgIdFilter = { $in: [orgIdObj, String(orgIdObj)] };
        const { normalizePhone, findOrgPhoneConflict } = require('../../services/dedupeService');

        // Existing org-scoped + orphan copies owned by this user
        const [existingOrg, existingOrphans] = await Promise.all([
            Candidate.find({ organizationId: orgIdFilter, email: { $in: emails } })
                .select('_id email createdBy contact phone')
                .lean(),
            Candidate.find({
                email: { $in: emails },
                createdBy: createdByFilter,
                $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
            })
                .select('_id email createdBy contact phone')
                .lean(),
        ]);

        const orgRowByEmail = new Map(existingOrg.map((r) => [String(r.email).toLowerCase(), r]));
        const orphanRowByEmail = new Map(existingOrphans.map((r) => [String(r.email).toLowerCase(), r]));
        const manager = canViewOrgAnalytics(req.user);

        const ops = [];
        let toInsert = 0;
        let toUpdate = 0;
        let skippedDesk = 0;
        let skippedPhone = 0;

        for (const doc of uniqueDocs) {
            const existing = orgRowByEmail.get(doc.email) || orphanRowByEmail.get(doc.email);
            const existingId = existing?._id;
            const setDoc = {};
            for (const key of ALLOWED_FIELDS) {
                if (doc[key] !== undefined) setDoc[key] = doc[key];
            }
            setDoc.organizationId = orgIdObj;

            if (existingId) {
                const owner = existing.createdBy != null ? String(existing.createdBy) : '';
                if (owner && owner !== String(userIdStr) && !manager) {
                    skippedDesk += 1;
                    continue;
                }
                toUpdate += 1;
                if (doc.appliedAt) setDoc.appliedAt = doc.appliedAt;
                const fromOrphan = String(orphanRowByEmail.get(doc.email)?._id || '') === String(existingId);
                ops.push({
                    updateOne: {
                        filter: fromOrphan
                            ? { _id: existingId, createdBy: createdByFilter }
                            : { _id: existingId, organizationId: orgIdFilter },
                        update: { $set: setDoc },
                    },
                });
            } else {
                // New email — do not create a second person with an existing org phone
                const phoneNorm = normalizePhone(doc.contact);
                if (phoneNorm) {
                    const phoneHit = await findOrgPhoneConflict(orgIdObj, doc.contact);
                    if (phoneHit) {
                        skippedPhone += 1;
                        continue;
                    }
                }
                toInsert += 1;
                // Never put the same field in both $set and $setOnInsert (Mongo rejects the whole op)
                const { email: emailVal, ...restSet } = setDoc;
                const insertAppliedAt = doc.appliedAt || new Date();
                ops.push({
                    updateOne: {
                        filter: { organizationId: orgIdObj, email: emailVal },
                        update: {
                            $set: restSet,
                            $setOnInsert: {
                                email: emailVal,
                                createdBy: userIdObj,
                                createdAt: insertAppliedAt,
                                appliedAt: insertAppliedAt,
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }

        const WRITE_CHUNK = 250;
        let upsertedCount = 0;
        let modifiedCount = 0;
        let matchedCount = 0;
        let writeErrors = 0;
        const errorSamples = [];

        for (let i = 0; i < ops.length; i += WRITE_CHUNK) {
            const slice = ops.slice(i, i + WRITE_CHUNK);
            try {
                const result = await Candidate.bulkWrite(slice, { ordered: false });
                upsertedCount += result.upsertedCount || result.insertedCount || 0;
                modifiedCount += result.modifiedCount || 0;
                matchedCount += result.matchedCount || 0;
            } catch (bulkErr) {
                const r = bulkErr.result || bulkErr;
                upsertedCount += r.nUpserted || r.upsertedCount || r.nInserted || r.insertedCount || 0;
                modifiedCount += r.nModified || r.modifiedCount || 0;
                matchedCount += r.nMatched || r.matchedCount || 0;
                const errs = bulkErr.writeErrors || [];
                writeErrors += errs.length;
                for (const e of errs.slice(0, 5)) {
                    if (errorSamples.length < 8) {
                        errorSamples.push(e.errmsg || e.err?.errmsg || e.message || String(e.code || e));
                    }
                }
                logger.warn({
                    writeErrors: errs.length,
                    sample: errorSamples[0] || bulkErr.message,
                }, '[IMPORT] bulkWrite partial failure');
            }
        }

        // Remove leftover orphan copies for emails we just wrote into the org
        let cleanedOrphans = 0;
        try {
            const del = await Candidate.deleteMany({
                email: { $in: emails },
                createdBy: createdByFilter,
                $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
            });
            cleanedOrphans = del.deletedCount || 0;
        } catch (cleanErr) {
            logger.warn({ err: cleanErr }, '[IMPORT] orphan cleanup skipped');
        }

        // Catalog promote must not block / timeout the import response
        const products = [...new Set(uniqueDocs.map((d) => d.product).filter(Boolean))].slice(0, 50);
        const positions = [...new Set(uniqueDocs.map((d) => d.position).filter(Boolean))].slice(0, 50);
        setImmediate(() => {
            Promise.all([
                promoteNamesSafe(orgIdObj, userIdStr, products),
                promotePositionsSafe(orgIdObj, userIdStr, positions),
            ]).catch((err) => logger.warn({ err }, '[IMPORT] catalog promote failed'));
        });

        const importedCount = upsertedCount + modifiedCount;
        const ok = importedCount > 0;

        logger.info({
            upserted: upsertedCount,
            modified: modifiedCount,
            matched: matchedCount,
            writeErrors,
            cleanedOrphans,
            toInsert,
            toUpdate,
            unique: uniqueDocs.length,
            errorSample: errorSamples[0] || null,
        }, '[IMPORT] Done');

        if (!ok) {
            if (skippedDesk > 0 && writeErrors === 0) {
                return res.status(200).json({
                    success: true,
                    imported: 0,
                    skippedDesk,
                    skippedNoEmail,
                    message: `${skippedDesk} existing candidate(s) were skipped because they belong to another desk.`,
                });
            }
            return res.status(500).json({
                success: false,
                imported: 0,
                upserted: 0,
                modified: 0,
                writeErrors,
                errorSamples,
                message: errorSamples[0]
                    ? `Import failed: ${errorSamples[0]}`
                    : 'Import failed — no rows were written. Check emails and try again.',
            });
        }

        res.status(writeErrors ? 207 : 200).json({
            success: true,
            imported: importedCount,
            upserted: upsertedCount,
            modified: modifiedCount,
            matched: matchedCount,
            writeErrors,
            cleanedOrphans,
            uniqueEmails: uniqueDocs.length,
            skippedNoEmail,
            skippedDesk,
            skippedPhone,
            statusFallbackRejected,
            errorSamples,
            message: writeErrors
                ? `Imported ${importedCount} candidates (${writeErrors} row errors)`
                : `Successfully imported ${importedCount} candidates`,
        });
    } catch (error) {
        logger.error({ err: error }, '[IMPORT] CRITICAL ERROR');
        res.status(500).json({ success: false, message: error.message || 'Import failed' });
    }
}

module.exports = { revalidateRecord, importReviewedCandidates };
