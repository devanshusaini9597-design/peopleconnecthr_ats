/**
 * One shared Position catalog for candidate Position, job title, import, and filters.
 * Position documents are the master (no org-list mirror).
 */
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');
const logger = require('../utils/logger');

function nameKey(value) {
  return normalizeText(String(value || ''));
}

function splitNames(value) {
  if (Array.isArray(value)) {
    return value.flatMap((v) => splitNames(v));
  }
  const n = String(value || '').trim();
  return n ? [n] : [];
}

function exactNameQuery(name) {
  const n = nameKey(name);
  if (!n) return null;
  return { $regex: new RegExp(`^${escapeRegex(n)}$`, 'i') };
}

function catalogFilter(orgId, userId) {
  if (orgId) return { organizationId: orgId };
  if (userId) return { createdBy: userId };
  return null;
}

async function findByName(orgId, userId, name) {
  const n = nameKey(name);
  const filter = catalogFilter(orgId, userId);
  if (!n || !filter) return null;
  return Position.findOne({ ...filter, name: exactNameQuery(n) });
}

async function ensurePosition(orgId, userId, name, description) {
  const n = nameKey(name);
  if (!n) return null;

  const existing = await findByName(orgId, userId, n);
  if (existing) {
    let dirty = false;
    if (!existing.isActive) {
      existing.isActive = true;
      dirty = true;
    }
    if (existing.name !== n) {
      existing.name = n;
      dirty = true;
    }
    if (description !== undefined) {
      const nextDesc = String(description || '').trim();
      if ((existing.description || '') !== nextDesc) {
        existing.description = nextDesc;
        dirty = true;
      }
    }
    if (dirty) {
      existing.updatedAt = new Date();
      await existing.save();
    }
    return existing;
  }

  try {
    return await Position.create({
      name: n,
      description: description !== undefined ? String(description || '').trim() : undefined,
      createdBy: userId || undefined,
      organizationId: orgId || undefined,
      isActive: true,
    });
  } catch (error) {
    if (error.code === 11000) return findByName(orgId, userId, n);
    throw error;
  }
}

async function promoteNames(orgId, userId, names) {
  const unique = [...new Set(splitNames(names).map(nameKey).filter(Boolean))];
  const out = [];
  for (const name of unique) {
    out.push(await ensurePosition(orgId, userId, name));
  }
  return out;
}

function promoteNamesSafe(orgId, userId, names) {
  if (!orgId && !userId) return Promise.resolve([]);
  return promoteNames(orgId, userId, names).catch((error) => {
    logger.warn('position catalog promote failed:', error.message);
    return [];
  });
}

async function renameLinked(orgId, oldName, newName) {
  const from = nameKey(oldName);
  const to = nameKey(newName);
  if (!orgId || !from || !to || from === to) return null;

  const dup = await Position.findOne({
    organizationId: orgId,
    name: exactNameQuery(to),
    isActive: true,
  });
  if (!dup) {
    await Position.updateMany(
      { organizationId: orgId, name: exactNameQuery(from) },
      { $set: { name: to, updatedAt: new Date() } }
    );
  }
  await ensurePosition(orgId, null, to);

  const fromQuery = exactNameQuery(from);
  await Candidate.updateMany(
    { organizationId: orgId, position: fromQuery },
    { $set: { position: to } }
  );
  await Job.updateMany(
    { organizationId: orgId, title: fromQuery },
    { $set: { title: to } }
  );
  await Job.updateMany(
    { organizationId: orgId, role: fromQuery },
    { $set: { role: to } }
  );
  return true;
}

async function removeLinked(orgId, name) {
  const n = nameKey(name);
  if (!orgId || !n) return null;
  await Position.deleteMany({
    organizationId: orgId,
    name: exactNameQuery(n),
  });
  return true;
}

module.exports = {
  nameKey,
  splitNames,
  exactNameQuery,
  findByName,
  ensurePosition,
  promoteNames,
  promoteNamesSafe,
  renameLinked,
  removeLinked,
};
