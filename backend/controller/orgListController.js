const OrgListItem = require('../models/OrgListItem');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');
const logger = require('../utils/logger');
const { masterDataScope, isFreelancer, createdByFilter } = require('../utils/dataScope');
const { seedNamedList } = require('../utils/seedNamedList');
const { listCatalogCities } = require('../services/locationService');
const skillCatalogSync = require('../services/skillCatalogSync');
const { parseCatalogQuery, findNamedCatalog, sendCatalog } = require('../utils/paginatedCatalog');

const ALLOWED = new Set(['ctc', 'notice', 'product', 'grade', 'industry', 'location', 'experience']);

/** Sensible starter sets for org picklists (candidate + job forms). */
const SEEDS = {
  ctc: [
    '0-50K', '50K-1L', '1L-2L', '2L-3L', '3L-4L', '4L-5L', '5L-6L', '6L-7L', '7L-8L', '8L-9L', '9L-10L',
    '10L-12L', '12L-15L', '15L-18L', '18L-20L', '20L-25L', '25L-30L', '30L-40L', '40L-50L',
    '50L-75L', '75L-1CR', 'ABOVE 1CR',
    'NEGOTIABLE', 'CONFIDENTIAL', 'NOT DISCLOSED', 'AS PER COMPANY NORMS',
  ],
  notice: ['IMMEDIATE', '15 DAYS', '30 DAYS', '45 DAYS', '60 DAYS', '90 DAYS', 'SERVING NOTICE'],
  product: [
    'HOME LOAN', 'PERSONAL LOAN', 'CREDIT CARDS', 'AUTO LOAN', 'BUSINESS LOAN',
    'SAVINGS ACCOUNT', 'CURRENT ACCOUNT', 'INSURANCE', 'WEALTH / INVESTMENT',
    'COLLECTIONS', 'SALES', 'OPERATIONS', 'CUSTOMER SERVICE',
  ],
  grade: [
    'EXECUTIVE', 'SENIOR EXECUTIVE', 'ASSISTANT MANAGER', 'MANAGER', 'SENIOR - MANAGER',
    'ASSISTANT BRANCH HEAD', 'BRANCH HEAD', 'AVP', 'VP',
  ],
  industry: [
    'LIFE INSURANCE', 'GENERAL INSURANCE', 'HEALTH INSURANCE', 'BFSI', 'IT / SOFTWARE',
    'ITES / BPO', 'MANUFACTURING', 'PHARMA / HEALTHCARE', 'FMCG', 'RETAIL',
    'REAL ESTATE', 'EDUCATION', 'TELECOM',
  ],
  location: listCatalogCities(),
  experience: [
    'FRESHER', '0-1 YEARS', '1-2 YEARS', '2-3 YEARS', '3-5 YEARS', '5-8 YEARS',
    '8-12 YEARS', '12+ YEARS', 'MINIMUM 2 YEARS OF RELEVANT EXPERIENCE',
  ],
};

