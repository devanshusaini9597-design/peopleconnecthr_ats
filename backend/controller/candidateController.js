// const Candidate = require('../models/Candidate');

// // 1. Add Candidate with Duplicate Check
// exports.createCandidate = async (req, res) => {
//   try {
//     const { email, contact, status } = req.body;

//     // Check if email or contact already exists
//     const existing = await Candidate.findOne({ $or: [{ email }, { contact }] });
//     if (existing) {
//       return res.status(400).json({ 
//         success: false, 
//         message: `Duplicate: Candidate with this ${existing.email === email ? 'Email' : 'Contact'} already exists!` 
//       });
//     }

//     const newCandidate = new Candidate({
//       ...req.body,
//       // Initialize history with current status
//       statusHistory: [{ status: status || 'Applied' }]
//     });

//     await newCandidate.save();
//     res.status(201).json({ success: true, data: newCandidate });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// // 2. Update Status with History Tracking
/* exports.bulkUploadCandidates = async (req, res) => {
    console.log("--- 🚀 STEP 1: API Hit & File Received ---");
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

    const filePath = req.file.path;
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        console.log("--- ✅ STEP 2: Excel File Read Success ---");

        // Send headers for streaming response
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');

        const STREAM_BATCH_SIZE = 50; // 🔥 OPTIMIZATION: Stream every 50 records (faster UI updates)
        const DB_BATCH_SIZE = 500; // 🔥 OPTIMIZATION: Insert 500 records at a time (faster than 1000)
        let dbBatch = [];
        let streamBatch = [];
        let totalRowsInFile = 0;
        let validRows = 0;
        let duplicateSkipped = 0;
        let successCount = 0;
        let dbDuplicates = 0;
        const failedRecords = [];
        const seenEmails = new Set();
        const seenContacts = new Set();
        const qualityReport = { excellent: 0, good: 0, poor: 0, validationIssues: [] };
        const flushBatch = async () => {
            if (dbBatch.length === 0) return;
            console.log(`--- 📤 Inserting batch of ${dbBatch.length} records (Total so far: ${successCount}) ---`);
            try {
                const result = await Candidate.insertMany(dbBatch, { ordered: false });
                successCount += result.length;
                console.log(`--- ✅ Batch inserted successfully ---`);
            } catch (bulkErr) {
                if (bulkErr.writeErrors) {
                    const batchSuccess = dbBatch.length - bulkErr.writeErrors.length;
                    successCount += batchSuccess;
                    bulkErr.writeErrors.forEach(e => {
                        if (e.code === 11000) dbDuplicates++;
                        else failedRecords.push({ reason: e.errmsg || 'Insert error' });
                    });
                } else {
                    failedRecords.push({ reason: bulkErr.message || 'Batch insert error' });
                }
            } finally {
                dbBatch = [];
            }
        };

        // Helper: normalize cell value to string
        const cellToString = (cell) => {
            if (cell === null || cell === undefined) return "";
            // ExcelJS rich text or object handling
            if (typeof cell === 'object') {
                if (cell.text) return String(cell.text).trim();
                if (cell.richText && Array.isArray(cell.richText)) return cell.richText.map(r => r.text || '').join('').trim();
                if (cell.result) return String(cell.result).trim();
                if (cell instanceof Date) return cell.toISOString().split('T')[0];
                return String(cell).trim();
            }
            return String(cell).trim();
        };

        // Helper: determine header row by scoring first few rows (pick row with most header-like cells)
        const detectHeaderRow = (worksheet) => {
            const scores = {};
            const rowLimit = Math.min(6, worksheet.actualRowCount || worksheet.rowCount);
            for (let r = 1; r <= rowLimit; r++) {
                let score = 0;
                const row = worksheet.getRow(r);
                row.eachCell((cell) => {
                    const text = cellToString(cell.value).toLowerCase();
                    if (!text) return;
                    if (text.includes('name') || text.includes('email') || text.includes('contact') || text.includes('position') || text.includes('company') || text.includes('ctc') || text.includes('client') || text.includes('experience') || text.includes('notice')) score++;
                });
                scores[r] = score;
            }
            // choose row with highest score
            let best = 1, bestScore = -1;
            for (const k of Object.keys(scores)) {
                if (scores[k] > bestScore) { best = Number(k); bestScore = scores[k]; }
            }
            return best;
        };

        const normalizeHeader = (value) => String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();

        const headerAliases = {
            name: ['name', 'candidatename', 'fullname'],
            email: ['email', 'emailid', 'mailid'],
            contact: ['contact', 'contactno', 'contactnumber', 'phone', 'mobile', 'mobileno', 'phoneno'],
            position: ['position', 'designation', 'role', 'profile'],
            companyName: ['company', 'companyname', 'currentcompany', 'employer', 'organisation', 'organization'],
            experience: ['experience', 'exp', 'workexp'],
            ctc: ['ctc', 'currentctc', 'salary'],
            expectedCtc: ['expectedctc', 'expectedctc', 'ectc', 'expectedsalary'],
            noticePeriod: ['noticeperiod', 'notice', 'np'],
            location: ['location', 'city', 'place'],
            date: ['date', 'joiningdate', 'applieddate'],
            status: ['status', 'feedback'],
            client: ['client'],
            spoc: ['spoc', 'contactperson'],
            source: ['source', 'sourceofcv'],
            fls: ['fls', 'nonfls', 'flsnonfls', 'flsnon', 'flsnonfls', 'flsnonfls']
        };

        const headerMatchesField = (field, headerText) => {
            const norm = normalizeHeader(headerText);
            const aliases = headerAliases[field] || [];
            return aliases.includes(norm);
        };

        // Status keywords that sometimes appear in Client column
        const statusKeywords = ['interested', 'not interested', 'notselected', 'not selected', 'scheduled', 'interview', 'selected', 'rejected','notgraduate','not graduate'];

        // Helper: build column scores using sample rows (for smart remapping)
        const buildColumnScores = (worksheet, headerRowNum) => {
            const maxCols = Math.max(worksheet.columnCount, 30);
            const startRow = headerRowNum + 1;
            // 🔥 OPTIMIZATION: Reduce sample rows from 80 to 20 (5x faster column detection)
            const endRow = Math.min(worksheet.rowCount, headerRowNum + 20);

            const emailRe = /@/;
            const phoneRe = /\d{7,15}/;
            const expRe = /(yr|yrs|year|years|month|months|mos)\b/i;
            const ctcRe = /(lpa|k\b|\bpa\b|per annum|p\.a\b|lakh|lakhs|₹|rs\b|ctc)\b/i;
            const noticeRe = /(notice|np|days|months|immediate|serving)/i;
            const statusRe = /(interested|not interested|notselected|not selected|scheduled|interview|selected|rejected|not graduate|notgraduate)/i;
            const companyRe = /(pvt|ltd|llp|inc|corp|co\.?\b|company|technologies|solutions|systems|services)/i;
            const positionRe = /(developer|engineer|manager|analyst|associate|designer|lead|intern|tester|qa|sales|marketing|hr|recruiter|accountant|architect|consultant|executive|officer|admin|support)/i;

            const colScores = {};
            for (let c = 1; c <= maxCols; c++) {
                colScores[c] = { email: 0, phone: 0, name: 0, exp: 0, ctc: 0, status: 0, notice: 0, company: 0, position: 0 };
            }

            // 🔥 OPTIMIZATION: Skip columns after column 25 (most data is in first 15-20 columns)
            const maxColsToCheck = Math.min(maxCols, 25);

            for (let r = startRow; r <= endRow; r++) {
                const row = worksheet.getRow(r);
                for (let c = 1; c <= maxColsToCheck; c++) {
                    const raw = row.getCell(c) ? cellToString(row.getCell(c).value) : '';
                    if (!raw) continue;
                    const low = raw.toLowerCase();
                    if (emailRe.test(raw)) colScores[c].email += 1;
                    if (phoneRe.test(raw)) colScores[c].phone += 1;
                    if (expRe.test(raw)) colScores[c].exp += 1;
                    if (ctcRe.test(raw)) colScores[c].ctc += 1;
                    if (noticeRe.test(low)) colScores[c].notice += 1;
                    if (statusRe.test(low)) colScores[c].status += 1;
                    if (companyRe.test(low)) colScores[c].company += 1;
                    if (positionRe.test(low)) colScores[c].position += 1;
                    // name heuristic: letters + spaces, not email, not mostly numbers
                    if (!emailRe.test(raw) && /[a-zA-Z]/.test(raw) && raw.replace(/[^0-9]/g, '').length < raw.length - 2) {
                        colScores[c].name += 1;
                    }
                }
            }

            return { colScores, maxCols: maxColsToCheck };
        };

        // Iterate sheets (sync loop so we can await batch flushes)
        for (let sheetIndex = 0; sheetIndex < workbook.worksheets.length; sheetIndex++) {
            const worksheet = workbook.worksheets[sheetIndex];
            const sheetId = sheetIndex + 1;
            try {
                const headerRowNum = detectHeaderRow(worksheet);
                const headerMap = {};

                // build headerMap from detected header row
                const headerRow = worksheet.getRow(headerRowNum);
                headerRow.eachCell((cell, colNumber) => {
                    const header = cellToString(cell.value).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                    if (!header) return;
                    
                    // Exact matches first (higher priority)
                    if (header === 'name') headerMap['name'] = colNumber;
                    else if (header === 'email' || header === 'emailid') headerMap['email'] = colNumber;
                    else if (header === 'position' || header === 'designation') headerMap['position'] = colNumber;
                    else if (header === 'companyname' || header === 'company name' || header === 'company') headerMap['company'] = colNumber;
                    else if (header === 'experience') headerMap['experience'] = colNumber;
                    else if (header === 'ctc') headerMap['ctc'] = colNumber;
                    else if (header === 'expected ctc' || header === 'expectedctc') headerMap['expectedCtc'] = colNumber;
                    else if (header === 'notice period' || header === 'noticeperiod') headerMap['notice'] = colNumber;
                    else if (header === 'contact no' || header === 'contactno' || header === 'contact') headerMap['contact'] = colNumber;
                    else if (header === 'location') headerMap['location'] = colNumber;
                    else if (header === 'date') headerMap['date'] = colNumber;
                    else if (header === 'client') headerMap['client'] = colNumber;
                    else if (header === 'spoc') headerMap['spoc'] = colNumber;
                    else if (header === 'status') headerMap['status'] = colNumber;
                    else if (header === 'source' || header === 'source of cv') headerMap['source'] = colNumber;
                    else if (header === 'fls' || header.includes('fls')) headerMap['flsStatus'] = colNumber;
                    // Partial matches (lower priority)
                    else if (!headerMap['name'] && (header.includes('candidate') || header.includes('name'))) headerMap['name'] = colNumber;
                    else if (!headerMap['email'] && header.includes('email')) headerMap['email'] = colNumber;
                    else if (!headerMap['contact'] && (header.includes('mobile') || header.includes('phone') || header.includes('contact'))) headerMap['contact'] = colNumber;
                    else if (!headerMap['position'] && (header.includes('role') || header.includes('profile') || header.includes('job'))) headerMap['position'] = colNumber;
                    else if (!headerMap['company'] && (header.includes('organisation') || header.includes('organization') || header.includes('employer') || header.includes('current company'))) headerMap['company'] = colNumber;
                    else if (!headerMap['experience'] && (header.includes('exp') || header.includes('work exp'))) headerMap['experience'] = colNumber;
                    else if (!headerMap['expectedCtc'] && (header.includes('expected') || header.includes('ectc'))) headerMap['expectedCtc'] = colNumber;
                    else if (!headerMap['notice'] && (header.includes('notice') || header === 'np')) headerMap['notice'] = colNumber;
                    else if (!headerMap['location'] && (header.includes('city') || header.includes('place'))) headerMap['location'] = colNumber;
                    else if (!headerMap['spoc'] && (header.includes('contact person') || header.includes('spoc'))) headerMap['spoc'] = colNumber;
                    else if (!headerMap['status'] && header.includes('feedback')) headerMap['status'] = colNumber;
                });

                const { colScores, maxCols } = buildColumnScores(worksheet, headerRowNum);

                const pickBestColumn = (scoreKey, excludeCols = new Set()) => {
                    let bestCol = null;
                    let bestScore = 0;
                    for (let c = 1; c <= maxCols; c++) {
                        if (excludeCols.has(c)) continue;
                        const score = colScores[c][scoreKey] || 0;
                        if (score > bestScore) {
                            bestScore = score;
                            bestCol = c;
                        }
                    }
                    return bestCol ? { col: bestCol, score: bestScore } : null;
                };

                // ONLY do auto-correction if NO user mapping was provided
                if (!userMapping || Object.keys(userMapping).length === 0) {
                    const ensureHeader = (key, scoreKey, minScore = 2) => {
                        const assigned = new Set(Object.values(headerMap).filter(Boolean));
                        const currentCol = headerMap[key];
                        const currentScore = currentCol ? (colScores[currentCol]?.[scoreKey] || 0) : 0;
                        const best = pickBestColumn(scoreKey, new Set([...assigned].filter(c => c !== currentCol)));

                        if (!currentCol || currentScore < minScore) {
                            if (best && best.score >= minScore) headerMap[key] = best.col;
                        } else if (best && best.score > currentScore * 1.5) {
                            headerMap[key] = best.col;
                        }
                    };

                    // Only auto-enhance if no user mapping
                    ensureHeader('email', 'email', 3);
                    ensureHeader('contact', 'phone', 3);
                    ensureHeader('name', 'name', 3);
                    ensureHeader('company', 'company', 2);
                    ensureHeader('experience', 'exp', 2);
                    ensureHeader('ctc', 'ctc', 2);
                    ensureHeader('expectedCtc', 'ctc', 1);
                    ensureHeader('notice', 'notice', 2);
                    ensureHeader('position', 'position', 2);
                    ensureHeader('status', 'status', 1);

                    const swapIf = (keyA, keyB, scoreA, scoreB) => {
                        const colA = headerMap[keyA];
                        const colB = headerMap[keyB];
                        if (!colA || !colB) return;
                        const aScoreA = colScores[colA]?.[scoreA] || 0;
                        const aScoreB = colScores[colA]?.[scoreB] || 0;
                        const bScoreA = colScores[colB]?.[scoreA] || 0;
                        const bScoreB = colScores[colB]?.[scoreB] || 0;
                        if (aScoreB > aScoreA && bScoreA > bScoreB) {
                            headerMap[keyA] = colB;
                            headerMap[keyB] = colA;
                        }
                    };

                    swapIf('name', 'company', 'name', 'company');
                    swapIf('experience', 'ctc', 'exp', 'ctc');
                    swapIf('notice', 'expectedCtc', 'notice', 'ctc');
                    swapIf('company', 'expectedCtc', 'company', 'ctc');
                }

                console.log(`--- 📋 Final headerMap for sheet ${sheetId}:`, JSON.stringify(headerMap, null, 2));
                console.log(`--- 📊 Column Assignments:`);
                console.log(`  Name column: ${headerMap['name'] || 'NOT FOUND'}`);
                console.log(`  Company column: ${headerMap['company'] || 'NOT FOUND'}`);
                console.log(`  Position column: ${headerMap['position'] || 'NOT FOUND'}`);
                console.log(`  Experience column: ${headerMap['experience'] || 'NOT FOUND'}`);
                console.log(`  CTC column: ${headerMap['ctc'] || 'NOT FOUND'}`);
                console.log(`  Expected CTC column: ${headerMap['expectedCtc'] || 'NOT FOUND'}`);
                console.log(`  Notice Period column: ${headerMap['notice'] || 'NOT FOUND'}`);
                console.log(`  Email column: ${headerMap['email'] || 'NOT FOUND'}`);
                console.log(`  Contact column: ${headerMap['contact'] || 'NOT FOUND'}`);

                if (!headerMap['name']) {
                    console.log(`--- ⚠️ Sheet ${sheetId} still missing Name mapping after profiling — skipping sheet`);
                    return;
                }

                // Process rows starting after headerRowNum
                for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
                    totalRowsInFile++;
                    const row = worksheet.getRow(r);
                    const rawName = cellToString(row.getCell(headerMap['name']).value || '');

                    if (!rawName) {
                        duplicateSkipped++; // empty name -> skip
                        continue;
                    }

                    // skip repeated header rows inside data
                    if (rawName.toLowerCase().trim() === 'name') { duplicateSkipped++; continue; }

                    const getData = (key) => {
                        const idx = headerMap[key];
                        if (idx && idx > 0) return cellToString(row.getCell(idx).value || '');
                        return '';
                    };

                    let nameVal = rawName;
                    let emailVal = getData('email');
                    let contactVal = getData('contact') || getData('spoc');
                    let clientVal = getData('client');
                    let statusVal = getData('status');
                    let companyVal = getData('company');
                    let expectedCtcVal = getData('expectedCtc') || getData('expected');

                    // Debug first 3 rows to see data extraction
                    if (r <= headerRowNum + 3) {
                        console.log(`\n--- 🔍 ROW ${r} Data Extraction (sheet ${sheetId}):`);
                        console.log(`  Raw Name from col ${headerMap['name']}: "${rawName}"`);
                        console.log(`  Company from col ${headerMap['company']}: "${companyVal}"`);
                        console.log(`  Position from col ${headerMap['position']}: "${getData('position')}"`);
                        console.log(`  Experience from col ${headerMap['experience']}: "${getData('experience')}"`);
                        console.log(`  CTC from col ${headerMap['ctc']}: "${getData('ctc')}"`);
                        console.log(`  Expected CTC from col ${headerMap['expectedCtc']}: "${expectedCtcVal}"`);
                        console.log(`  Notice from col ${headerMap['notice']}: "${getData('notice')}"`);
                        console.log(`  Email from col ${headerMap['email']}: "${emailVal}"`);
                        console.log(`  Contact from col ${headerMap['contact']}: "${contactVal}"`);
                    }

                    // If client cell contains status keywords, move it to status
                    const clientNorm = clientVal.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                    if (clientNorm) {
                        for (const k of statusKeywords) {
                            if (clientNorm.includes(k.replace(/\s+/g, ''))) {
                                // treat as status
                                statusVal = clientVal;
                                clientVal = '';
                                break;
                            }
                        }
                    }

                    // If companyName empty but client exists and client doesn't look like a status, use it
                    if (!companyVal && clientVal) {
                        companyVal = clientVal;
                        clientVal = '';
                    }

                    // Fallback email
                    if (!emailVal || !emailVal.includes('@')) {
                        emailVal = `user_sheet${sheetId}_row${r}_${Date.now()}@ats.local`;
                    }

                    // Fallback contact
                    if (!contactVal) contactVal = `PHONE_sheet${sheetId}_row${r}`;

                    // Avoid duplicates within batch
                    if (seenEmails.has(emailVal.toLowerCase()) || seenContacts.has(contactVal)) {
                        // Track this duplicate for display
                        duplicateRecords.push({
                            row: r,
                            name: nameVal,
                            email: emailVal,
                            contact: contactVal,
                            position: getData('position') || 'N/A',
                            company: companyVal || 'N/A',
                            reason: seenEmails.has(emailVal.toLowerCase()) ? 'Duplicate Email' : 'Duplicate Contact'
                        });
                        
                        if (validRows < 10) { // Log first 10 duplicates only
                            console.log(`\n⚠️  DUPLICATE DETECTED - Row ${r}:`);
                            console.log(`  Name: "${nameVal}"`);
                            console.log(`  Email: "${emailVal}" ${seenEmails.has(emailVal.toLowerCase()) ? '(DUPLICATE EMAIL)' : ''}`);
                            console.log(`  Contact: "${contactVal}" ${seenContacts.has(contactVal) ? '(DUPLICATE CONTACT)' : ''}`);
                        }
                        duplicateSkipped++; 
                        continue;
                    }
                    seenEmails.add(emailVal.toLowerCase());
                    seenContacts.add(contactVal);

                    // Date handling: try date column else today
                    let finalDate = new Date().toISOString().split('T')[0];
                    if (headerMap['date']) {
                        const rawDate = row.getCell(headerMap['date']).value;
                        if (rawDate instanceof Date) finalDate = rawDate.toISOString().split('T')[0];
                        else if (!isNaN(rawDate)) finalDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                    }

                    const candidateData = {
                        name: String(nameVal).trim(),
                        email: String(emailVal).trim().toLowerCase(),
                        contact: String(contactVal).trim(),
                        location: getData('location') || 'N/A',
                        state: LocationService.detectState(getData('location') || 'N/A'), // ✅ Auto-detect state from location
                        position: getData('position') || 'N/A',
                        companyName: companyVal || 'N/A',
                        experience: getData('experience') || '0',
                        ctc: getData('ctc') || '',
                        expectedCtc: expectedCtcVal || '',
                        noticePeriod: getData('notice') || 'N/A',
                        client: clientVal || 'N/A',
                        spoc: getData('spoc') || '',
                        fls: getData('flsStatus') || 'N/A',
                        date: finalDate,
                        status: statusVal || 'Applied',
                        source: getData('source') || 'Excel Import'
                    };

                    // ✅ VALIDATE & AUTO-FIX DATA QUALITY
                    const validation = DataValidator.validateCandidate(candidateData);
                    const fixedData = DataValidator.autoFixCandidate(candidateData);

                    // Update quality report
                    if (validation.score >= 90) qualityReport.excellent++;
                    else if (validation.score >= 70) qualityReport.good++;
                    else qualityReport.poor++;

                    // Log validation issues (first 10 only)
                    if (validRows < 10 && validation.issues.length > 0) {
                        console.log(`\n⚠️  Row ${r} has quality issues (Score: ${validation.score}%):`);
                        validation.issues.forEach(issue => console.log(`    - ${issue}`));
                        if (validation.suggestions.length > 0) {
                            console.log(`  💡 Suggestions:`);
                            validation.suggestions.forEach(sugg => console.log(`    - ${sugg}`));
                        }
                    }

                    // Log final candidate data for first 3 records
                    if (validRows < 3) {
                        console.log(`\n--- ✅ FINAL Candidate Data #${validRows + 1}:`);
                        console.log(`  Name: "${fixedData.name}" (Quality: ${validation.score}%)`);
                        console.log(`  Company: "${fixedData.companyName}"`);
                        console.log(`  Position: "${fixedData.position}"`);
                        console.log(`  Experience: "${fixedData.experience}"`);
                        console.log(`  CTC: "${fixedData.ctc}"`);
                        console.log(`  Expected CTC: "${fixedData.expectedCtc}"`);
                        console.log(`  Notice Period: "${fixedData.noticePeriod}"`);
                    }

                    dbBatch.push(fixedData);
                    streamBatch.push(fixedData);
                    validRows++;

                    // Stream data every 100 records
                    if (streamBatch.length >= STREAM_BATCH_SIZE) {
                        const chunk = {
                            type: 'progress',
                            records: streamBatch,
                            processed: validRows,
                            total: totalRowsInFile
                        };
                        res.write(JSON.stringify(chunk) + '\n');
                        console.log(`--- 📤 Streamed ${validRows}/${totalRowsInFile} records ---`);
                        streamBatch = [];
                    }

                    // Insert in DB in batches
                    if (dbBatch.length >= DB_BATCH_SIZE) {
                        await flushBatch();
                    }
                }
            } catch (sheetErr) {
                console.error(`--- ❌ Error processing sheet ${sheetId}:`, sheetErr.message);
            }
        }

        // Flush any remaining stream records
        if (streamBatch.length > 0) {
            const chunk = {
                type: 'progress',
                records: streamBatch,
                processed: validRows,
                total: totalRowsInFile
            };
            res.write(JSON.stringify(chunk) + '\n');
            console.log(`--- 📤 Streamed ${validRows}/${totalRowsInFile} records ---`);
            streamBatch = [];
        }

        // Flush any remaining DB records
        await flushBatch();

        const uploadDuration = ((Date.now() - uploadStartTime) / 1000).toFixed(2);
        console.log(`\n--- 📦 ✅ UPLOAD COMPLETE ---`);
        console.log(`--- ⏱️ Total Duration: ${uploadDuration} seconds ---`);
        console.log(`--- 📊 SUMMARY REPORT:`);
        console.log(`  📥 Total Rows in File: ${totalRowsInFile}`);
        console.log(`  ✅ Valid Records: ${validRows}`);
        console.log(`  💾 Successfully Saved: ${successCount}`);
        console.log(`  ⚠️  Duplicates in File: ${duplicateSkipped}`);
        console.log(`  ⚠️  Duplicates in DB: ${dbDuplicates}`);
        console.log(`  💯 Success Rate: ${((validRows / totalRowsInFile) * 100).toFixed(1)}%`);
        console.log(`\n--- 📈 DATA QUALITY BREAKDOWN:`);
        console.log(`  🟢 Excellent Quality (90-100%): ${qualityReport.excellent} records`);
        console.log(`  🟡 Good Quality (70-89%): ${qualityReport.good} records`);
        console.log(`  🔴 Poor Quality (<70%): ${qualityReport.poor} records`);
        const qualityPercent = ((qualityReport.excellent + qualityReport.good) / (qualityReport.excellent + qualityReport.good + qualityReport.poor) * 100).toFixed(1);
        console.log(`  📊 Overall Data Quality: ${qualityPercent}% good or better`);
        console.log(`--- ================== ---\n`);

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        if (validRows > 0) {
            // Send final completion message
            const finalMsg = {
                type: 'complete',
                success: true,
                message: `✅ All ${validRows} records streamed and mapped!`,
                processed: successCount,
                duplicatesInFile: duplicateSkipped,
                duplicatesInDB: dbDuplicates,
                totalProcessed: validRows,
                totalInFile: totalRowsInFile,
                failedRecords: failedRecords.length > 0 ? failedRecords : [],
                qualityBreakdown: {
                    excellent: qualityReport.excellent,
                    good: qualityReport.good,
                    poor: qualityReport.poor,
                    overallQualityPercent: (((qualityReport.excellent + qualityReport.good) / (qualityReport.excellent + qualityReport.good + qualityReport.poor)) * 100).toFixed(1)
                }
            };
            res.write(JSON.stringify(finalMsg) + '\n');
            res.end();

            return;
        } else {
            const errorMsg = {
                type: 'error',
                success: false,
                message: 'No valid candidates found. Check headers.',
                totalInFile: totalRowsInFile,
                duplicatesSkipped: duplicateSkipped
            };
            res.write(JSON.stringify(errorMsg) + '\n');
            res.end();
            return;
        }

    } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('--- ‼️ FATAL ERROR ---', err.message);
        res.status(500).json({ success: false, message: `Error: ${err.message}` });
    }
};
//                             .replace(/\s+/g, '') 
//                             .replace(/[.\-_]/g, ''); 
        
//         normalizedRow[cleanKey] = row[key];
//     });

//     // Smart Mapping: Multiple keywords check karein
//     return {
//         srNo: normalizedRow['sr'] || normalizedRow['srno'] || normalizedRow['sno'],
//         date: normalizedRow['date'] || new Date().toISOString().split('T')[0],
//         location: normalizedRow['location'] || normalizedRow['city'] || normalizedRow['address'],
//         position: normalizedRow['position'] || normalizedRow['jobrole'] || normalizedRow['role'],
//         fls: normalizedRow['fls'] || normalizedRow['flsnonfls'] || normalizedRow['flsnon'],
//         name: normalizedRow['name'] || normalizedRow['candidate'] || normalizedRow['candidatename'],
//         // "Contact no" ya "contact" dono pakad lega
//         contact: String(normalizedRow['contactno'] || normalizedRow['contact'] || normalizedRow['phone'] || normalizedRow['mob'] || ''),
//         email: normalizedRow['email'] || normalizedRow['emailid'],
//         companyName: normalizedRow['companyname'] || normalizedRow['company'] || normalizedRow['currentcompany'],
//         experience: normalizedRow['experience'] || normalizedRow['exp'] || normalizedRow['totalexp'],
//         ctc: normalizedRow['ctc'] || normalizedRow['currentctc'],
//         expectedCtc: normalizedRow['expectedctc'] || normalizedRow['ectc'],
//         noticePeriod: normalizedRow['noticeperiod'] || normalizedRow['np'] || normalizedRow['notice'],
//         status: normalizedRow['status'] || 'Applied',
//         client: normalizedRow['client'] || normalizedRow['clientname'],
//         spoc: normalizedRow['spoc'] || normalizedRow['contactperson'],
//         source: normalizedRow['sourceofcv'] || normalizedRow['source'] || normalizedRow['cvsource']
//     };
// });


        
//         const saved = await Candidate.insertMany(finalResults, { ordered: false });
//         console.log("Records Saved in DB:", saved.length);
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         res.status(200).json({ success: true, message: "Upload Successful!", count: saved.length });

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         res.status(500).json({ success: false, message: "Import Error", error: err.message });
//     }
// };



// const Candidate = require('../models/Candidate');
// const fs = require('fs');
// const csv = require('csv-parser');
// const xlsx = require('xlsx');

// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;
//     let rawResults = [];

//     try {
//         const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
//         if (fileExtension === 'csv') {
//             const results = [];
//             const stream = fs.createReadStream(filePath).pipe(csv());
//             for await (const row of stream) { results.push(row); }
//             rawResults = results;
//         } else {
//             const workbook = xlsx.readFile(filePath);
//             rawResults = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
//         }

//         const finalResults = rawResults.map((row, index) => {
//             const normalizedRow = {};
//             // Sabse pehle headers ko lowercase aur clean karlo
//             Object.keys(row).forEach(key => {
//                 const cleanKey = key.toLowerCase().trim().replace(/[\s_\-]/g, ''); 
//                 normalizedRow[cleanKey] = row[key];
//             });

//             // FUZZY MAPPING: Name, Email aur Position ke liye multiple options check karo
//             const name = normalizedRow['name'] || normalizedRow['candidatename'] || normalizedRow['fullname'] || normalizedRow['candidate'];
//             const email = normalizedRow['email'] || normalizedRow['emailid'] || normalizedRow['mail'];
//             const contact = normalizedRow['contact'] || normalizedRow['contactno'] || normalizedRow['phone'] || normalizedRow['phonenumber'];
//             const position = normalizedRow['position'] || normalizedRow['jobrole'] || normalizedRow['role'] || normalizedRow['designation'];

//             if (!name) return null; // Bina naam waale skip

//             return {
//                 srNo: String(normalizedRow['srno'] || index + 1),
//                 date: normalizedRow['date'] || new Date().toISOString().split('T')[0],
//                 location: normalizedRow['location'] || 'N/A',
//                 position: position || 'General', 
//                 fls: normalizedRow['fls'] || normalizedRow['flsnonfls'] || '',
//                 name: String(name).trim(),
//                 contact: contact ? String(contact).trim() : `Pending_${index}`, 
//                 email: email ? String(email).trim() : `noemail_${index}@ats.com`,
//                 companyName: normalizedRow['companyname'] || normalizedRow['company'] || '',
//                 experience: String(normalizedRow['experience'] || normalizedRow['exp'] || '0'),
//                 ctc: String(normalizedRow['ctc'] || ''),
//                 expectedCtc: String(normalizedRow['expectedctc'] || ''),
//                 noticePeriod: String(normalizedRow['noticeperiod'] || ''),
//                 status: normalizedRow['status'] || 'Applied',
//                 client: normalizedRow['client'] || '',
//                 spoc: normalizedRow['spoc'] || '',
//                 source: normalizedRow['source'] || normalizedRow['sourceofcv'] || 'Excel Import'
//             };
//         }).filter(item => item !== null);

//         if (finalResults.length > 0) {
//             // ordered: false matlab agar ek record fail ho toh baaki stop na ho
//             const saved = await Candidate.insertMany(finalResults, { ordered: false, runValidators: false });
//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//             return res.status(200).json({ success: true, message: `✅ ${saved.length} Candidates imported successfully!` });
//         } else {
//             throw new Error("Excel mein koi valid data nahi mila. Make sure 'Name' column exists.");
//         }

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         console.error("Import Error:", err);
//         res.status(500).json({ success: false, message: "Error: " + err.message });
//     }
// };

// exports.createCandidate = async (req, res) => {
//     try {
//         if (typeof req.body.statusHistory === 'string') {
//             req.body.statusHistory = JSON.parse(req.body.statusHistory);
//         }
//         if (req.file) {
//             req.body.resume = `/uploads/${req.file.filename}`;
//         }

//         const newCandidate = new Candidate(req.body);
//         await newCandidate.save();
//         res.status(201).json({ success: true, message: "Candidate Added Successfully" });
//     } catch (error) {
//         console.error("Create Error:", error);
//         if (error.code === 11000) {
//             return res.status(400).json({ success: false, message: "Email already exists!" });
//         }
//         res.status(500).json({ success: false, message: error.message || "Server Error" });
//     }
// };

// exports.updateCandidate = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (typeof req.body.statusHistory === 'string') {
//             try {
//                 req.body.statusHistory = JSON.parse(req.body.statusHistory);
//             } catch (e) {
//                 req.body.statusHistory = [];
//             }
//         }
//         if (req.file) {
//             req.body.resume = `/uploads/${req.file.filename}`;
//         }

//         const updatedCandidate = await Candidate.findByIdAndUpdate(
//             id, 
//             { $set: req.body }, 
//             { new: true, runValidators: true }
//         );

//         if (!updatedCandidate) {
//             return res.status(404).json({ success: false, message: "Candidate not found" });
//         }
//         res.status(200).json({ success: true, message: "Updated Successfully", data: updatedCandidate });
//     } catch (error) {
//         console.error("Update Error:", error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// };

*/

