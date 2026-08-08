const mongoose = require('mongoose');
const Candidate = require('../../models/Candidate');
const logger = require('../../utils/logger');
const {
    validateAndFixEmail,
    validateAndFixMobile,
    validateAndFixName,
    is100PercentCorrect,
} = require('./candidateValidation');

async function listCandidates(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const rawLimit = req.query.limit;
        const parsedLimit = rawLimit === 'all' ? 0 : parseInt(rawLimit, 10);
        const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
        const shouldPaginate = limit > 0;
        const skip = shouldPaginate ? (page - 1) * limit : 0;
        const search = (req.query.search || '').trim();
        const position = (req.query.position || '').trim();
        const location = (req.query.location || '').trim();
        const companyName = (req.query.companyName || '').trim();

        // Get raw string values for text field searches BEFORE fetching candidates
        const ctcMinStr = (req.query.ctcMin || '').trim();
        const ctcMaxStr = (req.query.ctcMax || '').trim();
        const expectedCtcMinStr = (req.query.expectedCtcMin || '').trim();
        const expectedCtcMaxStr = (req.query.expectedCtcMax || '').trim();

        // Try to parse as numbers for range queries
        const expMin = parseFloat(req.query.expMin);
        const expMax = parseFloat(req.query.expMax);
        const ctcMinNum = parseFloat(ctcMinStr);
        const ctcMaxNum = parseFloat(ctcMaxStr);
        const expectedCtcMinNum = parseFloat(expectedCtcMinStr);
        const expectedCtcMaxNum = parseFloat(expectedCtcMaxStr);

        // Determine if we have numeric or text field filters
        const hasNumericCTC = !isNaN(ctcMinNum) || !isNaN(ctcMaxNum);
        const hasNumericExpectedCTC = !isNaN(expectedCtcMinNum) || !isNaN(expectedCtcMaxNum);
        const hasTextCTC = ctcMinStr && isNaN(ctcMinNum);
        const hasTextExpectedCTC = expectedCtcMinStr && isNaN(expectedCtcMinNum);

        const hasRangeFilter =
            !isNaN(expMin) || !isNaN(expMax) ||
            hasNumericCTC || hasNumericExpectedCTC ||
            hasTextCTC || hasTextExpectedCTC;

        // Detect if ANY filter is active
        const hasAnyFilter = search || position || location || companyName || hasRangeFilter;

        // Build MongoDB filter - scope by the logged-in user (own + shared with me)
        const viewMode = (req.query.view || '').trim();
        const userIdRaw = req.user && req.user.id;
        if (!userIdRaw) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const userIdStr = String(userIdRaw).trim();
        let userIdObj = null;
        try {
            if (userIdStr.length === 24 && /^[a-fA-F0-9]+$/.test(userIdStr)) {
                userIdObj = new mongoose.Types.ObjectId(userIdStr);
            }
        } catch (objErr) {
            logger.warn('⚠️ Failed to create ObjectId:', objErr.message);
        }

        // Own + shared filter: match both ObjectId and string so we never miss (DB can store either)
        let filter;
        try {
            const createdByClause = userIdObj
                ? { createdBy: { $in: [userIdObj, userIdStr] } }
                : { createdBy: userIdStr };
            const sharedClause = userIdObj
                ? { 'sharedWith.userId': { $in: [userIdObj, userIdStr] } }
                : { 'sharedWith.userId': userIdStr };

            if (viewMode === 'all') {
                // All users in the SAME organization can see all candidates in
                // that org — but never across organizations. Without this
                // scope, view=all previously returned every candidate in the
                // entire database regardless of tenant.
                filter = req.user.organizationId ? { organizationId: req.user.organizationId } : createdByClause;
                Candidate.countDocuments(filter).then(n => logger.info('📊 Backend Query - view=all, org-scoped total:', n)).catch(() => {});
            } else if (viewMode === 'shared') {
                filter = sharedClause;
            } else {
                // 'mine' or default: own + shared with me
                filter = { $or: [createdByClause, sharedClause] };
            }
        } catch (filterErr) {
            logger.error('⚠️ Error building filter:', filterErr.message);
            filter = {};
        }

        let usedStringFallback = false;
        let usedOrphanFallback = false;
        let orphanCountForTotal = 0;

        // Fetch candidates with error handling
        let candidates = [];
        try {
            let candidatesQuery = Candidate.find(filter).sort({ createdAt: -1 }).lean();
            if (shouldPaginate && !hasAnyFilter) {
                candidatesQuery = candidatesQuery.limit(limit).skip(skip);
            }
            candidates = await candidatesQuery;
            logger.info(`📊 Backend Query - filter matched ${candidates.length} records`);
        } catch (queryErr) {
            logger.error('❌ Database query error:', queryErr.message);
            // Fallback 1: only use user filter when NOT view=all (for view=all we must not limit to current user)
            if (viewMode !== 'all') {
                try {
                    const stringFilter = { createdBy: userIdStr };
                    let stringQuery = Candidate.find(stringFilter).sort({ createdAt: -1 }).lean();
                    if (shouldPaginate && !hasAnyFilter) {
                        stringQuery = stringQuery.limit(limit).skip(skip);
                    }
                    candidates = await stringQuery;
                    if (candidates.length > 0) usedStringFallback = true;
                    logger.info(`📊 Backend Query - fallback matched ${candidates.length} records by string`);
                } catch (fallbackErr) {
                    logger.error('❌ Fallback query also failed:', fallbackErr.message);
                    candidates = [];
                }
            } else {
                candidates = [];
            }
        }

        // If main query returned 0 (no throw), try createdBy as string — only when NOT view=all
        if (candidates.length === 0 && viewMode !== 'shared' && viewMode !== 'all' && !usedStringFallback) {
            try {
                const stringFilter = { createdBy: userIdStr };
                let stringQuery = Candidate.find(stringFilter).sort({ createdAt: -1 }).lean();
                if (shouldPaginate && !hasAnyFilter) {
                    stringQuery = stringQuery.limit(limit).skip(skip);
                }
                candidates = await stringQuery;
                if (candidates.length > 0) usedStringFallback = true;
                if (candidates.length > 0) logger.info(`📊 Backend Query - matched ${candidates.length} by createdBy string`);
            } catch (e) {
                logger.warn('⚠️ String fallback failed:', e.message);
            }
        }

        // Fallback 2: if still 0, include orphan/legacy records (no createdBy) — for view=all we already did find({})
        if (candidates.length === 0 && viewMode !== 'shared' && viewMode !== 'all') {
            try {
                const orphanFilter = { $or: [{ createdBy: { $exists: false } }, { createdBy: null }] };
                orphanCountForTotal = await Candidate.countDocuments(orphanFilter);
                if (orphanCountForTotal > 0) {
                    usedOrphanFallback = true;
                    let orphanQuery = Candidate.find(orphanFilter).sort({ createdAt: -1 }).lean();
                    if (shouldPaginate && !hasAnyFilter) {
                        orphanQuery = orphanQuery.limit(limit).skip(skip);
                    }
                    candidates = await orphanQuery;
                    logger.info(`📊 Backend Query - using ${candidates.length} orphan/legacy candidates`);
                }
            } catch (orphanErr) {
                logger.warn('⚠️ Orphan fallback failed:', orphanErr.message);
            }
        }

        // Mark shared candidates: only those explicitly shared with current user (sharedWith contains userId).
        // This matches import-shared behavior so "Import all to my candidates" only sends importable IDs.
        let ownerIds = new Set();
        try {
            candidates.forEach(c => {
                const sharedWithMe = Array.isArray(c.sharedWith) && c.sharedWith.some(sw => String(sw && sw.userId) === userIdStr);
                c._isShared = !!sharedWithMe;
                if (sharedWithMe && c.createdBy != null && String(c.createdBy) !== '') ownerIds.add(String(c.createdBy));
            });
        } catch (markErr) {
            logger.warn('⚠️ Error marking shared candidates:', markErr.message);
        }

        // Populate owner names for shared candidates (non-blocking: list still returns if this fails)
        if (ownerIds.size > 0) {
            try {
                const User = require('mongoose').model('User');
                const ownerIdList = [...ownerIds];
                const owners = await User.find({ _id: { $in: ownerIdList } }).select('name email').lean();
                const ownerMap = {};
                owners.forEach(o => { ownerMap[String(o._id)] = o.name || o.email; });
                candidates.forEach(c => {
                    if (c._isShared) c._sharedByOwner = ownerMap[String(c.createdBy)] || 'Unknown';
                });
            } catch (ownerErr) {
                logger.warn('⚠️ Shared-by owner lookup failed (candidates still returned):', ownerErr.message);
            }
        }

        logger.info(`📊 Backend Query - hasAnyFilter: ${hasAnyFilter}, returned: ${candidates.length} records`);

        const parseNumber = (value) => {
            if (!value) return null;
            const numbers = String(value).match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length === 0) return null;
            return Math.max(...numbers.map(n => parseFloat(n)));
        };

        // Helper function to extract min and max from a range string like "3L-7L" or "0-50k"
        const parseRangeMinMax = (value) => {
            if (!value) return { min: null, max: null };

            const str = String(value).toLowerCase();
            // Extract all numbers
            const numbers = str.match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length === 0) return { min: null, max: null };

            const nums = numbers.map(n => parseFloat(n));
            return {
                min: Math.min(...nums),
                max: Math.max(...nums)
            };
        };

        const finalCandidates = hasAnyFilter
            ? candidates.filter((c) => {
                // General search - check all searchable fields
                if (search) {
                    const searchLower = search.toLowerCase();
                    const matchesSearch =
                        String(c.name || '').toLowerCase().includes(searchLower) ||
                        String(c.email || '').toLowerCase().includes(searchLower) ||
                        String(c.position || '').toLowerCase().includes(searchLower) ||
                        String(c.companyName || '').toLowerCase().includes(searchLower) ||
                        String(c.contact || '').toLowerCase().includes(searchLower) ||
                        String(c.location || '').toLowerCase().includes(searchLower) ||
                        String(c.spoc || '').toLowerCase().includes(searchLower);
                    if (!matchesSearch) return false;
                }

                // Case-insensitive text filters for position, location, company
                if (position && !String(c.position || '').toLowerCase().includes(position.toLowerCase())) {
                    return false;
                }
                if (location && !String(c.location || '').toLowerCase().includes(location.toLowerCase())) {
                    return false;
                }
                if (companyName && !String(c.companyName || '').toLowerCase().includes(companyName.toLowerCase())) {
                    return false;
                }

                // Range-based filters
                const expVal = parseNumber(c.experience);
                const ctcRange = parseRangeMinMax(c.ctc);
                const expectedCRange = parseRangeMinMax(c.expectedCtc);

                // Experience validation (numeric range)
                if (!isNaN(expMin) && (expVal === null || expVal < expMin)) return false;
                if (!isNaN(expMax) && (expVal === null || expVal > expMax)) return false;

                // CTC validation - numeric range query
                if (hasNumericCTC) {
                    // If candidate has no CTC data, exclude them
                    if (ctcRange.max === null) return false;

                    // Check if ranges overlap or candidate's CTC is within search range
                    if (!isNaN(ctcMinNum) && ctcRange.max < ctcMinNum) return false;
                    if (!isNaN(ctcMaxNum) && ctcRange.min > ctcMaxNum) return false;
                }

                // CTC validation - text field search (like "NA", "Fehe", etc)
                if (hasTextCTC) {
                    const ctcStr = String(c.ctc || '').toLowerCase();
                    const searchStr = ctcMinStr.toLowerCase();
                    if (!ctcStr.includes(searchStr)) return false;
                }

                // Expected CTC validation - numeric range query
                if (hasNumericExpectedCTC) {
                    // If candidate has no Expected CTC data, exclude them
                    if (expectedCRange.max === null) return false;

                    // Check if ranges overlap or candidate's Expected CTC is within search range
                    if (!isNaN(expectedCtcMinNum) && expectedCRange.max < expectedCtcMinNum) return false;
                    if (!isNaN(expectedCtcMaxNum) && expectedCRange.min > expectedCtcMaxNum) return false;
                }

                // Expected CTC validation - text field search
                if (hasTextExpectedCTC) {
                    const expectedCtcStr = String(c.expectedCtc || '').toLowerCase();
                    const searchStr = expectedCtcMinStr.toLowerCase();
                    if (!expectedCtcStr.includes(searchStr)) return false;
                }

                return true;
            })
            : candidates;

        // Get total count for pagination metadata
        const totalCount = hasAnyFilter
            ? finalCandidates.length
            : usedStringFallback
                ? await Candidate.countDocuments({ createdBy: userIdStr })
                : usedOrphanFallback
                    ? orphanCountForTotal
                    : await Candidate.countDocuments(filter);
        const totalPages = shouldPaginate ? Math.ceil(totalCount / limit) : 1;

        // Apply pagination to final candidates if ANY filter was used
        let paginatedCandidates = finalCandidates;
        if (hasAnyFilter && shouldPaginate) {
            paginatedCandidates = finalCandidates.slice(skip, skip + limit);
        } else if (!hasAnyFilter && !shouldPaginate) {
            // If limit=all and no filter, finalCandidates already has all
            paginatedCandidates = finalCandidates;
        }

        res.status(200).json({
            success: true,
            data: paginatedCandidates,
            pagination: {
                currentPage: shouldPaginate ? page : 1,
                totalPages: totalPages,
                totalCount: totalCount,
                pageSize: shouldPaginate ? limit : totalCount,
                hasMore: shouldPaginate ? page < totalPages : false
            }
        });
    } catch (err) {
        logger.error('❌ Error fetching candidates:', err.message, err.stack);
        res.status(500).json({
            success: false,
            message: "Error fetching candidates",
            error: err.message
        });
    }
}

