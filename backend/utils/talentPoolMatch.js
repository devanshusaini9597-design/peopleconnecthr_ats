/**
 * Match talent pools to a job / candidate so a Banking reject
 * can still surface for a Finance role when the profile overlaps.
 */

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function contextBlob(ctx = {}) {
  return [
    ctx.industry,
    ctx.title,
    ctx.role,
    ctx.position,
    ctx.skills,
    ctx.product,
    ctx.client,
    ctx.clientName,
    ctx.remark,
    ctx.description,
    Array.isArray(ctx.skills) ? ctx.skills.join(' ') : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function poolPhrases(pool) {
  return [pool?.industry, pool?.product, pool?.name]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter((s) => s.length >= 3);
}

function poolMatchesContext(pool, ctx = {}) {
  if (!pool) return false;
  const blob = contextBlob(ctx);
  if (!blob) return false;

  const industry = String(pool.industry || '').trim().toLowerCase();
  const ctxIndustry = String(ctx.industry || '').trim().toLowerCase();
  if (industry && ctxIndustry && industry === ctxIndustry) return true;

  const product = String(pool.product || '').trim().toLowerCase();
  const ctxProduct = String(ctx.product || '').trim().toLowerCase();
  if (product && ctxProduct && product === ctxProduct) return true;

  for (const phrase of poolPhrases(pool)) {
    if (blob.includes(phrase)) return true;
  }

  const needles = new Set([
    ...tokenize(pool.industry),
    ...tokenize(pool.product),
    ...tokenize(pool.name),
  ]);
  if (!needles.size) return false;
  const hay = new Set(tokenize(blob));
  for (const n of needles) {
    if (hay.has(n)) return true;
  }
  return false;
}

function flagHit(pool, trigger) {
  if (!pool) return false;
  if (trigger === 'reject') return !!(pool.addOnReject || pool.isDefaultRejectPool);
  if (trigger === 'dropped') return !!(pool.addOnDropped || pool.addOnReject || pool.isDefaultRejectPool);
  if (trigger === 'interview') return !!pool.addOnInterview;
  if (trigger === 'hired') return !!pool.addOnHired;
  if (trigger === 'create') return !!pool.addOnCreate;
  return false;
}

function catalogMatchForTrigger(trigger) {
  return trigger === 'reject' || trigger === 'dropped' || trigger === 'create' || trigger === 'interview';
}

function selectPoolsForTrigger(pools, ctx = {}, trigger = 'reject') {
  return (pools || []).filter(
    (p) => flagHit(p, trigger) || (catalogMatchForTrigger(trigger) && poolMatchesContext(p, ctx))
  );
}

function selectPoolsForReject(pools, ctx = {}) {
  return selectPoolsForTrigger(pools, ctx, 'reject');
}

function selectPoolsForJob(pools, job = {}) {
  const list = pools || [];
  const matched = list.filter(
    (p) => p.isDefaultRejectPool || p.addOnReject || poolMatchesContext(p, job)
  );
  return matched.length ? matched : list.filter((p) => p.isDefaultRejectPool);
}

module.exports = {
  tokenize,
  contextBlob,
  poolMatchesContext,
  selectPoolsForReject,
  selectPoolsForJob,
  selectPoolsForTrigger,
};
