/**
 * Curated starter packs for the assessment question bank.
 * Recruiters can load these as-is, or use them when AI is not configured.
 */
const PACKS = [
  {
    id: 'software-frontend',
    domain: 'Software engineering',
    skill: 'React',
    label: 'Frontend · React',
    description: 'Hooks, rendering, and component design',
    questions: [
      {
        type: 'multiple_choice',
        skillTag: 'React',
        section: 'Frontend',
        points: 10,
        prompt: 'When does React re-render a function component?',
        options: [
          'Only when the URL changes',
          'When state or props change, or a parent re-renders',
          'On every browser paint',
          'Only after componentDidMount',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        skillTag: 'React',
        section: 'Frontend',
        points: 10,
        prompt: 'What is the main reason to use a key on a list of components?',
        options: [
          'To style the first item',
          'To help React match items across renders',
          'To disable Strict Mode',
          'To skip reconciliation entirely',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'React',
        section: 'Frontend',
        points: 15,
        prompt: 'Explain when you would lift state up versus using context. Give one trade-off of each.',
        rubric: 'Mentions prop drilling vs shared context, re-render cost, and a concrete example.',
      },
      {
        type: 'code',
        skillTag: 'JavaScript',
        section: 'Frontend',
        language: 'javascript',
        points: 20,
        prompt: 'Write a function debounce(fn, wait) that delays calling fn until wait ms have passed without another call.',
        rubric: 'Returns a function, clears prior timer, preserves this/args.',
      },
      {
        type: 'communication',
        skillTag: 'Frontend',
        section: 'Frontend',
        points: 10,
        prompt: 'A stakeholder wants a “simple colour change”. You know it touches accessibility and theming. How do you reply in Slack?',
        rubric: 'Clear, respectful, sets expectation, offers a next step.',
      },
    ],
  },
  {
    id: 'software-backend',
    domain: 'Software engineering',
    skill: 'Node.js',
    label: 'Backend · APIs',
    description: 'HTTP, data modelling, and production habits',
    questions: [
      {
        type: 'multiple_choice',
        skillTag: 'APIs',
        section: 'Backend',
        points: 10,
        prompt: 'Which status code is most appropriate when a client sends a well-formed request they are not allowed to perform?',
        options: ['400', '401', '403', '404'],
        correctOptionIndex: 2,
      },
      {
        type: 'multiple_choice',
        skillTag: 'Databases',
        section: 'Backend',
        points: 10,
        prompt: 'An index on (organizationId, createdAt) is most useful for which query pattern?',
        options: [
          'Find one document by email worldwide',
          'List a tenant’s recent records',
          'Full-text search of prompts',
          'Join two collections in memory',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'Node.js',
        section: 'Backend',
        points: 15,
        prompt: 'A POST endpoint creates a record twice when the client retries. How would you make it idempotent?',
        rubric: 'Idempotency key, unique constraint, or upsert; mentions retry safety.',
      },
      {
        type: 'code',
        skillTag: 'Node.js',
        section: 'Backend',
        language: 'javascript',
        points: 20,
        prompt: 'Write an Express middleware that rejects requests missing X-Request-Id and otherwise calls next().',
        rubric: 'Reads header, 400 on missing, calls next otherwise.',
      },
      {
        type: 'communication',
        skillTag: 'Backend',
        section: 'Backend',
        points: 10,
        prompt: 'Production p95 latency jumped after a deploy. Write the first three checks you would run and what you would tell the on-call channel.',
        rubric: 'Error rate, deploy diff, dependency health; calm, specific comms.',
      },
    ],
  },
  {
    id: 'data-sql',
    domain: 'Data',
    skill: 'SQL',
    label: 'Data · SQL',
    description: 'Joins, grain, and reporting judgement',
    questions: [
      {
        type: 'multiple_choice',
        skillTag: 'SQL',
        section: 'Data',
        points: 10,
        prompt: 'LEFT JOIN B ON A.id = B.a_id returns rows where B has no match. What is in B’s columns?',
        options: ['Zeros', 'Empty strings', 'NULL', 'The last matched B row'],
        correctOptionIndex: 2,
      },
      {
        type: 'multiple_choice',
        skillTag: 'SQL',
        section: 'Data',
        points: 10,
        prompt: 'GROUP BY candidate_id, COUNT(*) over applications. What does each row represent?',
        options: [
          'One application',
          'One candidate and how many applications they have',
          'The latest application only',
          'A cartesian product of candidates',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'SQL',
        section: 'Data',
        points: 15,
        prompt: 'A dashboard shows more hires this month than HR acknowledges. List two likely query mistakes and how you would verify.',
        rubric: 'Grain (offers vs people), date timezone, duplicate rows; describes a check.',
      },
      {
        type: 'code',
        skillTag: 'SQL',
        section: 'Data',
        language: 'sql',
        points: 20,
        prompt: 'Write SQL to return each job_id and the count of distinct candidates who applied in the last 30 days.',
        rubric: 'Uses COUNT(DISTINCT), a date filter, GROUP BY job_id.',
      },
      {
        type: 'communication',
        skillTag: 'Data',
        section: 'Data',
        points: 10,
        prompt: 'A VP asks for “a number by tomorrow”. The source data is incomplete. How do you respond?',
        rubric: 'States limitation, offers a partial with caveats, proposes a date for a complete figure.',
      },
    ],
  },
  {
    id: 'sales',
    domain: 'Sales',
    skill: 'Enterprise sales',
    label: 'Sales · Discovery',
    description: 'Discovery, objection handling, written follow-up',
    questions: [
      {
        type: 'multiple_choice',
        skillTag: 'Sales',
        section: 'Sales',
        points: 10,
        prompt: 'Best next step after a discovery call with no budget confirmed?',
        options: [
          'Send a full proposal the same hour',
          'Confirm pain, stakeholders, and a next meeting',
          'Discount 30% to close this week',
          'Stop pursuing the account',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'Sales',
        section: 'Sales',
        points: 15,
        prompt: 'A champion says legal will “take months”. Draft 4–6 sentences for your follow-up email.',
        rubric: 'Empathy, offers a security pack, suggests a parallel technical track, clear ask.',
      },
      {
        type: 'communication',
        skillTag: 'Sales',
        section: 'Sales',
        points: 15,
        prompt: 'Role-play: the buyer says “we already have an ATS”. What do you say in the next 45 seconds?',
        rubric: 'Acknowledges, probes what is missing, differentiates without bashing.',
      },
      {
        type: 'multiple_choice',
        skillTag: 'Sales',
        section: 'Sales',
        points: 10,
        prompt: 'MEDDICC “Champion” is best described as:',
        options: [
          'Anyone who attended the demo',
          'Someone with influence who sells internally for you',
          'The procurement officer',
          'The lowest-priced competitor',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'Sales',
        section: 'Sales',
        points: 10,
        prompt: 'Write a one-paragraph discovery agenda you would send before a 30-minute call.',
        rubric: 'Time-boxed, mutual, names outcomes, no product dump.',
      },
    ],
  },
  {
    id: 'hr-recruiting',
    domain: 'Human resources',
    skill: 'Recruiting',
    label: 'HR · Recruiting',
    description: 'Sourcing judgement, fairness, candidate experience',
    questions: [
      {
        type: 'multiple_choice',
        skillTag: 'Recruiting',
        section: 'HR',
        points: 10,
        prompt: 'A hiring manager rejects a strong profile with “not a culture fit” and no examples. What should you do first?',
        options: [
          'Close the requisition',
          'Ask for observable behaviours and the must-have bar',
          'Ignore and send more of the same profiles',
          'Tell the candidate they failed culture',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'Recruiting',
        section: 'HR',
        points: 15,
        prompt: 'Write a structured interview question that tests stakeholder management without asking about age, family, or nationality.',
        rubric: 'Behavioural, job-related, no protected-class probes.',
      },
      {
        type: 'communication',
        skillTag: 'Recruiting',
        section: 'HR',
        points: 15,
        prompt: 'A candidate has been waiting 12 days with no update. Draft the message you send today.',
        rubric: 'Apology, honest status, next date, easy reply path.',
      },
      {
        type: 'multiple_choice',
        skillTag: 'Compliance',
        section: 'HR',
        points: 10,
        prompt: 'Which note is safest to store on a candidate profile?',
        options: [
          '“Too old for this team”',
          '“Accent will not work with clients”',
          '“Did not demonstrate SQL joins on the case”',
          '“Might be pregnant”',
        ],
        correctOptionIndex: 2,
      },
      {
        type: 'text',
        skillTag: 'Recruiting',
        section: 'HR',
        points: 10,
        prompt: 'How would you score a take-home so that late-career and early-career applicants are compared fairly?',
        rubric: 'Rubric, time-box, work-sample over pedigree.',
      },
    ],
  },
  {
    id: 'finance-ops',
    domain: 'Finance',
    skill: 'Financial analysis',
    label: 'Finance · Analysis',
    description: 'Ratios, cash vs profit, stakeholder writing',
    questions: [
      {
        type: 'multiple_choice',
        skillTag: 'Finance',
        section: 'Finance',
        points: 10,
        prompt: 'Gross margin is best described as:',
        options: [
          'Revenue minus all operating costs',
          'Revenue minus cost of goods sold, over revenue',
          'Cash in bank divided by monthly burn',
          'EBITDA plus depreciation',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        skillTag: 'Finance',
        section: 'Finance',
        points: 10,
        prompt: 'A company can be profitable and still run out of cash because:',
        options: [
          'Profit ignores tax',
          'Revenue can be recognised before cash is collected',
          'Banks freeze profitable accounts',
          'EBITDA is always higher than cash',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'text',
        skillTag: 'Finance',
        section: 'Finance',
        points: 15,
        prompt: 'ARR grew 40% but collection days stretched from 35 to 70. What two questions do you ask the CRO?',
        rubric: 'Quality of revenue, discounting, customer concentration, cash conversion.',
      },
      {
        type: 'communication',
        skillTag: 'Finance',
        section: 'Finance',
        points: 10,
        prompt: 'Explain burn multiple to a non-finance founder in five sentences.',
        rubric: 'Plain language, why it matters, one example.',
      },
      {
        type: 'text',
        skillTag: 'Finance',
        section: 'Finance',
        points: 10,
        prompt: 'You find a 2% unexplained variance in month-end close. Walk through how you investigate.',
        rubric: 'Materiality, recode vs true miss, documentation.',
      },
    ],
  },
];

function listCatalog() {
  return PACKS.map((pack) => ({
    id: pack.id,
    domain: pack.domain,
    skill: pack.skill,
    label: pack.label,
    description: pack.description,
    count: pack.questions.length,
  }));
}

function getPack(packId) {
  return PACKS.find((pack) => pack.id === packId) || null;
}

function questionsForSkill(domain, skill, type, count) {
  const needle = `${domain || ''} ${skill || ''}`.toLowerCase();
  const scored = PACKS
    .map((pack) => {
      const hay = `${pack.id} ${pack.domain} ${pack.skill} ${pack.label}`.toLowerCase();
      const hits = needle.split(/\s+/).filter(Boolean).filter((part) => hay.includes(part)).length;
      return { pack, hits };
    })
    .sort((a, b) => b.hits - a.hits);
  if (!scored[0]?.hits) return synthesizeTopicQuestions(skill || domain, type, count);
  const best = scored[0].pack.questions;
  const filtered = type ? best.filter((q) => q.type === type) : best;
  const pool = filtered.length ? filtered : best;
  return pool.slice(0, count);
}

function synthesizeTopicQuestions(skill, type, count = 5) {
  const topic = String(skill || 'this subject').trim() || 'this subject';
  const n = Math.min(8, Math.max(3, Number(count) || 5));
  if (/reason/i.test(topic)) {
    const reasoning = [
      {
        type: 'multiple_choice',
        skillTag: topic,
        points: 10,
        prompt: 'All recruiters are employees. Some employees are managers. Which conclusion follows?',
        options: [
          'All managers are recruiters',
          'Some recruiters may be managers — it is not certain',
          'No recruiter is a manager',
          'Every employee is a recruiter',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        skillTag: topic,
        points: 10,
        prompt: 'If no shortlisted candidate is ineligible, and Ravi is ineligible, which is true?',
        options: [
          'Ravi is shortlisted',
          'Ravi is not shortlisted',
          'Ravi may still be shortlisted',
          'All ineligible people are shortlisted',
        ],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        skillTag: topic,
        points: 10,
        prompt: 'Series: 2, 6, 12, 20, 30, ?',
        options: ['40', '42', '36', '48'],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        skillTag: topic,
        points: 10,
        prompt: 'A is taller than B. C is shorter than B. D is taller than A. Who is shortest?',
        options: ['A', 'B', 'C', 'D'],
        correctOptionIndex: 2,
      },
      {
        type: 'text',
        skillTag: topic,
        points: 15,
        prompt: 'A hiring manager says: “Every high performer went to a top college, so this candidate will not perform.” What is the flaw, and how would you reply?',
        rubric: 'Identifies converse / selection bias; professional, evidence-based reply.',
      },
    ];
    const filtered = type ? reasoning.filter((q) => q.type === type) : reasoning;
    if ((filtered.length ? filtered : reasoning).length) {
      return (filtered.length ? filtered : reasoning).slice(0, n);
    }
  }
  const bank = [
    {
      type: 'multiple_choice',
      skillTag: topic,
      points: 10,
      prompt: `Which approach is most reliable when evaluating ${topic} in a timed assessment?`,
      options: [
        'Guess from familiarity and skip verification',
        'Clarify the requirement, apply the core method, then check the result',
        'Copy an unrelated example without adapting it',
        'Avoid stating assumptions',
      ],
      correctOptionIndex: 1,
    },
    {
      type: 'multiple_choice',
      skillTag: topic,
      points: 10,
      prompt: `A candidate reports strong ${topic} experience. Which evidence is strongest?`,
      options: [
        'Years in the title only',
        'A relevant work sample or structured answer with a clear method',
        'A generic compliment from a colleague',
        'Social media activity',
      ],
      correctOptionIndex: 1,
    },
    {
      type: 'multiple_choice',
      skillTag: topic,
      points: 10,
      prompt: `Which practice should be avoided when scoring ${topic}?`,
      options: [
        'Using a written rubric',
        'Comparing answers to the same standard',
        'Changing the bar after seeing who applied',
        'Recording a brief rationale',
      ],
      correctOptionIndex: 2,
    },
    {
      type: 'multiple_choice',
      skillTag: topic,
      points: 10,
      prompt: `In a ${topic} exercise, the candidate is stuck. What is the most professional next step?`,
      options: [
        'End the session immediately',
        'Offer a structured hint and observe how they recover',
        'Complete the task for them',
        'Switch to unrelated personal questions',
      ],
      correctOptionIndex: 1,
    },
    {
      type: 'text',
      skillTag: topic,
      points: 15,
      prompt: `Describe how you would apply ${topic} to a realistic hiring-related problem. Outline your steps and how you would verify the outcome.`,
      rubric: 'Clear method, relevant example, verification step.',
    },
    {
      type: 'communication',
      skillTag: topic,
      points: 10,
      prompt: `A hiring manager disagrees with your ${topic} recommendation. Write a concise reply that states the evidence and a proposed next step.`,
      rubric: 'Calm, specific, proposes a decision path.',
    },
    {
      type: 'code',
      skillTag: topic,
      language: /sql/i.test(topic) ? 'sql' : /python/i.test(topic) ? 'python' : 'javascript',
      points: 20,
      prompt: `Write a short solution that demonstrates ${topic}. Include a brief comment on complexity or an edge case.`,
      rubric: 'Correct approach, readable, mentions an edge case.',
    },
  ];
  const filtered = type ? bank.filter((q) => q.type === type) : bank;
  return (filtered.length ? filtered : bank).slice(0, n);
}

module.exports = { PACKS, listCatalog, getPack, questionsForSkill, synthesizeTopicQuestions };
