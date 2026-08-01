const express = require('express');
const router = express.Router();
const { getClients, getAllClients, createClient, updateClient, deleteClient, setClientSharing, enableClientPortal, disableClientPortal } = require('../controller/clientController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

// NOTE: agency.multiClient is NOT gated here on purpose. This Client list is
// used as a plain dropdown/tag on the core "Add Candidate" flow on every
// plan (see AddCandidatePage.jsx, CandidateModal.jsx) — it's not exclusively
// the agency/recruiting-firm feature described in the product blueprint.
// Gating this route would break basic candidate entry for Starter orgs.
// Treat "agency mode" (per-client permissions, client portal) as a separate,
// not-yet-built feature layered on top of this list, not this CRUD itself.

// All routes require authentication
router.use(verifyToken);

// Routes — /all must be before /:id
router.get('/all', getAllClients);
router.get('/', getClients);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

// ── Agency mode (Enterprise) ─────────────────────────────────────────
router.put('/:id/sharing', requireFeature('agency.clientSharing'), setClientSharing);
router.post('/:id/portal/enable', requireFeature('agency.clientPortal'), enableClientPortal);
router.post('/:id/portal/disable', requireFeature('agency.clientPortal'), disableClientPortal);

module.exports = router;
