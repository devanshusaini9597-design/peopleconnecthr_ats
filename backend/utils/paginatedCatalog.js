const { escapeRegex } = require('./textNormalize');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parseCatalogQuery(query = {}) {
  const q = String(query.q || '').trim();
  const hasPage = query.page != null && String(query.page).trim() !== '';
  const hasLimit = query.limit != null && String(query.limit).trim() !== '';
  const paged = hasPage || hasLimit;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT));
  return { q, page, limit, skip: (page - 1) * limit, paged };
}

function nameContainsFilter(q) {
  if (!q) return {};
  return { name: { $regex: escapeRegex(q), $options: 'i' } };
}

function withOwner(items, userId) {
  const userIdStr = userId ? String(userId) : '';
  return (items || []).map((row) => ({
    ...row,
    isMine: row.createdBy ? String(row.createdBy) === userIdStr : !!row.isMine,
  }));
}

async function findNamedCatalog(Model, baseFilter, req, sort = { name: 1 }) {
  const parsed = parseCatalogQuery(req.query || {});
  const match = { ...baseFilter, ...nameContainsFilter(parsed.q) };
  const userId = req.user?.id;

  if (!parsed.paged) {
    const items = await Model.find(match).sort(sort).lean();
    return { paged: false, items: withOwner(items, userId) };
  }

  const [raw, total] = await Promise.all([
    Model.find(match).sort(sort).skip(parsed.skip).limit(parsed.limit).lean(),
    Model.countDocuments(match),
  ]);
  return {
    paged: true,
    items: withOwner(raw, userId),
    total,
    page: parsed.page,
    limit: parsed.limit,
  };
}

function sendCatalog(res, result) {
  if (!result.paged) return res.json(result.items);
  return res.json({
    items: result.items,
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
}

module.exports = {
  parseCatalogQuery,
  nameContainsFilter,
  withOwner,
  findNamedCatalog,
  sendCatalog,
};
