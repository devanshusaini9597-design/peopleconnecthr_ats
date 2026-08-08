import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { isDemoLoginEnabled } from '@/lib/demo-login';
import bcrypt from 'bcryptjs';

const DEMO_USERS = {
  ADMIN:          { email: 'admin@devlumiq.com',       name: 'Alex Admin' },
  RECRUITER:      { email: 'recruiter@devlumiq.com',   name: 'Rachel Recruiter' },
  HIRING_MANAGER: { email: 'hiring@devlumiq.com',      name: 'Henry Hiring' },
  INTERVIEWER:    { email: 'interviewer@devlumiq.com', name: 'Iris Interviewer' },
  VIEWER:         { email: 'viewer@devlumiq.com',      name: 'Victor Viewer' },
} as const;

type DemoRole = keyof typeof DEMO_USERS;
const DEMO_PASSWORD = 'Demo@1234';

// ─── Demo seed data ────────────────────────────────────────────────────────────
const DEMO_JOBS = [
  { title: 'Senior Software Engineer',   department: 'Engineering',      location: 'San Francisco, CA', type: 'Full-time', status: 'Active',  applicants: 42, description: 'Lead design and development of scalable backend services.', requirements: '5+ years Node.js, TypeScript, PostgreSQL.' },
  { title: 'Product Manager',            department: 'Product',          location: 'Remote',            type: 'Full-time', status: 'Active',  applicants: 28, description: 'Own product roadmap for our core platform.', requirements: '3+ years PM in B2B SaaS.' },
  { title: 'UX / Product Designer',      department: 'Design',           location: 'New York, NY',      type: 'Full-time', status: 'Active',  applicants: 19, description: 'Define UX strategy across web and mobile surfaces.', requirements: 'Portfolio showing SaaS product design. Figma expertise.' },
  { title: 'Data Analyst',               department: 'Data & Analytics', location: 'Austin, TX',        type: 'Full-time', status: 'Active',  applicants: 15, description: 'Build dashboards and analytical models for hiring funnel performance.', requirements: 'SQL, Python, Tableau. Statistical background.' },
  { title: 'DevOps Engineer',            department: 'Infrastructure',   location: 'Chicago, IL',       type: 'Full-time', status: 'Active',  applicants: 11, description: 'Maintain cloud infrastructure on AWS. CI/CD pipelines.', requirements: 'AWS, Terraform, Kubernetes, GitHub Actions.' },
  { title: 'Frontend Developer',         department: 'Engineering',      location: 'Remote',            type: 'Contract',  status: 'Active',  applicants: 33, description: 'Build performant, accessible React applications.', requirements: '3+ years React, TypeScript, Tailwind CSS.' },
  { title: 'Customer Success Manager',   department: 'Customer Success', location: 'Remote',            type: 'Full-time', status: 'Active',  applicants: 22, description: 'Own a portfolio of enterprise customers through their lifecycle.', requirements: '3+ years SaaS Customer Success. Salesforce/HubSpot.' },
  { title: 'Machine Learning Engineer',  department: 'Engineering',      location: 'Seattle, WA',       type: 'Full-time', status: 'Paused',  applicants: 8,  description: 'Build and productionise ML models for candidate matching.', requirements: 'Python, PyTorch/TensorFlow, MLOps. MS/PhD preferred.' },
];

// daysAgo helper used in createdAt spread
const dAgo = (d: number) => { const t = new Date(); t.setDate(t.getDate() - d); return t; };
const dAhead = (d: number, h = 10) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(h, 0, 0, 0); return t; };

