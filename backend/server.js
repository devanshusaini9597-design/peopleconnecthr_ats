/**
 * SkillNix SaaS ATS — Server Entry Point
 * 
 * Multi-tenant SaaS backend for Applicant Tracking System.
 * 
 * Architecture:
 * - Express.js REST API
 * - MongoDB via Mongoose (multi-tenant with organizationId)
 * - JWT authentication with RBAC
 * - Event-driven architecture for extensibility
 * - BYOK adapter pattern for integrations
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./utils/logger');

// ── Global crash handlers ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'FATAL: Uncaught Exception — crashing process');
  // Give logger time to flush, then exit with failure code
  setTimeout(() => process.exit(1), 1000);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'FATAL: Unhandled Rejection — crashing process');
  // Throw so it becomes uncaughtException and triggers the handler above
  throw reason;
});

// ── Core imports ─────────────────────────────────────────────────────
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ── Models ───────────────────────────────────────────────────────────
const User = require('./models/User');
const Organization = require('./models/Organization');
const Job = require('./models/Job');
const Candidate = require('./models/Candidate');
const Application = require('./models/Application');

// ── Middleware ────────────────────────────────────────────────────────
const { verifyToken } = require('./middleware/authMiddleware');

// ── Event Bus ────────────────────────────────────────────────────────
const eventBus = require('./events/eventBus');
const { initNotificationListeners } = require('./events/listeners/notificationListener');
const { initAuditListeners } = require('./events/listeners/auditListener');
const { registerIntegrationHandoffListeners } = require('./events/listeners/integrationHandoffListener');
const { initSequenceTriggerListeners } = require('./events/listeners/sequenceTriggerListener');
initNotificationListeners();
initAuditListeners();
registerIntegrationHandoffListeners();
initSequenceTriggerListeners();

// ── Routes ───────────────────────────────────────────────────────────
const homeRoutes = require('./routes/home');
const companyRoutes = require('./routes/companyRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const emailRoutes = require('./routes/emailRoutes');
const emailTemplateRoutes = require('./routes/emailTemplateRoutes');
const positionRoutes = require('./routes/positionRoutes');
const clientRoutes = require('./routes/clientRoutes');
const sourceRoutes = require('./routes/sourceRoutes');
const orgListRoutes = require('./routes/orgListRoutes');
const exportRoutes = require('./routes/exportRoutes');
const emailSettingsRoutes = require('./routes/emailSettingsRoutes');
const companyEmailSettingsRoutes = require('./routes/companyEmailSettingsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const teamRoutes = require('./routes/teamRoutes');
const publicSubscribeRoutes = require('./routes/publicSubscribeRoutes');
const zohoOAuthRoutes = require('./routes/zohoOAuthRoutes');
const calendarOAuthRoutes = require('./routes/calendarOAuthRoutes');

// New SaaS routes
const organizationRoutes = require('./routes/organizationRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const billingRoutes = require('./routes/billingRoutes');
const careersRoutes = require('./routes/careersRoutes');
const portalRoutes = require('./routes/portalRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const customRoleRoutes = require('./routes/customRoleRoutes');
const ssoRoutes = require('./routes/ssoRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const publicApiRoutes = require('./routes/publicApiRoutes');
const jobBoardRoutes = require('./routes/jobBoardRoutes');
const backgroundCheckRoutes = require('./routes/backgroundCheckRoutes');
const esignRoutes = require('./routes/esignRoutes');
const reportScheduleRoutes = require('./routes/reportScheduleRoutes');
const clientPortalRoutes = require('./routes/clientPortalRoutes');
const talentPoolRoutes = require('./routes/talentPoolRoutes');
const skillsRoutes = require('./routes/skillsRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const sequenceRoutes = require('./routes/sequenceRoutes');
const deiRoutes = require('./routes/deiRoutes');
const formBuilderRoutes = require('./routes/formBuilderRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const savedSearchRoutes = require('./routes/savedSearchRoutes');
const scorecardTemplateRoutes = require('./routes/scorecardTemplateRoutes');
const commentRoutes = require('./routes/commentRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const publicAnnouncementRoutes = require('./routes/publicAnnouncementRoutes');
const globalSearchRoutes = require('./routes/globalSearchRoutes');
const transcriptRoutes = require('./routes/transcriptRoutes');
const consentRoutes = require('./routes/consentRoutes');
const pushRoutes = require('./routes/pushRoutes');
const companyBrandRoutes = require('./routes/companyBrandRoutes');
const reportsStudioRoutes = require('./routes/reportsStudioRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const whiteLabelRoutes = require('./routes/whiteLabelRoutes');
const chromeExtensionRoutes = require('./routes/chromeExtensionRoutes');
const mfaRoutes = require('./routes/mfaRoutes');
const securityRoutes = require('./routes/securityRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const scimRoutes = require('./routes/scimRoutes');
const aiFeatureRoutes = require('./routes/aiFeatureRoutes');
const statusRoutes = require('./routes/statusRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const offerTemplateRoutes = require('./routes/offerTemplateRoutes');
const schedulingRoutes = require('./routes/schedulingRoutes');
const careerPageBuilderRoutes = require('./routes/careerPageBuilderRoutes');
const referralRoutes = require('./routes/referralRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const slackAppRoutes = require('./routes/slackAppRoutes');

// ── Services ─────────────────────────────────────────────────────────
const { startNotificationScheduler } = require('./services/notificationService');
const { initWebhookDispatcher } = require('./services/webhookDispatcher');
const { startReportScheduler } = require('./services/reportScheduler');

// ── App Setup ────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', 1);

// ── Security Middleware ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL, "https://api.stripe.com"].filter(Boolean),
      frameSrc: ["'self'", "https://js.stripe.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
}));

// ── Rate Limiting ────────────────────────────────────────────────────
// Auth rate limit lives in routes/authRoutes.js

// Demo login kept available for sales demos (user request) — see routes/authRoutes.js
const APP_FRONTEND_URL = process.env.FRONTEND_URL;
if (!APP_FRONTEND_URL && process.env.NODE_ENV === 'production') {
  logger.warn('FRONTEND_URL env var not set. CORS and redirects may not work correctly.');
}

// ── Global API Rate Limit ────────────────────────────────────────────
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute window
  max: 300,                // 300 requests per minute per IP
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});

// ── Request Timeout ──────────────────────────────────────────────────
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  next();
});

// ── Stripe webhook (must be mounted BEFORE express.json(), needs raw body
//    + no auth — Stripe calls this directly, not a logged-in user) ────
const stripeWebhookRoutes = require('./routes/stripeWebhookRoutes');
app.use('/api/billing/webhook', stripeWebhookRoutes);

// ── CORS ─────────────────────────────────────────────────────────────
// Production: only FRONTEND_URL + known production hosts (no localhost).
const productionOrigins = [
  'https://skillnix-ats-frontend.onrender.com',
  APP_FRONTEND_URL,
].filter(Boolean);

const developmentOrigins = [
  ...productionOrigins,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const allowedOriginList =
  process.env.NODE_ENV === 'production' ? productionOrigins : developmentOrigins;

function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true);
  if (allowedOriginList.includes(origin)) return cb(null, origin);
  // Extra localhost only outside production
  if (process.env.NODE_ENV !== 'production') {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return cb(null, origin);
  } else {
    logger.warn({ origin }, 'CORS blocked origin');
  }
  return cb(null, false);
}
app.use(cors({ origin: corsOrigin, credentials: true, optionsSuccessStatus: 200 }));
app.options('*', cors({ origin: corsOrigin, credentials: true, optionsSuccessStatus: 200 }));

// ── Body Parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Structured HTTP request logging (skips health checks)
try {
  const pinoHttp = require('pino-http');
  app.use(pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/health' },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }));
} catch (e) {
  logger.warn('pino-http not available — falling back to default logging');
}

app.use('/api', globalApiLimiter);

// Soft API versioning: accept /api/v1/* as an alias for /api/*
// Prefer /api/v1 for new clients; unversioned /api remains for compat.
app.use((req, _res, next) => {
  if (req.url === '/api/v1' || req.url.startsWith('/api/v1/') || req.url.startsWith('/api/v1?')) {
    req.url = req.url.replace(/^\/api\/v1/, '/api');
  }
  next();
});
// Also expose candidates under /api/v1/candidates → rewrite handled above when using /api/v1/candidates
// Legacy /candidates stays mounted below for older clients.

// ══════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════

// ── Public routes (no auth) ──────────────────────────────────────────
app.use('/api', require('./routes/authRoutes'));
app.use('/api', homeRoutes);
app.use('/api/public', publicSubscribeRoutes);
app.use('/oauth/zoho', zohoOAuthRoutes);
app.use('/oauth/google-calendar', calendarOAuthRoutes); // public callback (Google redirects here directly)
app.use('/api/integrations/oauth/google-calendar', calendarOAuthRoutes); // authenticated auth-url endpoint
const outlookCalendarOAuthRoutes = require('./routes/outlookCalendarOAuthRoutes');
app.use('/oauth/outlook-calendar', outlookCalendarOAuthRoutes);
app.use('/api/integrations/oauth/outlook-calendar', outlookCalendarOAuthRoutes);
app.use('/sso', ssoRoutes.publicRouter); // public SAML/OIDC SP endpoints
app.use('/scim/v2', scimRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/career-page', careerPageBuilderRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/client-portal', clientPortalRoutes); // public, token-gated — see routes/clientPortalRoutes.js

// ── Auth routes (rate limited) ───────────────────────────────────────
app.use('/api/onboarding', onboardingRoutes);

// ── Protected routes ─────────────────────────────────────────────────
app.use('/api/mfa', mfaRoutes);
app.use('/api/security', verifyToken, securityRoutes);
app.use('/api/compliance', verifyToken, complianceRoutes);
app.use('/api/organization', verifyToken, organizationRoutes);
app.use('/api/applications', verifyToken, applicationRoutes);
app.use('/api/interviews', verifyToken, interviewRoutes);
app.use('/api/billing', billingRoutes); // webhook is mounted separately above; this router applies verifyToken internally
app.use('/api/integrations', integrationRoutes);
app.use('/api/custom-roles', verifyToken, customRoleRoutes);
app.use('/api/sso', ssoRoutes); // internally applies verifyToken per-route (config CRUD) except /exchange which is public by design
app.use('/api/webhooks', webhookRoutes); // internally applies verifyToken + requireFeature
app.use('/api/api-keys', apiKeyRoutes); // internally applies verifyToken + requireFeature
app.use('/api/v1/public', publicApiRoutes); // API-key auth (not session JWT) — see apiKeyMiddleware.js
app.use('/api/job-board', jobBoardRoutes);
app.use('/api/background-check', backgroundCheckRoutes);
app.use('/api/esign', esignRoutes);
app.use('/api/report-schedules', reportScheduleRoutes);

app.use('/api/analytics', verifyToken, analyticsRoutes);
app.use('/api/statuses', require('./routes/statusesRoutes'));
app.use('/api/companies', companyRoutes);
app.use('/candidates', verifyToken, candidateRoutes);
app.use('/api/candidates', verifyToken, candidateRoutes); // versioned-friendly alias
app.use('/api/v1/candidates', verifyToken, candidateRoutes);
app.use('/api/email', verifyToken, emailRoutes);
app.use('/api/email-templates', verifyToken, emailTemplateRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/org-lists', orgListRoutes);
app.use('/api/export', verifyToken, exportRoutes);
app.use('/api/email-settings', verifyToken, emailSettingsRoutes);
app.use('/api/company-email-settings', verifyToken, companyEmailSettingsRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/talent-pools', verifyToken, talentPoolRoutes); // internally applies requireFeature('candidates.talentPools')
app.use('/api/skills', verifyToken, skillsRoutes); // requireFeature('candidates.skillsTaxonomy')
app.use('/api/inbox', verifyToken, inboxRoutes); // requireFeature('messaging.inbox')
app.use('/api/sequences', verifyToken, sequenceRoutes); // requireFeature('messaging.sequences')
app.use('/api/dei', verifyToken, deiRoutes); // requireFeature('analytics.dei')
app.use('/api/forms', formBuilderRoutes); // verifyToken + requireFeature('careers.formBuilder')
app.use('/api/chatbot', chatbotRoutes); // public ask/config + gated admin settings
app.use('/api/saved-searches', verifyToken, savedSearchRoutes);
app.use('/api/scorecard-templates', verifyToken, scorecardTemplateRoutes);
app.use('/api/comments', verifyToken, commentRoutes);
app.use('/api/public/announcements', publicAnnouncementRoutes); // careers-site banners (no auth)
app.use('/api/announcements', verifyToken, announcementRoutes);
app.use('/api/search', verifyToken, globalSearchRoutes);
app.use('/api/transcripts', verifyToken, transcriptRoutes);
app.use('/api/consent', consentRoutes); // public + authenticated (feature-gated inside for auth routes)
app.use('/api/push', verifyToken, pushRoutes);
app.use('/api/company-brand', verifyToken, companyBrandRoutes);
app.use('/api/reports-studio', verifyToken, reportsStudioRoutes);
app.use('/api/whatsapp', whatsappRoutes); // internally applies verifyToken + requireFeature('integrations.whatsapp')
app.use('/api/assessments', assessmentRoutes); // internally applies verifyToken + requireFeature('assessments') for recruiter routes; candidate-facing routes are token-gated, not session-gated
app.use('/api/white-label', whiteLabelRoutes); // internally applies verifyToken + requireFeature('whiteLabel')
app.use('/api/chrome-extension', chromeExtensionRoutes); // internally applies verifyToken (config) or extension-token auth (import)
app.use('/api/approvals', verifyToken, approvalRoutes);
app.use('/api/offer-templates', verifyToken, offerTemplateRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/integrations/slack', slackAppRoutes);
app.use('/api/ai', verifyToken, aiFeatureRoutes); // Phase 4 AI product capabilities; each route applies requireFeature
app.use('/api/data-warehouse', require('./routes/dataWarehouseRoutes'));

// ── Static Uploads ───────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  
  if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    res.setHeader('Content-Disposition', 'inline');
    next();
    return;
  }
  
  if (!ext) {
    const filePath = path.join(__dirname, 'uploads', req.path);
    if (fs.existsSync(filePath)) {
      try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(8);
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        const header = buffer.toString('ascii', 0, 5);
        if (header.startsWith('%PDF')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Content-Disposition', 'inline');
        } else if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', 'inline');
        }
      } catch (e) { /* ignore detection errors */ }
    }
  }
  next();
}, express.static(uploadDir));