const Candidate = require('../models/Candidate');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { detectFields, validateCandidate, autoFix } = require('../utils/globalValidation');
const ExcelJS = require('exceljs');
const DataValidator = require('../services/dataValidator');
const LocationService = require('../services/locationService');
const { normalizeText } = require('../utils/textNormalize');

// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;

//     try {
//         console.log("--- 1. File Received ---", req.file.originalname);
//         const workbook = xlsx.readFile(filePath);
//         const rawResults = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

//         console.log("--- 2. Raw Rows Found ---", rawResults.length);

//         const finalResults = rawResults.map((row, index) => {
//             const normalizedRow = {};
//             Object.keys(row).forEach(key => {
//                 const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ''); 
//                 normalizedRow[cleanKey] = row[key];
//             });

//             const name = normalizedRow['name']; 
//             const email = normalizedRow['email'];
            
//             if (!name || !email) {
//                 console.log(`⚠️ Row ${index + 1} Skipped: Name/Email missing in Excel columns`);
//                 return null;
//             }

//             return {
//                 srNo: String(normalizedRow['srno'] || index + 1),
//                 date: normalizedRow['date'] || new Date().toISOString().split('T')[0],
//                 location: normalizedRow['location'] || 'N/A',
//                 position: normalizedRow['position'] || 'General', 
//                 fls: String(normalizedRow['flsnonfls'] || '').trim(),
//                 name: String(name).trim(),
//                 contact: String(normalizedRow['contactno'] || normalizedRow['contact'] || `Pending_${index}`).trim(), 
//                 email: String(email).trim().toLowerCase(),
//                 companyName: normalizedRow['companyname'] || '',
//                 experience: String(normalizedRow['experience'] || '0'),
//                 ctc: String(normalizedRow['ctc'] || ''),
//                 expectedCtc: String(normalizedRow['expectedctc'] || ''),
//                 noticePeriod: String(normalizedRow['noticeperiod'] || ''),
//                 status: normalizedRow['status'] || 'Applied',
//                 source: normalizedRow['sourceofcv'] || 'Excel Import'
//             };
//         }).filter(item => item !== null);