async function getDataQualityAnalytics(req, res) {
    try {
        const allCandidates = await Candidate.find({ createdBy: req.user.id }).lean();
        const totalRecords = allCandidates.length;

        if (totalRecords === 0) {
            return res.status(200).json({
                success: true,
                totalRecords: 0,
                correctly100Percent: 0,
                percentage100Correct: '0%',
                incorrectCount: 0,
                duplicateCount: 0,
                analysis: {
                  correct: [],
                  incorrect: [],
                  duplicates: []
                }
            });
        }

        // ✅ Analyze data: Correct, Incorrect, Duplicates
        let correctCount = 0;
        let incorrectCount = 0;
        let duplicateCount = 0;

        const correctRecords = [];
        const incorrectRecords = [];
        const duplicateRecords = [];

        for (let i = 0; i < allCandidates.length; i++) {
            const c = allCandidates[i];

            // Check if marked as duplicate
            if (c.isDuplicate === true) {
                duplicateCount++;
                duplicateRecords.push({
                  name: c.name,
                  email: c.email,
                  contact: c.contact,
                  reason: 'Marked as duplicate during import'
                });
                continue;
            }

            // Use the simplified 3-field validation
            if (is100PercentCorrect(c)) {
                correctCount++;
                correctRecords.push({
                  name: c.name,
                  email: c.email,
                  contact: c.contact
                });
            } else {
                incorrectCount++;

                // Determine what's wrong
                const emailCheck = validateAndFixEmail(c.email);
                const mobileCheck = validateAndFixMobile(c.contact);
                const nameCheck = validateAndFixName(c.name);

                let issues = [];
                if (!emailCheck.isValid) issues.push('Invalid Email');
                if (!mobileCheck.isValid) issues.push('Invalid Mobile (not 10 digits or not 6-9)');
                if (!nameCheck.isValid) issues.push('Invalid Name (not alphabets)');

                incorrectRecords.push({
                  name: c.name,
                  email: c.email,
                  contact: c.contact,
                  issues: issues.join(', ')
                });
            }
        }

        const percentageCorrect = ((correctCount / totalRecords) * 100).toFixed(2);

        // 📊 LOG TO CONSOLE
        logger.info('\n========== 📊 DATA QUALITY ANALYSIS ==========');
        logger.info(`Total Records in Database: ${totalRecords}`);
        logger.info(`✅ Correct Records: ${correctCount} (${percentageCorrect}%)`);
        logger.info(`❌ Incorrect Records: ${incorrectCount}`);
        logger.info(`⚠️ Duplicate Records: ${duplicateCount}`);
        logger.info('=============================================\n');

        res.status(200).json({
            success: true,
            totalRecords,
            correctly100Percent: correctCount,
            percentage100Correct: percentageCorrect + '%',
            incorrectCount,
            duplicateCount,
            summary: {
                message: `Analysis Complete: ${correctCount} correct, ${incorrectCount} incorrect, ${duplicateCount} duplicates out of ${totalRecords} total`,
                correct_percentage: percentageCorrect,
                correct_count: correctCount,
                incorrect_count: incorrectCount,
                duplicate_count: duplicateCount
            }
        });

    } catch (err) {
        logger.error('Error analyzing data quality:', err);
        res.status(500).json({ success: false, message: "Error analyzing data quality", error: err.message });
    }
}

module.exports = { listCandidates, getDataQualityAnalytics };
