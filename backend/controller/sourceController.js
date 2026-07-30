const Source = require('../models/Source');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');

// Get all sources (user's own)
const getSources = async (req, res) => {
  try {
    const sources = await Source.find({ createdBy: req.user.id, isActive: true }).sort({ name: 1 });
    res.json(sources);
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all sources across company (all users)
const getAllSources = async (req, res) => {
  try {
    const sources = await Source.find({ isActive: true }).sort({ name: 1 }).lean();
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

    if (!name) {
      return res.status(400).json({ message: 'Source name is required' });
    }

    const existingActive = await Source.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: true });
    if (existingActive) {
      return res.status(400).json({ message: 'Source already exists' });
    }

    const existingInactive = await Source.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: false });
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
      createdBy: req.user.id
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

// Update a source (any authenticated user can edit any source)
const updateSource = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const source = await Source.findOne({ _id: id });
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }

    if (name) {
      const existingSource = await Source.findOne({
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

// Delete a source (any authenticated user can delete any source)
const deleteSource = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const result = await Source.deleteOne({ _id: id });
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
