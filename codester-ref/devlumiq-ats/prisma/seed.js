/**
 * prisma/seed.js — Canonical database seed for Devlumiq ATS
 *
 * Creates all 5 demo role-users + comprehensive sample data.
 * Uses upsert for users/company. Stops immediately if real data
 * exists to prevent accidental data loss. Use --force to override.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx prisma db seed
 *   -- OR --
 *   npm run seed
 *   -- OR --
 *   npm run seed -- --force
 */
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/** Prefer bundled O*NET-style catalog; fall back to inline list for offline/minimal installs. */
function loadSystemSkillsForSeed() {
  const catalogPath = path.resolve(__dirname, '../data/onet-skills.json');
  if (fs.existsSync(catalogPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        const seen = new Set();
        const out = [];
        for (const item of parsed) {
          if (!item || typeof item.name !== 'string') continue;
          const name = item.name.trim();
          if (!name) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const category =
            typeof item.category === 'string' && item.category.trim()
              ? item.category.trim()
              : 'Other';
          out.push([name, category]);
        }
        if (out.length > 0) return out;
      }
    } catch (e) {
      console.warn('⚠️  Could not read data/onet-skills.json; using inline skills list', e.message);
    }
  }
  return null;
}


// ─── Demo credentials (all roles) ────────────────────────────────────────────
const DEMO_PASSWORD = 'Demo@1234';

const ROLE_USERS = [
  { name: 'Alex Admin',       email: 'admin@devlumiq.com',       password: DEMO_PASSWORD, role: 'ADMIN'          },
  { name: 'Rachel Recruiter', email: 'recruiter@devlumiq.com',   password: DEMO_PASSWORD, role: 'RECRUITER'      },
  { name: 'Henry Hiring',     email: 'hiring@devlumiq.com',      password: DEMO_PASSWORD, role: 'HIRING_MANAGER' },
  { name: 'Iris Interviewer', email: 'interviewer@devlumiq.com', password: DEMO_PASSWORD, role: 'INTERVIEWER'    },
  { name: 'Victor Viewer',    email: 'viewer@devlumiq.com',      password: DEMO_PASSWORD, role: 'VIEWER'         },
  { name: 'Alex Johnson',     email: 'demo@devlumiq.com',        password: DEMO_PASSWORD, role: 'RECRUITER'      },
];

const ApplicationStage = {
  APPLIED: 'APPLIED',
  SCREENING: 'SCREENING',
  INTERVIEW: 'INTERVIEW',
  OFFER: 'OFFER',
  HIRED: 'HIRED',
  JOINED: 'JOINED',
  REJECTED: 'REJECTED',
  DROPPED: 'DROPPED',
};

const MessageDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
};

const JOB_TITLES = [
  { title: 'Senior Software Engineer', department: 'Engineering', location: 'San Francisco, CA', type: 'Full-time', applicants: 34, description: 'We are looking for an experienced Software Engineer to join our growing team. You will be responsible for designing, developing, and maintaining scalable web applications.', requirements: '5+ years experience with React, Node.js, TypeScript. Experience with cloud platforms (AWS/GCP). Strong problem-solving skills.' },
  { title: 'Product Manager', department: 'Product', location: 'Remote', type: 'Full-time', applicants: 18, description: 'Lead product development from conception to launch. Work closely with engineering, design, and marketing teams.', requirements: '3+ years PM experience in tech. Strong analytical skills. Experience with Agile methodologies.' },
  { title: 'UX Designer', department: 'Design', location: 'New York, NY', type: 'Full-time', applicants: 22, description: 'Create intuitive and engaging user experiences for our products. Conduct user research and usability testing.', requirements: 'Portfolio demonstrating UX/UI skills. Proficiency in Figma, Sketch. Experience with design systems.' },
  { title: 'Data Analyst', department: 'Data', location: 'Austin, TX', type: 'Full-time', applicants: 15, description: 'Analyze complex datasets to drive business decisions. Build dashboards and reports for stakeholders.', requirements: 'SQL, Python, Tableau or similar. Strong statistical knowledge. Bachelor\'s in related field.' },
  { title: 'DevOps Engineer', department: 'Engineering', location: 'Chicago, IL', type: 'Full-time', applicants: 9, description: 'Build and maintain CI/CD pipelines, infrastructure, and monitoring systems.', requirements: 'Docker, Kubernetes, Terraform, Jenkins. Cloud platform experience. Infrastructure as Code.' },
  { title: 'Frontend Developer', department: 'Engineering', location: 'Remote', type: 'Contract', applicants: 28, description: 'Develop responsive web applications using modern frameworks and tools.', requirements: '3+ years React/Vue/Angular. CSS, HTML5, JavaScript/TypeScript. Experience with responsive design.' },
  { title: 'HR Specialist', department: 'People', location: 'Boston, MA', type: 'Full-time', applicants: 12, status: 'Closed', description: 'Support recruitment, onboarding, and employee relations.', requirements: 'HR certification preferred. 2+ years experience. Strong interpersonal skills.' },
  { title: 'Machine Learning Engineer', department: 'Engineering', location: 'Seattle, WA', type: 'Full-time', applicants: 21, description: 'Build and deploy ML models for recommendation systems and data analysis.', requirements: 'Python, TensorFlow/PyTorch, SQL. Experience with model deployment. MS/PhD preferred.' },
  { title: 'Sales Representative', department: 'Sales', location: 'Denver, CO', type: 'Full-time', applicants: 16, description: 'Generate new business opportunities and maintain client relationships.', requirements: '2+ years B2B sales experience. Excellent communication skills. CRM experience.' },
  { title: 'Customer Success Manager', department: 'Customer Success', location: 'Remote', type: 'Full-time', applicants: 13, description: 'Ensure customer satisfaction and drive product adoption.', requirements: '3+ years in customer success. SaaS experience preferred. Strong problem-solving.' },
  { title: 'Marketing Manager', department: 'Marketing', location: 'Los Angeles, CA', type: 'Full-time', applicants: 19, description: 'Develop and execute marketing strategies across digital channels.', requirements: 'Digital marketing experience. SEO, SEM, social media. Analytics and reporting.' },
  { title: 'Security Engineer', department: 'Engineering', location: 'Washington, DC', type: 'Full-time', applicants: 8, description: 'Implement security best practices and conduct vulnerability assessments.', requirements: 'Security certifications (CISSP, CEH). Cloud security experience. Incident response.' },
];

