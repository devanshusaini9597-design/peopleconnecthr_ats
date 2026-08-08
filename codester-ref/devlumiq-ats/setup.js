#!/usr/bin/env node
/**
 * Devlumiq ATS — One-command setup script.
 * Run: node setup.js
 *
 * This script:
 * 1. Copies .env.example → .env (if .env doesn't exist)
 * 2. Runs prisma generate (creates the Prisma client)
 * 3. Runs prisma db push (ensures all schema tables exist — safe on fresh & existing DBs)
 * 4. Runs prisma migrate deploy (records migration history)
 * 5. Seeds demo data (candidates, jobs, interviews, notifications, etc.)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const envFile = path.join(root, '.env');
const envExample = path.join(root, '.env.example');

function run(cmd, label) {
  console.log(`\n➤ ${label}...`);
  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' });
    console.log(`  ✓ ${label} — done`);
  } catch (e) {
    console.error(`  ✗ ${label} — failed`);
    process.exit(1);
  }
}

console.log('\n╔══════════════════════════════════════════╗');
console.log('║   DevLumiq ATS — Setup                   ║');
console.log('╚══════════════════════════════════════════╝\n');

// Step 1: .env file
if (!fs.existsSync(envFile)) {
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, envFile);
    console.log('✓ Created .env from .env.example');
    console.log('  Edit .env to set your DATABASE_URL before continuing.');
  } else {
    console.error('✗ .env.example not found. Please create a .env file with your DATABASE_URL.');
    process.exit(1);
  }
} else {
  console.log('✓ .env already exists');
}

// Step 2: Generate Prisma Client
run('npx prisma generate', 'Generate Prisma Client');

// Step 3: Ensure all schema tables exist (fresh installs) / keep existing DB in sync
run('npx prisma db push', 'Sync database schema');

// Step 4: Apply migrations (records migration history for future upgrades)
run('npx prisma migrate deploy', 'Apply database migrations');

// Step 5: Seed demo data (only on fresh databases)
const { PrismaClient } = require('@prisma/client');
const prismaCheck = new PrismaClient();
prismaCheck.$connect().then(async () => {
  const userCount = await prismaCheck.user.count().catch(() => 0);
  const companyCount = await prismaCheck.company.count().catch(() => 0);
  await prismaCheck.$disconnect();
  if (userCount > 0 || companyCount > 0) {
    console.log('\n⚠️  Database already contains data. Skipping seed to protect existing data.');
    console.log('   To wipe and start fresh: npm run db:reset');
    console.log('   For v1 upgrade, run: node scripts/upgrade-v1-to-v2.js\n');
  } else {
    run('node prisma/seed.js', 'Seed demo data');
  }

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Setup complete!                        ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║                                          ║');
  console.log('║   Start the dev server:                  ║');
  console.log('║   npm run dev                            ║');
  console.log('║                                          ║');
  console.log('║   Then open: http://localhost:3000        ║');
  console.log('║                                          ║');
  console.log('║   Demo accounts (password: Demo@1234):   ║');
  console.log('║   admin@devlumiq.com   → ADMIN           ║');
  console.log('║   recruiter@devlumiq.com → RECRUITER     ║');
  console.log('║   hiring@devlumiq.com → HIRING_MANAGER   ║');
  console.log('║   interviewer@devlumiq.com → INTERVIEWER ║');
  console.log('║   viewer@devlumiq.com → VIEWER           ║');
  console.log('║   demo@devlumiq.com    → RECRUITER       ║');
  console.log('║                                          ║');
  console.log('╚══════════════════════════════════════════╝\n');
}).catch((err) => {
  console.error('\n✗ Database connection failed:', err.message);
  console.error('  Check your DATABASE_URL in .env\n');
  process.exit(1);
});
