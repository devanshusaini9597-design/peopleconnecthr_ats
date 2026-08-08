const Candidate = require('../../models/Candidate');
const logger = require('../../utils/logger');

// Re-validate a single record after user edits (for review & fix workflow)
async function revalidateRecord(req, res) {
    try {
        const { record } = req.body;
        
        if (!record) {
            return res.status(400).json({ success: false, message: "No record provided" });
        }

        const {
            validateCandidate,
            autoFix
        } = require('../../utils/globalValidation');

        // Normalize field names: contact → phone (for validation system)
        const normalizedRecord = { ...record };
        if (normalizedRecord.contact && !normalizedRecord.phone) {
            normalizedRecord.phone = normalizedRecord.contact;
        }

        // Auto-fix the edited record
        const { fixed, changes } = autoFix(normalizedRecord);
        
        // Re-validate
        const validation = validateCandidate(fixed, 0);

        // Map back to contact for response
        if (fixed.phone) {
            fixed.contact = fixed.phone;
            delete fixed.phone;
        }

        logger.info(`🔄 [REVALIDATE] Category: ${validation.category}, Confidence: ${validation.confidence}`);

        res.json({
            success: true,
            fixed,
            autoFixChanges: changes,
            validation: {
                category: validation.category,
                confidence: validation.confidence,
                errors: validation.errors,
                warnings: validation.warnings
            }
        });
    } catch (error) {
        logger.error("❌ [REVALIDATE] ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Import reviewed & fixed candidates to database
async function importReviewedCandidates(req, res) {
    try {
        const { readyRecords, reviewRecords } = req.body;
        
        const recordsToImport = [
            ...(Array.isArray(readyRecords) ? readyRecords : []),
            ...(Array.isArray(reviewRecords) ? reviewRecords : [])
        ];

        if (!Array.isArray(recordsToImport) || recordsToImport.length === 0) {
            logger.info("⚠️  [IMPORT] No ready records provided");
            return res.json({
                success: true,
                imported: 0,
                message: "No ready records to import"
            });
        }

        logger.info(`💾 [IMPORT] Importing ${readyRecords?.length || 0} ready + ${reviewRecords?.length || 0} review records`);
        logger.info(`📝 [IMPORT] First record structure:`, JSON.stringify(recordsToImport[0], null, 2));

        // Field mapping from validation output to database schema
        const mapFieldsToDatabase = (record, idx) => {
            const mapped = { ...record };
            
            // Validate that fixed object exists and has required fields
            if (mapped.fixed) {
                // Use the fixed object from validation
                const fixed = mapped.fixed;
                const processed = { ...fixed };
                
                // Handle phone → contact mapping
                if (processed.phone && !processed.contact) {
                    processed.contact = processed.phone;
                }
                delete processed.phone;
                
                // Map 'company' to 'companyName' if needed
                if (processed.company && !processed.companyName) {
                    processed.companyName = processed.company;
                }
                delete processed.company;
                
                // Ensure email exists (required for upsert)
                if (!processed.email) {
                    logger.warn(`⚠️  [IMPORT] Record ${idx} has no email, skipping`);
                    return null;
                }
                
                // Clean up validation metadata
                delete processed.validation;
                delete processed.rowIndex;
                delete processed.autoFixChanges;
                delete processed.original;
                delete processed.duplicates;

                // Keep customFields bag if present
                if (processed.customFields && typeof processed.customFields === 'object') {
                    const cleanedCf = {};
                    Object.entries(processed.customFields).forEach(([k, v]) => {
                        if (v != null && String(v).trim() !== '') cleanedCf[k] = v;
                    });
                    processed.customFields = cleanedCf;
                }
                
                return processed;
            } else {
                // Record is already in mapped format
                // Handle phone and company fields
                if (mapped.phone && !mapped.contact) {
                    mapped.contact = mapped.phone;
                }
                delete mapped.phone;
                
                if (mapped.company && !mapped.companyName) {
                    mapped.companyName = mapped.company;
                }
                delete mapped.company;
                
                // Ensure email exists
                if (!mapped.email) {
                    logger.warn(`⚠️  [IMPORT] Record ${idx} has no email, skipping`);
                    return null;
                }
                
                delete mapped.validation;
                delete mapped.rowIndex;
                delete mapped.autoFixChanges;
                delete mapped.original;
                delete mapped.duplicates;
                
                return mapped;
            }
        };

        // Map and filter records (remove nulls)
        const processedRecords = recordsToImport
            .map((doc, idx) => mapFieldsToDatabase(doc, idx))
            .filter(doc => doc !== null);

        if (processedRecords.length === 0) {
            logger.error("❌ [IMPORT] All records filtered out (missing required fields)");
            return res.status(400).json({ 
                success: false, 
                message: "No valid records to import (all missing required fields)" 
            });
        }

        logger.info(`✅ [IMPORT] Processed ${processedRecords.length} valid records (${recordsToImport.length - processedRecords.length} filtered)`);

        // ✅ Stamp ownership on every imported record
        const userId = req.user.id;
        processedRecords.forEach(doc => { doc.createdBy = userId; });

        // Build bulk operations for MongoDB - scoped by user + email
        // Merge customFields on update so unrelated keys are preserved when possible
        const bulkOps = processedRecords.map(doc => {
            const { customFields, ...rest } = doc;
            const update = { $set: { ...rest, createdBy: userId } };
            if (customFields && typeof customFields === 'object' && Object.keys(customFields).length > 0) {
                Object.entries(customFields).forEach(([k, v]) => {
                    update.$set[`customFields.${k}`] = v;
                });
            }
            return {
                updateOne: {
                    filter: { email: doc.email, createdBy: userId },
                    update,
                    upsert: true
                }
            };
        });

        logger.info(`📤 [IMPORT] Executing bulkWrite with ${bulkOps.length} operations...`);
        logger.info(`📄 [IMPORT] Sample bulk op:`, JSON.stringify(bulkOps[0], null, 2));

        const dbResult = await Candidate.bulkWrite(bulkOps, { ordered: false });
        const importedCount = (dbResult.upsertedCount || 0) + (dbResult.modifiedCount || 0);

        logger.info(`✅ [IMPORT] Database result:`, {
            upserted: dbResult.upsertedCount,
            modified: dbResult.modifiedCount,
            total: importedCount
        });

        res.json({
            success: true,
            imported: importedCount,
            upserted: dbResult.upsertedCount || 0,
            modified: dbResult.modifiedCount || 0,
            message: `✅ Successfully imported ${importedCount} candidates`
        });
    } catch (error) {
        logger.error("❌ [IMPORT] CRITICAL ERROR:", error.message);
        logger.error("❌ [IMPORT] Stack:", error.stack);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { revalidateRecord, importReviewedCandidates };
