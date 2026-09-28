/**
 * Isolated sales demo tenant. Public entry only issues a session for users
 * flagged isDemo inside the demo organization — never a customer account.
 */
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Application = require('../models/Application');
const MisContact = require('../models/MisContact');
const Interview = require('../models/Interview');
const {
  DEMO_ROLES,
  DEMO_ORG_SLUG,
  demoEmailForRole,
} = require('../config/demoRoles');

const DEMO_JOB_CODE = 'DEMO-NS-';

function demoEnabled() {
  return String(process.env.DEMO_PUBLIC || '1').trim() !== '0';
}

function publicRoles() {
  return DEMO_ROLES.map(({ role, name, title, summary }) => ({
    role,
    name,
    title,
    summary,
  }));
}

let ensuring = null;

async function ensureDemoWorkspace() {
  if (!ensuring) {
    ensuring = ensureDemoWorkspaceInner().finally(() => {
      ensuring = null;
    });
  }
  return ensuring;
}

async function ensureDemoWorkspaceInner() {
  const ownerSpec = DEMO_ROLES.find((r) => r.role === 'owner');
  const owner = await upsertDemoUser(ownerSpec, null);

  let org = await Organization.findOne({ slug: DEMO_ORG_SLUG });
  if (org && !org.isDemo) {
    const err = new Error('Demo slug is already used by a real company.');
    err.statusCode = 409;
    err.code = 'DEMO_SLUG_TAKEN';
    throw err;
  }
  if (!org) {
    org = await Organization.create({
      name: 'Northstar Talent (Demo)',
      slug: DEMO_ORG_SLUG,
      domain: 'demo.peopleconnecthr.com',
      allowedDomains: ['demo.peopleconnecthr.com'],
      ownerId: owner._id,
      plan: 'enterprise',
      planExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 8),
      isDemo: true,
      usageLimits: {
        maxUsers: 50,
        maxJobs: 200,
        maxCandidates: 5000,
        maxEmailsPerMonth: 0,
      },
      settings: { timezone: 'Asia/Kolkata', currency: 'INR', dateFormat: 'DD/MM/YYYY' },
    });
  } else if (org.plan !== 'enterprise' || !org.isDemo) {
    org.plan = 'enterprise';
    org.isDemo = true;
    org.planExpiresAt = org.planExpiresAt || new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 8);
    await org.save();
  }

  const usersByRole = { owner };
  owner.organizationId = org._id;
  owner.onboardingCompleted = true;
  owner.isEmailVerified = true;
  owner.signupStatus = 'active';
  owner.mustChangePassword = false;
  owner.isActive = true;
  owner.isDemo = true;
  await owner.save();

  for (const spec of DEMO_ROLES) {
    if (spec.role === 'owner') continue;
    usersByRole[spec.role] = await upsertDemoUser(spec, org._id);
  }

  await seedSampleData(org, usersByRole);
  return { org, usersByRole };
}

async function upsertDemoUser(spec, organizationId) {
  const email = demoEmailForRole(spec.role);
  let user = await User.findOne({ email });
  if (user && !user.isDemo) {
    const err = new Error(`Demo address ${email} belongs to a real account.`);
    err.statusCode = 409;
    err.code = 'DEMO_EMAIL_TAKEN';
    throw err;
  }
  if (!user) {
    const password = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    user = await User.create({
      name: spec.name,
      email,
      password,
      role: spec.role,
      organizationId: organizationId || undefined,
      isEmailVerified: true,
      signupStatus: 'active',
      onboardingCompleted: true,
      mustChangePassword: false,
      isActive: true,
      isDemo: true,
      mfaEnabled: false,
    });
    return user;
  }
  user.name = spec.name;
  user.role = spec.role;
  user.isDemo = true;
  user.isActive = true;
  user.isEmailVerified = true;
  user.signupStatus = 'active';
  user.onboardingCompleted = true;
  user.mustChangePassword = false;
  user.mfaEnabled = false;
  if (organizationId) user.organizationId = organizationId;
  await user.save();
  return user;
}

async function seedSampleData(org, usersByRole) {
  const existing = await Job.countDocuments({
    organizationId: org._id,
    jobCode: new RegExp(`^${DEMO_JOB_CODE}`),
  });
  if (existing < 1) {
    await seedCoreSampleData(org, usersByRole);
  }
  await seedSupportingSampleData(org, usersByRole);
}

