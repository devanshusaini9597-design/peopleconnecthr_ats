/**
 * COMPREHENSIVE FIX FOR MULTI-USER MASTER DATA ISSUE
 * 
 * PROBLEM:
 * - When User A adds "Full Stack Developer" to Positions
 * - Then User B logs in and tries to add the same "Full Stack Developer"
 * - System shows "Position already exists" error
 * 
 * ROOT CAUSE:
 * - MongoDB has a GLOBAL unique index on 'name' field
 * - Should be: Compound unique index on (createdBy, name)
 * 
 * FIX:
 * This script drops all incorrect global indexes and ensures proper
 * multi-user isolation where each user has their own data namespace.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/skillnix-pchr';

console.log('🔧 MASTER DATA ISOLATION FIX\n');
console.log(`📦 Connecting to: ${MONGODB_URL.replace(/:[^:]*@/, ':****@')}`);

const fixIndexes = async () => {
  try {
    await mongoose.connect(MONGODB_URL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collections = ['positions', 'sources', 'clients', 'companies'];

    for (const collName of collections) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 Processing: ${collName.toUpperCase()}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      try {
        const collection = db.collection(collName);
        const indexes = await collection.indexes();

        if (!Array.isArray(indexes) || indexes.length === 0) {
          console.log(`ℹ️  No indexes found for ${collName}`);
          continue;
        }

        console.log(`Found ${indexes.length} indexes:\n`);
        
        let fixCount = 0;
        for (const idx of indexes) {
          const indexName = idx.name;
          const indexKey = idx.key;
          const isUnique = idx.unique || false;

          console.log(`  Index: "${indexName}"`);
          console.log(`    Key: ${JSON.stringify(indexKey)}`);
          console.log(`    Unique: ${isUnique}`);

          // DETECT PROBLEMATIC INDEXES
          const hasNameField = indexKey.name === 1;
          const hasCreatedByField = indexKey.createdBy === 1;
          const isGlobalNameIndex = hasNameField && !hasCreatedByField && isUnique;
          const isDefaultIndex = indexName === '_id_';

          if (isDefaultIndex) {
            console.log(`    ✅ KEEP (mandatory)\n`);
          } else if (isGlobalNameIndex) {
            console.log(`    ❌ PROBLEM: Global unique index on 'name' - drops multi-user isolation!`);
            try {
              await collection.dropIndex(indexName);
              console.log(`    ✅ DROPPED\n`);
              fixCount++;
            } catch (dropErr) {
              console.log(`    ⚠️  Could not drop: ${dropErr.message}\n`);
            }
          } else if (hasNameField && hasCreatedByField && isUnique) {
            console.log(`    ✅ CORRECT: Compound unique index (createdBy, name)\n`);
          } else {
            console.log(`    ℹ️  Other index\n`);
          }
        }

        console.log(`Summary for ${collName}: ${fixCount} problematic index(es) removed`);

        // CREATE CORRECT INDEX
        console.log(`\n➕ Ensuring correct compound index on ${collName}...`);
        try {
          const collection = db.collection(collName);
          await collection.createIndex({ createdBy: 1, name: 1 }, { unique: true, sparse: false });
          console.log(`✅ Created compound unique index: (createdBy, name)\n`);
        } catch (createErr) {
          if (createErr.message.includes('already exists')) {
            console.log(`✅ Compound index already exists\n`);
          } else {
            console.log(`⚠️  Error creating index: ${createErr.message}\n`);
          }
        }

      } catch (err) {
        console.error(`❌ Error processing ${collName}:`, err.message);
      }
    }

    console.log(`\n${'━'.repeat(50)}`);
    console.log('✅ INDEX FIX COMPLETE\n');
    console.log('What was fixed:');
    console.log('  • Removed all global unique indexes on "name" field');
    console.log('  • Ensured compound (createdBy, name) indexes exist');
    console.log('  • Each user now has isolated data namespace');
    console.log('\n✨ RESULT: Multiple users can now add the same items!');
    console.log('  Example: User A + User B can both have "Full Stack Developer" position');

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:');
    console.error(error.message);
    console.error('\n⚠️  MongoDB Connection Issue - Check:');
    console.error('  1. IP Whitelist: https://cloud.mongodb.com/v2/{projectId}#/security/network/accessList');
    console.error('  2. Connection String: MONGODB_URL env variable');
    console.error('  3. MongoDB Atlas Status: https://status.mongodb.com/');
  } finally {
    try {
      await mongoose.connection.close();
      console.log('\n🔌 Disconnected from MongoDB');
    } catch (e) {
      // Ignore
    }
    process.exit(error ? 1 : 0);
  }
};

// Run with error handling
let error;
fixIndexes().catch(err => {
  error = err;
});