// ── Health Check ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const zohoKey = (process.env.ZOHO_ZEPTOMAIL_API_KEY || process.env.ZEPTOMAIL_API_KEY || '').trim();
  const zohoFrom = (process.env.ZOHO_ZEPTOMAIL_FROM_EMAIL || process.env.ZEPTOMAIL_FROM_EMAIL || '').trim();
  const emailConfigured = Boolean(zohoKey && zohoFrom);
  res.json({
    status: 'ok',
    version: 'v3-saas-enterprise-byok',
    timestamp: new Date().toISOString(),
    emailConfigured,
    // Public system sender used for verification/invites (not a secret)
    emailFrom: zohoFrom || null,
    frontendUrlSet: Boolean((process.env.FRONTEND_URL || '').trim()),
  });
});

// ── Database connection guard ──────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Service unavailable. Database connection is not ready.' });
  }
  next();
});

// Auth handlers live in routes/authRoutes.js (mounted earlier at /api).
// Legacy register path without /api prefix:
app.post('/register', (req, res, next) => {
  req.url = '/register';
  require('./routes/authRoutes')(req, res, next);
});

app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/jobs', require('./routes/jobRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));

// ══════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ══════════════════════════════════════════════════════════════════════

const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/allinone';

const startServer = () => {
  const server = app.listen(PORT, () => {
    global.__ats_server = server; // Store ref for graceful shutdown
    logger.info(`🚀 SkillNix SaaS ATS v3 running on port ${PORT}`);
    const s3Resume = require('./services/s3Service').isS3Configured();
    logger.info(s3Resume
      ? `[Resume storage] S3 — bucket: ${process.env.S3_BUCKET_NAME}`
      : '[Resume storage] Local (uploads/)');
    startNotificationScheduler();
    initWebhookDispatcher();
    startReportScheduler();
    logger.info('[Event Bus] Initialized with listeners:', eventBus.eventNames().join(', '));
  });

  server.timeout = 600000;
  server.keepAliveTimeout = 61000;
};

