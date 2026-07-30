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

// ── Global crash handlers ────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception (server stayed alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection (server stayed alive):', reason?.message || reason);
});

// ── Core imports ─────────────────────────────────────────────────────
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ── Models ───────────────────────────────────────────────────────────
const User = require('./models/User');
const Organization = require('./models/Organization');
const Job = require('./models/Job');
const Candidate = require('./models/Candidate');
const Application = require('./models/Application');
const Interview = require('./models/Interview');
const Scorecard = require('./models/Scorecard');
const IntegrationConfig = require('./models/IntegrationConfig');
const AuditLog = require('./models/AuditLog');
const JDTemplate = require('./models/JDTemplate');

// ── Middleware ────────────────────────────────────────────────────────
const { verifyToken, generateToken, optionalAuth, JWT_SECRET } = require('./middleware/authMiddleware');
const { requireRole, requireOwner, requireAdmin, requireRecruiterOrAbove, checkPlanLimit } = require('./middleware/rbacMiddleware');
const { tenantScope, requireOrganization } = require('./middleware/tenantMiddleware');

// ── Event Bus ────────────────────────────────────────────────────────
const eventBus = require('./events/eventBus');
const eventTypes = require('./events/eventTypes');
require('./events/listeners/notificationListener');
require('./events/listeners/auditListener');

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
const exportRoutes = require('./routes/exportRoutes');
const emailSettingsRoutes = require('./routes/emailSettingsRoutes');
const companyEmailSettingsRoutes = require('./routes/companyEmailSettingsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const teamRoutes = require('./routes/teamRoutes');
const publicSubscribeRoutes = require('./routes/publicSubscribeRoutes');
const zohoOAuthRoutes = require('./routes/zohoOAuthRoutes');

// New SaaS routes
const organizationRoutes = require('./routes/organizationRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const billingRoutes = require('./routes/billingRoutes');
const careersRoutes = require('./routes/careersRoutes');
const portalRoutes = require('./routes/portalRoutes');

// ── Services ─────────────────────────────────────────────────────────
const { startNotificationScheduler } = require('./services/notificationService');
const { normalizeText } = require('./utils/textNormalize');
const { sendEmail } = require('./services/emailService');

// ── App Setup ────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow file serving
  contentSecurityPolicy: false // Disable CSP for now (enable in production with proper config)
}));

// ── Rate Limiting ────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicApplyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 applications per hour per IP
  message: { success: false, message: 'Too many applications. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Request Timeout ──────────────────────────────────────────────────
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  next();
});

// ── CORS ─────────────────────────────────────────────────────────────
const allowedOriginList = [
  "https://skillnix-ats-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL
].filter(Boolean);

function corsOrigin(origin, cb) {
  if (!origin) return cb(null, true);
  if (allowedOriginList.indexOf(origin) !== -1) return cb(null, origin);
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return cb(null, origin);
  return cb(null, false);
}
app.use(cors({ origin: corsOrigin, credentials: true }));

// ── Body Parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ══════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════

// ── Public routes (no auth) ──────────────────────────────────────────
app.use('/api', homeRoutes);
app.use('/api/public', publicSubscribeRoutes);
app.use('/oauth/zoho', zohoOAuthRoutes);
app.use('/api/careers', careersRoutes);
app.use('/api/portal', portalRoutes);

// ── Auth routes (rate limited) ───────────────────────────────────────
app.use('/api/onboarding', onboardingRoutes);

// ── Protected routes ─────────────────────────────────────────────────
app.use('/api/organization', verifyToken, organizationRoutes);
app.use('/api/applications', verifyToken, applicationRoutes);
app.use('/api/interviews', verifyToken, interviewRoutes);
app.use('/api/billing', verifyToken, billingRoutes);

