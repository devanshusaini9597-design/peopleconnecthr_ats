require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const users = await User.find({ isEmailVerified: { $ne: true } })
    .select('email name isEmailVerified createdAt organizationId')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