//         console.log("--- 3. Final Processed Count ---", finalResults.length);
//         console.log("--- 🔍 Sample Data to Save ---", finalResults[0]); // Check karega data kaisa dikh raha hai

//         if (finalResults.length > 0) {
//             try {
//                 // BulkWrite use kar rahe hain debugger ke saath
//                 const bulkOps = finalResults.map(doc => ({
//                     updateOne: {
//                         filter: { email: doc.email },
//                         update: { $set: doc },
//                         upsert: true
//                     }
//                 }));

//                 const result = await Candidate.bulkWrite(bulkOps);
                
//                 console.log("--- 4. DB Write Result ---");
//                 console.log("New Inserted:", result.upsertedCount);
//                 console.log("Updated Existing:", result.modifiedCount);
//                 console.log("Already Matched:", result.matchedCount);

//                 const successCount = result.upsertedCount + result.modifiedCount + result.matchedCount;

//                 if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//                 return res.status(200).json({ 
//                     success: true, 
//                     message: `✅ ${successCount} Candidates processed!` 
//                 });

//             } catch (dbErr) {
//                 console.error("--- ❌ DATABASE REJECTED DATA ---");
//                 console.error("Error Message:", dbErr.message);
                
//                 // Agar validation error hai (e.g. Mobile number required)
//                 if (dbErr.errors) {
//                     Object.keys(dbErr.errors).forEach(key => {
//                         console.error(`Validation Failed for: ${key} -> ${dbErr.errors[key].message}`);
//                     });
//                 }
                