const DEMO_CANDIDATES = [
  { name: 'Jordan Chen',      email: 'jordan.c@email.com',   phone: '+1 555-0101', source: 'LinkedIn',   experience: 6,  location: 'San Francisco, CA', skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL'],          stage: 'INTERVIEW',  daysAgo: 1 },
  { name: 'Priya Sharma',     email: 'priya.s@email.com',    phone: '+1 555-0102', source: 'Referral',   experience: 4,  location: 'New York, NY',      skills: ['Product Strategy', 'Roadmapping', 'Agile', 'Jira'],       stage: 'OFFER',      daysAgo: 2 },
  { name: 'Marcus Williams',  email: 'marcus.w@email.com',   phone: '+1 555-0103', source: 'Indeed',     experience: 8,  location: 'Remote',            skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker'],               stage: 'SCREENING',  daysAgo: 1 },
  { name: 'Sofia Garcia',     email: 'sofia.g@email.com',    phone: '+1 555-0104', source: 'LinkedIn',   experience: 3,  location: 'Austin, TX',        skills: ['Figma', 'UX Research', 'Prototyping', 'Design Systems'],  stage: 'APPLIED',    daysAgo: 0 },
  { name: 'Ethan Park',       email: 'ethan.p@email.com',    phone: '+1 555-0105', source: 'LinkedIn',   experience: 5,  location: 'Chicago, IL',       skills: ['Python', 'SQL', 'Tableau', 'Statistics'],                 stage: 'INTERVIEW',  daysAgo: 3 },
  { name: 'Aisha Johnson',    email: 'aisha.j@email.com',    phone: '+1 555-0106', source: 'Referral',   experience: 7,  location: 'Seattle, WA',       skills: ['PyTorch', 'TensorFlow', 'MLOps', 'Python'],               stage: 'SCREENING',  daysAgo: 2 },
  { name: 'Lucas Martinez',   email: 'lucas.m@email.com',    phone: '+1 555-0107', source: 'LinkedIn',   experience: 4,  location: 'Remote',            skills: ['React', 'TypeScript', 'Tailwind', 'Next.js'],             stage: 'HIRED',      daysAgo: 5 },
  { name: 'Emma Thompson',    email: 'emma.t@email.com',     phone: '+1 555-0108', source: 'Indeed',     experience: 5,  location: 'San Francisco, CA', skills: ['Customer Success', 'SaaS', 'Gainsight', 'HubSpot'],       stage: 'OFFER',      daysAgo: 1 },
  { name: 'Noah Brown',       email: 'noah.b@email.com',     phone: '+1 555-0109', source: 'LinkedIn',   experience: 3,  location: 'New York, NY',      skills: ['Node.js', 'GraphQL', 'MongoDB', 'Docker'],                stage: 'APPLIED',    daysAgo: 0 },
  { name: 'Isabella Davis',   email: 'isabella.d@email.com', phone: '+1 555-0110', source: 'GitHub',     experience: 6,  location: 'Remote',            skills: ['Go', 'Rust', 'Kubernetes', 'gRPC'],                       stage: 'SCREENING',  daysAgo: 4 },
  { name: 'Oliver Wilson',    email: 'oliver.w@email.com',   phone: '+1 555-0111', source: 'LinkedIn',   experience: 9,  location: 'Austin, TX',        skills: ['Architecture', 'AWS', 'Microservices', 'Java'],           stage: 'INTERVIEW',  daysAgo: 2 },
  { name: 'Mia Anderson',     email: 'mia.a@email.com',      phone: '+1 555-0112', source: 'Referral',   experience: 2,  location: 'Chicago, IL',       skills: ['Figma', 'Illustrator', 'Motion Design', 'Webflow'],       stage: 'REJECTED',   daysAgo: 6 },
  { name: 'James Taylor',     email: 'james.t@email.com',    phone: '+1 555-0113', source: 'Indeed',     experience: 4,  location: 'Seattle, WA',       skills: ['React Native', 'iOS', 'Swift', 'Firebase'],               stage: 'APPLIED',    daysAgo: 1 },
  { name: 'Charlotte Lee',    email: 'charlotte.l@email.com',phone: '+1 555-0114', source: 'LinkedIn',   experience: 5,  location: 'Remote',            skills: ['SQL', 'Python', 'Power BI', 'BigQuery'],                  stage: 'SCREENING',  daysAgo: 3 },
  { name: 'Benjamin Harris',  email: 'ben.h@email.com',      phone: '+1 555-0115', source: 'LinkedIn',   experience: 7,  location: 'San Francisco, CA', skills: ['TypeScript', 'React', 'GraphQL', 'PostgreSQL'],           stage: 'HIRED',      daysAgo: 7 },
  { name: 'Amelia Lewis',     email: 'amelia.l@email.com',   phone: '+1 555-0116', source: 'Referral',   experience: 3,  location: 'New York, NY',      skills: ['Customer Success', 'SaaS', 'Onboarding', 'Gainsight'],    stage: 'INTERVIEW',  daysAgo: 0 },
  { name: 'Henry Clark',      email: 'henry.c@email.com',    phone: '+1 555-0117', source: 'LinkedIn',   experience: 11, location: 'Remote',            skills: ['Engineering Leadership', 'Rust', 'C++', 'Systems'],       stage: 'OFFER',      daysAgo: 4 },
  { name: 'Evelyn Wright',    email: 'evelyn.w@email.com',   phone: '+1 555-0118', source: 'LinkedIn',   experience: 4,  location: 'Austin, TX',        skills: ['QA', 'Selenium', 'Cypress', 'Playwright'],                stage: 'REJECTED',   daysAgo: 5 },
  { name: 'Samuel Mitchell',  email: 'samuel.m@email.com',   phone: '+1 555-0119', source: 'LinkedIn',   experience: 10, location: 'Chicago, IL',       skills: ['Cloud Architecture', 'AWS', 'CDK', 'Solutions'],          stage: 'APPLIED',    daysAgo: 2 },
  { name: 'Grace Turner',     email: 'grace.t@email.com',    phone: '+1 555-0120', source: 'Indeed',     experience: 2,  location: 'Seattle, WA',       skills: ['Content Strategy', 'SEO', 'Copywriting', 'HubSpot'],      stage: 'SCREENING',  daysAgo: 1 },
];

async function seedDemoData(companyId: string, userId: string) {
  // Check current state
  const existingJobs = await prisma.job.count({ where: { companyId } });
  const existingCandidates = await prisma.candidate.count({ where: { organizationId: companyId } });

  // If everything is already seeded, just fix stage casing and exit
  if (existingJobs > 0 && existingCandidates > 0) {
    const stageMap: Record<string, string> = {
      'Applied': 'APPLIED', 'Screening': 'SCREENING', 'Interview': 'INTERVIEW',
      'Offer': 'OFFER', 'Hired': 'HIRED', 'Rejected': 'REJECTED', 'Joined': 'JOINED',
    };
    const jobIds = await prisma.job.findMany({ where: { companyId }, select: { id: true } }).then(jobs => jobs.map(j => j.id));
    if (jobIds.length > 0) {
      await Promise.all(
        Object.entries(stageMap).map(([old, next]) =>
          prisma.application.updateMany({ where: { jobId: { in: jobIds }, stage: old }, data: { stage: next } }).catch(() => {})
        )
      );
    }
    const jobs = await prisma.job.findMany({ where: { companyId }, select: { id: true, title: true } });
    await ensureDemoAnnouncements(companyId);
    await ensureDemoSourceMetrics(companyId);
    await ensureDemoNotifications(userId);
    return;
  }

  // ── Create jobs if missing ──
  if (existingJobs === 0) {
    await prisma.job.createMany({
      data: DEMO_JOBS.map((j) => ({
        companyId,
        title: j.title,
        department: j.department,
        location: j.location,
        type: j.type,
        status: j.status,
        applicants: j.applicants,
        description: j.description,
        requirements: j.requirements,
      })),
    });
  }
  const jobs = await prisma.job.findMany({ where: { companyId }, select: { id: true, title: true } });

  // ── Create candidates + applications ──
  const createdCandidates: { id: string; name: string; jobId: string }[] = [];
  if (existingCandidates === 0) {
    // Fresh seed — create everything
    for (let i = 0; i < DEMO_CANDIDATES.length; i++) {
      const c = DEMO_CANDIDATES[i];
      const jobId = jobs[i % jobs.length].id;
      const candidate = await prisma.candidate.create({
        data: {
          name: c.name,
          email: c.email,
          phone: c.phone,
          source: c.source,
          experience: c.experience,
          location: c.location,
          skills: c.skills,
          tags: [],
          organizationId: companyId,
          createdAt: dAgo(c.daysAgo),
          applications: { create: { jobId, stage: c.stage } },
        },
        select: { id: true, name: true },
      });
      createdCandidates.push({ id: candidate.id, name: candidate.name, jobId });
    }
  } else {
    // Candidates exist but jobs were missing → create applications linking them
    const existingCandidateList = await prisma.candidate.findMany({
      where: { organizationId: companyId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
    const appStages = ['APPLIED','APPLIED','SCREENING','SCREENING','INTERVIEW','INTERVIEW','OFFER','HIRED','APPLIED','SCREENING','INTERVIEW','APPLIED','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED','APPLIED','SCREENING','INTERVIEW','APPLIED','SCREENING','OFFER','HIRED','APPLIED'];
    for (let i = 0; i < existingCandidateList.length; i++) {
      const c = existingCandidateList[i];
      const jobId = jobs[i % jobs.length].id;
      await prisma.application.create({
        data: { candidateId: c.id, jobId, stage: appStages[i % appStages.length] },
      }).catch(() => {});
      createdCandidates.push({ id: c.id, name: c.name, jobId });
    }
  }

  // Create upcoming interview events (next 1–7 days) for dashboard callbacks/upcoming-interviews
  const interviewSeeds = [
    { candidateIdx: 0, jobIdx: 0, daysAhead: 1, hour: 10, type: 'video',     title: 'Technical Interview' },
    { candidateIdx: 4, jobIdx: 3, daysAhead: 1, hour: 14, type: 'phone',     title: 'HR Screen' },
    { candidateIdx: 10, jobIdx: 1, daysAhead: 2, hour: 11, type: 'technical', title: 'Technical Screen' },
    { candidateIdx: 15, jobIdx: 5, daysAhead: 3, hour: 15, type: 'video',    title: 'Final Interview' },
    { candidateIdx: 2, jobIdx: 4, daysAhead: 4, hour: 9,  type: 'onsite',    title: 'On-site Interview' },
    { candidateIdx: 7, jobIdx: 6, daysAhead: 5, hour: 13, type: 'video',     title: 'Culture Fit Interview' },
  ];
  for (const s of interviewSeeds) {
    const c = createdCandidates[s.candidateIdx];
    const j = jobs[s.jobIdx % jobs.length];
    const startTime = dAhead(s.daysAhead, s.hour);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    await prisma.interviewEvent.create({
      data: {
        title: `${s.title} — ${c.name}`,
        type: s.type,
        start: startTime,
        end: endTime,
        candidateId: c.id,
        jobId: j.id,
        assignedToId: userId,
        interviewers: [{ name: 'Rachel Recruiter', email: 'recruiter@devlumiq.com' }],
      },
    }).catch(() => {});
  }

  // Create activity logs scoped to org jobs (jobId required for org-scoped query in dashboard)
  const activitySeeds = [
    { type: 'stage_changed',        jobIdx: 0, candidateName: 'Jordan Chen',     jobTitle: jobs[0]?.title ?? '', from: 'Screening',  to: 'Interview', daysAgo: 1 },
    { type: 'application_created',  jobIdx: 1, candidateName: 'Priya Sharma',    jobTitle: jobs[1]?.title ?? '', from: '',           to: 'Applied',   daysAgo: 1 },
    { type: 'stage_changed',        jobIdx: 1, candidateName: 'Priya Sharma',    jobTitle: jobs[1]?.title ?? '', from: 'Interview',  to: 'Offer',     daysAgo: 2 },
    { type: 'interview_scheduled',  jobIdx: 0, candidateName: 'Jordan Chen',     jobTitle: jobs[0]?.title ?? '', from: '',           to: '',          daysAgo: 2 },
    { type: 'stage_changed',        jobIdx: 5, candidateName: 'Lucas Martinez',  jobTitle: jobs[5]?.title ?? '', from: 'Offer',      to: 'Hired',     daysAgo: 5 },
    { type: 'application_created',  jobIdx: 2, candidateName: 'Noah Brown',      jobTitle: jobs[2]?.title ?? '', from: '',           to: 'Applied',   daysAgo: 0 },
    { type: 'stage_changed',        jobIdx: 4, candidateName: 'Marcus Williams', jobTitle: jobs[4]?.title ?? '', from: 'Applied',    to: 'Screening', daysAgo: 1 },
    { type: 'stage_changed',        jobIdx: 6, candidateName: 'Benjamin Harris', jobTitle: jobs[6]?.title ?? '', from: 'Interview',  to: 'Hired',     daysAgo: 7 },
  ];
  for (const a of activitySeeds) {
    const j = jobs[a.jobIdx % jobs.length];
    await prisma.activityLog.create({
      data: {
        type: a.type,
        jobId: j.id,
        payload: {
          user: 'Rachel Recruiter',
          candidate: a.candidateName,
          position: a.jobTitle,
          job: a.jobTitle,
          from: a.from || undefined,
          to: a.to || undefined,
          date: dAgo(a.daysAgo).toISOString(),
          icon: a.type === 'stage_changed' ? 'move' : a.type === 'interview_scheduled' ? 'calendar' : 'user-plus',
        },
        createdAt: dAgo(a.daysAgo),
      },
    }).catch(() => {});
  }

  // Create notifications for this user
  await prisma.notification.createMany({
    data: [
      { userId, title: 'Welcome to the demo!',        message: 'Explore all 5 roles — each has a different view. Rich sample data is pre-loaded.', type: 'success', href: '/dashboard',            priority: 'high'   },
      { userId, title: '3 interviews scheduled today', message: 'Jordan Chen, Ethan Park and Oliver Wilson have interviews today.', type: 'info',    href: '/dashboard/calendar',   priority: 'high'   },
      { userId, title: 'Offer extended',               message: 'Priya Sharma has received an offer for Product Manager.',         type: 'success', href: '/dashboard/candidates', priority: 'medium' },
      { userId, title: 'New applicant',                message: 'Noah Brown applied for UX / Product Designer.',                   type: 'info',    href: '/dashboard/candidates', priority: 'low'    },
      { userId, title: 'Candidate hired',              message: 'Lucas Martinez accepted the offer for Frontend Developer.',       type: 'success', href: '/dashboard/candidates', priority: 'medium' },
    ],
  }).catch(() => {});

  // ── Candidate Notes ──────────────────────────────────────────────────────────
  if (createdCandidates.length >= 5) {
    await prisma.candidateNote.createMany({
      data: [
        { candidateId: createdCandidates[0].id, authorName: 'Rachel Recruiter', body: 'Strong technical fundamentals. Recommend moving to technical round immediately.' },
        { candidateId: createdCandidates[0].id, authorName: 'Henry Hiring',     body: 'Agreed. Scheduling for next Tuesday at 10 AM.' },
        { candidateId: createdCandidates[1].id, authorName: 'Rachel Recruiter', body: 'Excellent leadership presence. References checked out — very positive feedback.' },
        { candidateId: createdCandidates[2].id, authorName: 'Henry Hiring',     body: 'Impressive DevOps experience. Moving forward with offer discussion.' },
        { candidateId: createdCandidates[3].id, authorName: 'Rachel Recruiter', body: 'Portfolio is outstanding. Proceeding to offer stage.' },
        { candidateId: createdCandidates[7].id, authorName: 'Rachel Recruiter', body: 'Offer letter drafted. Awaiting final approval from ADMIN.' },
      ],
    }).catch(() => {});
  }

  // ── Email Templates ────────────────────────────────────────────────────────
  const existingTemplates = await prisma.emailTemplate.count({ where: { organizationId: companyId } });
  if (existingTemplates === 0) {
    await prisma.emailTemplate.createMany({
      data: [
        {
          name: 'Interview Invitation',
          subject: 'Interview Invitation - {{position}} at {{companyName}}',
          body: 'Dear {{candidateName}},\n\nWe are impressed with your background and would like to invite you for an interview for the {{position}} position at {{companyName}}.\n\nInterview Details:\nDate: {{interviewDate}}\nTime: {{interviewTime}}\nFormat: {{interviewFormat}}\n\nPlease confirm your availability by replying to this email.\n\nBest regards,\n{{companyName}} Recruitment Team',
          category: 'interview',
          variables: ['candidateName', 'position', 'companyName', 'interviewDate', 'interviewTime', 'interviewFormat'],
          isDefault: true,
          organizationId: companyId,
        },
        {
          name: 'Job Offer',
          subject: 'Job Offer - {{position}} at {{companyName}}',
          body: 'Dear {{candidateName}},\n\nWe are delighted to offer you the position of {{position}} at {{companyName}}!\n\nPosition: {{position}}\nDepartment: {{department}}\nStart Date: {{startDate}}\nAnnual Salary: {{salary}}\n\nWe are excited about you joining our team.\n\nBest regards,\n{{companyName}} HR Team',
          category: 'offer',
          variables: ['candidateName', 'position', 'companyName', 'department', 'startDate', 'salary'],
          isDefault: true,
          organizationId: companyId,
        },
        {
          name: 'Application Rejection',
          subject: 'Update on your application - {{position}}',
          body: 'Dear {{candidateName}},\n\nThank you for your interest in the {{position}} position at {{companyName}} and for taking the time to interview with us.\n\nAfter careful consideration, we have decided to move forward with other candidates whose qualifications more closely match our current needs.\n\nWe wish you all the best in your job search.\n\nBest regards,\n{{companyName}} Recruitment Team',
          category: 'rejection',
          variables: ['candidateName', 'position', 'companyName'],
          isDefault: true,
          organizationId: companyId,
        },
      ],
    }).catch(() => {});
  }

  // ── Assessment Templates ───────────────────────────────────────────────────
  const existingAssessments = await prisma.assessmentTemplate.count({ where: { organizationId: companyId } });
  if (existingAssessments === 0) {
    const assessmentSeeds = [
      {
        name: 'React & TypeScript Technical Assessment',
        description: 'Comprehensive evaluation of React hooks, TypeScript fundamentals, and modern frontend patterns.',
        category: 'technical', type: 'MULTIPLE_CHOICE' as const, duration: 45, difficulty: 'intermediate', passingScore: 70, organizationId: companyId,
        questions: [
          { type: 'multiple_choice', question: 'What is the purpose of useEffect hook?', description: 'React hooks knowledge', options: JSON.stringify(['State management', 'Side effects', 'Event handling', 'Style manipulation']), correctAnswer: 'Side effects', points: 10 },
          { type: 'multiple_choice', question: 'Which TypeScript feature allows defining custom types?', description: 'TypeScript basics', options: JSON.stringify(['Interfaces', 'Variables', 'Functions', 'Loops']), correctAnswer: 'Interfaces', points: 10 },
          { type: 'open_ended', question: 'Explain the Virtual DOM and its benefits', description: 'React architecture', points: 20 },
          { type: 'coding', question: 'Create a custom useCounter hook', description: 'Custom hooks implementation', points: 25, language: 'javascript' },
        ]
      },
      {
        name: 'Personality & Culture Fit Assessment',
        description: 'Evaluate cultural alignment, teamwork approach, and soft skills.',
        category: 'personality', type: 'PERSONALITY' as const, duration: 30, difficulty: 'beginner', passingScore: 50, organizationId: companyId,
        questions: [
          { type: 'open_ended', question: 'How do you handle conflicts in a team?', description: 'Conflict resolution', points: 20 },
          { type: 'open_ended', question: 'Describe your ideal work environment', description: 'Work style', points: 20 },
          { type: 'multiple_choice', question: 'How do you prefer to receive feedback?', description: 'Communication style', options: JSON.stringify(['Face-to-face', 'Written', 'Both equally', 'Depends on context']), points: 15 },
          { type: 'open_ended', question: 'What motivates you in your work?', description: 'Motivation drivers', points: 20 },
        ]
      },
    ];
    for (const tpl of assessmentSeeds) {
      const { questions, ...templateInfo } = tpl;
      const template = await prisma.assessmentTemplate.create({
        data: {
          ...templateInfo,
          questions: { create: questions.map((q, idx) => ({ ...q, sortOrder: idx })) },
        },
      });
      // Assign to a couple candidates
      if (createdCandidates.length >= 3) {
        await prisma.assessmentAssignment.create({
          data: {
            templateId: template.id,
            candidateId: createdCandidates[0].id,
            assignedById: userId,
            status: 'completed',
            score: 82, maxScore: 100, percentage: 82, passed: true,
            startedAt: dAgo(3), submittedAt: dAgo(2),
            expiresAt: dAhead(7),
          },
        }).catch(() => {});
        await prisma.assessmentAssignment.create({
          data: {
            templateId: template.id,
            candidateId: createdCandidates[2].id,
            assignedById: userId,
            status: 'pending',
            expiresAt: dAhead(7),
          },
        }).catch(() => {});
      }
    }
  }

  // ── Background Checks ─────────────────────────────────────────────────────
  const existingBgChecks = await prisma.backgroundCheck.count({
    where: { candidate: { organizationId: companyId } },
  });
  if (existingBgChecks === 0 && createdCandidates.length >= 5) {
    const bgSeeds = [
      { idx: 0, status: 'clear',       types: ['criminal', 'employment', 'education'], result: 'clear' },
      { idx: 1, status: 'pending',     types: ['criminal', 'identity'],                result: null },
      { idx: 6, status: 'clear',       types: ['criminal', 'employment'],              result: 'clear' },
      { idx: 7, status: 'in_progress', types: ['criminal', 'employment', 'credit'],    result: null },
    ];
    for (const bg of bgSeeds) {
      await prisma.backgroundCheck.create({
        data: {
          candidateId: createdCandidates[bg.idx].id,
          requestedById: userId,
          provider: 'CHECKR',
          status: bg.status,
          checkTypes: bg.types,
          resultSummary: bg.result,
          completedAt: bg.result ? dAgo(1) : null,
          consentObtained: true,
          consentDate: dAgo(5),
          externalId: `demo-checkr-${Date.now()}-${bg.idx}`,
        },
      }).catch(() => {});
    }
  }

  // ── Message Threads ────────────────────────────────────────────────────────
  const existingThreads = await prisma.messageThread.count({ where: { organizationId: companyId } });
  if (existingThreads === 0) {
    await prisma.messageThread.create({ data: { subject: `${DEMO_JOBS[0].title} application — ${DEMO_CANDIDATES[0].name}`, organizationId: companyId, messages: { create: [
      { fromName: DEMO_CANDIDATES[0].name, fromEmail: DEMO_CANDIDATES[0].email, body: `Hi, I am very interested in the ${DEMO_JOBS[0].title} role. I have ${DEMO_CANDIDATES[0].experience} years of relevant experience.`, direction: 'INBOUND' },
      { fromName: 'Rachel Recruiter',       fromEmail: 'recruiter@devlumiq.com',  body: `Hi ${DEMO_CANDIDATES[0].name.split(' ')[0]}! Thank you for reaching out. We would like to schedule a technical screen. Are you available this week?`, direction: 'OUTBOUND' },
      { fromName: DEMO_CANDIDATES[0].name, fromEmail: DEMO_CANDIDATES[0].email, body: 'Absolutely! I am free Tuesday or Wednesday afternoon.', direction: 'INBOUND' },
    ]}}}).catch(() => {});
    await prisma.messageThread.create({ data: { subject: `${DEMO_JOBS[1].title} role — ${DEMO_CANDIDATES[1].name}`, organizationId: companyId, messages: { create: [
      { fromName: DEMO_CANDIDATES[1].name, fromEmail: DEMO_CANDIDATES[1].email, body: 'I would like to discuss the PM opportunity further.', direction: 'INBOUND' },
      { fromName: 'Rachel Recruiter',       fromEmail: 'recruiter@devlumiq.com',  body: `Hi ${DEMO_CANDIDATES[1].name.split(' ')[0]}, happy to chat! I'll send a calendar invite for this week.`, direction: 'OUTBOUND' },
    ]}}}).catch(() => {});
    await prisma.messageThread.create({ data: { subject: `Shortlist update — ${DEMO_JOBS[0].title}`, organizationId: companyId, messages: { create: [
      { fromName: 'Henry Hiring',       fromEmail: 'hiring@devlumiq.com',      body: 'Hi, do we have an update on the Senior Engineer shortlist? We need to move quickly.', direction: 'INBOUND' },
      { fromName: 'Rachel Recruiter',   fromEmail: 'recruiter@devlumiq.com',   body: 'Yes — we have 3 strong candidates in final round. Sending the shortlist now.', direction: 'OUTBOUND' },
    ]}}}).catch(() => {});
  }

  // ── Announcements ─────────────────────────────────────────────────────────
  await ensureDemoAnnouncements(companyId);

  // ── Analytics: Pipeline Metrics ──────────────────────────────────────────
  const existingPipeline = await prisma.pipelineMetric.count({ where: { jobId: { in: jobs.map(j => j.id) } } });
  if (existingPipeline === 0) {
    const pipelineStages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];
    const stageIn = [20, 14, 10, 5, 3];
    const stageOut = [14, 10, 5, 3, 3];
    for (let i = 0; i < pipelineStages.length; i++) {
      const dropOff = stageIn[i] - stageOut[i];
      await prisma.pipelineMetric.create({
        data: {
          jobId: jobs[0].id,
          stageName: pipelineStages[i],
          candidatesIn: stageIn[i],
          candidatesOut: stageOut[i],
          conversionRate: stageIn[i] > 0 ? Number(((stageOut[i] / stageIn[i]) * 100).toFixed(2)) : 0,
          dropOffCount: dropOff > 0 ? dropOff : 0,
          dropOffRate: stageIn[i] > 0 ? Number(((dropOff / stageIn[i]) * 100).toFixed(2)) : 0,
          date: dAgo(1),
          period: 'daily',
        },
      }).catch(() => {});
    }
  }

  // ── Analytics: Source Quality Metrics ──────────────────────────────────
  await ensureDemoSourceMetrics(companyId);

  // ── Analytics: Time to Hire Metrics ────────────────────────────────────
  const existingTimeToHire = await prisma.timeToHireMetric.count({ where: { jobId: { in: jobs.map(j => j.id) } } });
  if (existingTimeToHire === 0 && createdCandidates.length > 0) {
    const apps = await prisma.application.findMany({
      where: { candidateId: { in: createdCandidates.map(c => c.id) } },
      select: { id: true, candidateId: true, jobId: true, stage: true },
    });
    for (const app of apps) {
      const candidate = createdCandidates.find(c => c.id === app.candidateId);
      if (!candidate) continue;
      const dc = DEMO_CANDIDATES.find(c => c.name === candidate.name);
      const daysAgo = dc?.daysAgo ?? 1;
      const appliedAt = dAgo(daysAgo + 3);
      const hiredAt = app.stage === 'HIRED' ? dAgo(daysAgo) : null;
      const rejectedAt = app.stage === 'REJECTED' ? dAgo(daysAgo) : null;
      const totalHours = hiredAt
        ? Math.round((hiredAt.getTime() - appliedAt.getTime()) / (1000 * 60 * 60))
        : null;
      await prisma.timeToHireMetric.create({
        data: {
          applicationId: app.id,
          candidateId: app.candidateId,
          jobId: app.jobId,
          appliedAt,
          hiredAt,
          rejectedAt,
          totalTimeToHire: totalHours && totalHours > 0 ? totalHours : null,
        },
      }).catch(() => {});
    }
  }

  // Log seed
  await prisma.userActivityLog.create({
    data: { userId, action: 'demo_data_seeded', entityType: 'company', entityId: companyId, metadata: { jobs: jobs.length, candidates: DEMO_CANDIDATES.length } },
  }).catch(() => {});
}

async function ensureDemoAnnouncements(companyId: string) {
  const existingAnnouncements = await prisma.announcement.count({ where: { organizationId: companyId } });
  if (existingAnnouncements > 0) return;

  await prisma.announcement.createMany({
    data: [
      { organizationId: companyId, type: 'announcement', title: 'RBAC is live!', summary: 'Role-based access control is now enforced. Each user sees only what their role permits.', timeLabel: 'Today', cta: 'View Users', href: '/dashboard/settings/users' },
      { organizationId: companyId, type: 'news', title: 'Q2 hiring on track', summary: 'You are at 89 new hires this quarter - 12% ahead of last quarter. Keep it up!', timeLabel: '2h ago', cta: 'See analytics', href: '/dashboard/analytics' },
      { organizationId: companyId, type: 'reminder', title: '3 callbacks due this week', summary: 'Jordan Chen, Priya Sharma, and Ethan Park have pending follow-ups.', timeLabel: 'Due soon', cta: 'View pipeline', href: '/dashboard/kanban' },
      { organizationId: companyId, type: 'announcement', title: 'New integration: LinkedIn', summary: 'One-click import of LinkedIn applications is now available in Settings -> Integrations.', timeLabel: 'Yesterday', href: '/dashboard/integrations' },
    ],
  }).catch(() => {});
}

async function ensureDemoSourceMetrics(companyId: string) {
  const existingSourceQuality = await prisma.sourceQualityMetric.count({ where: { organizationId: companyId } });
  if (existingSourceQuality > 0) return;

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
        organizationId: companyId,
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
        date: dAgo(Math.floor(Math.random() * 14)),
        period: 'monthly',
      },
    }).catch(() => {});
  }
}