async function seedCoreSampleData(org, usersByRole) {
  const owner = usersByRole.owner;
  const recruiter = usersByRole.hr_recruiter;
  const freelancer = usersByRole.freelancer;

  const jobs = await Job.create([
    {
      organizationId: org._id,
      title: 'Relationship Manager',
      role: 'Relationship Manager',
      jobCode: `${DEMO_JOB_CODE}001`,
      department: 'Retail Banking',
      location: 'Mumbai',
      employmentType: 'full_time',
      experience: '3-6 years',
      skills: ['Relationship management', 'Retail banking', 'Cross-sell'],
      description: 'Sample mandate for the Northstar Talent demo workspace.',
      status: 'Open',
      isPublished: true,
      publishedAt: new Date(),
      openedAt: new Date(),
      openings: 4,
      priority: 'high',
      clientName: 'Harbour Bank',
      createdBy: owner._id,
    },
    {
      organizationId: org._id,
      title: 'Java Developer',
      role: 'Java Developer',
      jobCode: `${DEMO_JOB_CODE}002`,
      department: 'Engineering',
      location: 'Bengaluru',
      employmentType: 'full_time',
      experience: '4-7 years',
      skills: ['Java', 'Spring Boot', 'SQL'],
      description: 'Sample engineering mandate. Not a live client requirement.',
      status: 'Open',
      isPublished: true,
      publishedAt: new Date(),
      openedAt: new Date(),
      openings: 2,
      priority: 'medium',
      clientName: 'Northwind Systems',
      createdBy: recruiter._id,
    },
    {
      organizationId: org._id,
      title: 'Talent Acquisition Partner',
      role: 'Talent Acquisition Partner',
      jobCode: `${DEMO_JOB_CODE}003`,
      department: 'People',
      location: 'Hyderabad',
      employmentType: 'full_time',
      experience: '5-8 years',
      skills: ['Full-cycle hiring', 'Stakeholder management'],
      description: 'Sample in-house hiring role for the demo company.',
      status: 'Open',
      isPublished: false,
      openedAt: new Date(),
      openings: 1,
      priority: 'low',
      createdBy: owner._id,
    },
  ]);

  const people = [
    ['Anika Verma', 'anika.verma@example.com', 'Mumbai', 'Relationship Manager', recruiter._id],
    ['Dev Patel', 'dev.patel@example.com', 'Pune', 'Relationship Manager', recruiter._id],
    ['Sara Khan', 'sara.khan@example.com', 'Bengaluru', 'Java Developer', recruiter._id],
    ['Ishaan Gupta', 'ishaan.gupta@example.com', 'Bengaluru', 'Java Developer', freelancer._id],
    ['Ritika Bose', 'ritika.bose@example.com', 'Kolkata', 'Java Developer', freelancer._id],
    ['Mohit Jain', 'mohit.jain@example.com', 'Delhi', 'Talent Acquisition', recruiter._id],
    ['Leena Dsouza', 'leena.dsouza@example.com', 'Goa', 'Relationship Manager', freelancer._id],
    ['Harsh Vardhan', 'harsh.vardhan@example.com', 'Jaipur', 'Java Developer', recruiter._id],
  ];

  const candidates = await Candidate.create(people.map(([name, email, location, position, createdBy], index) => ({
    organizationId: org._id,
    name,
    email,
    contact: `98100000${String(index).padStart(2, '0')}`,
    position,
    location,
    status: 'Active',
    source: index % 2 === 0 ? 'LinkedIn' : 'Naukri',
    createdBy,
    candidateCode: `DEMO-C-${String(index + 1).padStart(4, '0')}`,
  })));

  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
  const pairs = [
    [0, 0], [1, 0], [2, 1], [3, 1], [4, 1], [5, 2], [7, 1],
  ];
  await Application.create(pairs.map(([ci, ji], index) => ({
    organizationId: org._id,
    jobId: jobs[ji]._id,
    candidateId: candidates[ci]._id,
    stage: stages[index % stages.length],
    source: 'Demo',
    assignedTo: index % 3 === 0 ? freelancer._id : recruiter._id,
    appliedAt: new Date(Date.now() - index * 86400000),
    lastActivityAt: new Date(),
    applicationCode: `DEMO-A-${String(index + 1).padStart(4, '0')}`,
    isHired: stages[index % stages.length] === 'Hired',
  })));

  await Job.updateOne({ _id: jobs[0]._id }, { applicationCount: 2 });
  await Job.updateOne({ _id: jobs[1]._id }, { applicationCount: 4 });
  await Job.updateOne({ _id: jobs[2]._id }, { applicationCount: 1 });
}