//                 // Agar Duplicate Key error hai (Code 11000)
//                 if (dbErr.code === 11000) {
//                     console.error("Duplicate Key Error Details:", JSON.stringify(dbErr.keyValue));
//                 }

//                 if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//                 return res.status(400).json({ success: false, message: "DB Error: " + dbErr.message });
//             }
//         } else {
//             console.log("--- ❌ No valid data after mapping ---");
//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//             return res.status(400).json({ message: "No valid data found in Excel" });
//         }

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         console.error("--- ❌ CRITICAL SYSTEM ERROR ---", err);
//         res.status(500).json({ success: false, message: "System Error: " + err.message });
//     }
// };

// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;

//     try {
//         console.log("--- 1. File Received ---", req.file.originalname);
//         const workbook = xlsx.readFile(filePath);
//         const sheetName = workbook.SheetNames[0];
//         const rawResults = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

//         console.log("--- 2. Raw Rows Found in Excel ---", rawResults.length);

//         const finalResults = rawResults.map((row, index) => {
//             const normalizedRow = {};
//             Object.keys(row).forEach(key => {
//                 // Header cleaning: Spaces aur dots hatao
//                 const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ''); 
//                 normalizedRow[cleanKey] = row[key];
//             });

//             // Mapping Headers (Aapki sheet ke hisaab se)
//             const name = normalizedRow['name'] || normalizedRow['candidate']; 
//             let email = normalizedRow['email'] || normalizedRow['emailid'];
//             const contact = normalizedRow['contactno'] || normalizedRow['contact'];