logger.info('🔌 Connecting to MongoDB...', mongoUrl.replace(/^(mongodb\+srv:\/\/[^:]+):[^@]+@/, '$1:****@'));

mongoose.connect(mongoUrl, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
  bufferCommands: false
})
  .then(() => {
    logger.info('✅ MongoDB Connected');
    startServer();
  })
  .catch(err => {
    logger.error('❌ Mongo Error:', err);
    process.exit(1);
  });

mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️ MongoDB disconnected');
});

// Migrations run via migrate-mongo (npm run migrate:up), not on server boot.

// ══════════════════════════════════════════════════════════════════════
// DIAGNOSTICS (protected in production, useful for dev)
// ══════════════════════════════════════════════════════════════════════

if (process.env.NODE_ENV !== 'production') {
  app.get('/diagnostics', async (req, res) => {
    try {
      const dbName = mongoose.connection.name || 'unknown';
      const userCount = await User.countDocuments().catch(() => 0);
      const orgCount = await Organization.countDocuments().catch(() => 0);
      const jobCount = await Job.countDocuments().catch(() => 0);
      const candidateCount = await Candidate.countDocuments().catch(() => 0);
      const applicationCount = await Application.countDocuments().catch(() => 0);

      return res.json({
        connected: mongoose.connection.readyState === 1,
        dbName,
        version: 'v3-saas',
        counts: { users: userCount, organizations: orgCount, jobs: jobCount, candidates: candidateCount, applications: applicationCount }
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ══════════════════════════════════════════════════════════════════════
const gracefulShutdown = (signal) => {
  logger.info(`\n📴 Received ${signal}. Starting graceful shutdown...`);
  // Close the HTTP server first (stop accepting new connections)
  if (global.__ats_server) {
    global.__ats_server.close(() => {
      logger.info('✅ HTTP server closed');
      mongoose.connection.close(false).then(() => {
        logger.info('✅ MongoDB connection closed');
        process.exit(0);
      }).catch(() => {
        process.exit(0);
      });
    });
  } else {
    mongoose.connection.close(false).then(() => process.exit(0)).catch(() => process.exit(0));
  }
  // Force kill after 30 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('⚠️ Graceful shutdown timed out after 30s. Forcing exit.');
    process.exit(1);
  }, 30000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