app.use('/api/analytics', verifyToken, analyticsRoutes);
app.use('/api/companies', companyRoutes);
app.use('/candidates', verifyToken, candidateRoutes);
app.use('/api/email', verifyToken, emailRoutes);
app.use('/api/email-templates', verifyToken, emailTemplateRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/export', verifyToken, exportRoutes);
app.use('/api/email-settings', verifyToken, emailSettingsRoutes);
app.use('/api/company-email-settings', verifyToken, companyEmailSettingsRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);
app.use('/api/team', teamRoutes);

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
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  version: 'v3-saas', 
  timestamp: new Date().toISOString() 
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH ROUTES (kept inline for backward compatibility)
// ══════════════════════════════════════════════════════════════════════

/* ================= LOGIN ================= */
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      return res.status(401).json({ 
        message: "email_not_found",
        displayMessage: "Email not registered. Please sign up first."
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        message: "account_deactivated",
        displayMessage: "Your account has been deactivated. Please contact your administrator."
      });
    }
    
    // Password verification (bcrypt with plain text backward compat)
    let passwordMatch = false;
    
    if (user.password.startsWith('$2')) {
      try {
        passwordMatch = await bcrypt.compare(password, user.password);
      } catch (bcryptErr) {
        passwordMatch = (user.password === password);
      }
    } else {
      passwordMatch = (user.password === password);
      // Upgrade plain text to bcrypt
      if (passwordMatch) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        message: "invalid_password",
        displayMessage: "Invalid password. Please try again."
      });
    }
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    // Generate token with org and role info
    const token = generateToken(user);
    
    // Load organization info if user has one
    let organization = null;
    if (user.organizationId) {
      organization = await Organization.findById(user.organizationId)
        .select('name slug logo plan planExpiresAt atsSettings settings')
        .lean();
    }
    
    res.json({ 
      message: "Login Successful", 
      token,
      user: { 
        name: user.name || '', 
        email: user.email, 
        phone: user.phone || '',
        role: user.role,
        organizationId: user.organizationId,
        isEmailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboardingCompleted,
        profilePicture: user.profilePicture || ''
      },
      organization
    });
  } catch (err) { 
    console.error('[LOGIN] ERROR:', err.message);
    res.status(500).json({ message: 'Internal server error' }); 
  }
});

/* ================= REGISTER (legacy — new flow uses /api/onboarding/register) ================= */
app.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const newUser = new User({ 
      name: normalizeText(name || ''), 
      email: email.toLowerCase().trim(), 
      phone: phone?.trim() || '', 
      password: password // Pre-save hook will hash this
    });
    await newUser.save();
    
    return res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    console.error('[REGISTER] ERROR:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ================= PROFILE ROUTES ================= */

// GET profile
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    let organization = null;
    if (user.organizationId) {
      organization = await Organization.findById(user.organizationId)
        .select('name slug logo plan planExpiresAt atsSettings settings usageCurrent usageLimits')
        .lean();
    }
    
    res.json({ 
      success: true, 
      user: { 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        profilePicture: user.profilePicture || '',
        role: user.role,
        organizationId: user.organizationId,
        isEmailVerified: user.isEmailVerified,
        onboardingCompleted: user.onboardingCompleted
      },
      organization
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE profile (name, phone)
app.put('/api/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = normalizeText(name);
    if (phone !== undefined) user.phone = phone.trim();
    await user.save();

    const token = generateToken(user);
    res.json({ 
      success: true, 
      message: 'Profile updated successfully', 
      user: { name: user.name, email: user.email, phone: user.phone, profilePicture: user.profilePicture || '', role: user.role }, 
      token 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPLOAD profile picture
const multerProfile = require('multer');
const profilePicUpload = multerProfile({
  storage: multerProfile.diskStorage({
    destination: path.join(__dirname, 'uploads'),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `profile-${req.user.id}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'));
  }
});

app.put('/api/profile/picture', verifyToken, uploadLimiter, profilePicUpload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image file provided' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.profilePicture) {
      const oldPath = path.join(__dirname, user.profilePicture);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.profilePicture = `/uploads/${req.file.filename}`;
    await user.save();

    res.json({ success: true, message: 'Profile picture updated', profilePicture: user.profilePicture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/profile/picture', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.profilePicture) {
      const picPath = path.join(__dirname, user.profilePicture);
      if (fs.existsSync(picPath)) fs.unlinkSync(picPath);
    }
    user.profilePicture = '';
    await user.save();

    res.json({ success: true, message: 'Profile picture removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CHANGE password
app.put('/api/profile/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    let passwordMatch = false;
    if (user.password.startsWith('$2')) {
      try {
        passwordMatch = await bcrypt.compare(currentPassword, user.password);
      } catch (bcryptErr) {
        passwordMatch = (user.password === currentPassword);
      }
    } else {
      passwordMatch = (user.password === currentPassword);
    }
    
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ================= PASSWORD RESET ROUTES ================= */

// Step 1: Request password reset
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json({ success: true, message: 'If this email is registered, you will receive a reset link.' });
    }

    const resetToken = jwt.sign(
      { id: user._id, email: user.email, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; padding: 30px 20px; background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">SkillNix ATS</p>
          </div>
          <div style="padding: 30px 20px; background: #ffffff; border: 1px solid #e5e7eb; border-top: none;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi ${user.name || 'there'},</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Reset My Password</a>
            </div>
            <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">This link expires in <strong>15 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">If the button doesn't work, copy and paste this URL:<br><a href="${resetUrl}" style="color: #4F46E5; word-break: break-all;">${resetUrl}</a></p>
          </div>
        </div>
      `;

      await sendEmail(
        user.email,
        'Reset Your Password - SkillNix ATS',
        htmlBody,
        `Reset your password: ${resetUrl} (expires in 15 minutes)`,
        { userId: user._id }
      );
    } catch (emailErr) {
      console.error('[PASSWORD-RESET] Email send failed:', emailErr.message);
      if (emailErr.message === 'EMAIL_NOT_CONFIGURED') {
        return res.json({
          success: true,
          message: 'Email service not configured. Use the direct reset link.',
          resetUrl: resetUrl
        });
      }
    }

    res.json({ success: true, message: 'If this email is registered, you will receive a reset link.' });
  } catch (err) {
    console.error('[PASSWORD-RESET] Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to process password reset request' });
  }
});

// Step 2: Verify reset token
app.get('/api/auth/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ success: false, message: 'Invalid token type' });
    }

    res.json({ success: true, email: decoded.email });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
    }
    res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
  }
});

// Step 3: Reset password with token
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ success: false, message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ success: false, message: 'Reset link has expired. Please request a new one.' });
    }
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