//             // Validation: Agar name hi nahi hai toh skip karo
//             if (!name) {
//                 if(index < 10) console.log(`⚠️ Row ${index + 2} skipped: Name column missing.`);
//                 return null;
//             }

//             // Email cleaning: Agar email "NA" hai ya galat hai, toh use unique dummy banao taaki upload ho jaye
//             const emailStr = String(email || '').trim().toLowerCase();
//             const finalEmail = (emailStr && emailStr.includes('@')) 
//                 ? emailStr 
//                 : `pending_${index}_${Date.now()}@ats.com`;

//             // Date processing: Excel numbers (45914) ko sahi date mein badlo
//             let finalDate = normalizedRow['date'];
//             if (typeof finalDate === 'number') {
//                 finalDate = new Date((finalDate - 25569) * 86400 * 1000).toISOString().split('T')[0];
//             }

//             return {
//                 srNo: String(normalizedRow['srno'] || index + 1),
//                 date: finalDate || new Date().toISOString().split('T')[0],
//                 location: String(normalizedRow['location'] || 'N/A').trim(),
//                 position: String(normalizedRow['position'] || 'General').trim(), 
//                 fls: String(normalizedRow['flsnonfls'] || '').trim(),
//                 name: String(name).trim(),
//                 contact: contact ? String(contact).trim() : 'N/A', 
//                 email: finalEmail,
//                 companyName: String(normalizedRow['companyname'] || '').trim(),
//                 experience: String(normalizedRow['experience'] || '0'),
//                 ctc: String(normalizedRow['ctc'] || ''),
//                 expectedCtc: String(normalizedRow['expectedctc'] || ''),
//                 noticePeriod: String(normalizedRow['noticeperiod'] || ''),
//                 status: String(normalizedRow['status'] || 'Applied').trim(),
//                 source: String(normalizedRow['sourceofcv'] || 'Excel Import').trim()
//             };
//         }).filter(item => item !== null);

//         console.log("--- 3. Final Processed Count ---", finalResults.length);

