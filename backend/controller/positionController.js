const Position = require('../models/Position');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');
const { masterDataScope, isFreelancer, createdByFilter } = require('../utils/dataScope');
const { seedNamedList } = require('../utils/seedNamedList');
const { findNamedCatalog, sendCatalog } = require('../utils/paginatedCatalog');
const positionCatalog = require('../services/positionCatalogSync');
const logger = require('../utils/logger');

const scopeFilter = (req) => masterDataScope(req);
const catalogScope = (req) => (
  req.user?.organizationId
    ? { organizationId: req.user.organizationId }
    : scopeFilter(req)
);

const POSITION_SEEDS = [
  'SALES EXECUTIVE',
  'RELATIONSHIP MANAGER',
  'TEAM LEADER',
  'BRANCH MANAGER',
  'ASSISTANT SALES MANAGER',
  'OPERATIONS EXECUTIVE',
  'CUSTOMER SERVICE EXECUTIVE',
  'CREDIT ANALYST',
  'COLLECTION EXECUTIVE',
  'HR EXECUTIVE',
];

// Get all positions (scoped to the caller's organization)
const getPositions = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const positions = await Position.find({ ...catalogScope(req), isActive: true }).sort({ name: 1 });
    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all positions across the organization.
// Unpaged `/all` stays a plain array for older clients.
// `?page=&limit=` returns { items, total, page, limit } for the Manage modal.
const getAllPositions = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const result = await findNamedCatalog(Position, { ...catalogScope(req), isActive: true }, req);
    return sendCatalog(res, result);
  } catch (error) {
    console.error('Error fetching all positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new position (org-wide catalog; reuses an existing row on duplicate)
const createPosition = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { name, description } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Position name is required' });
    }

    const existingActive = await Position.findOne({
      ...catalogScope(req),
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
      isActive: true,
    });
    if (existingActive) {
      return res.status(400).json({ message: 'Position already exists' });
    }

    const position = await positionCatalog.ensurePosition(
      req.user.organizationId,
      userId,
      name,
      description
    );
    if (!position) {
      return res.status(400).json({ message: 'Position name is required' });
    }
    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating position:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Position already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a position; freelancers may only edit positions they created.
const updatePosition = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const scope = catalogScope(req);

    const ownershipScope = isFreelancer(req.user) ? createdByFilter(req.user) : {};
    const position = await Position.findOne({ _id: id, ...scope, ...ownershipScope });
    if (!position) {
      return res.status(isFreelancer(req.user) ? 403 : 404).json({
        message: isFreelancer(req.user) ? 'You can only edit positions you added' : 'Position not found',
      });
    }

    const previousName = position.name;
    if (name) {
      const existingPosition = await Position.findOne({
        ...scope,
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });
      if (existingPosition) {
        return res.status(400).json({ message: 'Position name already exists' });
      }
      position.name = normalizeText(name);
    }

    if (description !== undefined) {
      position.description = description?.trim();
    }

    if (isActive !== undefined) {
      position.isActive = isActive;
    }

    position.updatedAt = new Date();
    await position.save();

    if (
      req.user.organizationId &&
      name &&
      positionCatalog.nameKey(previousName) !== positionCatalog.nameKey(position.name)
    ) {
      await positionCatalog.renameLinked(req.user.organizationId, previousName, position.name).catch((err) => {
        logger.warn('position rename sync failed:', err.message);
      });
    }

    res.json(position);
  } catch (error) {
    console.error('Error updating position:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Position name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a position; freelancers may only delete positions they created.
const deletePosition = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const ownershipScope = isFreelancer(req.user) ? createdByFilter(req.user) : {};
    const result = await Position.deleteOne({ _id: id, ...catalogScope(req), ...ownershipScope });
    if (result.deletedCount === 0) {
      return res.status(isFreelancer(req.user) ? 403 : 404).json({
        message: isFreelancer(req.user) ? 'You can only delete positions you added' : 'Position not found',
      });
    }

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const seedPositions = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (isFreelancer(req.user)) {
      return res.status(403).json({
        message: 'Company starter libraries are managed by the organization. You may add your own positions only.',
      });
    }
    const scope = catalogScope(req);
    const existing = await Position.countDocuments({ ...scope, isActive: true });
    if (existing > 0 && !req.body?.force) {
      return res.status(400).json({ message: 'List already has items. Pass force:true to re-seed missing only.' });
    }
    const created = await seedNamedList(Position, {
      scope,
      names: POSITION_SEEDS,
      user: req.user,
    });
    res.status(201).json({ success: true, added: created.length, data: created });
  } catch (error) {
    logger.error('Error seeding positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPositions,
  getAllPositions,
  createPosition,
  updatePosition,
  deletePosition,
  seedPositions,
};
