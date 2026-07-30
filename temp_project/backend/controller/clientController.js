const Client = require('../models/Client');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');

// Get all clients (user's own)
const getClients = async (req, res) => {
  try {
    const clients = await Client.find({ createdBy: req.user.id, isActive: true }).sort({ name: 1 });
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all clients across company (all users)
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true }).sort({ name: 1 }).lean();
    const userIdStr = req.user?.id?.toString();
    const withOwner = clients.map(c => ({ ...c, isMine: c.createdBy?.toString() === userIdStr }));
    res.json(withOwner);
  } catch (error) {
    console.error('Error fetching all clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new client
const createClient = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Client name is required' });
    }

    const existingActive = await Client.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: true });
    if (existingActive) {
      return res.status(400).json({ message: 'Client already exists' });
    }

    const existingInactive = await Client.findOne({ createdBy: req.user.id, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: false });
    if (existingInactive) {
      existingInactive.isActive = true;
      existingInactive.description = description?.trim() ?? existingInactive.description;
      existingInactive.updatedAt = new Date();
      await existingInactive.save();
      return res.status(201).json(existingInactive);
    }

    const client = new Client({
      name: normalizeText(name),
      description: description?.trim(),
      createdBy: req.user.id
    });

    await client.save();
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Client already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a client (any authenticated user can edit any client)
const updateClient = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const client = await Client.findOne({ _id: id });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (name) {
      const existingClient = await Client.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
        _id: { $ne: id },
        isActive: true
      });
      if (existingClient) {
        return res.status(400).json({ message: 'Client name already exists' });
      }
      client.name = normalizeText(name);
    }

    if (description !== undefined) {
      client.description = description?.trim();
    }

    if (isActive !== undefined) {
      client.isActive = isActive;
    }

    client.updatedAt = new Date();
    await client.save();

    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Client name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a client (any authenticated user can delete any client)
const deleteClient = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const result = await Client.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getClients,
  getAllClients,
  createClient,
  updateClient,
  deleteClient
};