// GET account stats (for profile page)
app.get('/api/profile/stats', verifyToken, async (req, res) => {
  try {
    const candidateFilter = req.user.organizationId 
      ? { organizationId: req.user.organizationId }
      : { createdBy: req.user.id };
    const candidateCount = await Candidate.countDocuments(candidateFilter);
    
    const user = await User.findById(req.user.id).select('createdAt');
    const memberSince = user?.createdAt || (user?._id ? user._id.getTimestamp() : null);
    
    let orgStats = null;
    if (req.user.organizationId) {
      const org = await Organization.findById(req.user.organizationId)
        .select('usageCurrent usageLimits plan planExpiresAt')
        .lean();
      orgStats = org;
    }
    
    res.json({
      success: true,
      stats: {
        totalCandidates: candidateCount,
        memberSince,
        role: req.user.role,
        organization: orgStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ================= JOB ROUTES (legacy inline — will migrate to jobRoutes) ================= */
app.get('/jobs', verifyToken, async (req, res) => {
  try {
    const { isTemplate } = req.query;
    
    // Build tenant-scoped query
    const baseFilter = req.user.organizationId 
      ? { organizationId: req.user.organizationId }
      : {};
    
    const query = isTemplate === 'true' 
      ? { ...baseFilter, isTemplate: true } 
      : { ...baseFilter, $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }] };
    
    const jobs = await Job.find(query).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/jobs', verifyToken, async (req, res) => {
  try {
    const jobData = { ...req.body };
    
    // Add tenant context
    if (req.user.organizationId) {
      jobData.organizationId = req.user.organizationId;
    }
    jobData.createdBy = req.user.id;
    
    // Sync title/role for backward compat
    if (jobData.role && !jobData.title) {
      jobData.title = jobData.role;
    }
    if (jobData.title && !jobData.role) {
      jobData.role = jobData.title;
    }
    
    const newJob = new Job(jobData);
    await newJob.save();
    
    // Increment org usage counter
    if (req.user.organizationId) {
      await Organization.findByIdAndUpdate(
        req.user.organizationId,
        { $inc: { 'usageCurrent.jobs': 1 } }
      );
    }
    
    // Emit event
    eventBus.emit(eventTypes.JOB_CREATED, {
      organizationId: req.user.organizationId,
      userId: req.user.id,
      jobId: newJob._id,
      title: newJob.title
    });
    
    res.status(201).json(newJob);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ══════════════════════════════════════════════════════════════════════

mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/allinone')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ Mongo Error:', err));

// ── Post-connection migrations ───────────────────────────────────────
mongoose.connection.once('open', async () => {
  // Drop legacy indexes
  try {
    const indexes = await Candidate.collection.indexes();
    const hasContactIndex = indexes.find(idx => idx.name === 'contact_1');
    const hasEmailIndex = indexes.find(idx => idx.name === 'email_1');
    if (hasContactIndex) {
      await Candidate.collection.dropIndex('contact_1');
      console.log('✅ Dropped legacy contact_1 index');
    }
    if (hasEmailIndex) {
      await Candidate.collection.dropIndex('email_1');
      console.log('✅ Dropped legacy email_1 index');
    }
  } catch (err) {
    console.warn('⚠️ Failed to drop legacy indexes:', err.message);
  }

  // Migrate orphan candidates to first user
  try {
    const orphanCount = await Candidate.collection.countDocuments({ createdBy: { $exists: false } });
    if (orphanCount > 0) {
      const firstUser = await User.findOne().sort({ _id: 1 });
      if (firstUser) {
        const result = await Candidate.collection.updateMany(
          { createdBy: { $exists: false } },
          { $set: { createdBy: firstUser._id } }
        );
        console.log(`✅ MIGRATION: Assigned ${result.modifiedCount} orphan candidates to user ${firstUser.email}`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Migration error:', err.message);
  }

  // Migrate master data collections
  const masterCollections = ['sources', 'positions', 'clients', 'companies'];
  for (const collName of masterCollections) {
    try {
      const coll = mongoose.connection.db.collection(collName);
      const indexes = await coll.indexes();
      
      for (const idx of indexes) {
        const hasNameOnly = idx.key.name === 1 && Object.keys(idx.key).length === 1;
        const isUniqueGlobal = idx.unique === true;
        const isDefaultId = idx.name === '_id_';
        const isOldPattern = idx.name === 'name_1' || idx.name === 'name_1_createdBy_1';
        
        if (!isDefaultId && (isUniqueGlobal && hasNameOnly || isOldPattern)) {
          try {
            await coll.dropIndex(idx.name);
            console.log(`✅ Dropped problematic index on ${collName}: ${idx.name}`);
          } catch (dropErr) {
            console.warn(`⚠️ Could not drop index ${idx.name} on ${collName}:`, dropErr.message);
          }
        }
      }
      
      try {
        await coll.createIndex({ createdBy: 1, name: 1 }, { unique: true, sparse: false });
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn(`⚠️ Could not create compound index on ${collName}:`, err.message);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Error checking indexes for ${collName}:`, err.message);
    }

    // Assign orphan records
    try {
      const coll = mongoose.connection.db.collection(collName);
      const orphans = await coll.countDocuments({ createdBy: { $exists: false } });
      if (orphans > 0) {
        const firstUser = await User.findOne().sort({ _id: 1 });
        if (firstUser) {
          const res = await coll.updateMany(
            { createdBy: { $exists: false } },
            { $set: { createdBy: firstUser._id } }
          );
          console.log(`✅ MIGRATION: Assigned ${res.modifiedCount} orphan ${collName} to ${firstUser.email}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Migration ${collName}:`, err.message);
    }
  }

  // ── NEW: Create default organization for existing users without one ──
  try {
    const usersWithoutOrg = await User.find({ organizationId: { $exists: false } }).limit(100);
    if (usersWithoutOrg.length > 0) {
      console.log(`[MIGRATION] Found ${usersWithoutOrg.length} users without organization. Creating default orgs...`);
      for (const user of usersWithoutOrg) {
        try {
          const org = new Organization({
            name: `${user.name || user.email.split('@')[0]}'s Organization`,
            ownerId: user._id,
            plan: 'free_trial',
            planExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          });
          await org.save();
          
          user.organizationId = org._id;
          user.role = 'owner';
          user.isEmailVerified = true; // Existing users are assumed verified
          user.onboardingCompleted = true;
          await user.save();
          
          // Backfill organizationId on this user's candidates
          await Candidate.collection.updateMany(
            { createdBy: user._id, organizationId: { $exists: false } },
            { $set: { organizationId: org._id } }
          );
          
          // Backfill organizationId on this user's jobs
          await Job.collection.updateMany(
            { createdBy: user._id, organizationId: { $exists: false } },
            { $set: { organizationId: org._id } }
          );
          
          console.log(`✅ MIGRATION: Created org "${org.name}" (${org.slug}) for user ${user.email}`);
        } catch (err) {
          console.warn(`⚠️ Failed to create org for ${user.email}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Org migration error:', err.message);
  }
});

// ══════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  console.log(`🚀 SkillNix SaaS ATS v3 running on port ${PORT}`);
  const s3Resume = require('./services/s3Service').isS3Configured();
  console.log(s3Resume
    ? `[Resume storage] S3 — bucket: ${process.env.S3_BUCKET_NAME}`
    : '[Resume storage] Local (uploads/)');
  startNotificationScheduler();
  console.log('[Event Bus] Initialized with listeners:', eventBus.eventNames().join(', '));
});

server.timeout = 600000;
server.keepAliveTimeout = 61000;

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
