const mongoose = require('mongoose');
const Candidate = require('../../models/Candidate');
const logger = require('../../utils/logger');
const {
    validateAndFixEmail,
    validateAndFixMobile,
    validateAndFixName,
    is100PercentCorrect,
} = require('./candidateValidation');
const {
  candidateListScope,
  isFreelancer,
  canViewOrgAnalytics,
  requestedAnalyticsUserId,
} = require('../../utils/dataScope');
const { applyBlockLettersToObject } = require('../../utils/textNormalize');
const { healCandidateBlockLettersSafe } = require('../../services/candidateCasingHeal');
const { buildDateFilter } = require('../../utils/analyticsTime');
const {
  withActivityDateRange,
  candidateListSortSpec,
  backfillAppliedAtForOrg,
} = require('../../utils/candidateActivityDate');

/** Columns needed by ATS grid / client filters — exclude resumeText, embeddings, histories. */
const CANDIDATE_LIST_SELECT = [
  'srNo', 'date', 'name', 'email', 'contact', 'phone', 'position', 'location', 'state',
  'companyName', 'experience', 'ctc', 'expectedCtc', 'noticePeriod', 'skills', 'product',
  'pan', 'status', 'client', 'spoc', 'source', 'feedback', 'remark', 'callBackDate', 'fls',
  'resume', 'tags', 'customFields', 'createdBy', 'sharedWith', 'organizationId',
  'createdAt', 'updatedAt', 'appliedAt', 'hiredDate', 'legalHold', 'personId', 'talentPoolIds',
].join(' ');

/** At most one orphan organizationId heal per org / 30 minutes (keeps list hot path fast). */
const orphanHealLastByOrg = new Map();
const ORPHAN_HEAL_TTL_MS = 30 * 60 * 1000;

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ciRegex(value) {
  return { $regex: escapeRegex(value), $options: 'i' };
}

function buildSearchClause(search, searchScope) {
  const q = String(search || '').trim();
  if (!q) return null;
  const rx = ciRegex(q);
  const scope = String(searchScope || 'all').trim().toLowerCase();
  if (scope === 'name') return { name: rx };
  if (scope === 'email') return { email: rx };
  if (scope === 'position') return { position: rx };
  if (scope === 'skills') return { skills: rx };
  if (scope === 'product') return { product: rx };
  if (scope === 'spoc') return { spoc: rx };
  if (scope === 'company') return { companyName: rx };
  if (scope === 'client') return { client: rx };
  if (scope === 'location') {
    return { $or: [{ location: rx }, { state: rx }] };
  }
  return {
    $or: [
      { name: rx }, { email: rx }, { position: rx }, { companyName: rx },
      { contact: rx }, { location: rx }, { state: rx }, { spoc: rx },
      { skills: rx }, { product: rx }, { client: rx }, { source: rx },
    ],
  };
}

function canonStatusKey(value) {
  const key = String(value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toUpperCase();
  if (!key) return '';
  if (key === 'PENDING REVIEW') return 'APPLIED';
  return key;
}

function buildStatusClause(status) {
  const key = canonStatusKey(status);
  if (!key) return null;
  // Match ALL-CAPS storage and legacy title-case variants
  const title = key
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    $or: [
      { status: key },
      { status: title },
      { status: ciRegex(`^${escapeRegex(key)}$`) },
    ],
  };
}

function candidateListQuery(filter, sortSpec = { appliedAt: -1, createdAt: -1, _id: -1 }) {
  return Candidate.find(filter).select(CANDIDATE_LIST_SELECT).sort(sortSpec).lean();
}

