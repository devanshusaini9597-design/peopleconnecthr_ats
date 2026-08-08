#!/usr/bin/env node
/**
 * One-time migration: hash any remaining plaintext passwords.
 *
 * Run ONCE:  node scripts/migrate-plaintext-passwords.js
 *
 * This is safe to run multiple times — it only touches passwords
 * that are NOT already bcrypt-hashed (don't start with '$2').
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URL = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL;

if (!MONGODB_URL) {
  console.error('ERROR: No MongoDB URL found in environment variables.');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('✅ Connected to MongoDB');

    const User = require('../models/User');
    const users = await User.find({}).select('+password');
    let migrated = 0;
    let alreadyHashed = 0;

    for (const user of users) {
      if (!user.password) {
        console.warn(`⚠️  User ${user.email} has no password — skipping`);
        continue;
      }

      if (user.password.startsWith('$2')) {
        alreadyHashed++;
        continue;
      }

      console.log(`🔐 Hashing plaintext password for: ${user.email}`);
      const salt = await bcrypt.genSalt(12);
      const hashed = await bcrypt.hash(user.password, salt);

      // Use direct update to bypass the pre-save hook (which would double-hash)
      await User.collection.updateOne(
        { _id: user._id },
        { $set: { password: hashed } }
      );
      migrated++;
    }

    console.log(`\n✅ Done.`);
    console.log(`   Already hashed: ${alreadyHashed}`);
    console.log(`   Migrated to bcrypt: ${migrated}`);
    console.log(`   Total users: ${users.length}`);
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
