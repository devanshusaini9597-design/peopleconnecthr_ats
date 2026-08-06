/**
 * SCIM 2.0 User provisioning — Enterprise (sso.scim).
 * Mounted at /scim/v2 — bearer token auth (not session JWT).
 * Thin wrappers; domain logic in scimService.
 */
const express = require('express');
const router = express.Router();
const svc = require('../services/scimService');

function handle(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    detail: error.message,
    status: String(status)
  });
}

router.use(svc.scimAuth);

router.get('/Users', async (req, res) => {
  try {
    const body = await svc.listUsers(req.scimOrgId, req.query.filter);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.get('/Users/:id', async (req, res) => {
  try {
    const body = await svc.getUser(req.scimOrgId, req.params.id);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.post('/Users', async (req, res) => {
  try {
    const body = await svc.createUser(req.scimOrgId, req.body);
    res.status(201).json(body);
  } catch (error) {
    handle(res, error);
  }
});

router.patch('/Users/:id', async (req, res) => {
  try {
    const body = await svc.patchUser(req.scimOrgId, req.params.id, req.body);
    res.json(body);
  } catch (error) {
    handle(res, error);
  }
});

/** Re-export for ssoRoutes (`require('./scimRoutes').issueScimToken`) */
module.exports = router;
module.exports.issueScimToken = svc.issueScimToken;
