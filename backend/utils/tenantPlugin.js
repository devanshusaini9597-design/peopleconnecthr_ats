/**
 * Mongoose Tenant Scoping Plugin
 *
 * Automatically adds organizationId to query filters when the _tenantId
 * option is set on the query. Prevents accidental cross-tenant data access.
 *
 * Usage in models:
 *   const tenantPlugin = require('../utils/tenantPlugin');
 *   mySchema.plugin(tenantPlugin);
 *
 * Usage in routes (via tenantMiddleware):
 *   const docs = await Model.find({ status: 'active' }).setOptions({ _tenantId: req.user.organizationId });
 *
 * This plugin does NOT add the organizationId field to the schema —
 * each model already defines it. It only auto-injects the filter.
 */

module.exports = function tenantPlugin(schema) {
  // Query middleware — Aggregate is NOT a Query and has no getOptions().
  const queryOps = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
    'countDocuments', 'estimatedDocumentCount',
    'updateOne', 'updateMany',
    'deleteOne', 'deleteMany',
    'distinct',
  ];

  for (const op of queryOps) {
    schema.pre(op, function () {
      const tenantId = this.getOptions?.()?._tenantId;
      if (tenantId) {
        this.where({ organizationId: tenantId });
      }
    });
  }

  // Aggregate middleware uses this.options, not getOptions()
  schema.pre('aggregate', function () {
    const tenantId = this.options?._tenantId;
    if (tenantId) {
      this.pipeline().unshift({ $match: { organizationId: tenantId } });
    }
  });
};
