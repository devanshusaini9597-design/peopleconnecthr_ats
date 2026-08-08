/**
 * Drop legacy unique indexes and assign orphan createdBy fields.
 * Extracted from server startup — run via: npm run migrate:up
 */
module.exports = {
  async up(db) {
    // ── Drop legacy candidate indexes (contact_1, email_1) ────────────
    try {
      const candidates = db.collection('candidates');
      const indexes = await candidates.indexes();
      if (indexes.find((idx) => idx.name === 'contact_1')) {
        await candidates.dropIndex('contact_1');
        console.log('✅ Dropped legacy contact_1 index');
      }
      if (indexes.find((idx) => idx.name === 'email_1')) {
        await candidates.dropIndex('email_1');
        console.log('✅ Dropped legacy email_1 index');
      }
    } catch (err) {
      console.warn('⚠️ Failed to drop legacy candidate indexes:', err.message);
    }

    // ── Assign orphan candidates (missing createdBy) to first user ───
    try {
      const candidates = db.collection('candidates');
      const users = db.collection('users');
      const orphanCount = await candidates.countDocuments({ createdBy: { $exists: false } });
      if (orphanCount > 0) {
        const firstUser = await users.find().sort({ _id: 1 }).limit(1).next();
        if (firstUser) {
          const result = await candidates.updateMany(
            { createdBy: { $exists: false } },
            { $set: { createdBy: firstUser._id } }
          );
          console.log(
            `✅ MIGRATION: Assigned ${result.modifiedCount} orphan candidates to user ${firstUser.email}`
          );
        }
      }
    } catch (err) {
      console.warn('⚠️ Orphan candidate migration error:', err.message);
    }

    // ── Master data: drop bad indexes, create compound unique, assign orphans
    const masterCollections = ['sources', 'positions', 'clients', 'companies'];
    for (const collName of masterCollections) {
      try {
        const coll = db.collection(collName);
        const indexes = await coll.indexes();

        for (const idx of indexes) {
          const hasNameOnly = idx.key?.name === 1 && Object.keys(idx.key).length === 1;
          const isUniqueGlobal = idx.unique === true;
          const isDefaultId = idx.name === '_id_';
          const isOldPattern = idx.name === 'name_1' || idx.name === 'name_1_createdBy_1';

          if (!isDefaultId && ((isUniqueGlobal && hasNameOnly) || isOldPattern)) {
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

      try {
        const coll = db.collection(collName);
        const users = db.collection('users');
        const orphans = await coll.countDocuments({ createdBy: { $exists: false } });
        if (orphans > 0) {
          const firstUser = await users.find().sort({ _id: 1 }).limit(1).next();
          if (firstUser) {
            const res = await coll.updateMany(
              { createdBy: { $exists: false } },
              { $set: { createdBy: firstUser._id } }
            );
            console.log(
              `✅ MIGRATION: Assigned ${res.modifiedCount} orphan ${collName} to ${firstUser.email}`
            );
          }
        }
      } catch (err) {
        console.warn(`⚠️ Migration ${collName}:`, err.message);
      }
    }
  },

  async down() {
    // Index drops / orphan assignment are not safely reversible
  },
};
