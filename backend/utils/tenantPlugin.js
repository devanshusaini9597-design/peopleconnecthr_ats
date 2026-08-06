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
  const queryOps = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
    'countDocuments', 'estimatedDocumentCount',
    'updateOne', 'updateMany',
    'deleteOne', 'deleteMany',
    'distinct', 'aggregate',
  ];

  for (const op of queryOps) {
    schema.pre(op, function () {
      const tenantId = this.getOptions()?._tenantId;
      if (tenantId) {
        if (op === 'aggregate') {
          // Prepend a $match stage for aggregation pipelines
          this.pipeline().unshift({ $match: { organizationId: tenantId } });
        } else {
          this.where({ organizationId: tenantId });
        }
      }
    });
  }
};