//         if (finalResults.length > 0) {
//             // BulkWrite with UPSERT (Email match hua toh update, nahi toh insert)
//             const bulkOps = finalResults.map(doc => ({
//                 updateOne: {
//                     filter: { email: doc.email },
//                     update: { $set: doc },
//                     upsert: true
//                 }
//             }));

//             // Large files ke liye batch processing (Optional but recommended for 15k+)
//             const result = await Candidate.bulkWrite(bulkOps, { ordered: false });
            
//             console.log("--- 4. DB Success ---");
//             console.log("Total Records in File:", finalResults.length);
//             console.log("Newly Added:", result.upsertedCount);
//             console.log("Updated/Matched:", result.modifiedCount + result.matchedCount);
            
//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            
//             return res.status(200).json({ 
//                 success: true, 
//                 message: `✅ ${finalResults.length} Candidates processed successfully!` 
//             });
//         } else {
//             throw new Error("No valid data found. Check if 'Name' column exists.");
//         }

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         console.error("--- ❌ CRITICAL ERROR ---", err.message);
//         res.status(500).json({ success: false, message: "Error: " + err.message });
//     }
// };

// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;

//     try {
//         console.log("--- 1. File Received ---", req.file.originalname);

//         // ✅ UPDATED: Optimized reading to prevent 'Out of Memory'
//         const workbook = xlsx.readFile(filePath, { 
//             cellDates: true, 
//             cellFormula: false, 
//             cellHTML: false, 
//             cellText: false 
//         });

//         const sheetName = workbook.SheetNames[0];
//         const rawResults = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

//         console.log("--- 2. Raw Rows Found in Excel ---", rawResults.length);

//         const finalResults = rawResults.map((row, index) => {
//             const normalizedRow = {};
//             Object.keys(row).forEach(key => {
//                 // Header cleaning
//                 const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ''); 
//                 normalizedRow[cleanKey] = row[key];
//             });

//             // ✅ UPDATED: Added more flexible name mapping
//             const name = normalizedRow['name'] || normalizedRow['candidate'] || normalizedRow['candidatename']; 
//             let email = normalizedRow['email'] || normalizedRow['emailid'] || normalizedRow['mail'];
//             const contact = normalizedRow['contactno'] || normalizedRow['contact'] || normalizedRow['phone'];

//             // Validation: Skip if name is missing
//             if (!name) {
//                 if(index < 5) console.log(`⚠️ Row ${index + 2} skipped: Name missing.`);
//                 return null;
//             }

//             const emailStr = String(email || '').trim().toLowerCase();
//             const finalEmail = (emailStr && emailStr.includes('@')) 
//                 ? emailStr 
//                 : `pending_${index}_${Date.now()}@ats.com`;

//             // Date processing
//             let finalDate = normalizedRow['date'];
//             if (typeof finalDate === 'number') {
//                 finalDate = new Date((finalDate - 25569) * 86400 * 1000).toISOString().split('T')[0];
//             }

//             return {
//                 srNo: String(normalizedRow['srno'] || index + 1),
//                 date: finalDate || new Date().toISOString().split('T')[0],
//                 location: String(normalizedRow['location'] || 'N/A').trim(),
//                 position: String(normalizedRow['position'] || 'General').trim(), 
//                 fls: String(normalizedRow['flsnonfls'] || '').trim(),
//                 name: String(name).trim(),
//                 contact: contact ? String(contact).trim() : 'N/A', 
//                 email: finalEmail,
//                 companyName: String(normalizedRow['companyname'] || '').trim(),
//                 experience: String(normalizedRow['experience'] || '0'),
//                 ctc: String(normalizedRow['ctc'] || ''),
//                 expectedCtc: String(normalizedRow['expectedctc'] || ''),
//                 noticePeriod: String(normalizedRow['noticeperiod'] || ''),
//                 status: String(normalizedRow['status'] || 'Applied').trim(),
//                 source: String(normalizedRow['sourceofcv'] || 'Excel Import').trim()
//             };
//         }).filter(item => item !== null);

//         console.log("--- 3. Final Processed Count ---", finalResults.length);

//         if (finalResults.length > 0) {
//             // ✅ UPDATED: Batching records for better DB performance
//             const bulkOps = finalResults.map(doc => ({
//                 updateOne: {
//                     filter: { email: doc.email },
//                     update: { $set: doc },
//                     upsert: true
//                 }
//             }));

//             const result = await Candidate.bulkWrite(bulkOps, { ordered: false });
            
//             console.log("--- 4. DB Success ---");
//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            
//             return res.status(200).json({ 
//                 success: true, 
//                 message: `✅ ${finalResults.length} Candidates processed successfully!` 
//             });
//         } else {
//             throw new Error("No valid data found. Check your Excel headers.");
//         }

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         console.error("--- ❌ CRITICAL ERROR ---", err);
//         res.status(500).json({ success: false, message: "Error: " + err.message });
//     }
// };

 

// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;

//     try {
//         console.log("--- 1. File Received (Streaming Mode) ---", req.file.originalname);
        
//         const workbook = new ExcelJS.Workbook();
//         await workbook.xlsx.readFile(filePath);
//         const worksheet = workbook.getWorksheet(1); // Pehli sheet uthayi

//         const finalResults = [];
//         const headers = [];

//         // Headers detect karein
//         worksheet.getRow(1).eachCell((cell, colNumber) => {
//             headers[colNumber] = cell.value.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
//         });

//         // Rows read karein (Skip first row as it's header)
//         worksheet.eachRow((row, rowNumber) => {
//             if (rowNumber === 1) return;

//             const rowData = {};
//             row.eachCell((cell, colNumber) => {
//                 rowData[headers[colNumber]] = cell.value;
//             });

//             // Mapping (Same as before)
//             const name = rowData['name'] || rowData['candidate'] || rowData['candidatename'];
//             const email = rowData['email'] || rowData['emailid'] || rowData['mail'];

//             if (name) {
//                 const finalEmail = (email && String(email).includes('@')) 
//                     ? String(email).trim().toLowerCase() 
//                     : `pending_${rowNumber}_${Date.now()}@ats.com`;

//                 finalResults.push({
//                     name: String(name).trim(),
//                     email: finalEmail,
//                     location: String(rowData['location'] || 'N/A'),
//                     position: String(rowData['position'] || 'General'),
//                     contact: rowData['contactno'] || rowData['contact'] || 'N/A',
//                     date: rowData['date'] instanceof Date ? rowData['date'].toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
//                     status: 'Applied'
//                 });
//             }
//         });

//         console.log("--- 2. Rows Processed ---", finalResults.length);

//         if (finalResults.length > 0) {
//             const bulkOps = finalResults.map(doc => ({
//                 updateOne: {
//                     filter: { email: doc.email },
//                     update: { $set: doc },
//                     upsert: true
//                 }
//             }));

//             await Candidate.bulkWrite(bulkOps, { ordered: false });
//             console.log("--- 3. DB Upload Success ---");

//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//             return res.status(200).json({ success: true, message: `✅ ${finalResults.length} Records Uploaded!` });
//         } else {
//             throw new Error("No valid data found in Excel.");
//         }

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         console.error("--- ❌ ERROR ---", err);
//         res.status(500).json({ success: false, message: err.message });
//     }
// };
// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;

//     try {
//         console.log("--- 1. File Received ---", req.file.originalname);
        
//         const workbook = new ExcelJS.Workbook();
//         await workbook.xlsx.readFile(filePath);
//         const worksheet = workbook.getWorksheet(1);

//         const finalResults = [];
//         const headers = [];

//         // Headers detect karein aur clean karein
//         worksheet.getRow(1).eachCell((cell, colNumber) => {
//             // "Contact no." becomes "contactno"
//             headers[colNumber] = cell.value.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
//         });

//         worksheet.eachRow((row, rowNumber) => {
//             if (rowNumber === 1) return;

//             const rowData = {};
//             row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
//                 rowData[headers[colNumber]] = cell.value;
//             });

//             const name = rowData['name'] || rowData['candidate'];
//             const email = rowData['email'];
//             const rawContact = rowData['contactno'] || rowData['contact'];
//             const contact = rawContact ? String(rawContact).trim() : null;

//             if (name) {
//                 // --- 1. DATE FIX LOGIC ---
//                 let finalDate = new Date().toISOString().split('T')[0];
//                 let rawDate = rowData['date'];

