const { normalizeText, escapeRegex } = require('./textNormalize');

/**
 * Upsert a starter catalog into a named list (positions, sources, org-lists).
 * Does not create duplicates; reactivates matching inactive rows.
 */
async function seedNamedList(Model, { scope, names, user, extraFields }) {
  const created = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const found = await Model.findOne({
      ...scope,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    });
    const extras = typeof extraFields === 'function' ? extraFields(i, name) : (extraFields || {});
    if (found) {
      const canonical = normalizeText(name);
      let dirty = false;
      if (!found.isActive) {
        found.isActive = true;
        dirty = true;
      }
      if (found.name !== canonical) {
        found.name = canonical;
        dirty = true;
      }
      if (extras.sortOrder != null && found.sortOrder !== extras.sortOrder) {
        found.sortOrder = extras.sortOrder;
        dirty = true;
      }
      if (dirty) {
        found.updatedAt = new Date();
        await found.save();
        created.push(found);
      }
      continue;
    }
    try {
      created.push(await Model.create({
        name: normalizeText(name),
        createdBy: user.id,
        organizationId: user.organizationId,
        ...extras,
      }));
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return created;
}

module.exports = { seedNamedList };
