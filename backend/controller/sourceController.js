const Source = require('../models/Source');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');

// Tenant scope: prefer organizationId (multi-tenant safe); fall back to
// createdBy only for legacy users somehow without an org.
const scopeFilter = (req) => (
  req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id }
);

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

// Get all sources across the organization (kept for backward-compatible route/response shape)
const getAllSources = async (req, res) => {
  try {
    const sources = await Source.find({ ...scopeFilter(req), isActive: true }).sort({ name: 1 }).lean();
    const userIdStr = req.user?.id?.toString();
    const withOwner = sources.map(s => ({ ...s, isMine: s.createdBy?.toString() === userIdStr }));
    res.json(withOwner);
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

// Update a source (any authenticated user in the same organization can edit)
const updateSource = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const scope = scopeFilter(req);

    const source = await Source.findOne({ _id: id, ...scope });
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
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

// Delete a source (any authenticated user in the same organization can delete)
const deleteSource = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const result = await Source.deleteOne({ _id: id, ...scopeFilter(req) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Source not found' });
    }

    res.json({ message: 'Source deleted successfully' });
  } catch (error) {
    console.error('Error deleting source:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSources,
  getAllSources,
  createSource,
  updateSource,
  deleteSource
};