const scopeFilter = (req) => masterDataScope(req);

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
    const scope = scopeFilter(req);
    if (listKey === 'product' && req.user.organizationId) {
      const picker = await skillCatalogSync.listPickerItems(req.user.organizationId, req.user.id);
      return res.json(picker);
    }
    const items = await OrgListItem.find({ ...scope, listKey, isActive: true })
      .sort({ sortOrder: 1, name: 1 });
    // Notice / CTC labels are stored and shown in block letters
    res.json(items.map((item) => {
      const o = item.toObject ? item.toObject() : item;
      return { ...o, name: normalizeText(o.name) };
    }));
  } catch (error) {
    logger.error('Error fetching org list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAllItems = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey } = req.params;
    if (!assertKey(listKey, res)) return;
    const parsed = parseCatalogQuery(req.query);
    if (listKey === 'product' && req.user.organizationId) {
      const picker = await skillCatalogSync.listPickerItems(
        req.user.organizationId,
        req.user.id,
        parsed
      );
      if (parsed.paged) return res.json(picker);
      return res.json(Array.isArray(picker) ? picker : picker.items || []);
    }
    const result = await findNamedCatalog(
      OrgListItem,
      { ...scopeFilter(req), listKey, isActive: true },
      req,
      { sortOrder: 1, name: 1 }
    );
    result.items = result.items.map((p) => ({ ...p, name: normalizeText(p.name) }));
    return sendCatalog(res, result);
  } catch (error) {
    logger.error('Error fetching all org list:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const seedItems = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (isFreelancer(req.user)) {
      return res.status(403).json({
        message: 'Company starter libraries are managed by the organization. You may add your own values only.',
      });
    }
    const { listKey } = req.params;
    if (!assertKey(listKey, res)) return;
    const scope = scopeFilter(req);
    const existing = await OrgListItem.countDocuments({ ...scope, listKey, isActive: true });
    if (existing > 0 && !req.body?.force) {
      return res.status(400).json({ message: 'List already has items. Pass force:true to re-seed missing only.' });
    }
    const names = SEEDS[listKey] || [];
    const created = await seedNamedList(OrgListItem, {
      scope: { ...scope, listKey },
      names,
      user: req.user,
      extraFields: (i) => ({ listKey, sortOrder: i }),
    });
    if (listKey === 'product' && req.user.organizationId) {
      await skillCatalogSync.reconcileSkillCatalog(req.user.organizationId, req.user.id);
    }
    res.status(201).json({ success: true, added: created.length, data: created });
  } catch (error) {
    logger.error('Error seeding org list:', error);
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
      if (isFreelancer(req.user)) {
        const ownsInactive = String(existingInactive.createdBy || '') === String(req.user.id);
        if (!ownsInactive) {
          return res.status(403).json({
            message: 'This value already exists in the company library and cannot be recreated from your desk.',
          });
        }
      }
      existingInactive.isActive = true;
      existingInactive.description = description?.trim() ?? existingInactive.description;
      existingInactive.updatedAt = new Date();
      await existingInactive.save();
      if (listKey === 'product') {
        await skillCatalogSync.promoteNamesSafe(req.user.organizationId, req.user.id, existingInactive.name);
      }
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
    if (listKey === 'product') {
      await skillCatalogSync.promoteNamesSafe(req.user.organizationId, req.user.id, item.name);
    }
    res.status(201).json(item);
  } catch (error) {
    logger.error('Error creating org list item:', error);
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
    const ownershipScope = isFreelancer(req.user) ? createdByFilter(req.user) : {};
    const item = await OrgListItem.findOne({ _id: id, listKey, ...scope, ...ownershipScope });
    if (!item) {
      return res.status(isFreelancer(req.user) ? 403 : 404).json({
        message: isFreelancer(req.user)
          ? 'You can only edit values you added. Company library values are read-only.'
          : 'Item not found',
      });
    }

    const previousName = item.name;
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
    if (listKey === 'product' && req.user.organizationId) {
      if (name && previousName && skillCatalogSync.nameKey(previousName) !== skillCatalogSync.nameKey(item.name)) {
        await skillCatalogSync.renameLinked(req.user.organizationId, previousName, item.name).catch((err) => {
          logger.warn('skill catalog rename failed:', err.message);
        });
      } else {
        await skillCatalogSync.promoteNamesSafe(req.user.organizationId, req.user.id, item.name);
      }
    }
    res.json(item);
  } catch (error) {
    logger.error('Error updating org list item:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteItem = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { listKey, id } = req.params;
    if (!assertKey(listKey, res)) return;
    const ownershipScope = isFreelancer(req.user) ? createdByFilter(req.user) : {};
    const existing = await OrgListItem.findOne({ _id: id, listKey, ...scopeFilter(req), ...ownershipScope });
    if (!existing) {
      return res.status(isFreelancer(req.user) ? 403 : 404).json({
        message: isFreelancer(req.user)
          ? 'You can only remove values you added. Company library values are read-only.'
          : 'Item not found',
      });
    }
    const removedName = existing.name;
    await existing.deleteOne();
    if (listKey === 'product' && req.user.organizationId) {
      await skillCatalogSync.removeLinked(req.user.organizationId, removedName).catch((err) => {
        logger.warn('skill catalog remove failed:', err.message);
      });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    logger.error('Error deleting org list item:', error);
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
