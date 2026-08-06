const Candidate = require('../../models/Candidate');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const LocationService = require('../../services/locationService');
const { normalizeText } = require('../../utils/textNormalize');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

function autoDetectHeaderMapping(headerRow) {
    const headerMap = {};
    const candidates = {}; // Store multiple candidates for each field
    
    headerRow.eachCell((cell, colNumber) => {
        const header = String(cell.value || '').toLowerCase().trim();
        const norm = header.replace(/[^a-z0-9]/g, '');
        const has = (s) => header.includes(s) || norm.includes(s.replace(/[^a-z0-9]/g, ''));
        
        // Priority-based matching with exact matches getting priority
        
        // Name - EXACT matches first, avoid company
        if (norm === 'name' || norm === 'candidatename' || norm === 'fullname') {
            if (!candidates['name'] || candidates['name'].priority < 10) {
                candidates['name'] = { col: colNumber, priority: 10 };
            }
        } else if ((has('name') || has('candidate') || has('applicant')) && !has('company')) {
            if (!candidates['name'] || candidates['name'].priority < 5) {
                candidates['name'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Email - Must have email/mail keyword
        if (norm === 'email' || norm === 'emailid') {
            if (!candidates['email'] || candidates['email'].priority < 10) {
                candidates['email'] = { col: colNumber, priority: 10 };
            }
        } else if (has('email') || has('mail')) {
            if (!candidates['email'] || candidates['email'].priority < 5) {
                candidates['email'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Contact - Must have contact/phone/mobile keyword
        if (norm === 'contact' || norm === 'contactno' || norm === 'mobileno' || norm === 'phoneno') {
            if (!candidates['contact'] || candidates['contact'].priority < 10) {
                candidates['contact'] = { col: colNumber, priority: 10 };
            }
        } else if (has('contact') || has('phone') || has('mobile')) {
            if (!candidates['contact'] || candidates['contact'].priority < 5) {
                candidates['contact'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Position
        if (norm === 'position' || norm === 'designation' || norm === 'role') {
            if (!candidates['position'] || candidates['position'].priority < 10) {
                candidates['position'] = { col: colNumber, priority: 10 };
            }
        } else if (has('position') || has('role') || has('designation') || has('jobrole') || has('profile')) {
            if (!candidates['position'] || candidates['position'].priority < 5) {
                candidates['position'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Company Name
        if (norm === 'company' || norm === 'companyname') {
            if (!candidates['companyName'] || candidates['companyName'].priority < 10) {
                candidates['companyName'] = { col: colNumber, priority: 10 };
            }
        } else if (has('company') || has('organisation') || has('organization') || has('employer')) {
            if (!candidates['companyName'] || candidates['companyName'].priority < 5) {
                candidates['companyName'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Experience
        if (norm === 'experience' || norm === 'exp') {
            if (!candidates['experience'] || candidates['experience'].priority < 10) {
                candidates['experience'] = { col: colNumber, priority: 10 };
            }
        } else if (has('experience') || has('exp') || has('workexp')) {
            if (!candidates['experience'] || candidates['experience'].priority < 5) {
                candidates['experience'] = { col: colNumber, priority: 5 };
            }
        }
        
        // CTC
        if (norm === 'ctc' || norm === 'currentctc') {
            if (!candidates['ctc'] || candidates['ctc'].priority < 10) {
                candidates['ctc'] = { col: colNumber, priority: 10 };
            }
        } else if (has('ctc') || has('salary')) {
            if (!candidates['ctc'] || candidates['ctc'].priority < 5) {
                candidates['ctc'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Expected CTC
        if (norm === 'expectedctc' || norm === 'ectc') {
            if (!candidates['expectedCtc'] || candidates['expectedCtc'].priority < 10) {
                candidates['expectedCtc'] = { col: colNumber, priority: 10 };
            }
        } else if (has('expected') && has('ctc')) {
            if (!candidates['expectedCtc'] || candidates['expectedCtc'].priority < 5) {
                candidates['expectedCtc'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Notice Period
        if (norm === 'noticeperiod' || norm === 'np') {
            if (!candidates['noticePeriod'] || candidates['noticePeriod'].priority < 10) {
                candidates['noticePeriod'] = { col: colNumber, priority: 10 };
            }
        } else if (has('notice')) {
            if (!candidates['noticePeriod'] || candidates['noticePeriod'].priority < 5) {
                candidates['noticePeriod'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Location
        if (norm === 'location' || norm === 'city') {
            if (!candidates['location'] || candidates['location'].priority < 10) {
                candidates['location'] = { col: colNumber, priority: 10 };
            }
        } else if (has('location') || has('city') || has('place')) {
            if (!candidates['location'] || candidates['location'].priority < 5) {
                candidates['location'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Date
        if (norm === 'date') {
            if (!candidates['date'] || candidates['date'].priority < 10) {
                candidates['date'] = { col: colNumber, priority: 10 };
            }
        } else if (has('date')) {
            if (!candidates['date'] || candidates['date'].priority < 5) {
                candidates['date'] = { col: colNumber, priority: 5 };
            }
        }
        
        // FLS
        if (norm === 'fls' || norm === 'flsnonfls') {
            if (!candidates['fls'] || candidates['fls'].priority < 10) {
                candidates['fls'] = { col: colNumber, priority: 10 };
            }
        } else if (has('fls')) {
            if (!candidates['fls'] || candidates['fls'].priority < 5) {
                candidates['fls'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Client
        if (norm === 'client') {
            if (!candidates['client'] || candidates['client'].priority < 10) {
                candidates['client'] = { col: colNumber, priority: 10 };
            }
        } else if (has('client')) {
            if (!candidates['client'] || candidates['client'].priority < 5) {
                candidates['client'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Status
        if (norm === 'status') {
            if (!candidates['status'] || candidates['status'].priority < 10) {
                candidates['status'] = { col: colNumber, priority: 10 };
            }
        } else if (has('status')) {
            if (!candidates['status'] || candidates['status'].priority < 5) {
                candidates['status'] = { col: colNumber, priority: 5 };
            }
        }
        
        // SPOC
        if (norm === 'spoc') {
            if (!candidates['spoc'] || candidates['spoc'].priority < 10) {
                candidates['spoc'] = { col: colNumber, priority: 10 };
            }
        } else if (has('spoc') || has('contactperson')) {
            if (!candidates['spoc'] || candidates['spoc'].priority < 5) {
                candidates['spoc'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Source
        if (norm === 'source') {
            if (!candidates['source'] || candidates['source'].priority < 10) {
                candidates['source'] = { col: colNumber, priority: 10 };
            }
        } else if (has('source')) {
            if (!candidates['source'] || candidates['source'].priority < 5) {
                candidates['source'] = { col: colNumber, priority: 5 };
            }
        }
        
        // Feedback
        if (norm === 'feedback') {
            if (!candidates['feedback'] || candidates['feedback'].priority < 10) {
                candidates['feedback'] = { col: colNumber, priority: 10 };
            }
        } else if (has('feedback')) {
            if (!candidates['feedback'] || candidates['feedback'].priority < 5) {
                candidates['feedback'] = { col: colNumber, priority: 5 };
            }
        }
    });
    
    // Convert candidates to headerMap (use highest priority)
    for (const [field, candidate] of Object.entries(candidates)) {
        headerMap[field] = candidate.col;
    }
    
    return headerMap;
}

async function bulkUploadCandidates(req, res) {
    logger.info("[BULK-UPLOAD] Starting validation and review process");
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

    const filePath = req.file.path;

    try {
        const {
            detectFields,
            detectFieldsFromHeaders,
            detectHeaderMapping,
            isHeaderRow,
            postDetectionSwap,
            validateCandidate,
            autoFix
        } = require('../../utils/globalValidation');

        logger.info("[BULK-UPLOAD] Reading file:", req.file.originalname);

        // Parse column mapping from frontend if provided
        // Shape: { [excelColIndex]: 'name' | 'email' | ... | 'cf:custom_key' }
        let userMapping = null;
        if (req.body.columnMapping) {
            try {
                userMapping = JSON.parse(req.body.columnMapping);
            } catch (parseErr) {
                userMapping = null;
            }
        }

        const { UI_TO_DETECT_FIELD } = require('../../config/coreCandidateFields');
        const customColMapFromUser = {}; // customKey -> colIdx
        let coreUserMapping = null;
        if (userMapping && typeof userMapping === 'object') {
            coreUserMapping = {};
            Object.entries(userMapping).forEach(([excelColumnIndex, fieldName]) => {
                if (!fieldName) return;
                const colIdx = parseInt(excelColumnIndex, 10);
                if (Number.isNaN(colIdx) || colIdx < 0) return;
                const name = String(fieldName);
                if (name.startsWith('cf:')) {
                    const ck = name.slice(3).trim();
                    if (ck) customColMapFromUser[ck] = colIdx;
                } else {
                    coreUserMapping[colIdx] = name;
                }
            });
        }

        const workbook = new ExcelJS.Workbook();
        const ext = (req.file.originalname || '').toLowerCase();
        if (ext.endsWith('.csv')) {
            await workbook.csv.readFile(filePath);
        } else {
            await workbook.xlsx.readFile(filePath);
        }

        let totalRows = 0;
        let readyCount = 0;
        let reviewCount = 0;
        let blockedCount = 0;
        let duplicateDbCount = 0;
        const results = [];
        const ready = [];
        const review = [];
        const blocked = [];
        const seenEmails = new Set();
        const seenPhones = new Set();

        // DB-level duplicate check: Pre-fetch existing emails and phones for this user
        const userId = req.user?.id;
        let existingEmails = new Set();
        let existingPhones = new Set();

        if (userId) {
            try {
                const existingCandidates = await Candidate.find(
                    { createdBy: userId },
                    { email: 1, contact: 1, _id: 0 }
                ).lean();
                existingCandidates.forEach(c => {
                    if (c.email) existingEmails.add(c.email.toLowerCase().trim());
                    if (c.contact) existingPhones.add(String(c.contact).replace(/\D/g, ''));
                });
                logger.info(`[BULK-UPLOAD] Pre-loaded ${existingEmails.size} existing emails, ${existingPhones.size} existing phones for duplicate check`);
            } catch (dbErr) {
                logger.warn("[BULK-UPLOAD] Could not pre-load DB records for duplicate check:", dbErr.message);
            }
        }

        // Set up streaming response for progress updates
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendProgress = (data) => {
            try { res.write(JSON.stringify(data) + '\n'); } catch (e) { /* ignore write errors */ }
        };

        // Count total data rows across all sheets first (for progress calculation)
        let estimatedTotalRows = 0;
        for (const ws of workbook.worksheets) {
            estimatedTotalRows += Math.max(0, ws.rowCount - 1);
        }
        sendProgress({ type: 'progress', phase: 'reading', message: `Reading file... ${estimatedTotalRows} rows found`, totalEstimate: estimatedTotalRows, processed: 0 });

        // Process all sheets
        for (let sheetIndex = 0; sheetIndex < workbook.worksheets.length; sheetIndex++) {
            const worksheet = workbook.worksheets[sheetIndex];
            const sheetName = worksheet.name || `Sheet${sheetIndex + 1}`;

            // Collect all rows
            const allRows = [];
            let headers = [];
            
            worksheet.eachRow((row, rowNumber) => {
                const rowValues = row.values ? row.values.slice(1) : [];
                allRows.push(rowValues.map(v => {
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') {
                        if (v.text) return String(v.text).trim();
                        if (v.result) return String(v.result).trim();
                        if (v.richText) return v.richText.map(rt => rt.text || '').join('').trim();
                        if (v instanceof Date) return v.toISOString().split('T')[0];
                    }
                    return String(v).trim();
                }));
            });

            if (allRows.length < 2) continue;

            headers = allRows[0];
            sendProgress({ type: 'progress', phase: 'processing', message: `Processing sheet "${sheetName}" (${allRows.length - 1} rows)...`, totalEstimate: estimatedTotalRows, processed: totalRows });

            // SMART HEADER MAPPING: detect which columns map to which fields
            let smartHeaderMap = null;
            if (coreUserMapping && Object.keys(coreUserMapping).length > 0) {
                // Use user-provided mapping (UI field names → detect field names)
                smartHeaderMap = {};
                Object.entries(coreUserMapping).forEach(([excelColumnIndex, fieldName]) => {
                    if (!fieldName || fieldName === '') return;
                    const colIdx = parseInt(excelColumnIndex, 10);
                    if (colIdx >= 0 && colIdx < headers.length) {
                        const detectName = UI_TO_DETECT_FIELD[fieldName] || fieldName;
                        smartHeaderMap[detectName] = colIdx;
                    }
                });
            } else {
                // Auto-detect header mapping
                smartHeaderMap = detectHeaderMapping(headers);
            }

            const useSmartHeaders = Object.keys(smartHeaderMap).length >= 2;
            logger.info(`[BULK-UPLOAD] Sheet "${sheetName}": ${useSmartHeaders ? 'HEADER-BASED' : 'CONTENT-BASED'} mapping (${Object.keys(smartHeaderMap).length} fields detected)`);
            if (useSmartHeaders) {
                logger.info(`[BULK-UPLOAD] Mapped fields:`, Object.entries(smartHeaderMap).map(([f, i]) => `${f}→col${i}("${headers[i]}")`).join(', '));
            }

            // Process data rows
            for (let rowIdx = 1; rowIdx < allRows.length; rowIdx++) {
                const rowData = allRows[rowIdx];
                
                // Skip completely empty rows
                const hasData = rowData.some(cell => cell && String(cell).trim() !== '');
                if (!hasData) continue;

                // Skip repeated header rows in the middle of data
                if (isHeaderRow(rowData, headers)) continue;

                totalRows++;

                // Send progress update every 500 rows
                if (totalRows % 500 === 0) {
                    sendProgress({ type: 'progress', phase: 'validating', message: `Validating row ${totalRows} of ~${estimatedTotalRows}...`, totalEstimate: estimatedTotalRows, processed: totalRows, ready: readyCount, review: reviewCount, blocked: blockedCount });
                }

                try {
                    let detected;
                    let originalRow = {};

                    // Build original row for display
                    headers.forEach((header, colIdx) => {
                        if (header) originalRow[header] = rowData[colIdx] || '';
                    });

                    if (useSmartHeaders) {
                        // HEADER-BASED: Direct column mapping (most accurate)
                        detected = detectFieldsFromHeaders(rowData, smartHeaderMap, headers);
                    } else {
                        // FALLBACK: Content-based detection
                        let row = {};
                        headers.forEach((header, colIdx) => {
                            if (header) row[header] = rowData[colIdx] || '';
                        });
                        detected = detectFields(row, headers);
                        postDetectionSwap(detected);
                    }

                    const { fixed, changes } = autoFix(detected);

                    // Attach org custom fields from mapped Excel columns
                    const customFields = {};
                    Object.entries(customColMapFromUser).forEach(([ck, colIdx]) => {
                        const raw = rowData[colIdx];
                        if (raw == null) return;
                        const val = String(raw).trim();
                        if (val) customFields[ck] = val;
                    });
                    if (Object.keys(customFields).length > 0) {
                        fixed.customFields = customFields;
                    }

                    const validation = validateCandidate(fixed, totalRows);

                    // Skip if duplicate within this import batch
                    if (fixed.email && seenEmails.has(fixed.email.toLowerCase())) continue;
                    if (fixed.phone && seenPhones.has(fixed.phone)) continue;

                    // Track seen values
                    if (fixed.email) seenEmails.add(fixed.email.toLowerCase());
                    if (fixed.phone) seenPhones.add(fixed.phone);

                    // DB-level duplicate check
                    const isDbDuplicateEmail = fixed.email && existingEmails.has(fixed.email.toLowerCase());
                    const isDbDuplicatePhone = fixed.phone && existingPhones.has(String(fixed.phone).replace(/\D/g, ''));
                    const isDbDuplicate = isDbDuplicateEmail || isDbDuplicatePhone;

                    if (isDbDuplicate) {
                        duplicateDbCount++;
                        const dupWarning = isDbDuplicateEmail
                            ? { field: 'email', message: `Email "${fixed.email}" already exists in your database (will update on import)`, severity: 'INFO' }
                            : { field: 'phone', message: `Phone "${fixed.phone}" already exists in your database (will update on import)`, severity: 'INFO' };
                        validation.warnings = validation.warnings || [];
                        validation.warnings.push(dupWarning);
                    }

                    const result = {
                        rowIndex: totalRows,
                        original: originalRow,
                        fixed,
                        autoFixChanges: changes,
                        swaps: detected._swaps || [],
                        isDbDuplicate,
                        validation: {
                            category: validation.category,
                            confidence: validation.confidence,
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    };

                    // Map phone → contact for consistent database field names
                    if (result.fixed.phone) {
                        result.fixed.contact = result.fixed.phone;
                        delete result.fixed.phone;
                    }

                    // Map company → companyName for consistency
                    if (result.fixed.company && !result.fixed.companyName) {
                        result.fixed.companyName = result.fixed.company;
                        delete result.fixed.company;
                    }

                    // Map sourceOfCV → source for consistency
                    if (result.fixed.sourceOfCV && !result.fixed.source) {
                        result.fixed.source = result.fixed.sourceOfCV;
                        delete result.fixed.sourceOfCV;
                    }

                    // Map expectedSalary → expectedCtc for consistency
                    if (result.fixed.expectedSalary !== null && result.fixed.expectedSalary !== undefined && !result.fixed.expectedCtc) {
                        result.fixed.expectedCtc = result.fixed.expectedSalary;
                        delete result.fixed.expectedSalary;
                    }

                    // Normalize status to Title Case
                    if (result.fixed.status) {
                        const statusMap = {
                            'applied': 'Applied', 'interested': 'Interested', 'scheduled': 'Interested and scheduled',
                            'interviewed': 'Interview', 'rejected': 'Rejected', 'joined': 'Joined',
                            'pending': 'Applied', 'active': 'Applied', 'on hold': 'Hold',
                            'not interested': 'Rejected', 'hold': 'Hold', 'selected': 'Offer',
                            'offered': 'Offer', 'accepted': 'Offer', 'declined': 'Rejected',
                            'screening': 'Screening', 'hired': 'Hired', 'offer': 'Offer',
                            'interview': 'Interview', 'dropped': 'Dropped'
                        };
                        const normalized = statusMap[result.fixed.status.toLowerCase().trim()];
                        if (normalized) result.fixed.status = normalized;
                    }

                    // Set default date if not provided
                    if (!result.fixed.date) {
                        result.fixed.date = new Date().toISOString().split('T')[0];
                    }

                    results.push(result);

                    // Categorize by validation status
                    if (validation.category === 'ready') {
                        readyCount++;
                        ready.push(result);
                    } else if (validation.category === 'review') {
                        reviewCount++;
                        review.push(result);
                    } else {
                        blockedCount++;
                        blocked.push(result);
                    }
                } catch (rowErr) {
                    logger.error(`[BULK-UPLOAD] Error processing row ${totalRows}:`, rowErr.message);
                    continue;
                }
            }
        }

        logger.info(`[BULK-UPLOAD] Total: ${totalRows}, Ready: ${readyCount}, Review: ${reviewCount}, Blocked: ${blockedCount}, DB Duplicates: ${duplicateDbCount}`);

        sendProgress({ type: 'progress', phase: 'finalizing', message: 'Preparing results...', totalEstimate: estimatedTotalRows, processed: totalRows });

        const finalResult = {
            type: 'complete',
            success: true,
            fileName: req.file.originalname,
            totalProcessed: totalRows,
            stats: {
                ready: readyCount,
                review: reviewCount,
                blocked: blockedCount,
                dbDuplicates: duplicateDbCount
            },
            results: { ready, review, blocked },
            message: `Processed ${totalRows} rows: ${readyCount} ready, ${reviewCount} need review, ${blockedCount} blocked${duplicateDbCount > 0 ? `, ${duplicateDbCount} existing in DB` : ''}`
        };

        res.write(JSON.stringify(finalResult) + '\n');
        res.end();

    } catch (err) {
        logger.error("[BULK-UPLOAD] ERROR:", err.message, err.stack);
        try {
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: err.message });
            } else {
                res.write(JSON.stringify({ type: 'error', success: false, message: err.message }) + '\n');
                res.end();
            }
        } catch (e) { res.end(); }
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
};

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

async function extractHeaders(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const workbook = new ExcelJS.Workbook();
        const ext = path.extname(req.file.originalname || '').toLowerCase();
        if (ext === '.csv') {
            await workbook.csv.readFile(req.file.path);
        } else if (ext === '.xls') {
            return res.status(400).json({ success: false, message: "Old .xls format not supported. Please save as .xlsx or .csv." });
        } else {
            await workbook.xlsx.readFile(req.file.path);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            return res.status(400).json({ success: false, message: "No worksheet found" });
        }

        // Helper function to convert cell value to string
        const cellToString = (cell) => {
            if (cell === null || cell === undefined) return "";
            if (typeof cell === 'object') {
                if (cell.text) return String(cell.text).trim();
                if (cell.richText && Array.isArray(cell.richText)) return cell.richText.map(r => r.text || '').join('').trim();
                if (cell.result) return String(cell.result).trim();
                if (cell instanceof Date) return cell.toISOString().split('T')[0];
                return String(cell).trim();
            }
            return String(cell).trim();
        };

        // Detect header row (best match in first few rows)
        const detectHeaderRow = (sheet) => {
            const scores = {};
            for (let r = 1; r <= Math.min(8, sheet.rowCount); r++) {
                let score = 0;
                const row = sheet.getRow(r);
                row.eachCell((cell) => {
                    const text = cellToString(cell.value).toLowerCase();
                    if (!text) return;
                    if (text.includes('name') || text.includes('email') || text.includes('contact') || text.includes('position') || text.includes('company') || text.includes('ctc') || text.includes('client') || text.includes('experience') || text.includes('notice')) score++;
                });
                scores[r] = score;
            }
            let best = 1, bestScore = -1;
            for (const k of Object.keys(scores)) {
                if (scores[k] > bestScore) { best = Number(k); bestScore = scores[k]; }
            }
            return best;
        };

        // Extract headers from detected header row, including ALL columns (even if empty)
        const headers = [];
        const headerRowNum = detectHeaderRow(worksheet);
        const headerRow = worksheet.getRow(headerRowNum);

        // Determine last used column in header row (preserve gaps)
        let maxCol = 0;
        headerRow.eachCell((cell, colNumber) => {
            if (colNumber > maxCol) maxCol = colNumber;
        });
        maxCol = Math.max(maxCol, 20); // At least check 20 columns

        for (let col = 1; col <= maxCol; col++) {
            const cell = headerRow.getCell(col);
            const value = cellToString(cell.value);
            if (value) {
                headers.push(value);
            } else {
                headers.push(`Column ${col}`);
            }
        }

        // Trim trailing empty columns
        while (headers.length > 0 && headers[headers.length - 1].startsWith('Column')) {
            headers.pop();
        }

        logger.info("--- 📋 Extracted Headers:", headers);
        logger.info("--- 🧭 Header Row Detected:", headerRowNum);
        logger.info("--- 📊 Total columns detected:", headers.length);

        // Cleanup
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(200).json({ success: true, headers });
    } catch (err) {
        logger.error("Extract Headers Error:", err);
        res.status(500).json({ success: false, message: "Error reading file: " + err.message });
    }
}

module.exports = { bulkUploadCandidates, revalidateRecord, importReviewedCandidates, extractHeaders };
