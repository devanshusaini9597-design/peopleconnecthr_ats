/**
 * Manually mark a user email as verified (ops unblock when ZeptoMail is misconfigured).
 * Usage: node scripts/verify-user-email.js sarbjeet@peopleconnecthr.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = String(process.argv[2] || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Usage: node scripts/verify-user-email.js user@domain.com');
  }
  await mongoose.connect(process.env.MONGODB_URL);
  const user = await User.findOne({ email });
  if (!user) {
    console.log(JSON.stringify({ ok: false, error: 'User not found', email }));
    await mongoose.disconnect();
    process.exit(1);
  }
  user.isEmailVerified = true;
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  if (typeof user.isActive === 'boolean') user.isActive = true;
  await user.save();
  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        emailVerified: user.emailVerified,
        isActive: user.isActive,
        organizationId: user.organizationId,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
