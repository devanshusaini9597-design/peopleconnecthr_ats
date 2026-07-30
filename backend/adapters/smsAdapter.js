/**
 * SMS Adapter Stub
 */
module.exports = {
  send: async ({ to, message, organizationId }) => {
    throw new Error('SMS integration not configured');
  }
};
