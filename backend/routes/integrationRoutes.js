/**
 * Integration (BYOK) Config Routes
 *
 * CRUD + test-connection for per-org third-party integrations.
 * Thin wrappers; domain logic in integrationService.
 * Two independent gates apply:
 *  - RBAC: only owner/admin may view or change integration config.
 *  - Entitlement: the org's plan must include the requested category
 *    (mirrors the check in adapters/index.js so a Starter org can't
 *    self-configure a BYOK integration via direct API calls even if the
 *    frontend never shows the option).
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const svc = require('../services/integrationService');

function handle(res, error) {
  const status = error.statusCode || 500;
  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.feature) body.feature = error.feature;
  return res.status(status).json(body);
}

const requireCategoryEntitlement = async (req, res, next) => {
  try {
    await svc.assertCategoryEntitlement(
      req.user.organizationId,
      req.body.category || req.params.category
    );
    next();
  } catch (error) {
    handle(res, error);
  }
};

router.use(verifyToken, requireOrganization, tenantScope, requireAdmin);

/**
 * GET / — list all integration configs for this org (credentials never returned)
 */
router.get('/', async (req, res) => {
  try {
    const data = await svc.listIntegrations(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * POST / — create or update an integration config (upsert by org+provider)
 * Body: { category, provider, displayName, credentials: {...} }
 */
router.post('/', requireCategoryEntitlement, async (req, res) => {
  try {
    const { isNew, data } = await svc.upsertIntegration(
      req.user.organizationId,
      req.user.id,
      req.body
    );
    res.status(isNew ? 201 : 200).json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * POST /:id/test — validate stored credentials by calling the provider
 */
router.post('/:id/test', async (req, res) => {
  try {
    const result = await svc.testIntegration(
      req.user.organizationId,
      req.params.id,
      req.user.id
    );
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * PUT /:id/activate — set isActive true/false
 */
router.put('/:id/activate', async (req, res) => {
  try {
    const data = await svc.setIntegrationActive(
      req.user.organizationId,
      req.params.id,
      req.user.id,
      req.body.isActive
    );
    res.json({ success: true, data });
  } catch (error) {
    handle(res, error);
  }
});

/**
 * DELETE /:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await svc.deleteIntegration(req.user.organizationId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
