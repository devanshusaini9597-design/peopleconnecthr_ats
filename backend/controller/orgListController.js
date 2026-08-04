const OrgListItem = require('../models/OrgListItem');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');

const ALLOWED = new Set(['ctc', 'notice']);

/** Sensible starter sets — lean, not 0–50L noise. */
const SEEDS = {
  ctc: [
    '0-50k', '50k-1L', '1L-2L', '2L-3L', '3L-4L', '4L-5L', '5L-6L', '6L-8L',
    '8L-10L', '10L-12L', '12L-15L', '15L-20L', '20L-25L', '25L-30L', '30L-40L',
    '40L-50L', 'Above 50L', 'As Per Company Norms',
  ],
  notice: ['Immediate', '15 Days', '30 days', '60 days', '90 days'],
};

const scopeFilter = (req) => (
  req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id }
);

const assertKey = (listKey, res) => {
  if (!ALLOWED.has(listKey)) {
    res.status(400).json({ message: 'Invalid list key' });
    return false;
  }
  return true;
};

const getItems = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey } = req.params;
    if (!assertKey(listKey, res)) return;
    const items = await OrgListItem.find({ ...scopeFilter(req), listKey, isActive: true })
      .sort({ sortOrder: 1, name: 1 });
    res.json(items);
  } catch (error) {
    console.error('Error fetching org list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAllItems = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey } = req.params;
    if (!assertKey(listKey, res)) return;
    const items = await OrgListItem.find({ ...scopeFilter(req), listKey, isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    const userIdStr = req.user.id.toString();
    res.json(items.map((p) => ({ ...p, isMine: p.createdBy?.toString() === userIdStr })));
  } catch (error) {
    console.error('Error fetching all org list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const seedItems = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey } = req.params;
    if (!assertKey(listKey, res)) return;
    const scope = scopeFilter(req);
    const existing = await OrgListItem.countDocuments({ ...scope, listKey, isActive: true });
    if (existing > 0 && !req.body?.force) {
      return res.status(400).json({ message: 'List already has items. Pass force:true to re-seed missing only.' });
    }
    const names = SEEDS[listKey] || [];
    const created = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const found = await OrgListItem.findOne({
        ...scope,
        listKey,
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      });
      if (found) {
        if (!found.isActive) {
          found.isActive = true;
          found.sortOrder = i;
          found.updatedAt = new Date();
          await found.save();
          created.push(found);
        }
        continue;
      }
      const doc = await OrgListItem.create({
        listKey,
        name: normalizeText(name),
        sortOrder: i,
        createdBy: req.user.id,
        organizationId: req.user.organizationId,
      });
      created.push(doc);
    }
    res.status(201).json({ success: true, added: created.length, data: created });
  } catch (error) {
    console.error('Error seeding org list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createItem = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey } = req.params;
    if (!assertKey(listKey, res)) return;
    const { name, description } = req.body;
    const scope = scopeFilter(req);
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const existingActive = await OrgListItem.findOne({
      ...scope,
      listKey,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      isActive: true,
    });
    if (existingActive) return res.status(400).json({ message: 'Item already exists' });

    const existingInactive = await OrgListItem.findOne({
      ...scope,
      listKey,
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      isActive: false,
    });
    if (existingInactive) {
      existingInactive.isActive = true;
      existingInactive.description = description?.trim() ?? existingInactive.description;
      existingInactive.updatedAt = new Date();
      await existingInactive.save();
      return res.status(201).json(existingInactive);
    }

    const count = await OrgListItem.countDocuments({ ...scope, listKey });
    const item = await OrgListItem.create({
      listKey,
      name: normalizeText(name),
      description: description?.trim(),
      sortOrder: count,
      createdBy: req.user.id,
      organizationId: req.user.organizationId,
    });
    res.status(201).json(item);
  } catch (error) {
    console.error('Error creating org list item:', error);
    if (error.code === 11000) return res.status(400).json({ message: 'Item already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

const updateItem = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey, id } = req.params;
    if (!assertKey(listKey, res)) return;
    const { name, description, isActive } = req.body;
    const scope = scopeFilter(req);
    const item = await OrgListItem.findOne({ _id: id, listKey, ...scope });
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (name) {
      const dup = await OrgListItem.findOne({
        ...scope,
        listKey,
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        _id: { $ne: id },
        isActive: true,
      });
      if (dup) return res.status(400).json({ message: 'Name already exists' });
      item.name = normalizeText(name);
    }
    if (description !== undefined) item.description = description?.trim();
    if (isActive !== undefined) item.isActive = isActive;
    item.updatedAt = new Date();
    await item.save();
    res.json(item);
  } catch (error) {
    console.error('Error updating org list item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey, id } = req.params;
    if (!assertKey(listKey, res)) return;
    const result = await OrgListItem.deleteOne({ _id: id, listKey, ...scopeFilter(req) });
    if (result.deletedCount === 0) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting org list item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getItems,
  getAllItems,
  seedItems,
  createItem,
  updateItem,
  deleteItem,
  SEEDS,
};
