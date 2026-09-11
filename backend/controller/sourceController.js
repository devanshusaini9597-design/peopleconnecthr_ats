const Source = require('../models/Source');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');
const { masterDataScope, isFreelancer, createdByFilter } = require('../utils/dataScope');
const { seedNamedList } = require('../utils/seedNamedList');
const { findNamedCatalog, sendCatalog } = require('../utils/paginatedCatalog');
const logger = require('../utils/logger');

const scopeFilter = (req) => masterDataScope(req);

const SOURCE_SEEDS = ['LINKEDIN', 'INDEED', 'NAUKRI', 'REFERRAL', 'DIRECT', 'FREELANCE'];

// Get all sources (scoped to the caller's organization)
const getSources = async (req, res) => {
  try {
    const sources = await Source.find({ ...scopeFilter(req), isActive: true }).sort({ name: 1 });
    res.json(sources);
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all sources across the organization.
// Unpaged `/all` stays a plain array. `?page=&limit=` returns a page object.
const getAllSources = async (req, res) => {
  try {
    const result = await findNamedCatalog(Source, { ...scopeFilter(req), isActive: true }, req);
    return sendCatalog(res, result);
  } catch (error) {
    console.error('Error fetching all sources:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new source
const createSource = async (req, res) => {
  try {
    const { name, description } = req.body;
    const scope = scopeFilter(req);

    if (!name) {
      return res.status(400).json({ message: 'Source name is required' });
    }

    const existingActive = await Source.findOne({ ...scope, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: true });
    if (existingActive) {
      return res.status(400).json({ message: 'Source already exists' });
    }

    const existingInactive = await Source.findOne({ ...scope, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: false });
    if (existingInactive) {
      if (isFreelancer(req.user)) {
        const ownsInactive = String(existingInactive.createdBy || '') === String(req.user.id);
        if (!ownsInactive) {
          return res.status(403).json({
            message: 'This source already exists in the company library and cannot be recreated from your desk.',
          });
        }
      }
      existingInactive.isActive = true;
      existingInactive.description = description?.trim() ?? existingInactive.description;
      existingInactive.updatedAt = new Date();
      await existingInactive.save();
      return res.status(201).json(existingInactive);
    }

    const source = new Source({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: req.user.id,
      organizationId: req.user.organizationId
    });

    await source.save();
    res.status(201).json(source);
  } catch (error) {
    console.error('Error creating source:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Source already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a source. Freelancers may only edit sources they created.
const updateSource = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const scope = scopeFilter(req);

    const ownershipScope = isFreelancer(req.user) ? createdByFilter(req.user) : {};
    const source = await Source.findOne({ _id: id, ...scope, ...ownershipScope });
    if (!source) {
      return res.status(isFreelancer(req.user) ? 403 : 404).json({
        message: isFreelancer(req.user)
          ? 'You can only edit sources you added. Company library values are read-only.'
          : 'Source not found',
      });
    }

    if (name) {
      const existingSource = await Source.findOne({
        ...scope,
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });
      if (existingSource) {
        return res.status(400).json({ message: 'Source name already exists' });
      }
      source.name = normalizeText(name);
    }

    if (description !== undefined) {
      source.description = description?.trim();
    }

    if (isActive !== undefined) {
      source.isActive = isActive;
    }

    source.updatedAt = new Date();
    await source.save();

    res.json(source);
  } catch (error) {
    console.error('Error updating source:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Source name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a source. Freelancers may only delete sources they created.
const deleteSource = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const ownershipScope = isFreelancer(req.user) ? createdByFilter(req.user) : {};
    const result = await Source.deleteOne({ _id: id, ...scopeFilter(req), ...ownershipScope });
    if (result.deletedCount === 0) {
      return res.status(isFreelancer(req.user) ? 403 : 404).json({
        message: isFreelancer(req.user)
          ? 'You can only remove sources you added. Company library values are read-only.'
          : 'Source not found',
      });
    }

    res.json({ message: 'Source deleted successfully' });
  } catch (error) {
    console.error('Error deleting source:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const seedSources = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (isFreelancer(req.user)) {
      return res.status(403).json({
        message: 'Company starter libraries are managed by the organization. You may add your own values only.',
      });
    }
    const scope = scopeFilter(req);
    const existing = await Source.countDocuments({ ...scope, isActive: true });
    if (existing > 0 && !req.body?.force) {
      return res.status(400).json({ message: 'List already has items. Pass force:true to re-seed missing only.' });
    }
    const created = await seedNamedList(Source, {
      scope,
      names: SOURCE_SEEDS,
      user: req.user,
    });
    res.status(201).json({ success: true, added: created.length, data: created });
  } catch (error) {
    logger.error('Error seeding sources:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSources,
  getAllSources,
  createSource,
  updateSource,
  deleteSource,
  seedSources,
};