//                 if (rawDate) {
//                     if (rawDate instanceof Date) {
//                         finalDate = rawDate.toISOString().split('T')[0];
//                     } else if (!isNaN(rawDate)) {
//                         // Excel serial number (e.g., 45914) to JS Date conversion
//                         const convertedDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
//                         finalDate = convertedDate.toISOString().split('T')[0];
//                     }
//                 }

//                 const finalEmail = (email && String(email).includes('@')) 
//                     ? String(email).trim().toLowerCase() 
//                     : `pending_${rowNumber}_${Date.now()}@ats.com`;

//                 finalResults.push({
//                     name: String(name).trim(),
//                     email: finalEmail,
//                     location: String(rowData['location'] || 'N/A'),
//                     position: String(rowData['position'] || 'General'),
//                     contact: contact || 'N/A',
//                     date: finalDate, // Ab ye "45914" nahi, sahi date dikhayega
//                     status: 'Applied'
//                 });
//             }
//         });

//         console.log("--- 2. Rows Processed ---", finalResults.length);

//         if (finalResults.length > 0) {
//             // --- 2. DUPLICATE ERROR FIX ---
//             // Aapke screenshot mein "contact_1" duplicate error hai.
//             // Hum filter mein email OR contact dono check karenge.
//             const bulkOps = finalResults.map(doc => ({
//                 updateOne: {
//                     filter: { 
//                         $or: [
//                             { email: doc.email },
//                             { contact: doc.contact !== 'N/A' ? doc.contact : 'unique_dummy_non_existent' }
//                         ]
//                     },
//                     update: { $set: doc },
//                     upsert: true
//                 }
//             }));

//             await Candidate.bulkWrite(bulkOps, { ordered: false });
//             console.log("--- 3. DB Upload Success ---");

//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//             return res.status(200).json({ success: true, message: `✅ ${finalResults.length} Records Uploaded/Updated!` });
//         } else {
//             throw new Error("No valid data found in Excel.");
//         }

//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         console.error("--- ❌ ERROR ---", err);
//         // User ko saaf error message bhejein
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

// exports.bulkUploadCandidates = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: "No file uploaded." });
//     const filePath = req.file.path;

//     try {
//         const workbook = new ExcelJS.Workbook();
//         await workbook.xlsx.readFile(filePath);
//         const worksheet = workbook.getWorksheet(1);

//         const finalResults = [];
//         const headerMap = {};

//         // 1. Sabhi Headers ko identify karein (Client aur FLS status ke saath)
//         const firstRow = worksheet.getRow(1);
//         firstRow.eachCell((cell, colNumber) => {
//             const header = cell.value ? cell.value.toString().toLowerCase().trim() : "";
            
//             if (header.includes("name")) headerMap["name"] = colNumber;
//             if (header.includes("email")) headerMap["email"] = colNumber;
//             if (header.includes("contact") || header.includes("mobile")) headerMap["contact"] = colNumber;
//             if (header.includes("location")) headerMap["location"] = colNumber;
//             if (header.includes("position")) headerMap["position"] = colNumber;
//             if (header.includes("company")) headerMap["company"] = colNumber;
//             if (header.includes("experience") || header.includes("exp")) headerMap["experience"] = colNumber;
//             if (header === "ctc") headerMap["ctc"] = colNumber;
//             if (header.includes("notice")) headerMap["notice"] = colNumber;
//             if (header.includes("date")) headerMap["date"] = colNumber;
            
//             // Nayi Fields Mapping:
//             if (header.includes("client")) headerMap["client"] = colNumber;
//             if (header.includes("fls")) headerMap["flsStatus"] = colNumber; // FLS/Non FLS column
//         });

//         worksheet.eachRow((row, rowNumber) => {
//             if (rowNumber === 1) return; // Skip Header

//             const name = row.getCell(headerMap["name"] || 0).value;
//             if (name) {
//                 // Date logic (Excel Serial to JS Date)
//                 let rawDate = row.getCell(headerMap["date"] || 0).value;
//                 let finalDate = new Date().toISOString().split('T')[0];
//                 if (rawDate && !isNaN(rawDate)) {
//                     finalDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
//                 }

//                 // Email fallback
//                 const emailCell = row.getCell(headerMap["email"] || 0).value;
//                 const finalEmail = (emailCell && String(emailCell).includes('@')) 
//                     ? String(emailCell).trim().toLowerCase() 
//                     : `pending_${rowNumber}_${Date.now()}@ats.com`;

//                 finalResults.push({
//                     name: String(name).trim(),
//                     email: finalEmail,
//                     contact: String(row.getCell(headerMap["contact"] || 0).value || 'N/A').trim(),
//                     location: String(row.getCell(headerMap["location"] || 0).value || 'N/A'),
//                     position: String(row.getCell(headerMap["position"] || 0).value || 'N/A'),
//                     companyName: String(row.getCell(headerMap["company"] || 0).value || 'N/A'),
//                     experience: String(row.getCell(headerMap["experience"] || 0).value || '0'),
//                     ctc: String(row.getCell(headerMap["ctc"] || 0).value || '0'),
//                     noticePeriod: String(row.getCell(headerMap["notice"] || 0).value || 'N/A'),
//                     date: finalDate,
                    
//                     // Dashboard pe ye dikhane ke liye:
//                     client: String(row.getCell(headerMap["client"] || 0).value || 'N/A'),
//                     flsStatus: String(row.getCell(headerMap["flsStatus"] || 0).value || 'N/A'),
                    
//                     status: 'Applied'
//                 });
//             }
//         });

//         if (finalResults.length > 0) {
//             const bulkOps = finalResults.map(doc => ({
//                 updateOne: {
//                     filter: { 
//                         $or: [
//                             { email: doc.email },
//                             { contact: doc.contact !== 'N/A' ? doc.contact : `dummy_${Math.random()}` }
//                         ]
//                     },
//                     update: { $set: doc },
//                     upsert: true
//                 }
//             }));

//             await Candidate.bulkWrite(bulkOps, { ordered: false });
//             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//             return res.status(200).json({ success: true, message: `✅ ${finalResults.length} Records (including Client & FLS) Uploaded!` });
//         }
//     } catch (err) {
//         if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
//         res.status(500).json({ success: false, message: err.message });
//     }
// };

// 🔥 AUTO-DETECT EXCEL HEADERS - No manual mapping needed!
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

