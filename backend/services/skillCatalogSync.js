/**
 * One shared skill catalog for Skills page, candidate Product/Skill, and job skills.
 * Skill documents are the master; org-list `product` rows stay as the editable picklist mirror.
 */
const Skill = require('../models/Skill');
const OrgListItem = require('../models/OrgListItem');
const { slugifySkill, orgSkillSlug } = require('../utils/skillHelpers');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');
const logger = require('../utils/logger');

const PRODUCT_KEY = 'product';
const CUSTOM_CATEGORY = 'Product / Skill';

function nameKey(value) {
  return normalizeText(String(value || ''));
}

function splitSkillNames(value) {
  if (Array.isArray(value)) {
    return value.flatMap((v) => splitSkillNames(v));
  }
  return String(value || '')
    .split(/[,;/|]+/)
    .map((part) => String(part || '').trim())
    .filter((part) => part.length >= 2 && part.length <= 80);
}

function mergePickerItems(orgItems, catalogSkills, { userId } = {}) {
  const userIdStr = userId ? String(userId) : '';
  const seen = new Set();
  const out = [];

  for (const item of orgItems || []) {
    const name = nameKey(item?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const raw = item.toObject ? item.toObject() : { ...item };
    out.push({
      ...raw,
      name,
      catalog: false,
      isMine: raw.createdBy ? String(raw.createdBy) === userIdStr : !!raw.isMine,
    });
  }

  for (const skill of catalogSkills || []) {
    const name = nameKey(skill?.name);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({
      _id: `catalog:${skill._id || name}`,
      name,
      catalog: true,
      isSystem: !!skill.isSystem,
      isMine: false,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function findSkillByName(orgId, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;
  const slug = slugifySkill(trimmed);
  if (!slug) return null;
  const orgSlug = orgId ? orgSkillSlug(orgId, trimmed) : '';
  return Skill.findOne({
    $or: [
      { isSystem: true, slug },
      ...(orgId && orgSlug ? [{ organizationId: orgId, slug: orgSlug }] : []),
    ],
  });
}

async function ensureSkill(orgId, name, category = CUSTOM_CATEGORY) {
  const trimmed = String(name || '').trim();
  if (!trimmed || !orgId) return null;
  const existing = await findSkillByName(orgId, trimmed);
  if (existing) return existing;

  const slug = orgSkillSlug(orgId, trimmed);
  try {
    return await Skill.create({
      organizationId: orgId,
      name: trimmed,
      slug,
      category: String(category || CUSTOM_CATEGORY).trim() || CUSTOM_CATEGORY,
      isSystem: false,
    });
  } catch (error) {
    if (error.code === 11000) return findSkillByName(orgId, trimmed);
    throw error;
  }
}

async function ensureProductItem(orgId, userId, name) {
  const n = nameKey(name);
  if (!n || !orgId) return null;

  const existing = await OrgListItem.findOne({
    organizationId: orgId,
    listKey: PRODUCT_KEY,
    name: { $regex: new RegExp(`^${escapeRegex(n)}$`, 'i') },
  });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.updatedAt = new Date();
      await existing.save();
    }
    return existing;
  }

  try {
    const count = await OrgListItem.countDocuments({ organizationId: orgId, listKey: PRODUCT_KEY });
    return await OrgListItem.create({
      listKey: PRODUCT_KEY,
      name: n,
      sortOrder: count,
      createdBy: userId || undefined,
      organizationId: orgId,
      isActive: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      return OrgListItem.findOne({ organizationId: orgId, listKey: PRODUCT_KEY, name: n });
    }
    throw error;
  }
}

async function promoteNames(orgId, userId, names, category = CUSTOM_CATEGORY) {
  const unique = [...new Set(splitSkillNames(names).map(nameKey).filter(Boolean))];
  const out = [];
  for (const name of unique) {
    const [skill, item] = await Promise.all([
      ensureSkill(orgId, name, category),
      ensureProductItem(orgId, userId, name),
    ]);
    out.push({ skill, item });
  }
  return out;
}

function promoteNamesSafe(orgId, userId, names, category) {
  if (!orgId) return Promise.resolve([]);
  return promoteNames(orgId, userId, names, category).catch((error) => {
    logger.warn('skill catalog promote failed:', error.message);
    return [];
  });
}

async function renameLinked(orgId, oldName, newName) {
  const from = nameKey(oldName);
  const to = nameKey(newName);
  if (!orgId || !from || !to || from === to) return null;

  const item = await OrgListItem.findOne({
    organizationId: orgId,
    listKey: PRODUCT_KEY,
    name: { $regex: new RegExp(`^${escapeRegex(from)}$`, 'i') },
  });
  if (item) {
    const dup = await OrgListItem.findOne({
      organizationId: orgId,
      listKey: PRODUCT_KEY,
      _id: { $ne: item._id },
      name: { $regex: new RegExp(`^${escapeRegex(to)}$`, 'i') },
      isActive: true,
    });
    if (!dup) {
      item.name = to;
      item.updatedAt = new Date();
      await item.save();
    }
  }

  const skill = await findSkillByName(orgId, from);
  if (skill && !skill.isSystem) {
    const nextSlug = orgSkillSlug(orgId, to);
    const conflict = await Skill.findOne({
      _id: { $ne: skill._id },
      $or: [
        { slug: nextSlug, organizationId: orgId },
        { isSystem: true, slug: slugifySkill(to) },
      ],
    });
    if (!conflict) {
      skill.name = String(newName || to).trim();
      skill.slug = nextSlug;
      await skill.save();
    }
  }
  await ensureSkill(orgId, to);
  await ensureProductItem(orgId, null, to);
  return true;
}

async function removeLinked(orgId, name) {
  const n = nameKey(name);
  if (!orgId || !n) return null;

  await OrgListItem.deleteMany({
    organizationId: orgId,
    listKey: PRODUCT_KEY,
    name: { $regex: new RegExp(`^${escapeRegex(n)}$`, 'i') },
  });

  const skill = await findSkillByName(orgId, n);
  if (skill && !skill.isSystem) {
    const CandidateSkill = require('../models/CandidateSkill');
    const JobSkill = require('../models/JobSkill');
    await CandidateSkill.deleteMany({ skillId: skill._id });
    await JobSkill.deleteMany({ skillId: skill._id });
    await skill.deleteOne();
  }
  return true;
}

async function syncProductListToSkills(orgId) {
  if (!orgId) return 0;
  const items = await OrgListItem.find({
    organizationId: orgId,
    listKey: PRODUCT_KEY,
    isActive: true,
  }).select('name').lean();
  if (!items.length) return 0;

  const names = items.map((item) => item.name).filter(Boolean);
  const systemSlugs = names.map((n) => slugifySkill(n)).filter(Boolean);
  const orgSlugs = names.map((n) => orgSkillSlug(orgId, n)).filter(Boolean);
  const existing = await Skill.find({
    $or: [
      { isSystem: true, slug: { $in: systemSlugs } },
      { organizationId: orgId, slug: { $in: orgSlugs } },
    ],
  }).select('slug').lean();
  const have = new Set(existing.map((s) => s.slug));

  const toCreate = [];
  for (const name of names) {
    const trimmed = String(name || '').trim();
    const slug = slugifySkill(trimmed);
    const orgSlug = orgSkillSlug(orgId, trimmed);
    if (!trimmed || !orgSlug) continue;
    if (have.has(slug) || have.has(orgSlug)) continue;
    toCreate.push({
      organizationId: orgId,
      name: trimmed,
      slug: orgSlug,
      category: CUSTOM_CATEGORY,
      isSystem: false,
    });
    have.add(orgSlug);
  }
  if (!toCreate.length) return 0;
  try {
    const created = await Skill.insertMany(toCreate, { ordered: false });
    return created.length;
  } catch (error) {
    if (error.code === 11000) return toCreate.length;
    throw error;
  }
}

async function syncCustomSkillsToProductList(orgId, userId) {
  if (!orgId) return 0;
  const skills = await Skill.find({ organizationId: orgId, isSystem: false }).select('name').lean();
  let added = 0;
  for (const skill of skills) {
    const before = await OrgListItem.exists({
      organizationId: orgId,
      listKey: PRODUCT_KEY,
      name: { $regex: new RegExp(`^${escapeRegex(nameKey(skill.name))}$`, 'i') },
    });
    await ensureProductItem(orgId, userId, skill.name);
    if (!before) added += 1;
  }
  return added;
}

async function reconcileSkillCatalog(orgId, userId) {
  if (!orgId) return { skills: 0, products: 0 };
  const [skills, products] = await Promise.all([
    syncProductListToSkills(orgId),
    syncCustomSkillsToProductList(orgId, userId),
  ]);
  return { skills, products };
}

async function listPickerItems(orgId, userId, opts = {}) {
  if (!orgId) {
    return opts.paged ? { items: [], total: 0, page: 1, limit: opts.limit || 20 } : [];
  }

  const q = String(opts.q || '').trim();
  const paged = !!opts.paged;
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(100, Math.max(1, opts.limit || 20));
  const skip = Number.isFinite(opts.skip) ? opts.skip : (page - 1) * limit;
  const nameFilter = q.length >= 2 ? { name: { $regex: escapeRegex(q), $options: 'i' } } : {};
  const orgMatch = { organizationId: orgId, listKey: PRODUCT_KEY, isActive: true, ...nameFilter };

  if (!paged) {
    const [orgItems, catalogSkills] = await Promise.all([
      OrgListItem.find(orgMatch).sort({ sortOrder: 1, name: 1 }).limit(400).lean(),
      Skill.find({ $or: [{ isSystem: true }, { organizationId: orgId }], ...nameFilter })
        .select('name isSystem')
        .sort({ name: 1 })
        .limit(400)
        .lean(),
    ]);
    return mergePickerItems(orgItems, catalogSkills, { userId });
  }

  const includeCatalog = q.length >= 2;
  const skillMatch = includeCatalog
    ? { $and: [nameFilter, { $or: [{ isSystem: true }, { organizationId: orgId }] }] }
    : null;

  const [orgItems, orgTotal, catalogSkills, skillTotal] = await Promise.all([
    OrgListItem.find(orgMatch).sort({ sortOrder: 1, name: 1 }).skip(skip).limit(limit).lean(),
    OrgListItem.countDocuments(orgMatch),
    includeCatalog
      ? Skill.find(skillMatch).select('name isSystem').sort({ name: 1 }).limit(limit).lean()
      : Promise.resolve([]),
    includeCatalog ? Skill.countDocuments(skillMatch) : Promise.resolve(0),
  ]);

  const items = mergePickerItems(orgItems, catalogSkills, { userId }).slice(0, limit);
  return {
    items,
    total: includeCatalog ? Math.max(orgTotal, skillTotal) : orgTotal,
    page,
    limit,
  };
}

module.exports = {
  PRODUCT_KEY,
  CUSTOM_CATEGORY,
  nameKey,
  splitSkillNames,
  mergePickerItems,
  findSkillByName,
  ensureSkill,
  ensureProductItem,
  promoteNames,
  promoteNamesSafe,
  renameLinked,
  removeLinked,
  syncProductListToSkills,
  syncCustomSkillsToProductList,
  reconcileSkillCatalog,
  listPickerItems,
};