const CANDIDATES = [
  { name: 'Sarah Mitchell',    email: 'sarah.m@email.com',       phone: '+1 555-0101', source: 'LinkedIn',       skills: ['React', 'Node.js', 'TypeScript', 'AWS'],                        tags: ['senior', 'urgent'],          experience: 7,  location: 'San Francisco, CA' },
  { name: 'James Chen',        email: 'james.c@email.com',       phone: '+1 555-0102', source: 'Referral',        skills: ['Product Strategy', 'Agile', 'Jira', 'SQL', 'Figma'],          tags: ['leadership', 'referral'],    experience: 5,  location: 'New York, NY'      },
  { name: 'Emily Rodriguez',   email: 'emily.r@email.com',       phone: '+1 555-0103', source: 'Indeed',          skills: ['Figma', 'Sketch', 'User Research', 'Prototyping'],             tags: ['creative', 'top-candidate'], experience: 4,  location: 'Los Angeles, CA'   },
  { name: 'Michael Thompson',  email: 'michael.t@email.com',     phone: '+1 555-0104', source: 'LinkedIn',        skills: ['Python', 'SQL', 'Tableau', 'Excel', 'Power BI'],              tags: ['analytics'],                 experience: 3,  location: 'Austin, TX'        },
  { name: 'Priya Sharma',      email: 'priya.s@email.com',       phone: '+1 555-0105', source: 'Glassdoor',       skills: ['Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'AWS'],          tags: ['devops', 'remote'],          experience: 6,  location: 'Remote'            },
  { name: 'David Kim',         email: 'david.k@email.com',       phone: '+1 555-0106', source: 'Company Website', skills: ['Vue.js', 'React', 'CSS', 'GraphQL', 'TypeScript'],            tags: ['frontend'],                  experience: 3,  location: 'Seattle, WA'       },
  { name: 'Lisa Wang',         email: 'lisa.w@email.com',        phone: '+1 555-0107', source: 'LinkedIn',        skills: ['Java', 'Spring Boot', 'Microservices', 'PostgreSQL'],         tags: ['senior', 'backend'],         experience: 8,  location: 'Boston, MA'        },
  { name: 'Marcus Johnson',    email: 'marcus.j@email.com',      phone: '+1 555-0108', source: 'Referral',        skills: ['Go', 'Python', 'Redis', 'MongoDB', 'Kafka'],                  tags: ['referral', 'backend'],       experience: 5,  location: 'Chicago, IL'       },
  { name: 'Rachel Green',      email: 'rachel.g@email.com',      phone: '+1 555-0109', source: 'Indeed',          skills: ['React', 'Next.js', 'Tailwind', 'TypeScript'],                 tags: ['frontend', 'junior'],        experience: 2,  location: 'Denver, CO'        },
  { name: 'Kevin Patel',       email: 'kevin.p@email.com',       phone: '+1 555-0110', source: 'Glassdoor',       skills: ['PyTorch', 'TensorFlow', 'Python', 'MLflow', 'R'],             tags: ['data-science'],              experience: 4,  location: 'San Jose, CA'      },
  { name: 'Alex Rivera',       email: 'alex.r@email.com',        phone: '+1 555-0111', source: 'LinkedIn',        skills: ['Python', 'Pandas', 'SQL', 'Power BI'],                        tags: ['analytics'],                 experience: 2,  location: 'Miami, FL'         },
  { name: 'Sofia Martinez',    email: 'sofia.m@email.com',       phone: '+1 555-0112', source: 'Referral',        skills: ['AWS', 'Azure', 'Linux', 'Ansible', 'Terraform'],              tags: ['devops', 'referral'],        experience: 5,  location: 'Phoenix, AZ'       },
  { name: 'Daniel Brown',      email: 'daniel.b@email.com',      phone: '+1 555-0113', source: 'Indeed',          skills: ['React', 'Angular', 'Node.js', 'MongoDB'],                     tags: ['fullstack'],                 experience: 4,  location: 'Portland, OR'      },
  { name: 'Ethan Davis',       email: 'ethan.d@email.com',       phone: '+1 555-0115', source: 'LinkedIn',        skills: ['Java', 'Python', 'System Design', 'AWS', 'DynamoDB'],         tags: ['senior', 'top-candidate'],   experience: 9,  location: 'San Francisco, CA' },
  { name: 'Emma White',        email: 'emma.w@email.com',        phone: '+1 555-0120', source: 'Company Website', skills: ['React', 'TypeScript', 'Next.js', 'Tailwind', 'Figma'],       tags: ['frontend', 'top-candidate'], experience: 4,  location: 'Seattle, WA'       },
  { name: 'Charlotte Lee',     email: 'charlotte.l@email.com',   phone: '+1 555-0122', source: 'Indeed',          skills: ['Marketing', 'SEO', 'Content Strategy', 'Analytics', 'HubSpot'], tags: ['marketing'],              experience: 4,  location: 'Chicago, IL'       },
  { name: 'Benjamin Clark',    email: 'benjamin.c@email.com',    phone: '+1 555-0123', source: 'Glassdoor',       skills: ['Salesforce', 'CRM', 'B2B Sales', 'Outreach'],                 tags: ['sales'],                     experience: 5,  location: 'New York, NY'      },
  { name: 'Amelia Lewis',      email: 'amelia.l@email.com',      phone: '+1 555-0124', source: 'Referral',        skills: ['Customer Success', 'SaaS', 'Onboarding', 'Gainsight'],        tags: ['customer-success'],          experience: 3,  location: 'Austin, TX'        },
  { name: 'Lucas Hall',        email: 'lucas.h@email.com',       phone: '+1 555-0125', source: 'LinkedIn',        skills: ['iOS', 'Swift', 'SwiftUI', 'Firebase', 'Xcode'],               tags: ['mobile'],                    experience: 5,  location: 'Los Angeles, CA'   },
  { name: 'Evelyn Wright',     email: 'evelyn.w@email.com',      phone: '+1 555-0128', source: 'LinkedIn',        skills: ['QA', 'Selenium', 'Cypress', 'Playwright', 'JIRA'],            tags: ['qa'],                        experience: 4,  location: 'Denver, CO'        },
  { name: 'Sebastian Scott',   email: 'sebastian.s@email.com',   phone: '+1 555-0131', source: 'Indeed',          skills: ['Network Security', 'CISSP', 'Firewalls', 'SIEM'],             tags: ['security'],                  experience: 7,  location: 'Washington, DC'    },
  { name: 'Ella Green',        email: 'ella.g@email.com',        phone: '+1 555-0132', source: 'LinkedIn',        skills: ['Data Engineering', 'Spark', 'Hadoop', 'Scala'],               tags: ['data-engineering'],          experience: 5,  location: 'San Jose, CA'      },
  { name: 'Samuel Mitchell',   email: 'samuel.m2@email.com',     phone: '+1 555-0137', source: 'LinkedIn',        skills: ['Cloud Architecture', 'AWS', 'Solutions Architecture', 'CDK'], tags: ['cloud', 'senior'],           experience: 10, location: 'San Francisco, CA' },
  { name: 'Gabriel Evans',     email: 'gabriel.e@email.com',     phone: '+1 555-0143', source: 'Glassdoor',       skills: ['AI/ML', 'Computer Vision', 'OpenCV', 'Python'],               tags: ['ai-ml'],                     experience: 5,  location: 'Boston, MA'        },
  { name: 'Daniel Roberts',    email: 'daniel.r@email.com',      phone: '+1 555-0139', source: 'Company Website', skills: ['Full Stack', 'JavaScript', 'Python', 'AWS'],                  tags: ['fullstack', 'senior'],       experience: 7,  location: 'Remote'            },
];

const STAGES_ORDER = [
  ApplicationStage.APPLIED,
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.SCREENING,
  ApplicationStage.INTERVIEW,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
  ApplicationStage.HIRED,
  ApplicationStage.JOINED,
  ApplicationStage.REJECTED,
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.INTERVIEW,
  ApplicationStage.APPLIED,
  ApplicationStage.OFFER,
  ApplicationStage.INTERVIEW,
  ApplicationStage.SCREENING,
  ApplicationStage.APPLIED,
  ApplicationStage.REJECTED,
  ApplicationStage.JOINED,
];

async function main() {
  console.log('🌱 Starting seed...\n');

  // ── Safety guard: detect real (non-demo) data and refuse to destroy it ────
  const forceFlag = process.argv.includes('--force');
  const DEMO_EMAILS = new Set(ROLE_USERS.map(u => u.email.toLowerCase()));
  const allExistingUsers = await prisma.user.findMany({ select: { email: true } }).catch(() => []);
  const nonDemoUsers = allExistingUsers.filter(u => !DEMO_EMAILS.has(u.email.toLowerCase()));
  const existingDemoCompany = await prisma.company.findUnique({
    where: { slug: 'devlumiq' },
    select: { id: true },
  }).catch(() => null);
  const candidateCount = await prisma.candidate.count({
    where: existingDemoCompany
      ? { OR: [{ organizationId: null }, { organizationId: { not: existingDemoCompany.id } }] }
      : {},
  }).catch(() => 0);
  const jobCount = await prisma.job.count({
    where: existingDemoCompany
      ? { OR: [{ companyId: null }, { companyId: { not: existingDemoCompany.id } }] }
      : {},
  }).catch(() => 0);
  const hasRealData = nonDemoUsers.length > 0 || candidateCount > 0 || jobCount > 0;

  if (forceFlag) {
    console.error('\nERROR: --force is disabled for buyer safety.');
    console.error('This seed is only allowed to refresh the isolated demo workspace.');
    console.error('Use npm run upgrade:v1 for buyer upgrades; it never deletes data.\n');
    process.exit(1);
  }

  if (hasRealData) {
    console.error('\n❌ REFUSING TO SEED — Real data detected in database:');
    if (nonDemoUsers.length > 0) console.error(`   • ${nonDemoUsers.length} non-demo user(s): ${nonDemoUsers.map(u => u.email).join(', ')}`);
    if (candidateCount > CANDIDATES.length) console.error(`   • ${candidateCount} candidates (>${CANDIDATES.length} demo)`);
    if (jobCount > JOB_TITLES.length) console.error(`   • ${jobCount} jobs (>${JOB_TITLES.length} demo)`);
    console.error('\n   No customer data was changed.');
    console.error('   Use the demo login button to create/refresh demo data safely.');
    console.error('   For a safe upgrade from v1, see README.md "Upgrading from v1"\n');
    process.exit(1);
  }

  // ── Company ────────────────────────────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { slug: 'devlumiq' },
    update: {},
    create: {
      name: 'Devlumiq',
      slug: 'devlumiq',
      description: 'Enterprise-grade recruitment platform trusted by fast-growing teams worldwide.',
      website: 'https://devlumiq.com',
      metaTitle: 'Devlumiq — Careers',
      metaDescription: 'Join Devlumiq and help build the future of intelligent talent acquisition.',
      isPublished: true,
    },
  });
  console.log(`✅ Company: ${company.name}`);

  // ── Role Users (all with bcrypt passwords) ──────────────────────────────────
  const createdUsers = [];
  for (const u of ROLE_USERS) {
    const hash = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, isActive: true, password: hash, organizationId: company.id, isEmailVerified: true },
      create: { name: u.name, email: u.email, password: hash, role: u.role, isActive: true, organizationId: company.id, isEmailVerified: true },
    });
    createdUsers.push(user);
    console.log(`✅ User [${u.role.padEnd(15)}] ${u.email}`);
  }
  const adminUser    = createdUsers.find(u => u.role === 'ADMIN');
  const recruiterUser = createdUsers.find(u => u.email === 'recruiter@devlumiq.com');
  const hiringManager = createdUsers.find(u => u.role === 'HIRING_MANAGER');
  const interviewerUser = createdUsers.find(u => u.role === 'INTERVIEWER');
  const demoUser     = createdUsers.find(u => u.email === 'demo@devlumiq.com');
  const primaryUser  = recruiterUser ?? demoUser ?? createdUsers[0];

  // ── Wipe volatile data ──────────────────────────────────────────────────────
  const demoUserIds = createdUsers.map(u => u.id);
  const demoJobIds = (await prisma.job.findMany({ where: { companyId: company.id }, select: { id: true } })).map(j => j.id);
  const demoCandidateIds = (await prisma.candidate.findMany({ where: { organizationId: company.id }, select: { id: true } })).map(c => c.id);
  const demoInterviewIds = (await prisma.interviewEvent.findMany({
    where: { OR: [{ jobId: { in: demoJobIds } }, { candidateId: { in: demoCandidateIds } }] },
    select: { id: true },
  }).catch(() => [])).map(i => i.id);
  const demoThreadIds = (await prisma.messageThread.findMany({ where: { organizationId: company.id }, select: { id: true } })).map(t => t.id);
  const demoTemplateIds = (await prisma.assessmentTemplate.findMany({ where: { organizationId: company.id }, select: { id: true } })).map(t => t.id);

  await prisma.userActivityLog.deleteMany({ where: { userId: { in: demoUserIds } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.candidateNote.deleteMany({ where: { candidateId: { in: demoCandidateIds } } });
  await prisma.announcement.deleteMany({ where: { organizationId: company.id } }).catch(() => {});
  await prisma.interviewScore.deleteMany({ where: { interviewId: { in: demoInterviewIds } } }).catch(() => {});
  await prisma.interviewEvent.deleteMany({ where: { id: { in: demoInterviewIds } } });
  await prisma.assessmentAssignment.deleteMany({ where: { OR: [{ candidateId: { in: demoCandidateIds } }, { templateId: { in: demoTemplateIds } }] } });
  await prisma.assessmentQuestion.deleteMany({ where: { templateId: { in: demoTemplateIds } } });
  await prisma.assessmentTemplate.deleteMany({ where: { id: { in: demoTemplateIds } } });
  await prisma.backgroundCheck.deleteMany({ where: { candidateId: { in: demoCandidateIds } } });
  await prisma.talentPoolMember.deleteMany({ where: { candidateId: { in: demoCandidateIds } } }).catch(() => {});
  await prisma.talentPool.deleteMany({ where: { organizationId: company.id } }).catch(() => {});
  await prisma.emailTemplate.deleteMany({ where: { organizationId: company.id } });
  await prisma.application.deleteMany({ where: { OR: [{ jobId: { in: demoJobIds } }, { candidateId: { in: demoCandidateIds } }] } });
  await prisma.message.deleteMany({ where: { threadId: { in: demoThreadIds } } });
  await prisma.messageThread.deleteMany({ where: { id: { in: demoThreadIds } } });
  await prisma.activityLog.deleteMany({ where: { jobId: { in: demoJobIds } } });
  await prisma.pipelineMetric.deleteMany({ where: { jobId: { in: demoJobIds } } });
  await prisma.sourceQualityMetric.deleteMany({ where: { organizationId: company.id } }).catch(() => {});
  await prisma.timeToHireMetric.deleteMany({ where: { jobId: { in: demoJobIds } } });
  await prisma.candidate.deleteMany({ where: { id: { in: demoCandidateIds } } });
  await prisma.job.deleteMany({ where: { id: { in: demoJobIds } } });
  console.log('\nCleared only the isolated demo workspace\n');

  const user = primaryUser;

  // ── Jobs ──────────────────────────────────────────────────────────────────
  await prisma.job.createMany({
    data: JOB_TITLES.map((j) => ({
      companyId: company.id,
      title: j.title,
      department: j.department,
      location: j.location,
      type: j.type,
      status: j.status || 'Active',
      applicants: j.applicants ?? Math.floor(Math.random() * 30) + 5,
      description: j.description,
      requirements: j.requirements,
    })),
  });
  const jobRecords = await prisma.job.findMany();
  const jobIds = jobRecords.map((j) => j.id);
  console.log(`✅ Jobs: ${jobRecords.length}`);

  // ── Candidates + Applications (all org-scoped) ───────────────────────────
  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    const stage = STAGES_ORDER[i % STAGES_ORDER.length] || ApplicationStage.APPLIED;
    const jobId = jobIds[i % jobIds.length];
    await prisma.candidate.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        source: c.source,
        location: c.location,
        skills: c.skills,
        tags: c.tags,
        experience: c.experience,
        organizationId: company.id,
        applications: { create: { jobId, stage } },
      },
    });
  }
  const candidates = await prisma.candidate.findMany({ include: { applications: { include: { job: true } } } });
  const baseTime = Date.now();
  console.log(`✅ Candidates: ${candidates.length}`);

  // ── Interviews ─────────────────────────────────────────────────────────────
  const ivUser = interviewerUser ?? primaryUser;
  const interviewCandidates = candidates.filter(c => c.applications.some(a => ['INTERVIEW', 'OFFER', 'HIRED'].includes(a.stage)));
  for (let i = 0; i < Math.min(10, interviewCandidates.length); i++) {
    const c = interviewCandidates[i];
    const jobId = c.applications[0]?.jobId ?? jobIds[0];
    await prisma.interviewEvent.create({
      data: {
        title: `Interview — ${c.name}`,
        type: i % 3 === 0 ? 'Technical' : i % 3 === 1 ? 'Behavioral' : 'HR Screen',
        start: new Date(baseTime + (i + 1) * 2 * 3600 * 1000),
        candidateId: c.id,
        jobId,
        assignedToId: ivUser.id,
        interviewers: JSON.stringify([{ name: ivUser.name, email: ivUser.email, status: 'confirmed' }]),
        location: i % 2 === 0 ? 'Google Meet' : 'Zoom',
      },
    });
  }
  console.log(`✅ Interviews: ${Math.min(10, interviewCandidates.length)}`);

  // ── Candidate Notes ────────────────────────────────────────────────────────
  const hm = hiringManager ?? primaryUser;
  if (candidates.length >= 3) {
    await prisma.candidateNote.createMany({
      data: [
        { candidateId: candidates[0].id, authorName: primaryUser.name, body: 'Strong technical fundamentals. Recommend moving to technical round immediately.' },
        { candidateId: candidates[0].id, authorName: hm.name,          body: 'Agreed. Scheduling for next Tuesday at 10 AM.' },
        { candidateId: candidates[1].id, authorName: primaryUser.name, body: 'Excellent leadership presence. References checked out — very positive feedback.' },
        { candidateId: candidates[2].id, authorName: hm.name,          body: 'Portfolio is outstanding. Proceeding to offer stage.' },
        { candidateId: candidates[2].id, authorName: primaryUser.name, body: 'Offer letter drafted. Awaiting final approval from ADMIN.' },
      ],
    });
  }
  console.log('✅ Candidate notes: 5');

  // ── Activity Logs ──────────────────────────────────────────────────────────
  const activityPayloads = [
    { type: 'candidate_added',     user: primaryUser.name, candidate: 'Sarah Mitchell',  position: 'Senior Software Engineer', icon: 'user-plus'   },
    { type: 'status_changed',      user: primaryUser.name, from: 'Screening', to: 'Interview', candidate: 'James Chen',       icon: 'arrow-right' },
    { type: 'interview_scheduled', user: primaryUser.name, candidate: 'Emily Rodriguez', date: new Date().toISOString().slice(0, 10),               icon: 'calendar'    },
    { type: 'offer_sent',          user: hm.name,          candidate: 'Priya Sharma',    position: 'DevOps Engineer',          icon: 'file-check'  },
    { type: 'hired',               user: primaryUser.name, candidate: 'Marcus Johnson',  position: 'Backend Developer',        icon: 'award'       },
    { type: 'job_posted',          user: adminUser?.name ?? primaryUser.name, job: 'Security Engineer', department: 'Engineering', icon: 'briefcase' },
    { type: 'role_change',         user: adminUser?.name ?? primaryUser.name, target: 'Rachel Recruiter', fromRole: 'VIEWER', toRole: 'RECRUITER', icon: 'shield' },
    { type: 'candidate_added',     user: primaryUser.name, candidate: 'Ethan Davis',     position: 'Senior Software Engineer',   icon: 'user-plus'   },
    { type: 'status_changed',      user: primaryUser.name, from: 'Applied', to: 'Screening',                                    icon: 'arrow-right' },
    { type: 'interview_completed', user: ivUser.name,      candidate: 'Priya Sharma',    position: 'DevOps Engineer',            icon: 'check-circle'},
    { type: 'rejection_sent',      user: primaryUser.name, candidate: 'Michael Thompson',position: 'Data Analyst',               icon: 'x-circle'   },
    { type: 'offer_accepted',      user: primaryUser.name, candidate: 'Sofia Martinez',  position: 'Cloud Engineer',             icon: 'award'      },
  ];
  for (let i = 0; i < activityPayloads.length; i++) {
    const p = activityPayloads[i];
    await prisma.activityLog.create({
      data: { type: p.type, payload: { ...p, time: new Date(baseTime - (activityPayloads.length - i) * 3600000).toISOString() } },
    });
  }
  console.log(`✅ Activity logs: ${activityPayloads.length}`);

  // ── Announcements ──────────────────────────────────────────────────────────
  await prisma.announcement.createMany({
    data: [
      { organizationId: company.id, type: 'announcement', title: 'RBAC is live!',              summary: 'Role-based access control is now enforced. Each user sees only what their role permits.',       timeLabel: 'Today',     cta: 'View Users',    href: '/dashboard/settings/users' },
      { organizationId: company.id, type: 'news',         title: 'Q2 hiring on track',         summary: 'You are at 89 new hires this quarter - 12% ahead of last quarter. Keep it up!',                 timeLabel: '2h ago',    cta: 'See analytics', href: '/dashboard/analytics' },
      { organizationId: company.id, type: 'reminder',     title: '3 callbacks due this week',  summary: 'Sarah Mitchell, James Chen, and Emily Rodriguez have pending follow-ups.',                       timeLabel: 'Due soon',  cta: 'View pipeline', href: '/dashboard/kanban' },
      { organizationId: company.id, type: 'announcement', title: 'New integration: LinkedIn',  summary: 'One-click import of LinkedIn applications is now available in Settings -> Integrations.',        timeLabel: 'Yesterday', href: '/dashboard/integrations' },
    ],
  });
  console.log('✅ Announcements: 4');

  // ── Notifications ──────────────────────────────────────────────────────────
  const now = Date.now();
  const notifUserId = recruiterUser?.id ?? primaryUser.id;
  await prisma.notification.createMany({
    data: [
      { userId: notifUserId, title: 'New application received', message: 'Sarah Mitchell applied for Senior Software Engineer.',           type: 'info',      isRead: false, href: '/dashboard/candidates', createdAt: new Date(now - 15 * 60000)     },
      { userId: notifUserId, title: 'Interview scheduled',       message: 'Technical interview with James Chen tomorrow at 10 AM.',        type: 'interview', isRead: false, href: '/dashboard/calendar',   createdAt: new Date(now - 45 * 60000)     },
      { userId: notifUserId, title: 'Offer accepted!',           message: 'Emily Rodriguez accepted the UX Designer offer. Welcome aboard!', type: 'success', isRead: false, href: '/dashboard/candidates', createdAt: new Date(now - 2 * 3600000)    },
      { userId: notifUserId, title: 'Callback reminder',         message: 'Follow-up call with Priya Sharma is due today.',                type: 'callback',  isRead: false, href: '/dashboard',            createdAt: new Date(now - 3 * 3600000)    },
      { userId: notifUserId, title: 'New referral',              message: 'Marcus Johnson was referred by David Kim for Backend role.',     type: 'info',      isRead: true,  href: '/dashboard/candidates', createdAt: new Date(now - 5 * 3600000)    },
      { userId: notifUserId, title: 'Pipeline milestone',        message: '20+ candidates in pipeline this month — a new record!',          type: 'success',   isRead: true,  href: '/dashboard/analytics',  createdAt: new Date(now - 8 * 3600000)    },
      { userId: notifUserId, title: 'Job posting expiring',      message: 'HR Specialist posting expires in 3 days.',                       type: 'warning',   isRead: true,  href: '/dashboard/jobs',       createdAt: new Date(now - 24 * 3600000)   },
      { userId: notifUserId, title: 'Weekly report ready',       message: 'Your hiring summary for this week is available in Analytics.',   type: 'info',      isRead: true,  href: '/dashboard/analytics',  createdAt: new Date(now - 48 * 3600000)   },
    ],
  });
  console.log('✅ Notifications: 8');

  // ── Message Threads ────────────────────────────────────────────────────────
  await prisma.messageThread.create({ data: { subject: 'Senior Software Engineer application — Sarah Mitchell', organizationId: company.id, messages: { create: [
    { fromName: 'Sarah Mitchell', fromEmail: 'sarah.m@email.com', body: 'Hi, I am very interested in the Senior Software Engineer role. I have 7 years of Node.js experience.', direction: MessageDirection.INBOUND  },
    { fromName: user.name,        fromEmail: user.email,          body: 'Hi Sarah! Thank you for reaching out. We would like to schedule a technical screen. Are you available this week?', direction: MessageDirection.OUTBOUND },
    { fromName: 'Sarah Mitchell', fromEmail: 'sarah.m@email.com', body: 'Absolutely! I am free Tuesday or Wednesday afternoon.', direction: MessageDirection.INBOUND },
  ]}}});
  await prisma.messageThread.create({ data: { subject: 'Product Manager role — James Chen', organizationId: company.id, messages: { create: [
    { fromName: 'James Chen', fromEmail: 'james.c@email.com', body: 'I would like to discuss the PM opportunity further.', direction: MessageDirection.INBOUND },
    { fromName: user.name,    fromEmail: user.email,          body: 'Hi James, happy to chat! I\'ll send a calendar invite for this week.', direction: MessageDirection.OUTBOUND },
  ]}}});
  await prisma.messageThread.create({ data: { subject: 'Shortlist update — Senior Engineer role', organizationId: company.id, messages: { create: [
    { fromName: hm.name,   fromEmail: hm.email,   body: 'Hi, do we have an update on the Senior Engineer shortlist? We need to move quickly.', direction: MessageDirection.INBOUND  },
    { fromName: user.name, fromEmail: user.email, body: 'Yes — we have 3 strong candidates in final round. Sending the shortlist now.', direction: MessageDirection.OUTBOUND },
  ]}}});
  await prisma.messageThread.create({ data: { subject: 'Technical round scheduled — Sarah M.', organizationId: company.id, messages: { create: [
    { fromName: 'Mike Chen', fromEmail: 'mike.chen@company.com', body: 'Technical round scheduled for Sarah M. at 10 AM tomorrow.', direction: MessageDirection.INBOUND  },
    { fromName: user.name,   fromEmail: user.email,              body: 'Thanks, I\'ve added it to the calendar.', direction: MessageDirection.OUTBOUND },
  ]}}});
  console.log('✅ Message threads: 4');

  // ── User Activity Logs (Audit Log page) ────────────────────────────────────
  if (adminUser) {
    for (const u of createdUsers.filter(u => u.role !== 'ADMIN')) {
      await prisma.userActivityLog.create({
        data: { userId: adminUser.id, action: 'role_change', metadata: { targetUserId: u.id, targetEmail: u.email, fromRole: 'VIEWER', toRole: u.role } },
      }).catch(() => {});
    }
  }
  console.log('✅ Audit logs seeded');

  // ── Assessment Templates ────────────────────────────────────────────────────
  const assessmentTemplates = [
    {
      name: 'React & TypeScript Technical Assessment',
      description: 'Comprehensive evaluation of React hooks, TypeScript fundamentals, and modern frontend development patterns.',
      category: 'technical',
      type: 'MULTIPLE_CHOICE',
      duration: 45,
      difficulty: 'intermediate',
      passingScore: 70,
      isActive: true,
      questions: [
        { type: 'multiple_choice', question: 'What is the purpose of useEffect hook?', description: 'Testing React hooks knowledge', options: ['State management', 'Side effects', 'Event handling', 'Style manipulation'], correctAnswer: 'Side effects', points: 10 },
        { type: 'multiple_choice', question: 'Which TypeScript feature allows defining custom types?', description: 'TypeScript basics', options: ['Interfaces', 'Variables', 'Functions', 'Loops'], correctAnswer: 'Interfaces', points: 10 },
        { type: 'open_ended', question: 'Explain the Virtual DOM and its benefits', description: 'React architecture understanding', points: 20 },
        { type: 'multiple_choice', question: 'What is JSX?', description: 'React syntax knowledge', options: ['JavaScript XML', 'Java Syntax Extension', 'JSON Xchange', 'JavaScript Extension'], correctAnswer: 'JavaScript XML', points: 10 },
        { type: 'coding', question: 'Create a custom useCounter hook', description: 'Custom hooks implementation', points: 25, language: 'javascript' },
      ]
    },
    {
      name: 'JavaScript Algorithms & Data Structures',
      description: 'Coding challenges testing algorithmic thinking, problem-solving, and JavaScript proficiency.',
      category: 'technical',
      type: 'CODING',
      duration: 60,
      difficulty: 'advanced',
      passingScore: 60,
      isActive: true,
      questions: [
        { type: 'coding', question: 'Implement binary search algorithm', description: 'Search algorithm', points: 25, language: 'javascript' },
        { type: 'coding', question: 'Solve the two-sum problem efficiently', description: 'Array manipulation', points: 25, language: 'javascript' },
        { type: 'multiple_choice', question: 'Time complexity of binary search?', description: 'Big O notation', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctAnswer: 'O(log n)', points: 15 },
        { type: 'coding', question: 'Implement a debounce function', description: 'Advanced JavaScript', points: 20, language: 'javascript' },
        { type: 'open_ended', question: 'Explain event loop in JavaScript', description: 'Core JS concepts', points: 15 },
      ]
    },
    {
      name: 'Personality & Culture Fit Assessment',
      description: 'Evaluate cultural alignment, teamwork approach, and soft skills for company values fit.',
      category: 'personality',
      type: 'PERSONALITY',
      duration: 30,
      difficulty: 'beginner',
      passingScore: 50,
      isActive: true,
      questions: [
        { type: 'open_ended', question: 'How do you handle conflicts in a team?', description: 'Conflict resolution', points: 20 },
        { type: 'open_ended', question: 'Describe your ideal work environment', description: 'Work style', points: 20 },
        { type: 'multiple_choice', question: 'How do you prefer to receive feedback?', description: 'Communication style', options: ['Face-to-face', 'Written', 'Both equally', 'Depends on context'], points: 15 },
        { type: 'open_ended', question: 'Tell us about a time you made a mistake and learned from it', description: 'Growth mindset', points: 25 },
        { type: 'open_ended', question: 'What motivates you in your work?', description: 'Motivation drivers', points: 20 },
      ]
    },
    {
      name: 'Logical Reasoning & Problem Solving',
      description: 'Cognitive assessment testing logical thinking, pattern recognition, and analytical skills.',
      category: 'cognitive',
      type: 'LOGICAL_REASONING',
      duration: 40,
      difficulty: 'intermediate',
      passingScore: 65,
      isActive: true,
      questions: [
        { type: 'multiple_choice', question: 'Complete the pattern: 2, 6, 12, 20, 30, ?', description: 'Pattern recognition', options: ['40', '42', '44', '46'], correctAnswer: '42', points: 10 },
        { type: 'multiple_choice', question: 'If all Bloops are Bleeps and all Bleeps are Blops, are all Bloops Blops?', description: 'Logical deduction', options: ['Yes', 'No', 'Cannot be determined', 'Some are'], correctAnswer: 'Yes', points: 15 },
        { type: 'multiple_choice', question: 'A bat and ball cost $11. The bat costs $10 more than the ball. How much is the ball?', description: 'Math problem solving', options: ['$0.50', '$1', '$1.50', '$0.10'], correctAnswer: '$0.50', points: 20 },
        { type: 'open_ended', question: 'How would you estimate the number of gas stations in a city?', description: 'Fermi estimation', points: 25 },
        { type: 'multiple_choice', question: 'Which number is next: 1, 1, 2, 3, 5, 8, ?', description: 'Sequence logic', options: ['11', '12', '13', '21'], correctAnswer: '13', points: 10 },
      ]
    },
    {
      name: 'English Language Proficiency',
      description: 'Assess written communication skills, grammar, and professional email writing.',
      category: 'language',
      type: 'LANGUAGE',
      duration: 35,
      difficulty: 'intermediate',
      passingScore: 75,
      isActive: true,
      questions: [
        { type: 'multiple_choice', question: 'Choose the correct sentence:', description: 'Grammar', options: ['Their going to the store.', 'They\'re going to the store.', 'There going to the store.', 'Thier going to the store.'], correctAnswer: 'They\'re going to the store.', points: 10 },
        { type: 'multiple_choice', question: 'Which word is spelled correctly?', description: 'Spelling', options: ['Accomodate', 'Accommodate', 'Acommodate', 'Accommodatte'], correctAnswer: 'Accommodate', points: 10 },
        { type: 'open_ended', question: 'Write a professional email declining a job offer politely', description: 'Professional writing', points: 30 },
        { type: 'multiple_choice', question: 'Select the best synonym for "meticulous":', description: 'Vocabulary', options: ['Careless', 'Thorough', 'Quick', 'Lazy'], correctAnswer: 'Thorough', points: 10 },
        { type: 'open_ended', question: 'Summarize the following paragraph in 2-3 sentences...', description: 'Comprehension', points: 20 },
      ]
    },
  ];

  // Create assessment templates
  const createdTemplates = [];
  for (const templateData of assessmentTemplates) {
    const { questions, ...templateInfo } = templateData;
    const template = await prisma.assessmentTemplate.create({
      data: {
        ...templateInfo,
        questions: {
          create: questions.map((q, idx) => ({
            type: q.type,
            question: q.question,
            description: q.description,
            options: q.options ? JSON.stringify(q.options) : null,
            correctAnswer: q.correctAnswer || null,
            points: q.points,
            sortOrder: idx,
            language: q.language || null,
          })),
        },
      },
    });
    createdTemplates.push(template);
  }

  // Get candidates for assignments
  const allCandidates = await prisma.candidate.findMany({ take: 10 });

  // Create assessment assignments with realistic data
  const assignmentStatuses = ['pending', 'in_progress', 'completed', 'completed', 'completed'];
  const passOutcomes = [true, true, true, false, true];

  for (let i = 0; i < Math.min(8, allCandidates.length); i++) {
    const candidate = allCandidates[i];
    const template = createdTemplates[i % createdTemplates.length];
    const status = assignmentStatuses[i % assignmentStatuses.length];
    const passed = status === 'completed' ? passOutcomes[i % passOutcomes.length] : null;
    const percentage = status === 'completed' ? (passed ? 82 : 45) : null;
    const score = status === 'completed' ? (passed ? 82 : 45) : null;
    const maxScore = 100;

    const startedAt = status !== 'pending' ? new Date(Date.now() - (i + 1) * 86400000) : null;
    const submittedAt = status === 'completed' ? new Date(Date.now() - i * 43200000) : null;

    await prisma.assessmentAssignment.create({
      data: {
        templateId: template.id,
        candidateId: candidate.id,
        assignedById: primaryUser.id,
        status,
        startedAt,
        submittedAt,
        score,
        maxScore,
        percentage,
        passed,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
  }

  // Create background checks with realistic data
  const bgCheckStatuses = ['clear', 'pending', 'consider', 'clear', 'in_progress'];
  const bgCheckTypes = [
    ['criminal', 'employment', 'education'],
    ['criminal', 'identity'],
    ['criminal', 'employment', 'education', 'credit'],
    ['criminal'],
    ['criminal', 'employment', 'identity', 'motor_vehicle'],
  ];

  for (let i = 0; i < Math.min(5, allCandidates.length); i++) {
    const candidate = allCandidates[i];
    const status = bgCheckStatuses[i % bgCheckStatuses.length];
    const checkTypes = bgCheckTypes[i % bgCheckTypes.length];
    const completedAt = ['clear', 'consider'].includes(status)
      ? new Date(Date.now() - i * 86400000 * 2)
      : null;
    const resultSummary = status === 'clear' ? 'clear' : status === 'consider' ? 'consider' : null;

    await prisma.backgroundCheck.create({
      data: {
        candidateId: candidate.id,
        requestedById: primaryUser.id,
        provider: 'CHECKR',
        status,
        checkTypes,
        resultSummary,
        completedAt,
        consentObtained: true,
        consentDate: new Date(Date.now() - (i + 1) * 86400000),
        externalId: `checkr-${Date.now()}-${i}`,
      },
    });
  }

  // Seed email templates
  const emailTemplates = [
    {
      name: 'Interview Invitation',
      subject: 'Interview Invitation - {{position}} at {{companyName}}',
      body: 'Dear {{candidateName}},\n\nWe are impressed with your background and would like to invite you for an interview for the {{position}} position at {{companyName}}.\n\nInterview Details:\nDate: {{interviewDate}}\nTime: {{interviewTime}}\nFormat: {{interviewFormat}}\n\nPlease confirm your availability by replying to this email.\n\nBest regards,\n{{companyName}} Recruitment Team',
      category: 'interview',
      variables: ['candidateName', 'position', 'companyName', 'interviewDate', 'interviewTime', 'interviewFormat'],
      isDefault: true
    },
    {
      name: 'Job Offer',
      subject: 'Job Offer - {{position}} at {{companyName}}',
      body: 'Dear {{candidateName}},\n\nWe are delighted to offer you the position of {{position}} at {{companyName}}!\n\nPOSITION DETAILS\nPosition: {{position}}\nDepartment: {{department}}\nStart Date: {{startDate}}\n\nCOMPENSATION\nAnnual Salary: {{salary}}\nCurrency: {{currency}}\n\nWe are excited about you joining our team. Please review the attached offer letter and let us know if you have any questions.\n\nWelcome aboard!\n\nBest regards,\n{{companyName}} HR Team',
      category: 'offer',
      variables: ['candidateName', 'position', 'companyName', 'department', 'startDate', 'salary', 'currency'],
      isDefault: true
    },
    {
      name: 'Application Rejection',
      subject: 'Update on your application - {{position}}',
      body: 'Dear {{candidateName}},\n\nThank you for your interest in the {{position}} position at {{companyName}} and for taking the time to interview with us.\n\nAfter careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.\n\nWe appreciate your interest in joining our team and wish you all the best in your job search.\n\nBest regards,\n{{companyName}} Recruitment Team',
      category: 'rejection',
      variables: ['candidateName', 'position', 'companyName'],
      isDefault: true
    }
  ];
  await prisma.emailTemplate.createMany({
    data: emailTemplates.map((template) => ({ ...template, organizationId: company.id })),
  });

  console.log('✅ Email templates: 3');
  console.log('✅ Assessment templates: 5');

  // ── Analytics: Pipeline Metrics ────────────────────────────────────────────
  const pipelineStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  const stageIn = [20, 14, 10, 5, 3];
  const stageOut = [14, 10, 5, 3, 3];
  for (let i = 0; i < pipelineStages.length; i++) {
    const dropOff = stageIn[i] - stageOut[i];
    await prisma.pipelineMetric.create({
      data: {
        jobId: jobIds[0],
        stageName: pipelineStages[i],
        candidatesIn: stageIn[i],
        candidatesOut: stageOut[i],
        conversionRate: stageIn[i] > 0 ? Number(((stageOut[i] / stageIn[i]) * 100).toFixed(2)) : 0,
        dropOffCount: dropOff > 0 ? dropOff : 0,
        dropOffRate: stageIn[i] > 0 ? Number(((dropOff / stageIn[i]) * 100).toFixed(2)) : 0,
        date: new Date(Date.now() - 86400000),
        period: 'daily',
      },
    });
  }
  console.log('✅ Pipeline metrics: 5');

  // ── Analytics: Source Quality Metrics ──────────────────────────────────────
  const sourceMetrics = [
    { source: 'LinkedIn', totalApplicants: 12, passedScreening: 8, interviews: 6, offers: 3, hires: 2 },
    { source: 'Referral', totalApplicants: 5, passedScreening: 4, interviews: 3, offers: 2, hires: 2 },
    { source: 'Indeed', totalApplicants: 4, passedScreening: 2, interviews: 1, offers: 0, hires: 0 },
    { source: 'GitHub', totalApplicants: 2, passedScreening: 1, interviews: 1, offers: 0, hires: 0 },
    { source: 'LinkedIn', totalApplicants: 8, passedScreening: 5, interviews: 3, offers: 2, hires: 1 },
  ];
  for (const s of sourceMetrics) {
    await prisma.sourceQualityMetric.create({
      data: {
        organizationId: company.id,
        source: s.source,
        totalApplicants: s.totalApplicants,
        passedScreening: s.passedScreening,
        interviews: s.interviews,
        offers: s.offers,
        hires: s.hires,
        passRate: Number(((s.passedScreening / s.totalApplicants) * 100).toFixed(2)),
        interviewRate: Number(((s.interviews / s.totalApplicants) * 100).toFixed(2)),
        offerRate: s.totalApplicants > 0 ? Number(((s.offers / s.totalApplicants) * 100).toFixed(2)) : 0,
        hireRate: s.totalApplicants > 0 ? Number(((s.hires / s.totalApplicants) * 100).toFixed(2)) : 0,
        avgTimeToHire: 240,
        date: new Date(Date.now() - Math.floor(Math.random() * 14) * 86400000),
        period: 'monthly',
      },
    });
  }
  console.log('✅ Source quality metrics: 5');

  // ── Analytics: Time to Hire Metrics ──────────────────────────────────────
  for (const app of candidates.flatMap(c => c.applications)) {
    const hiredAt = app.stage === 'HIRED' ? new Date(Date.now() - 86400000) : null;
    const rejectedAt = app.stage === 'REJECTED' ? new Date(Date.now() - 86400000) : null;
    const totalHours = hiredAt ? Math.round((hiredAt.getTime() - app.createdAt.getTime()) / (1000 * 60 * 60)) : null;
    await prisma.timeToHireMetric.create({
      data: {
        applicationId: app.id,
        candidateId: app.candidateId,
        jobId: app.jobId,
        appliedAt: app.createdAt,
        hiredAt,
        rejectedAt,
        totalTimeToHire: totalHours && totalHours > 0 ? totalHours : null,
      },
    }).catch(() => {});
  }
  console.log('✅ Time-to-hire metrics seeded');

  // ── Skills taxonomy (system + link demo candidates) ─────────────────────────
  const INLINE_SYSTEM_SKILLS = [
    ['JavaScript', 'Engineering'], ['TypeScript', 'Engineering'], ['Python', 'Engineering'],
    ['Java', 'Engineering'], ['C#', 'Engineering'], ['Go', 'Engineering'], ['Rust', 'Engineering'],
    ['Ruby', 'Engineering'], ['PHP', 'Engineering'], ['Swift', 'Engineering'], ['Kotlin', 'Engineering'],
    ['React', 'Engineering'], ['Next.js', 'Engineering'], ['Vue.js', 'Engineering'], ['Angular', 'Engineering'],
    ['Node.js', 'Engineering'], ['Django', 'Engineering'], ['Spring Boot', 'Engineering'],
    ['GraphQL', 'Engineering'], ['REST APIs', 'Engineering'], ['SQL', 'Engineering'],
    ['PostgreSQL', 'Engineering'], ['MySQL', 'Engineering'], ['MongoDB', 'Engineering'], ['Redis', 'Engineering'],
    ['AWS', 'Engineering'], ['Azure', 'Engineering'], ['Google Cloud', 'Engineering'],
    ['Docker', 'Engineering'], ['Kubernetes', 'Engineering'], ['CI/CD', 'Engineering'], ['Git', 'Engineering'],
    ['Terraform', 'Engineering'], ['Machine Learning', 'Engineering'], ['Data Structures', 'Engineering'],
    ['C++', 'Engineering'], ['Scala', 'Engineering'], ['Flutter', 'Engineering'], ['React Native', 'Engineering'],
    ['Express.js', 'Engineering'], ['FastAPI', 'Engineering'], ['NestJS', 'Engineering'], ['.NET', 'Engineering'],
    ['Kafka', 'Engineering'], ['Microservices', 'Engineering'], ['System Design', 'Engineering'],
    ['Linux', 'Engineering'], ['Cybersecurity', 'Engineering'],
    ['Figma', 'Design'], ['UI Design', 'Design'], ['UX Research', 'Design'], ['Wireframing', 'Design'],
    ['Design Systems', 'Design'], ['Prototyping', 'Design'], ['Accessibility', 'Design'],
    ['Product Management', 'Product'], ['Agile', 'Product'], ['Scrum', 'Product'], ['Roadmapping', 'Product'],
    ['A/B Testing', 'Product'], ['OKRs', 'Product'],
    ['Data Analysis', 'Data'], ['Tableau', 'Data'], ['Power BI', 'Data'], ['Excel', 'Data'],
    ['Statistics', 'Data'], ['ETL', 'Data'], ['dbt', 'Data'], ['Apache Spark', 'Data'], ['Airflow', 'Data'],
    ['Communication', 'Soft Skills'], ['Leadership', 'Soft Skills'], ['Problem Solving', 'Soft Skills'],
    ['Mentoring', 'Soft Skills'], ['Project Management', 'Soft Skills'], ['Negotiation', 'Soft Skills'],
    ['B2B Sales', 'Sales'], ['Cold Outreach', 'Sales'], ['CRM', 'Sales'], ['Salesforce', 'Sales'],
    ['SEO', 'Marketing'], ['Content Marketing', 'Marketing'], ['Google Ads', 'Marketing'],
    ['Email Marketing', 'Marketing'], ['Copywriting', 'Marketing'],
    ['Talent Acquisition', 'HR'], ['Interviewing', 'HR'], ['HRIS', 'HR'],
    ['Employee Relations', 'HR'], ['Onboarding', 'HR'], ['Diversity & Inclusion', 'HR'],
  ];
  const SYSTEM_SKILLS = loadSystemSkillsForSeed() || INLINE_SYSTEM_SKILLS;
  const skillIdByName = new Map();
  for (const [name, category] of SYSTEM_SKILLS) {
    const slug = String(name)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^\w\s+#.-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) continue;
    const skill = await prisma.skill.upsert({
      where: { slug },
      create: { name, slug, category, isSystem: true },
      update: { name, category, isSystem: true },
    });
    skillIdByName.set(name.toLowerCase(), skill.id);
  }
  // Link candidate JSON skills → CandidateSkill when name matches taxonomy
  for (const c of candidates) {
    const names = Array.isArray(c.skills) ? c.skills : [];
    for (const skillName of names) {
      const skillId = skillIdByName.get(String(skillName).toLowerCase());
      if (!skillId) continue;
      await prisma.candidateSkill.upsert({
        where: { candidateId_skillId: { candidateId: c.id, skillId } },
        create: { candidateId: c.id, skillId, proficiency: 3, source: 'seed' },
        update: {},
      }).catch(() => {});
    }
  }
  // Job skills for first engineering job
  const engJob = jobRecords.find((j) => j.title.includes('Software Engineer')) || jobRecords[0];
  if (engJob) {
    for (const name of ['TypeScript', 'React', 'Node.js', 'AWS']) {
      const skillId = skillIdByName.get(name.toLowerCase());
      if (!skillId) continue;
      await prisma.jobSkill.upsert({
        where: { jobId_skillId: { jobId: engJob.id, skillId } },
        create: { jobId: engJob.id, skillId, required: true, minProficiency: 2, weight: 1 },
        update: {},
      }).catch(() => {});
    }
  }
  console.log(`✅ Skills taxonomy: ${SYSTEM_SKILLS.length} system skills + candidate/job links`);

  // ── Talent pools (CRM / silver medalists) ─────────────────────────────────
  await prisma.candidate.updateMany({
    where: { organizationId: company.id },
    data: { talentPoolConsent: true, talentPoolConsentAt: new Date() },
  });
  const poolDefs = [
    {
      name: 'Silver medalists — Engineering',
      poolType: 'silver_medalist',
      description: 'Strong final-round Eng candidates we almost hired.',
      tags: ['engineering', 'silver'],
      reason: 'Reached final round; excellent culture fit',
    },
    {
      name: 'Keep warm — Product & Design',
      poolType: 'keep_warm',
      description: 'Designers and PMs for quarterly nurture campaigns.',
      tags: ['product', 'design'],
      reason: 'Strong portfolio; timing was not right',
    },
    {
      name: 'Future fit — Leadership',
      poolType: 'future_fit',
      description: 'Senior ICs and managers for upcoming leadership roles.',
      tags: ['leadership', 'future'],
      reason: 'High potential for future leadership hire',
    },
  ];
  let poolMemberCount = 0;
  for (let i = 0; i < poolDefs.length; i++) {
    const def = poolDefs[i];
    const pool = await prisma.talentPool.create({
      data: {
        organizationId: company.id,
        name: def.name,
        description: def.description,
        poolType: def.poolType,
        tags: def.tags,
        createdById: primaryUser.id,
      },
    });
    const slice = candidates.slice(i * 4, i * 4 + 5);
    for (let j = 0; j < slice.length; j++) {
      await prisma.talentPoolMember.create({
        data: {
          poolId: pool.id,
          candidateId: slice[j].id,
          addedReason: def.reason,
          addedById: primaryUser.id,
          tags: def.tags,
          lastContactedAt: j % 2 === 0 ? new Date(baseTime - (j + 1) * 7 * 86400000) : null,
          notes: j === 0 ? 'Priority nurture — schedule coffee chat next month.' : null,
        },
      });
      poolMemberCount += 1;
    }
  }
  console.log(`✅ Talent pools: ${poolDefs.length} pools, ${poolMemberCount} members`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Demo accounts (all password: Demo@1234):');
  for (const u of ROLE_USERS) {
    console.log(`  ${u.role.padEnd(16)} ${u.email}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
