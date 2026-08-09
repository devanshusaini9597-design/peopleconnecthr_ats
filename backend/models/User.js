const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Use the same JWT_SECRET from authMiddleware to avoid dual-secret bugs.
// In production, authMiddleware.js exits the process if JWT_SECRET is unset,
// so this fallback only applies in development.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be defined in production');
  }
  JWT_SECRET = 'dev-only-secret-CHANGE-IN-PRODUCTION';
}

/**
 * User Model
 */
const userSchema = new mongoose.Schema({
  name: { type: String, default: '', trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '', trim: true },
  password: {
    type: String,
    required: true,
    minlength: [8, 'Password must be at least 8 characters'],
  },
  profilePicture: { type: String, default: '' },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  role: {
    type: String,
    enum: ['owner', 'admin', 'recruiter', 'interviewer', 'readonly'],
    default: 'recruiter'
  },
  // Enterprise-only: overrides DEFAULT_ROLE_PERMISSIONS[role] with a custom
  // permission set. Null/unset = use the fixed role's default permissions.
  customRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomRole', default: null },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  lastLoginAt: { type: Date },
  isActive: { type: Boolean, default: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  inviteToken: { type: String, default: null },
  inviteTokenExpires: { type: Date, default: null },
  onboardingCompleted: { type: Boolean, default: false },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, select: false, default: null },
  mfaBackupCodes: [{
    code: { type: String },
    used: { type: Boolean, default: false }
  }]
}, { timestamps: true });

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ organizationId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ inviteToken: 1 }, { sparse: true });

// Pre-save hook: hash password only if not already hashed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  // Check if password is already hashed (starts with $2)
  if (this.password.startsWith('$2')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method: comparePassword
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method: generateAuthToken
userSchema.methods.generateAuthToken = function () {
  const payload = {
    id: this._id,
    organizationId: this.organizationId,
    role: this.role,
    email: this.email,
    name: this.name || ''
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = mongoose.model('User', userSchema);
