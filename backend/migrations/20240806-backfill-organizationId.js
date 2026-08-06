/**
 * Backfill organizationId on orphan records from their creators.
 * Extracted from server startup — run via: npm run migrate:up
 *
 * Covers: candidates, jobs, clients, positions, sources, teammembers, companies.
 */
module.exports = {
  async up(db) {
    const users = db.collection('users');

    async function backfillFromCreator(collName, label) {
      const coll = db.collection(collName);
      const orphans = await coll
        .find({
          organizationId: { $exists: false },
          createdBy: { $exists: true, $ne: null },
        })
        .project({ _id: 1, createdBy: 1 })
        .toArray();

      let migrated = 0;
      const ownerOrgCache = new Map();

      for (const doc of orphans) {
        try {
          const ownerId = String(doc.createdBy);
          if (!ownerOrgCache.has(ownerId)) {
            const owner = await users.findOne(
              { _id: doc.createdBy },
              { projection: { organizationId: 1 } }
            );
            ownerOrgCache.set(ownerId, owner?.organizationId || null);
          }
          const orgId = ownerOrgCache.get(ownerId);
          if (orgId) {
            await coll.updateOne({ _id: doc._id }, { $set: { organizationId: orgId } });
            migrated++;
          }
        } catch (docErr) {
          console.warn(
            `⚠️ Could not backfill organizationId on ${label}/${doc._id}:`,
            docErr.message
          );
        }
      }

      if (migrated > 0) {
        console.log(`✅ MIGRATION: Backfilled organizationId on ${migrated} ${label} record(s)`);
      }
    }

    await backfillFromCreator('candidates', 'candidate');
    await backfillFromCreator('jobs', 'job');

    // Master / team collections previously scoped only by createdBy
    const tenantScopedMasterCollections = [
      'clients',
      'positions',
      'sources',
      'teammembers',
      'companies',
    ];
    for (const collName of tenantScopedMasterCollections) {
      try {
        await backfillFromCreator(collName, collName);
      } catch (err) {
        console.warn(`⚠️ organizationId backfill error for ${collName}:`, err.message);
      }
    }
  },

  async down() {
    // Irreversible data backfill
  },
};