async function ensureDemoNotifications(userId: string) {
  await prisma.notification.deleteMany({
    where: {
      userId,
      title: {
        in: [
          'Welcome to the demo!',
          '3 interviews scheduled today',
          'Offer extended',
          'New applicant',
          'Candidate hired',
        ],
      },
    },
  }).catch(() => {});

  await prisma.notification.createMany({
    data: [
      { userId, title: 'Welcome to the demo!', message: 'Explore all 5 roles - each has a different view. Rich sample data is pre-loaded.', type: 'success', href: '/dashboard', priority: 'high' },
      { userId, title: '3 interviews scheduled today', message: 'Jordan Chen, Ethan Park and Oliver Wilson have interviews today.', type: 'info', href: '/dashboard/calendar', priority: 'high' },
      { userId, title: 'Offer extended', message: 'Priya Sharma has received an offer for Product Manager.', type: 'success', href: '/dashboard/candidates', priority: 'medium' },
      { userId, title: 'New applicant', message: 'Noah Brown applied for UX / Product Designer.', type: 'info', href: '/dashboard/candidates', priority: 'low' },
      { userId, title: 'Candidate hired', message: 'Lucas Martinez accepted the offer for Frontend Developer.', type: 'success', href: '/dashboard/candidates', priority: 'medium' },
    ],
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
  try {
    if (!isDemoLoginEnabled(request.headers.get('host') || request.nextUrl.host)) {
      return NextResponse.json(
        { error: 'Demo login is disabled', code: 'DEMO_LOGIN_DISABLED' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const role = ((body?.role ?? '') as string).toUpperCase() as DemoRole;

    if (!DEMO_USERS[role]) {
      return NextResponse.json({ error: 'Invalid demo role' }, { status: 400 });
    }

    const meta = DEMO_USERS[role];

    // Ensure the Devlumiq demo company exists
    const company = await prisma.company.upsert({
      where: { slug: 'devlumiq' },
      update: {},
      create: {
        name: 'Devlumiq',
        slug: 'devlumiq',
        description: 'Enterprise-grade recruitment platform trusted by fast-growing teams worldwide.',
        website: 'https://devlumiq.com',
        isPublished: true,
      },
    });

    // Ensure every demo role account exists and is linked to the demo company.
    const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const demoAccounts = await Promise.all(
      Object.entries(DEMO_USERS).map(([demoRole, demoMeta]) =>
        prisma.user.upsert({
          where: { email: demoMeta.email },
          create: {
            name: demoMeta.name,
            email: demoMeta.email,
            password: demoPasswordHash,
            role: demoRole as DemoRole,
            isActive: true,
            isEmailVerified: true,
            organizationId: company.id,
          },
          update: {
            password: demoPasswordHash,
            role: demoRole as DemoRole,
            isActive: true,
            isEmailVerified: true,
            organizationId: company.id,
          },
          select: { id: true, name: true, email: true, role: true, organizationId: true, tokenVersion: true },
        })
      )
    );
    const user = demoAccounts.find((account) => account.email === meta.email) ?? demoAccounts[0];

    // Seed sample data if this is the first login for this demo company
    await seedDemoData(company.id, user.id);

    // Log demo login
    await prisma.userActivityLog.create({
      data: { userId: user.id, action: 'login', metadata: { method: 'demo' } },
    }).catch(() => {});

    const token = signSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ?? null,
      tokenVersion: user.tokenVersion ?? 0,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        initials: user.name.slice(0, 2).toUpperCase(),
      },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (e: any) {
    console.error('POST /api/auth/demo error:', e?.message ?? e);
    return NextResponse.json({ error: e?.message ?? 'Demo login failed' }, { status: 500 });
  }
}
