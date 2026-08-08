/**
 * Create default organizations for users missing organizationId,
 * then backfill their candidates/jobs.
 * Extracted from server startup — run via: npm run migrate:up
 */
const { ObjectId } = require('mongodb');

function slugifyName(name) {
  return String(name || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function uniqueSlug(db, baseSlug) {
  let unique = baseSlug || 'org';
  let counter = 1;
  while (await db.collection('organizations').findOne({ slug: unique })) {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    unique = `${baseSlug}-${randomSuffix}`;
    counter++;
    if (counter > 10) break;
  }
  return unique;
}

module.exports = {
  async up(db) {
    const usersCol = db.collection('users');
    const orgsCol = db.collection('organizations');
    const candidatesCol = db.collection('candidates');
    const jobsCol = db.collection('jobs');

    const usersWithoutOrg = await usersCol
      .find({ organizationId: { $exists: false } })
      .limit(100)
      .toArray();

    if (usersWithoutOrg.length === 0) return;

    console.log(
      `[MIGRATION] Found ${usersWithoutOrg.length} users without organization. Creating default orgs...`
    );

    const now = new Date();
    const planExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    for (const user of usersWithoutOrg) {
      try {
        const display = user.name || (user.email || 'user').split('@')[0];
        const name = `${display}'s Organization`;
        const baseSlug = slugifyName(name);
        const slug = await uniqueSlug(db, baseSlug);
        const orgId = new ObjectId();

        await orgsCol.insertOne({
          _id: orgId,
          name,
          slug,
          ownerId: user._id,
          plan: 'free_trial',
          planExpiresAt,
          productPlans: { ats: 'free_trial' },
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });

        await usersCol.updateOne(
          { _id: user._id },
          {
            $set: {
              organizationId: orgId,
              role: 'owner',
              isEmailVerified: true,
              onboardingCompleted: true,
            },
          }
        );

        await candidatesCol.updateMany(
          { createdBy: user._id, organizationId: { $exists: false } },
          { $set: { organizationId: orgId } }
        );

        await jobsCol.updateMany(
          { createdBy: user._id, organizationId: { $exists: false } },
          { $set: { organizationId: orgId } }
        );

        console.log(`✅ MIGRATION: Created org "${name}" (${slug}) for user ${user.email}`);
      } catch (err) {
        console.warn(`⚠️ Failed to create org for ${user.email}:`, err.message);
      }
    }
  },

  async down() {
    // Irreversible — created orgs and user updates are not undone
  },
};