async function seedSupportingSampleData(org, usersByRole) {
  const recruiter = usersByRole.hr_recruiter;
  const interviewer = usersByRole.interviewer;
  const owner = usersByRole.owner;

  const interviewCount = await Interview.countDocuments({ organizationId: org._id });
  if (interviewCount < 1 && interviewer && recruiter) {
    const apps = await Application.find({ organizationId: org._id }).sort({ createdAt: 1 }).limit(3);
    if (apps.length) {
      await Interview.create(apps.slice(0, 2).map((app, index) => ({
        organizationId: org._id,
        applicationId: app._id,
        candidateId: app.candidateId,
        jobId: app.jobId,
        interviewers: [{
          userId: interviewer._id,
          name: interviewer.name,
          email: interviewer.email,
          status: 'accepted',
        }],
        scheduledAt: new Date(Date.now() + (index + 1) * 86400000 * 2),
        duration: 45,
        type: index === 0 ? 'video' : 'phone_screen',
        meetingLink: index === 0 ? 'https://meet.example.com/demo-northstar' : '',
        status: 'scheduled',
        createdBy: recruiter._id,
      })));
    }
  }

  const misExists = await MisContact.countDocuments({ organizationId: org._id });
  if (misExists < 1) {
    await MisContact.create([
      {
        organizationId: org._id,
        createdBy: owner._id,
        deskScope: 'org',
        name: 'Kavya Menon',
        email: 'kavya.menon@example.com',
        contact: '9876500101',
        position: 'HR Head',
        location: 'Chennai',
        companyName: 'Lumen Retail',
        source: 'Demo',
      },
      {
        organizationId: org._id,
        createdBy: recruiter._id,
        deskScope: 'org',
        name: 'Farhan Ali',
        email: 'farhan.ali@example.com',
        contact: '9876500102',
        position: 'Talent Lead',
        location: 'Hyderabad',
        companyName: 'Orbit Finance',
        source: 'Demo',
      },
      {
        organizationId: org._id,
        createdBy: usersByRole.sales?._id || owner._id,
        deskScope: 'personal',
        name: 'Sneha Kapoor',
        email: 'sneha.kapoor@example.com',
        contact: '9876500103',
        position: 'CHRO',
        location: 'Mumbai',
        companyName: 'Summit Hospitals',
        source: 'Demo',
      },
    ]);
  }
}

async function listDemoRoles() {
  if (!demoEnabled()) {
    const err = new Error('Demo is not available.');
    err.statusCode = 404;
    throw err;
  }
  return { company: 'Northstar Talent (Demo)', roles: publicRoles() };
}

async function enterDemoRole(role, req) {
  if (!demoEnabled()) {
    const err = new Error('Demo is not available.');
    err.statusCode = 404;
    throw err;
  }
  const spec = DEMO_ROLES.find((r) => r.role === String(role || '').trim());
  if (!spec) {
    const err = new Error('Choose a demo role.');
    err.statusCode = 400;
    throw err;
  }
  const { usersByRole } = await ensureDemoWorkspace();
  const user = usersByRole[spec.role];
  if (!user?.isDemo) {
    const err = new Error('Demo sign-in failed.');
    err.statusCode = 403;
    throw err;
  }
  const { completeLogin } = require('./authService');
  const result = await completeLogin(user, req);
  return {
    ...result,
    payload: {
      success: true,
      ...result.payload,
      demo: true,
      message: `Demo opened as ${spec.title}`,
    },
  };
}

function homePathForDemoRole(role) {
  if (role === 'interviewer') return '/interviews';
  if (role === 'freelancer') return '/dashboard';
  if (role === 'sales') return '/mis';
  return '/dashboard';
}

async function isDemoUserId(userId) {
  if (!userId) return false;
  const row = await User.findById(userId).select('isDemo').lean();
  return Boolean(row?.isDemo);
}

module.exports = {
  demoEnabled,
  listDemoRoles,
  enterDemoRole,
  ensureDemoWorkspace,
  isDemoUserId,
  homePathForDemoRole,
  DEMO_ORG_SLUG,
};
