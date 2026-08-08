/**
 * Approval workflows domain logic.
 */
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ApprovalInstance = require('../models/ApprovalInstance');
const Job = require('../models/Job');
const Application = require('../models/Application');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function listWorkflows(organizationId) {
  return ApprovalWorkflow.find({ organizationId }).sort({ createdAt: -1 });
}

async function createWorkflow(organizationId, userId, body) {
  const { name, entityType, steps } = body;
  if (!name || !entityType) {
    throw httpError('name and entityType are required');
  }
  const workflow = new ApprovalWorkflow({
    organizationId,
    name,
    entityType,
    steps: steps || [],
    createdBy: userId
  });
  await workflow.save();
  return workflow;
}

async function updateWorkflow(organizationId, id, body) {
  const workflow = await ApprovalWorkflow.findOne({ _id: id, organizationId });
  if (!workflow) throw httpError('Workflow not found', 404);
  const { name, steps, isActive } = body;
  if (name) workflow.name = name;
  if (steps) workflow.steps = steps;
  if (isActive !== undefined) workflow.isActive = isActive;
  await workflow.save();
  return workflow;
}

async function listInstances(organizationId, { status } = {}) {
  const filter = { organizationId };
  if (status) filter.status = status;
  return ApprovalInstance.find(filter).sort({ createdAt: -1 }).limit(100);
}

async function submitForApproval(organizationId, userId, body) {
  const { entityType, entityId, workflowId } = body;
  if (!entityType || !entityId) {
    throw httpError('entityType and entityId are required');
  }

  let workflow;
  if (workflowId) {
    workflow = await ApprovalWorkflow.findOne({ _id: workflowId, organizationId, isActive: true });
  } else {
    workflow = await ApprovalWorkflow.findOne({ organizationId, entityType, isActive: true });
  }
  if (!workflow || !workflow.steps.length) {
    throw httpError('No active approval workflow configured for this entity type.');
  }

  const existing = await ApprovalInstance.findOne({
    organizationId,
    entityType,
    entityId,
    status: 'pending'
  });
  if (existing) {
    throw httpError('This item is already pending approval.');
  }

  let entityLabel = '';
  if (entityType === 'job_req') {
    const job = await Job.findOne({ _id: entityId, organizationId });
    if (!job) throw httpError('Job not found', 404);
    entityLabel = job.title;
  } else if (entityType === 'offer') {
    const app = await Application.findOne({ _id: entityId, organizationId });
    if (!app) throw httpError('Application not found', 404);
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
    organizationId,
    workflowId: workflow._id,
    entityType,
    entityId,
    entityLabel,
    steps: instanceSteps,
    submittedBy: userId
  });
  await instance.save();
  return instance;
}

async function approveInstance(organizationId, id, userId, comment) {
  const instance = await ApprovalInstance.findOne({ _id: id, organizationId });
  if (!instance) throw httpError('Approval instance not found', 404);
  if (instance.status !== 'pending') {
    throw httpError('This approval is no longer pending.');
  }

  const step = instance.steps[instance.currentStepIndex];
  if (!step) throw httpError('No pending step');

  step.status = 'approved';
  step.actedBy = userId;
  step.actedAt = new Date();
  step.comment = comment || '';

  if (instance.currentStepIndex >= instance.steps.length - 1) {
    instance.status = 'approved';
    instance.completedAt = new Date();
  } else {
    instance.currentStepIndex += 1;
  }
  await instance.save();
  return instance;
}

async function rejectInstance(organizationId, id, userId, comment) {
  const instance = await ApprovalInstance.findOne({ _id: id, organizationId });
  if (!instance) throw httpError('Approval instance not found', 404);
  if (instance.status !== 'pending') {
    throw httpError('This approval is no longer pending.');
  }

  const step = instance.steps[instance.currentStepIndex];
  if (step) {
    step.status = 'rejected';
    step.actedBy = userId;
    step.actedAt = new Date();
    step.comment = comment || '';
  }
  instance.status = 'rejected';
  instance.completedAt = new Date();
  await instance.save();
  return instance;
}

module.exports = {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  listInstances,
  submitForApproval,
  approveInstance,
  rejectInstance,
};
