const mongoose = require('mongoose');
const Client = require('../models/Client');
const { normalizeText, escapeRegex } = require('../utils/textNormalize');
const { planHasFeature } = require('../config/planFeatures');
const logger = require('../utils/logger');

// Tenant scope: prefer organizationId (multi-tenant safe); fall back to
// createdBy only for legacy users somehow without an org.
const scopeFilter = (req) => (
  req.user.organizationId ? { organizationId: req.user.organizationId } : { createdBy: req.user.id }
);

/**
 * Per-client sharing/permissions ('agency.clientSharing', Enterprise only).
 * A Client with a non-empty `restrictedToUsers` is only visible to those
 * users (plus owner/admin, who always see every client for management).
 * On any other plan — or for owner/admin — this is a no-op so existing
 * "everyone sees every client" behavior is unchanged.
 */
const applyClientSharingFilter = async (req, baseFilter) => {
  if (req.user.role === 'owner' || req.user.role === 'admin') return baseFilter;

  const Organization = mongoose.model('Organization');
  const org = await Organization.findById(req.user.organizationId).select('plan');
  if (!org || !planHasFeature(org.plan, 'agency.clientSharing')) return baseFilter;

  return {
    ...baseFilter,
    $or: [
      { restrictedToUsers: { $exists: false } },
      { restrictedToUsers: { $size: 0 } },
      { restrictedToUsers: req.user.id }
    ]
  };
};

// Get all clients (scoped to the caller's organization, minus any per-client restriction)
const getClients = async (req, res) => {
  try {
    const filter = await applyClientSharingFilter(req, { ...scopeFilter(req), isActive: true });
    const clients = await Client.find(filter).sort({ name: 1 });
    res.json(clients);
  } catch (error) {
    logger.error('Error fetching clients:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Admin-only: set which users a client is restricted to (empty = everyone). */
const setClientSharing = async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only owners/admins can manage client sharing' });
    }
    const { userIds } = req.body;
    const client = await Client.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.restrictedToUsers = Array.isArray(userIds) ? userIds : [];
    client.updatedAt = new Date();
    await client.save();
    res.json(client);
  } catch (error) {
    logger.error('Error setting client sharing:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all clients across the organization (same as getClients now that both
// are org-scoped; kept for backward-compatible route/response shape)
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find({ ...scopeFilter(req), isActive: true }).sort({ name: 1 }).lean();
    const userIdStr = req.user?.id?.toString();
    const withOwner = clients.map(c => ({ ...c, isMine: c.createdBy?.toString() === userIdStr }));
    res.json(withOwner);
  } catch (error) {
    logger.error('Error fetching all clients:', error);
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

    const scope = scopeFilter(req);

    const existingActive = await Client.findOne({ ...scope, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: true });
    if (existingActive) {
      return res.status(400).json({ message: 'Client already exists' });
    }

    const existingInactive = await Client.findOne({ ...scope, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }, isActive: false });
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
      createdBy: req.user.id,
      organizationId: req.user.organizationId
    });

    await client.save();
    res.status(201).json(client);
  } catch (error) {
    logger.error('Error creating client:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Client already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a client (any authenticated user in the same organization can edit)
const updateClient = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const scope = scopeFilter(req);

    const client = await Client.findOne({ _id: id, ...scope });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    if (name) {
      const existingClient = await Client.findOne({
        ...scope,
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
    logger.error('Error updating client:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Client name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a client (any authenticated user in the same organization can delete)
const deleteClient = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const { id } = req.params;

    const result = await Client.deleteOne({ _id: id, ...scopeFilter(req) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    logger.error('Error deleting client:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Admin-only: enable/generate the client-facing read-only portal link. */
const enableClientPortal = async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only owners/admins can manage the client portal' });
    }
    const client = await Client.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.portal.enabled = true;
    if (!client.portal.token) client.portal.token = Client.generatePortalToken();
    if (req.body.contactEmail !== undefined) client.portal.contactEmail = req.body.contactEmail.trim();
    await client.save();

    res.json({ ...client.toObject(), portalUrl: `${process.env.FRONTEND_URL || ''}/client-portal/${client.portal.token}` });
  } catch (error) {
    logger.error('Error enabling client portal:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const disableClientPortal = async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only owners/admins can manage the client portal' });
    }
    const client = await Client.findOne({ _id: req.params.id, ...scopeFilter(req) });
    if (!client) return res.status(404).json({ message: 'Client not found' });

    client.portal.enabled = false;
    await client.save();
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getClients,
  getAllClients,
  createClient,
  updateClient,
  deleteClient,
  setClientSharing,
  enableClientPortal,
  disableClientPortal
};
