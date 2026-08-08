/**
 * Route mounting helper (partial Fix 10).
 * Primary mounts still live in server.js; this documents the target layout
 * and mounts the extracted auth + job routers for reuse/tests.
 */
const { verifyToken } = require('../middleware/authMiddleware');

const mountExtractedRoutes = (app) => {
  app.use('/api', require('../routes/authRoutes'));
  app.use('/api/profile', require('../routes/profileRoutes'));
  app.use('/jobs', require('../routes/jobRoutes'));
  app.use('/api/jobs', require('../routes/jobRoutes'));
  app.use('/candidates', verifyToken, require('../routes/candidateRoutes'));
  app.use('/api/candidates', verifyToken, require('../routes/candidateRoutes'));
};

module.exports = { mountExtractedRoutes };