exports.bulkUploadCandidates = async (req, res) => {
    console.log("[BULK-UPLOAD] Starting validation and review process");
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
        } = require('../utils/globalValidation');

        console.log("[BULK-UPLOAD] Reading file:", req.file.originalname);

        // Parse column mapping from frontend if provided
        let userMapping = null;
        if (req.body.columnMapping) {
            try {
                userMapping = JSON.parse(req.body.columnMapping);
            } catch (parseErr) {
                userMapping = null;
            }
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
                console.log(`[BULK-UPLOAD] Pre-loaded ${existingEmails.size} existing emails, ${existingPhones.size} existing phones for duplicate check`);
            } catch (dbErr) {
                console.warn("[BULK-UPLOAD] Could not pre-load DB records for duplicate check:", dbErr.message);
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
            if (userMapping && Object.keys(userMapping).length > 0) {
                // Use user-provided mapping
                smartHeaderMap = {};
                Object.entries(userMapping).forEach(([excelColumnIndex, fieldName]) => {
                    if (!fieldName || fieldName === '') return;
                    const colIdx = parseInt(excelColumnIndex, 10);
                    if (colIdx >= 0 && colIdx < headers.length) {
                        smartHeaderMap[fieldName] = colIdx;
                    }
                });
            } else {
                // Auto-detect header mapping
                smartHeaderMap = detectHeaderMapping(headers);
            }

            const useSmartHeaders = Object.keys(smartHeaderMap).length >= 2;
            console.log(`[BULK-UPLOAD] Sheet "${sheetName}": ${useSmartHeaders ? 'HEADER-BASED' : 'CONTENT-BASED'} mapping (${Object.keys(smartHeaderMap).length} fields detected)`);
            if (useSmartHeaders) {
                console.log(`[BULK-UPLOAD] Mapped fields:`, Object.entries(smartHeaderMap).map(([f, i]) => `${f}→col${i}("${headers[i]}")`).join(', '));
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
                    console.error(`[BULK-UPLOAD] Error processing row ${totalRows}:`, rowErr.message);
                    continue;
                }
            }
        }

        console.log(`[BULK-UPLOAD] Total: ${totalRows}, Ready: ${readyCount}, Review: ${reviewCount}, Blocked: ${blockedCount}, DB Duplicates: ${duplicateDbCount}`);

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
        console.error("[BULK-UPLOAD] ERROR:", err.message, err.stack);
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
exports.revalidateRecord = async (req, res) => {
    try {
        const { record } = req.body;
        
        if (!record) {
            return res.status(400).json({ success: false, message: "No record provided" });
        }

        const {
            validateCandidate,
            autoFix
        } = require('../utils/globalValidation');

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

        console.log(`🔄 [REVALIDATE] Category: ${validation.category}, Confidence: ${validation.confidence}`);

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
        console.error("❌ [REVALIDATE] ERROR:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Import reviewed & fixed candidates to database
exports.importReviewedCandidates = async (req, res) => {
    try {
        const { readyRecords, reviewRecords } = req.body;
        
        const recordsToImport = [
            ...(Array.isArray(readyRecords) ? readyRecords : []),
            ...(Array.isArray(reviewRecords) ? reviewRecords : [])
        ];

        if (!Array.isArray(recordsToImport) || recordsToImport.length === 0) {
            console.log("⚠️  [IMPORT] No ready records provided");
            return res.json({
                success: true,
                imported: 0,
                message: "No ready records to import"
            });
        }

        console.log(`💾 [IMPORT] Importing ${readyRecords?.length || 0} ready + ${reviewRecords?.length || 0} review records`);
        console.log(`📝 [IMPORT] First record structure:`, JSON.stringify(recordsToImport[0], null, 2));

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
                    console.warn(`⚠️  [IMPORT] Record ${idx} has no email, skipping`);
                    return null;
                }
                
                // Clean up validation metadata
                delete processed.validation;
                delete processed.rowIndex;
                delete processed.autoFixChanges;
                delete processed.original;
                delete processed.duplicates;
                
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
                    console.warn(`⚠️  [IMPORT] Record ${idx} has no email, skipping`);
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
            console.error("❌ [IMPORT] All records filtered out (missing required fields)");
            return res.status(400).json({ 
                success: false, 
                message: "No valid records to import (all missing required fields)" 
            });
        }

        console.log(`✅ [IMPORT] Processed ${processedRecords.length} valid records (${recordsToImport.length - processedRecords.length} filtered)`);

        // ✅ Stamp ownership on every imported record
        const userId = req.user.id;
        processedRecords.forEach(doc => { doc.createdBy = userId; });

        // Build bulk operations for MongoDB - scoped by user + email
        const bulkOps = processedRecords.map(doc => {
            return {
                updateOne: {
                    filter: { email: doc.email, createdBy: userId },
                    update: { $set: doc },
                    upsert: true
                }
            };
        });

        console.log(`📤 [IMPORT] Executing bulkWrite with ${bulkOps.length} operations...`);
        console.log(`📄 [IMPORT] Sample bulk op:`, JSON.stringify(bulkOps[0], null, 2));

        const dbResult = await Candidate.bulkWrite(bulkOps, { ordered: false });
        const importedCount = (dbResult.upsertedCount || 0) + (dbResult.modifiedCount || 0);

        console.log(`✅ [IMPORT] Database result:`, {
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
        console.error("❌ [IMPORT] CRITICAL ERROR:", error.message);
        console.error("❌ [IMPORT] Stack:", error.stack);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCandidate = async (req, res) => {
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
        if (req.file) {
            const s3Service = require('../services/s3Service');
            const path = require('path');
            const fs = require('fs');
            const filePath = (req.file.path && fs.existsSync(req.file.path))
                ? req.file.path
                : (fs.existsSync(path.join(process.cwd(), 'uploads', req.file.filename))
                    ? path.join(process.cwd(), 'uploads', req.file.filename)
                    : path.join(__dirname, '..', 'uploads', req.file.filename));
            console.log('[Resume] Saving resume — storage: S3 if configured, else local');
            const uploaded = s3Service.uploadResumeFromFile(filePath, req.file.originalname);
            if (uploaded && uploaded.key) {
                req.body.resume = uploaded.key;
                console.log('[Resume] ✅ Stored in S3 — bucket:', process.env.S3_BUCKET_NAME, ', folder: resumes/, key:', uploaded.key);
            } else {
                req.body.resume = `/uploads/${req.file.filename}`;
                console.log('[Resume] Stored locally (S3 not used) — path: uploads/' + req.file.filename);
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

        const LocationService = require('../services/locationService');

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
        console.error('bulkCreateFromParsed error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

exports.updateCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        if (typeof req.body.statusHistory === 'string') {
            try { req.body.statusHistory = JSON.parse(req.body.statusHistory); } 
            catch (e) { req.body.statusHistory = []; }
        }
        if (req.file) {
            const s3Service = require('../services/s3Service');
            const path = require('path');
            const fs = require('fs');
            const filePath = (req.file.path && fs.existsSync(req.file.path))
                ? req.file.path
                : (fs.existsSync(path.join(process.cwd(), 'uploads', req.file.filename))
                    ? path.join(process.cwd(), 'uploads', req.file.filename)
                    : path.join(__dirname, '..', 'uploads', req.file.filename));
            console.log('[Resume] Saving resume (update) — storage: S3 if configured, else local');
            const uploaded = s3Service.uploadResumeFromFile(filePath, req.file.originalname);
            if (uploaded && uploaded.key) {
                req.body.resume = uploaded.key;
                console.log('[Resume] ✅ Stored in S3 — bucket:', process.env.S3_BUCKET_NAME, ', folder: resumes/, key:', uploaded.key);
            } else {
                req.body.resume = `/uploads/${req.file.filename}`;
                console.log('[Resume] Stored locally (S3 not used) — path: uploads/' + req.file.filename);
            }
        }

        // ✅ Auto-detect state from location if location is being updated
        if (req.body.location && !req.body.state) {
            req.body.state = LocationService.detectState(req.body.location);
        }

        // ✅ Normalize text fields (Title Case + single spaces)
        const textFields = ['name', 'position', 'companyName', 'location', 'client', 'spoc', 'source', 'noticePeriod', 'fls', 'remark'];
        textFields.forEach(f => { if (req.body[f] && typeof req.body[f] === 'string') req.body[f] = normalizeText(req.body[f]); });

        // Enterprise: any authenticated user can update any candidate. Do not allow changing ownership.
        const { createdBy, _id, __v, ...safeBody } = req.body;
        const updatedCandidate = await Candidate.findOneAndUpdate(
            { _id: id },
            { $set: safeBody },
            { new: true, runValidators: true }
        );
        if (!updatedCandidate) return res.status(404).json({ success: false, message: "Candidate not found" });
        res.status(200).json({ success: true, message: "Updated Successfully", data: updatedCandidate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ Share candidate with team members (request-based workflow with notifications + email)
exports.shareCandidate = async (req, res) => {
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
        const Notification = require('../models/Notification');
        
        // Verify all candidates belong to the logged-in user
        const candidates = await Candidate.find({ _id: { $in: ids }, createdBy: userId });
        if (candidates.length !== ids.length) {
            return res.status(404).json({ 
                success: false, 
                message: "One or more candidates not found or access denied" 
            });
        }

        const TeamMember = require('../models/TeamMember');
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
                    console.error('Failed to create share notification:', notifErr.message);
                }
            }

            // Send email notification
            try {
                const { sendEmail } = require('../services/emailService');
                const appUrl = process.env.FRONTEND_URL || 'https://skillnix.vercel.app';
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
                
                await sendEmail(member.email, `${sharerName} shared ${candidateLabel} with you - SkillNix`, htmlBody, textBody, { userId });
            } catch (emailErr) {
                console.error(`Failed to send share email to ${member.email}:`, emailErr.message);
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
        console.error('Error sharing candidate:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error sharing candidate", 
            error: error.message 
        });
    }
};

// Import shared candidates into current user's database (copy as own candidates)
exports.importSharedCandidates = async (req, res) => {
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
        console.error('Import shared error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

// Import all candidates (from database) into current user's list (copy as own). Skips already-owned.
exports.importAllToMine = async (req, res) => {
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
        console.error('Import all to mine error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};