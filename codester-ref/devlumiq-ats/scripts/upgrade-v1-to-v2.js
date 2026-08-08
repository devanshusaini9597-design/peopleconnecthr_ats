#!/usr/bin/env node
/**
 * Devlumiq ATS — v1 to v2 Upgrade Helper
 *
 * This script safely upgrades an existing v1 database to v2.
 * It NEVER deletes data. It only creates missing structures and backfills.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/upgrade-v1-to-v2.js
 *
 * What it does:
 * 1. Runs `prisma generate` (creates Prisma client with new models)
 * 2. Runs `prisma db push` (creates all missing tables/columns safely)
 * 3. Runs `prisma migrate deploy` (records migration history)
 * 4. Creates a default Company if none exists
 * 5. Backfills organizationId for all users, candidates, and jobs
 * 6. Creates a FREE subscription for the default company
 */

const { execSync } = require('child_process');
const { randomBytes } = require('crypto');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd, label) {
  console.log(`\n➤ ${label}...`);
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
    console.log(`  ✓ ${label} — done`);
  } catch (e) {
    console.error(`  ✗ ${label} — failed`);
    console.error(`    Command: ${cmd}`);
    process.exit(1);
  }
}

async function backfillData(prisma) {
  console.log('\n➤ Backfilling multi-tenancy data...');

  // 1. Find or create a default Company
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Default Organization',
        slug: `default-org-${Date.now()}`,
        description: 'Automatically created during v1→v2 upgrade',
        isPublished: false,
      },
    });
    console.log(`  ✓ Created default Company: ${company.id}`);
  } else {
    console.log(`  ✓ Found existing Company: ${company.id}`);
  }

  // 2. Backfill User.organizationId
  const usersUpdated = await prisma.user.updateMany({
    where: { organizationId: null },
    data: { organizationId: company.id },
  });
  console.log(`  ✓ Updated ${usersUpdated.count} user(s) with organizationId`);

  // 3. Backfill Candidate.organizationId
  const candidatesUpdated = await prisma.candidate.updateMany({
    where: { organizationId: null },
    data: { organizationId: company.id },
  });
  console.log(`  ✓ Updated ${candidatesUpdated.count} candidate(s) with organizationId`);

  // 4. Backfill Job.companyId (v1 jobs don't have companyId)
  // Note: db push added this column as nullable on existing data.
  // We need to set it for all jobs that don't have it.
  const jobsUpdated = await prisma.job.updateMany({
    where: { companyId: null },
    data: { companyId: company.id },
  });
  console.log(`  ✓ Updated ${jobsUpdated.count} job(s) with companyId`);

  // 5. Create FREE subscription for the company
  const existingSub = await prisma.subscription.findUnique({
    where: { organizationId: company.id },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        organizationId: company.id,
        plan: 'FREE',
        status: 'ACTIVE',
        seats: 3,
      },
    });
    console.log(`  ✓ Created FREE subscription for Company`);
  } else {
    console.log(`  ✓ Subscription already exists for Company`);
  }

  // 6. Mark all existing users as email-verified (they were active in v1)
  const verifiedUpdated = await prisma.user.updateMany({
    where: { isEmailVerified: false },
    data: { isEmailVerified: true },
  });
  console.log(`  ✓ Marked ${verifiedUpdated.count} user(s) as email-verified`);

  // 7. Generate password-reset tokens for users without a password (v1 migration)
  const passwordlessUsers = await prisma.user.findMany({
    where: { password: null },
    select: { id: true, email: true, name: true },
  });
  for (const u of passwordlessUsers) {
    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await prisma.user.update({
      where: { id: u.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });
  }
  if (passwordlessUsers.length > 0) {
    console.log(`  ⚠️  ${passwordlessUsers.length} user(s) migrated from v1 have NO password.`);
    console.log(`      They MUST use "Forgot Password" before they can log in.`);
  }

  return company;
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   DevLumiq ATS — v1 → v2 Upgrade Helper                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  This script is SAFE — it only creates and backfills.');
  console.log('   It NEVER deletes existing data.\n');

  // Step 1: Generate Prisma client
  run('npx prisma generate', 'Generate Prisma Client');

  // Step 2: Apply migrations first (safe data transformations, role mapping, etc.)
  run('npx prisma migrate deploy', 'Apply database migrations');

  // Step 3: Sync any remaining schema changes (creates missing tables/columns)
  run('npx prisma db push', 'Sync database schema (db push)');

  // Step 4: Backfill data
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await backfillData(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Upgrade complete!                                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log('║   IMPORTANT:                                               ║');
  console.log('║   Existing users from v1 MUST use "Forgot Password"        ║');
  console.log('║   to set a password before they can log in.                ║');
  console.log('║                                                            ║');
  console.log('║   Next steps:                                              ║');
  console.log('║   1. npm run dev                                           ║');
  console.log('║   2. Log in as admin (use Forgot Password if needed)     ║');
  console.log('║   3. Tell all existing users to reset their passwords    ║');
  console.log('║   4. Review company settings at /dashboard/settings        ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\n❌ Upgrade failed:', err.message);
  process.exit(1);
});
