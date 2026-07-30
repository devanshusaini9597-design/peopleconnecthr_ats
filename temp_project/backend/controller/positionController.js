const Position = require('../models/Position');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');

// Get all positions (user's own)
const getPositions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const positions = await Position.find({ createdBy: userId, isActive: true }).sort({ name: 1 });
    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all positions across company (all users) — for "View all positions added across company"
const getAllPositions = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const positions = await Position.find({ isActive: true }).sort({ name: 1 }).lean();
    const userIdStr = req.user.id.toString();
    const withOwner = positions.map(p => ({ ...p, isMine: p.createdBy?.toString() === userIdStr }));
    res.json(withOwner);
  } catch (error) {
    console.error('Error fetching all positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new position
const createPosition = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Position name is required' });
    }

    const existingActive = await Position.findOne({ createdBy: userId, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: true });
    if (existingActive) {
      return res.status(400).json({ message: 'Position already exists' });
    }

    // If user had soft-deleted this name before, reactivate it instead of creating duplicate
    const existingInactive = await Position.findOne({ createdBy: userId, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: false });
    if (existingInactive) {
      existingInactive.isActive = true;
      existingInactive.description = description?.trim() ?? existingInactive.description;
      existingInactive.updatedAt = new Date();
      await existingInactive.save();
      return res.status(201).json(existingInactive);
    }

    const position = new Position({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: userId
    });

    await position.save();
    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating position:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Position already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a position (any authenticated user can edit any position)
const updatePosition = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const position = await Position.findOne({ _id: id });
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }

    if (name) {
      const existingPosition = await Position.findOne({
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

    res.json(position);
  } catch (error) {
    console.error('Error updating position:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Position name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a position (any authenticated user can delete any position)
const deletePosition = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const result = await Position.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Position not found' });
    }

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPositions,
  getAllPositions,
  createPosition,
  updatePosition,
  deletePosition
};
