/**
 * Approval workflows — Enterprise, gated by workflows.approvals.
 */
const express = require('express');
const router = express.Router();
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ApprovalInstance = require('../models/ApprovalInstance');
const Job = require('../models/Job');
const Application = require('../models/Application');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');

router.use(verifyToken, requireOrganization, tenantScope, requireFeature('workflows.approvals'));

/** GET /workflows */
router.get('/workflows', requireRecruiterOrAbove, async (req, res) => {
  try {
    const workflows = await ApprovalWorkflow.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 });
    res.json({ success: true, data: workflows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /workflows */
router.post('/workflows', requireAdmin, async (req, res) => {
  try {
    const { name, entityType, steps } = req.body;
    if (!name || !entityType) {
      return res.status(400).json({ success: false, message: 'name and entityType are required' });
    }
    const workflow = new ApprovalWorkflow({
      organizationId: req.user.organizationId,
      name,
      entityType,
      steps: steps || [],
      createdBy: req.user.id
    });
    await workflow.save();
    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** PUT /workflows/:id */
router.put('/workflows/:id', requireAdmin, async (req, res) => {
  try {
    const workflow = await ApprovalWorkflow.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
    const { name, steps, isActive } = req.body;
    if (name) workflow.name = name;
    if (steps) workflow.steps = steps;
    if (isActive !== undefined) workflow.isActive = isActive;
    await workflow.save();
    res.json({ success: true, data: workflow });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /instances */
router.get('/instances', requireRecruiterOrAbove, async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.query.status) filter.status = req.query.status;
    const instances = await ApprovalInstance.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: instances });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /submit — submit entity for approval */
router.post('/submit', requireRecruiterOrAbove, async (req, res) => {
  try {
    const { entityType, entityId, workflowId } = req.body;
    if (!entityType || !entityId) {
      return res.status(400).json({ success: false, message: 'entityType and entityId are required' });
    }

    let workflow;
    if (workflowId) {
      workflow = await ApprovalWorkflow.findOne({ _id: workflowId, organizationId: req.user.organizationId, isActive: true });
    } else {
      workflow = await ApprovalWorkflow.findOne({ organizationId: req.user.organizationId, entityType, isActive: true });
    }
    if (!workflow || !workflow.steps.length) {
      return res.status(400).json({ success: false, message: 'No active approval workflow configured for this entity type.' });
    }

    const existing = await ApprovalInstance.findOne({
      organizationId: req.user.organizationId,
      entityType,
      entityId,
      status: 'pending'
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This item is already pending approval.' });
    }

    let entityLabel = '';
    if (entityType === 'job_req') {
      const job = await Job.findOne({ _id: entityId, organizationId: req.user.organizationId });
      if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
      entityLabel = job.title;
    } else if (entityType === 'offer') {
      const app = await Application.findOne({ _id: entityId, organizationId: req.user.organizationId });
      if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
      entityLabel = `Offer for application ${app._id}`;
    }

    const instanceSteps = workflow.steps.map((s) => ({
      order: s.order,
      name: s.name,
      approverRole: s.approverRole,
      approverUserId: s.approverUserId,
      status: 'pending'
    }));

    const instance = new ApprovalInstance({
      organizationId: req.user.organizationId,
      workflowId: workflow._id,
      entityType,
      entityId,
      entityLabel,
      steps: instanceSteps,
      submittedBy: req.user.id
    });
    await instance.save();
    res.status(201).json({ success: true, data: instance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /instances/:id/approve */
router.post('/instances/:id/approve', requireRecruiterOrAbove, async (req, res) => {
  try {
    const instance = await ApprovalInstance.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!instance) return res.status(404).json({ success: false, message: 'Approval instance not found' });
    if (instance.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This approval is no longer pending.' });
    }

    const step = instance.steps[instance.currentStepIndex];
    if (!step) return res.status(400).json({ success: false, message: 'No pending step' });

    step.status = 'approved';
    step.actedBy = req.user.id;
    step.actedAt = new Date();
    step.comment = req.body.comment || '';

    if (instance.currentStepIndex >= instance.steps.length - 1) {
      instance.status = 'approved';
      instance.completedAt = new Date();
    } else {
      instance.currentStepIndex += 1;
    }
    await instance.save();
    res.json({ success: true, data: instance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /instances/:id/reject */
router.post('/instances/:id/reject', requireRecruiterOrAbove, async (req, res) => {
  try {
    const instance = await ApprovalInstance.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!instance) return res.status(404).json({ success: false, message: 'Approval instance not found' });
    if (instance.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This approval is no longer pending.' });
    }

    const step = instance.steps[instance.currentStepIndex];
    if (step) {
      step.status = 'rejected';
      step.actedBy = req.user.id;
      step.actedAt = new Date();
      step.comment = req.body.comment || '';
    }
    instance.status = 'rejected';
    instance.completedAt = new Date();
    await instance.save();
    res.json({ success: true, data: instance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
