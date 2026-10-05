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
const { withStageEntryDateRange } = require('../../utils/candidateStatusHistory');
const { isCareersSource, collectUnmergedDuplicateIds } = require('../../utils/jobPipelineStats');

/** Columns needed by ATS grid / client filters — exclude resumeText, embeddings, histories. */
const CANDIDATE_LIST_SELECT = [
  'srNo', 'candidateCode', 'date', 'name', 'email', 'contact', 'phone', 'position', 'location', 'state',
  'companyName', 'experience', 'ctc', 'expectedCtc', 'noticePeriod', 'skills', 'product',
  'pan', 'status', 'client', 'spoc', 'source', 'feedback', 'remark', 'callBackDate', 'fls',
  'resume', 'tags', 'customFields', 'createdBy', 'sharedWith', 'organizationId',
  'createdAt', 'updatedAt', 'appliedAt', 'statusEnteredAt', 'hiredDate', 'legalHold', 'personId', 'talentPoolIds',
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
  if (scope === 'candidateid' || scope === 'candidatecode' || scope === 'id') {
    return { candidateCode: { $regex: `^\\s*${escapeRegex(q)}\\s*$`, $options: 'i' } };
  }
  if (scope === 'applicationid' || scope === 'applicationcode') {
    return null;
  }
  return {
    $or: [
      { name: rx }, { email: rx }, { position: rx }, { companyName: rx },
      { contact: rx }, { location: rx }, { state: rx }, { spoc: rx },
      { skills: rx }, { product: rx }, { client: rx }, { source: rx },
      { candidateCode: rx }, { srNo: rx },
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
        const jobIdRaw = (req.query.jobId || '').trim();
        const jobAppSource = String(req.query.appSource || req.query.jobAppSource || '').trim().toLowerCase();
        const candidateCodeFilter = (req.query.candidateCode || '').trim();
        const applicationCodeFilter = (req.query.applicationCode || '').trim();
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
            return res.status(500).json({ success: false, message: 'Could not apply data scope' });
        }

        // Push text/status/search filters into Mongo so list stays O(page), not O(desk).
        const andParts = [filter];
        const searchScopeKey = String(searchScope || 'all').trim().toLowerCase();
        const searchClause = buildSearchClause(search, searchScope);
        if (searchClause) andParts.push(searchClause);
        if (candidateCodeFilter) {
            andParts.push({ candidateCode: { $regex: `^\\s*${escapeRegex(candidateCodeFilter)}\\s*$`, $options: 'i' } });
        }

        const Application = require('../../models/Application');
        const { applicationListFilter } = require('../../utils/dataScope');
        const appCodeNeedles = [];
        if (applicationCodeFilter) appCodeNeedles.push(applicationCodeFilter);
        if (search && (searchScopeKey === 'applicationid' || searchScopeKey === 'applicationcode' || searchScopeKey === 'all')) {
            appCodeNeedles.push(search);
        }
        if (appCodeNeedles.length && req.user.organizationId) {
            const appOr = appCodeNeedles.map((n) => ({
                applicationCode: { $regex: `^\\s*${escapeRegex(n)}\\s*$`, $options: 'i' },
            }));
            const appScope = await applicationListFilter(req.user.organizationId, req.user);
            const appIds = await Application.find({ $and: [appScope, { $or: appOr }] }).distinct('candidateId');
            if (searchScopeKey === 'applicationid' || searchScopeKey === 'applicationcode' || applicationCodeFilter) {
                andParts.push({ _id: { $in: appIds } });
            } else if (search && appIds.length) {
                const last = andParts[andParts.length - 1];
                if (last && last.$or) {
                    last.$or = [...last.$or, { _id: { $in: appIds } }];
                } else {
                    andParts.push({ _id: { $in: appIds } });
                }
            }
        }
        const statusClause = buildStatusClause(status);
        const listKind = String(req.query.list || '').trim();
        const cohortMonth = String(req.query.cohort || '').trim();
        let drillIds = null;
        if (listKind === 'moved' && status) {
          const { candidateIdsForMove } = require('../../services/pipelineMetricsService');
          const activityFilter = activityPeriod && activityPeriod !== 'all'
            ? buildDateFilter(activityPeriod, activityFrom, activityTo)
            : null;
          drillIds = await candidateIdsForMove({
            userFilter: filter,
            stage: status,
            dateFilter: activityFilter,
          });
        } else if (listKind === 'added' && status) {
          if (statusClause) andParts.push(statusClause);
          if (activityPeriod && activityPeriod !== 'all') {
            const activityFilter = buildDateFilter(activityPeriod, activityFrom, activityTo);
            if (activityFilter) andParts[0] = withActivityDateRange(andParts[0], activityFilter);
          }
        } else if (listKind === 'cohort' && status && cohortMonth) {
          const { candidateIdsForCohortStage } = require('../../services/pipelineMetricsService');
          drillIds = await candidateIdsForCohortStage({
            userFilter: filter,
            stage: status,
            cohortMonth,
          });
        }
        if (drillIds) {
          andParts.push({ _id: { $in: drillIds } });
        } else if (!(listKind === 'added' && status)) {
          if (statusClause) andParts.push(statusClause);
          if (activityPeriod && activityPeriod !== 'all') {
            const activityFilter = buildDateFilter(activityPeriod, activityFrom, activityTo);
            if (activityFilter) {
              andParts[0] = status
                ? withStageEntryDateRange(andParts[0], activityFilter)
                : withActivityDateRange(andParts[0], activityFilter);
            }
          }
        }
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
        let jobFilterId = null;
        let jobDoc = null;
        if (jobIdRaw && jobIdRaw !== 'all' && req.user.organizationId) {
            const Application = require('../../models/Application');
            const Job = require('../../models/Job');
            const orgId = req.user.organizationId;
            if (mongoose.Types.ObjectId.isValid(jobIdRaw) && String(jobIdRaw).length === 24) {
                jobDoc = await Job.findOne({ _id: jobIdRaw, organizationId: orgId }).select('_id jobCode').lean();
            }
            if (!jobDoc) {
                jobDoc = await Job.findOne({
                    organizationId: orgId,
                    jobCode: String(jobIdRaw).toUpperCase(),
                }).select('_id jobCode').lean();
            }
            if (!jobDoc) {
                andParts.push({ _id: { $in: [] } });
            } else {
                jobFilterId = jobDoc._id;
                const jobApps = await Application.find({
                    organizationId: orgId,
                    jobId: jobDoc._id,
                }).select('candidateId source').lean();
                let applicantIds = jobApps.map((a) => a.candidateId);
                if (jobAppSource === 'careers' || jobAppSource === 'applied') {
                    applicantIds = jobApps.filter((a) => isCareersSource(a.source)).map((a) => a.candidateId);
                } else if (jobAppSource === 'added' || jobAppSource === 'tagged') {
                    applicantIds = jobApps.filter((a) => !isCareersSource(a.source)).map((a) => a.candidateId);
                } else if (jobAppSource === 'duplicates' || jobAppSource === 'duplicate') {
                    const people = await Candidate.find({
                        organizationId: orgId,
                        _id: { $in: applicantIds },
                    }).select('email contact phone personId').lean();
                    const emails = [...new Set(people.map((c) => String(c.email || '').trim().toLowerCase()).filter(Boolean))];
                    const personIds = [...new Set(people.map((c) => c.personId).filter(Boolean))];
                    const or = [];
                    if (emails.length) {
                        or.push({ email: { $in: emails } });
                        or.push({ email: { $in: emails.map((e) => e.toUpperCase()) } });
                    }
                    if (personIds.length) or.push({ personId: { $in: personIds } });
                    let siblings = people;
                    if (or.length) {
                        siblings = await Candidate.find({ organizationId: orgId, $or: or })
                            .select('_id email contact phone personId').lean();
                    }
                    const dupIds = collectUnmergedDuplicateIds(people, siblings);
                    applicantIds = applicantIds.filter((id) => dupIds.has(String(id)));
                }
                andParts.push({ _id: { $in: applicantIds } });
            }
        }
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
          || ['date', 'stagesince', 'statusenteredat', 'stage_since'].includes(String(sortField).toLowerCase());
        // Freelancer desks are small and private — skip org-wide appliedAt backfill.
        if (sortingByEntryDate && req.user?.organizationId && !isFreelancer(req.user) && !idsOnly) {
          backfillAppliedAtForOrg(req.user.organizationId, Candidate).catch((bfErr) => {
            logger.warn('⚠️ appliedAt backfill before list sort failed:', bfErr.message);
          });
          try {
            const { backfillStatusEnteredAtForOrg } = require('../../utils/candidateStatusHistory');
            backfillStatusEnteredAtForOrg(req.user.organizationId, Candidate).catch((bfErr) => {
              logger.warn('⚠️ statusEnteredAt backfill before list sort failed:', bfErr.message);
            });
          } catch (bfErr) {
            logger.warn('⚠️ statusEnteredAt backfill before list sort failed:', bfErr.message);
          }
        }
        const safeLimit = shouldPaginate ? Math.min(Math.max(limit, 1), 200) : 0;
        const effectiveSkip = shouldPaginate ? (page - 1) * safeLimit : 0;
        const RANGE_SCAN_CAP = 50000;

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
                    const ids = matched.map((r) => String(r._id));
                    return {
                        idsOnly: true,
                        ids,
                        totalCount: matched.length,
                        capped: scanned.length >= RANGE_SCAN_CAP,
                    };
                }
                const idLimit = Math.min(3000, Math.max(1, parseInt(req.query.idLimit, 10) || 3000));
                const idSkip = Math.max(0, parseInt(req.query.idSkip, 10) || 0);
                const [total, rows] = await Promise.all([
                    Candidate.countDocuments(queryFilter).maxTimeMS(8000).catch(() => null),
                    Candidate.find(queryFilter).select('_id').sort(sortSpec).skip(idSkip).limit(idLimit + 1).maxTimeMS(20000).lean(),
                ]);
                const hasMore = rows.length > idLimit;
                const pageRows = hasMore ? rows.slice(0, idLimit) : rows;
                const ids = pageRows.map((r) => String(r._id));
                return {
                    idsOnly: true,
                    ids,
                    totalCount: total == null ? idSkip + ids.length + (hasMore ? 1 : 0) : total,
                    capped: false,
                    hasMore,
                };
            }

            if (hasRangeFilter) {
                const scanned = await candidateListQuery(queryFilter, sortSpec).limit(RANGE_SCAN_CAP);
                const matched = scanned.filter(matchesNumericRanges);
                const count = matched.length;
                const pageRows = shouldPaginate ? matched.slice(effectiveSkip, effectiveSkip + safeLimit) : matched;
                return { candidates: pageRows, totalCount: count };
            }

            const countPromise = Candidate.countDocuments(queryFilter).maxTimeMS(8000).catch(() => null);
            let listPromise;
            if (shouldPaginate) {
                listPromise = candidateListQuery(queryFilter, sortSpec).skip(effectiveSkip).limit(safeLimit);
            } else {
                listPromise = candidateListQuery(queryFilter, sortSpec).limit(RANGE_SCAN_CAP);
            }
            const [count, rows] = await Promise.all([countPromise, listPromise]);
            const resolvedCount = count == null
                ? effectiveSkip + rows.length + (shouldPaginate && rows.length >= safeLimit ? 1 : 0)
                : count;
            return { candidates: rows, totalCount: resolvedCount };
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
                        hasMore: Boolean(result.hasMore),
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
                                hasMore: Boolean(result.hasMore),
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

        if (candidates.length && req.user.organizationId) {
            try {
                const Application = require('../../models/Application');
                const { applicationListFilter } = require('../../utils/dataScope');
                const { ensureApplicationCode, ensureCandidateCode } = require('../../services/candidateCodeService');
                const appScope = await applicationListFilter(req.user.organizationId, req.user);
                const appQuery = {
                    $and: [
                        appScope,
                        { candidateId: { $in: candidates.map((c) => c._id) } },
                    ],
                };
                if (jobFilterId) appQuery.$and.push({ jobId: jobFilterId });
                const apps = await Application.find(appQuery)
                    .select('candidateId jobId appliedAt createdAt source stage applicationCode organizationId')
                    .sort({ appliedAt: -1, createdAt: -1 })
                    .lean();

                const missing = apps.filter((a) => !String(a.applicationCode || '').trim()).slice(0, 50);
                for (const a of missing) {
                    try {
                        a.applicationCode = await ensureApplicationCode(a);
                    } catch (codeErr) {
                        logger.warn('⚠️ applicationCode backfill failed:', codeErr.message);
                    }
                }

                const byCand = new Map();
                for (const a of apps) {
                    const key = String(a.candidateId);
                    const list = byCand.get(key) || [];
                    list.push(a);
                    byCand.set(key, list);
                }
                const uniqueJobIds = [...new Set(apps.map((a) => a.jobId).filter(Boolean))];
                const jobCodeById = new Map();
                if (jobFilterId && jobDoc?.jobCode) {
                    jobCodeById.set(String(jobFilterId), jobDoc.jobCode);
                }
                const missingJobIds = uniqueJobIds.filter((id) => !jobCodeById.has(String(id)));
                if (missingJobIds.length) {
                    const Job = require('../../models/Job');
                    const jobRows = await Job.find({
                        _id: { $in: missingJobIds },
                        organizationId: req.user.organizationId,
                    }).select('jobCode').lean();
                    for (const j of jobRows) {
                        jobCodeById.set(String(j._id), j.jobCode || '');
                    }
                }
                for (const c of candidates) {
                    const list = byCand.get(String(c._id));
                    if (!list || !list.length) continue;
                    const app = list[0];
                    c._jobAppliedAt = app.appliedAt || app.createdAt || null;
                    c._jobApplicationSource = app.source || '';
                    c._jobApplicationStage = app.stage || '';
                    c._jobApplicationCode = app.applicationCode || '';
                    c._applicationCount = list.length;
                    c._jobCode = jobCodeById.get(String(app.jobId)) || '';
                    c._jobMongoId = app.jobId || null;
                    if (!String(c.candidateCode || '').trim()) {
                        try {
                            c.candidateCode = await ensureCandidateCode(c);
                        } catch (codeErr) {
                            logger.warn('⚠️ candidateCode backfill failed:', codeErr.message);
                        }
                    }
                }
                const sortingByDate = !String(sortField || 'date').trim()
                  || ['date', 'appliedat'].includes(String(sortField).toLowerCase());
                if (jobFilterId && sortingByDate) {
                    const dir = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
                    candidates.sort((a, b) => {
                        const ta = new Date(a._jobAppliedAt || 0).getTime();
                        const tb = new Date(b._jobAppliedAt || 0).getTime();
                        return (ta - tb) * dir;
                    });
                }
            } catch (appErr) {
                logger.warn('⚠️ application overlay failed:', appErr.message);
            }
        }

        const pageSize = shouldPaginate ? safeLimit : totalCount;
        const totalPages = shouldPaginate && pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

        res.status(200).json({
            success: true,
            data: candidates.map((c) => {
                const row = typeof c.toObject === 'function' ? c.toObject() : { ...c };
                applyBlockLettersToObject(row);
                if (c._jobAppliedAt || c._jobApplicationCode || c._applicationCount || c._jobCode) {
                    row.jobAppliedAt = c._jobAppliedAt;
                    row.jobApplicationSource = c._jobApplicationSource || '';
                    row.jobApplicationStage = c._jobApplicationStage || '';
                    row.jobApplicationCode = c._jobApplicationCode || '';
                    row.applicationCount = c._applicationCount || 0;
                    if (c._jobCode) row.jobCode = c._jobCode;
                    if (c._jobMongoId) row.taggedJobId = c._jobMongoId;
                }
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