async function listCandidates(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const rawLimit = req.query.limit;
        const parsedLimit = rawLimit === 'all' ? 0 : parseInt(rawLimit, 10);
        const limit = Number.isNaN(parsedLimit) ? 50 : parsedLimit;
        const shouldPaginate = limit > 0;
        const skip = shouldPaginate ? (page - 1) * limit : 0;
        const search = (req.query.search || '').trim();
        const searchScope = (req.query.searchScope || 'all').trim();
        const status = (req.query.status || '').trim();
        const position = (req.query.position || '').trim();
        const location = (req.query.location || '').trim();
        const companyName = (req.query.companyName || '').trim();
        const skills = (req.query.skills || '').trim();
        const product = (req.query.product || '').trim();
        const spoc = (req.query.spoc || '').trim();
        const client = (req.query.client || '').trim();
        const dateNeedle = (req.query.date || '').trim();
        const activityPeriod = (req.query.dateRange || req.query.period || '').trim();
        const activityFrom = (req.query.customFrom || req.query.from || '').trim();
        const activityTo = (req.query.customTo || req.query.to || '').trim();
        const sortField = (req.query.sortField || 'date').trim();
        const sortOrder = (req.query.sortOrder || 'desc').trim();
        const freelanceOnly = ['1', 'true', 'yes'].includes(String(req.query.freelanceOnly || '').toLowerCase());
        const idsOnly = ['1', 'true', 'yes'].includes(String(req.query.idsOnly || '').toLowerCase());
        // Explicit candidate id list (e.g. freelancer mandate drill-down)
        const rawIdsParam = String(req.query.ids || '').trim();
        const requestedIds = rawIdsParam
          ? [...new Set(
              rawIdsParam
                .split(/[,\s]+/)
                .map((id) => String(id || '').trim())
                .filter((id) => id.length === 24 && /^[a-fA-F0-9]+$/.test(id))
            )].slice(0, 500)
          : [];
        const requestedObjectIds = requestedIds
          .map((id) => {
            try { return new mongoose.Types.ObjectId(id); } catch { return null; }
          })
          .filter(Boolean);

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

        // Heal Excel imports missing organizationId — throttled so large ATS loads stay fast.
        // Freelancer desk lists are already scoped; skip the heavy heal path for them.
        if (
            !isFreelancer(req.user)
            && req.user.organizationId
            && (userIdObj || userIdStr)
        ) {
            const orgKey = String(req.user.organizationId);
            const last = orphanHealLastByOrg.get(orgKey) || 0;
            if (Date.now() - last >= ORPHAN_HEAL_TTL_MS) {
                orphanHealLastByOrg.set(orgKey, Date.now());
                try {
                    const orgId = req.user.organizationId;
                    const orphans = await Candidate.find({
                        createdBy: userIdObj ? { $in: [userIdObj, userIdStr] } : userIdStr,
                        $or: [
                            { organizationId: { $exists: false } },
                            { organizationId: null },
                        ],
                    }).select('_id email').limit(500).lean();

                    if (orphans.length) {
                        const emails = [...new Set(orphans.map((o) => String(o.email || '').toLowerCase()).filter(Boolean))];
                        const twins = emails.length
                            ? await Candidate.find({ organizationId: orgId, email: { $in: emails } }).select('email').lean()
                            : [];
                        const twinEmails = new Set(twins.map((t) => String(t.email || '').toLowerCase()));

                        const deleteIds = orphans
                            .filter((o) => twinEmails.has(String(o.email || '').toLowerCase()))
                            .map((o) => o._id);
                        const stampIds = orphans
                            .filter((o) => !twinEmails.has(String(o.email || '').toLowerCase()))
                            .map((o) => o._id);

                        if (deleteIds.length) {
                            await Candidate.deleteMany({ _id: { $in: deleteIds } });
                        }
                        if (stampIds.length) {
                            await Candidate.updateMany(
                                { _id: { $in: stampIds } },
                                { $set: { organizationId: orgId } }
                            );
                        }
                    }
                } catch (healErr) {
                    logger.warn({ err: healErr }, 'organizationId heal skipped');
                }
            }
        }

        // Own + shared / SPOC desk / org-wide — same rules as dashboard analytics
        let filter;
        try {
            filter = await candidateListScope(req, viewMode);
            if (canViewOrgAnalytics(req.user) && requestedAnalyticsUserId(req)) {
                logger.info('📊 Backend Query - manager viewing employee SPOC desk', {
                    userId: requestedAnalyticsUserId(req),
                });
            }
        } catch (filterErr) {
            const status = filterErr.statusCode || 500;
            if (filterErr.statusCode) {
                return res.status(status).json({ success: false, message: filterErr.message });
            }
            logger.error('⚠️ Error building filter:', filterErr.message);
            filter = {};
        }

        // Push text/status/search filters into Mongo so list stays O(page), not O(desk).
        const andParts = [filter];
        const searchClause = buildSearchClause(search, searchScope);
        if (searchClause) andParts.push(searchClause);
        const statusClause = buildStatusClause(status);
        if (statusClause) andParts.push(statusClause);
        if (position) andParts.push({ position: ciRegex(position) });
        if (location) {
            andParts.push({ $or: [{ location: ciRegex(location) }, { state: ciRegex(location) }] });
        }
        if (companyName) andParts.push({ companyName: ciRegex(companyName) });
        if (skills) andParts.push({ skills: ciRegex(skills) });
        if (product) andParts.push({ product: ciRegex(product) });
        if (spoc) andParts.push({ spoc: ciRegex(spoc) });
        if (client) andParts.push({ client: ciRegex(client) });
        if (dateNeedle) andParts.push({ date: ciRegex(dateNeedle) });
        // Analytics drill-down: same activity-date window as dashboard KPIs
        if (activityPeriod && activityPeriod !== 'all') {
          const activityFilter = buildDateFilter(activityPeriod, activityFrom, activityTo);
          if (activityFilter) {
            andParts[0] = withActivityDateRange(andParts[0], activityFilter);
          }
        }
        if (freelanceOnly) andParts.push({ source: ciRegex('freelance') });
        if (requestedObjectIds.length) {
          andParts.push({ _id: { $in: requestedObjectIds } });
        }
        if (hasTextCTC) andParts.push({ ctc: ciRegex(ctcMinStr) });
        if (hasTextExpectedCTC) andParts.push({ expectedCtc: ciRegex(expectedCtcMinStr) });

        const mongoFilter = andParts.length === 1 ? andParts[0] : { $and: andParts };
        const sortSpec = candidateListSortSpec(sortField, sortOrder);
        // Heal entry dates BEFORE sorting so DATE column order is correct on this response
        // (not on a later refresh after a background backfill).
        const sortingByEntryDate = !String(sortField || 'date').trim()
          || String(sortField).toLowerCase() === 'date';
        // Freelancer desks are small and private — skip org-wide appliedAt backfill.
        if (sortingByEntryDate && req.user?.organizationId && !isFreelancer(req.user)) {
          try {
            await backfillAppliedAtForOrg(req.user.organizationId, Candidate);
          } catch (bfErr) {
            logger.warn('⚠️ appliedAt backfill before list sort failed:', bfErr.message);
          }
        }
        const safeLimit = shouldPaginate ? Math.min(Math.max(limit, 1), 200) : 0;
        const effectiveSkip = shouldPaginate ? (page - 1) * safeLimit : 0;
        const RANGE_SCAN_CAP = 50000;
        const IDS_CAP = 50000;

        const parseNumber = (value) => {
            if (!value) return null;
            const numbers = String(value).match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length === 0) return null;
            return Math.max(...numbers.map((n) => parseFloat(n)));
        };
        const parseRangeMinMax = (value) => {
            if (!value) return { min: null, max: null };
            const numbers = String(value).toLowerCase().match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length === 0) return { min: null, max: null };
            const nums = numbers.map((n) => parseFloat(n));
            return { min: Math.min(...nums), max: Math.max(...nums) };
        };
        const matchesNumericRanges = (c) => {
            if (!hasRangeFilter) return true;
            const expVal = parseNumber(c.experience);
            const ctcRange = parseRangeMinMax(c.ctc);
            const expectedCRange = parseRangeMinMax(c.expectedCtc);
            if (!isNaN(expMin) && (expVal === null || expVal < expMin)) return false;
            if (!isNaN(expMax) && (expVal === null || expVal > expMax)) return false;
            if (hasNumericCTC) {
                if (ctcRange.max === null) return false;
                if (!isNaN(ctcMinNum) && ctcRange.max < ctcMinNum) return false;
                if (!isNaN(ctcMaxNum) && ctcRange.min > ctcMaxNum) return false;
            }
            if (hasNumericExpectedCTC) {
                if (expectedCRange.max === null) return false;
                if (!isNaN(expectedCtcMinNum) && expectedCRange.max < expectedCtcMinNum) return false;
                if (!isNaN(expectedCtcMaxNum) && expectedCRange.min > expectedCtcMaxNum) return false;
            }
            return true;
        };

        let candidates = [];
        let totalCount = 0;
        let usedStringFallback = false;

        const runListQuery = async (queryFilter) => {
            if (idsOnly) {
                if (hasRangeFilter) {
                    const scanned = await Candidate.find(queryFilter)
                        .select('_id experience ctc expectedCtc')
                        .sort(sortSpec)
                        .limit(RANGE_SCAN_CAP)
                        .lean();
                    const matched = scanned.filter(matchesNumericRanges);
                    const ids = matched.map((r) => String(r._id)).slice(0, IDS_CAP);
                    return {
                        idsOnly: true,
                        ids,
                        totalCount: matched.length,
                        capped: matched.length > ids.length,
                    };
                }
                const [total, rows] = await Promise.all([
                    Candidate.countDocuments(queryFilter),
                    Candidate.find(queryFilter).select('_id').sort(sortSpec).limit(IDS_CAP).lean(),
                ]);
                const ids = rows.map((r) => String(r._id));
                return {
                    idsOnly: true,
                    ids,
                    totalCount: total,
                    capped: total > ids.length,
                };
            }

            if (hasRangeFilter) {
                const scanned = await candidateListQuery(queryFilter, sortSpec).limit(RANGE_SCAN_CAP);
                const matched = scanned.filter(matchesNumericRanges);
                const count = matched.length;
                const pageRows = shouldPaginate ? matched.slice(effectiveSkip, effectiveSkip + safeLimit) : matched;
                return { candidates: pageRows, totalCount: count };
            }

            const countPromise = Candidate.countDocuments(queryFilter);
            let listPromise;
            if (shouldPaginate) {
                listPromise = candidateListQuery(queryFilter, sortSpec).skip(effectiveSkip).limit(safeLimit);
            } else {
                listPromise = candidateListQuery(queryFilter, sortSpec).limit(RANGE_SCAN_CAP);
            }
            const [count, rows] = await Promise.all([countPromise, listPromise]);
            return { candidates: rows, totalCount: count };
        };

        try {
            const result = await runListQuery(mongoFilter);
            if (result.idsOnly) {
                return res.status(200).json({
                    success: true,
                    ids: result.ids,
                    pagination: {
                        totalCount: result.totalCount,
                        selectedCount: result.ids.length,
                        capped: Boolean(result.capped),
                    },
                });
            }
            candidates = result.candidates;
            totalCount = result.totalCount;
            logger.info(`📊 Backend Query - mongo matched page=${candidates.length} total=${totalCount}`);
        } catch (queryErr) {
            logger.error('❌ Database query error:', queryErr.message);
            if (
                isFreelancer(req.user) &&
                viewMode !== 'all' &&
                !requestedAnalyticsUserId(req)
            ) {
                try {
                    const hideClause = {
                        hiddenFromFreelancerIds: { $nin: [userIdObj, userIdStr].filter(Boolean) },
                    };
                    const stringFilter = andParts.length <= 1
                        ? { $and: [{ createdBy: userIdStr }, hideClause] }
                        : { $and: [{ createdBy: userIdStr }, hideClause, ...andParts.slice(1)] };
                    const result = await runListQuery(stringFilter);
                    if (result.idsOnly) {
                        return res.status(200).json({
                            success: true,
                            ids: result.ids,
                            pagination: {
                                totalCount: result.totalCount,
                                selectedCount: result.ids.length,
                                capped: Boolean(result.capped),
                            },
                        });
                    }
                    candidates = result.candidates;
                    totalCount = result.totalCount;
                    usedStringFallback = candidates.length > 0;
                } catch (fallbackErr) {
                    logger.error('❌ Fallback query also failed:', fallbackErr.message);
                    candidates = [];
                    totalCount = 0;
                }
            } else {
                candidates = [];
                totalCount = 0;
            }
        }

        // Freelancer createdBy-string fallback when scoped query returns empty
        if (
            !idsOnly &&
            candidates.length === 0 &&
            totalCount === 0 &&
            viewMode !== 'shared' &&
            viewMode !== 'all' &&
            isFreelancer(req.user) &&
            !usedStringFallback
        ) {
            try {
                const hideClause = {
                    hiddenFromFreelancerIds: { $nin: [userIdObj, userIdStr].filter(Boolean) },
                };
                const stringFilter = andParts.length <= 1
                    ? { $and: [{ createdBy: userIdStr }, hideClause] }
                    : { $and: [{ createdBy: userIdStr }, hideClause, ...andParts.slice(1)] };
                const result = await runListQuery(stringFilter);
                candidates = result.candidates;
                totalCount = result.totalCount;
            } catch (e) {
                logger.warn('⚠️ String fallback failed:', e.message);
            }
        }

        // Mark shared candidates: only those explicitly shared with current user (sharedWith contains userId).
        let ownerIds = new Set();
        try {
            candidates.forEach((c) => {
                const sharedWithMe = Array.isArray(c.sharedWith) && c.sharedWith.some((sw) => String(sw && sw.userId) === userIdStr);
                c._isShared = !!sharedWithMe;
                if (sharedWithMe && c.createdBy != null && String(c.createdBy) !== '') ownerIds.add(String(c.createdBy));
            });
        } catch (markErr) {
            logger.warn('⚠️ Error marking shared candidates:', markErr.message);
        }

        if (ownerIds.size > 0) {
            try {
                const User = require('mongoose').model('User');
                const owners = await User.find({ _id: { $in: [...ownerIds] } }).select('name email').lean();
                const ownerMap = {};
                owners.forEach((o) => { ownerMap[String(o._id)] = o.name || o.email; });
                candidates.forEach((c) => {
                    if (c._isShared) c._sharedByOwner = ownerMap[String(c.createdBy)] || 'Unknown';
                });
            } catch (ownerErr) {
                logger.warn('⚠️ Shared-by owner lookup failed (candidates still returned):', ownerErr.message);
            }
        }

        try {
            const creatorIds = [...new Set(candidates.map((c) => String(c.createdBy || '')).filter((id) => id && id.length === 24))];
            if (creatorIds.length > 0) {
                const User = require('mongoose').model('User');
                const creators = await User.find({ _id: { $in: creatorIds } }).select('name role').lean();
                const creatorMap = {};
                creators.forEach((u) => { creatorMap[String(u._id)] = { name: u.name, role: u.role }; });
                candidates.forEach((c) => {
                    const meta = creatorMap[String(c.createdBy)];
                    if (meta) {
                        c._createdByRole = meta.role;
                        c._createdByName = meta.name || '';
                    }
                });
            }
        } catch (creatorErr) {
            logger.warn('⚠️ createdBy role lookup failed:', creatorErr.message);
        }

        const pageSize = shouldPaginate ? safeLimit : totalCount;
        const totalPages = shouldPaginate && pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

        res.status(200).json({
            success: true,
            data: candidates.map((c) => {
                const row = typeof c.toObject === 'function' ? c.toObject() : { ...c };
                applyBlockLettersToObject(row);
                return row;
            }),
            pagination: {
                currentPage: shouldPaginate ? page : 1,
                totalPages,
                totalCount,
                pageSize,
                hasMore: shouldPaginate ? page < totalPages : false,
            },
        });

        if (req.user?.organizationId) {
            setImmediate(() => {
                healCandidateBlockLettersSafe(req.user.organizationId);
                // Keep appliedAt in sync with Excel/manual `date` so DATE-column sort stays correct
                backfillAppliedAtForOrg(req.user.organizationId, Candidate);
            });
        }
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
