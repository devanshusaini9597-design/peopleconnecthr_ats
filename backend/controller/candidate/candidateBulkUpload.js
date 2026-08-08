const Candidate = require('../../models/Candidate');
const fs = require('fs');
const ExcelJS = require('exceljs');
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

module.exports = { bulkUploadCandidates };
