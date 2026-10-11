/** Topic-based question drafts used when generating a library. */

export const SUGGESTED_TOPICS = [
  'Logical reasoning',
  'Numerical aptitude',
  'Verbal ability',
  'React.js',
  'Java',
  'Python',
  'SQL',
  'Communication',
  'Behavioral',
  'Microsoft Excel',
];

const REASONING = [
  {
    type: 'multiple_choice',
    skillTag: 'Logical reasoning',
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
    skillTag: 'Logical reasoning',
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
    skillTag: 'Logical reasoning',
    points: 10,
    prompt: 'Series: 2, 6, 12, 20, 30, ?',
    options: ['40', '42', '36', '48'],
    correctOptionIndex: 1,
  },
  {
    type: 'multiple_choice',
    skillTag: 'Logical reasoning',
    points: 10,
    prompt: 'A is taller than B. C is shorter than B. D is taller than A. Who is shortest?',
    options: ['A', 'B', 'C', 'D'],
    correctOptionIndex: 2,
  },
  {
    type: 'text',
    skillTag: 'Logical reasoning',
    points: 15,
    prompt: 'A hiring manager says: “Every high performer went to a top college, so this candidate will not perform.” What is the flaw, and how would you reply?',
    rubric: 'Identifies converse / selection bias; professional, evidence-based reply.',
  },
];

function stemsFor(topic) {
  return [
    {
      type: 'multiple_choice',
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
      prompt: `In a ${topic} exercise, the candidate is stuck. What is the most professional next step for an interviewer?`,
      options: [
        'End the interview immediately',
        'Offer a structured hint and observe how they recover',
        'Complete the task for them',
        'Change the subject to personal background',
      ],
      correctOptionIndex: 1,
    },
    {
      type: 'multiple_choice',
      prompt: `What should a ${topic} question measure first?`,
      options: [
        'Pedigree of previous employers',
        'Job-relevant judgement and method',
        'Speed of typing only',
        'Willingness to work unpaid overtime',
      ],
      correctOptionIndex: 1,
    },
    {
      type: 'text',
      prompt: `Describe how you would apply ${topic} to a realistic hiring-related problem. Outline your steps and how you would verify the outcome.`,
      rubric: 'Clear method, relevant example, verification step.',
      points: 15,
    },
    {
      type: 'communication',
      prompt: `A hiring manager disagrees with your ${topic} recommendation. Write a concise reply that states the evidence and a proposed next step.`,
      rubric: 'Calm, specific, proposes a decision path.',
      points: 10,
    },
    {
      type: 'code',
      language: /sql/i.test(topic) ? 'sql' : /python/i.test(topic) ? 'python' : 'javascript',
      prompt: `Write a short solution that demonstrates ${topic}. Include a brief comment on complexity or edge cases.`,
      rubric: 'Correct approach, readable, mentions an edge case.',
      points: 20,
    },
  ].map((item) => ({
    points: item.points || 10,
    skillTag: topic,
    required: true,
    options: item.options || [],
    correctOptionIndex: item.correctOptionIndex,
    language: item.language || '',
    rubric: item.rubric || '',
    ...item,
  }));
}

export function synthesizeQuestions(topic, type, count = 5) {
  const skill = String(topic || '').trim() || 'General aptitude';
  const n = Math.min(8, Math.max(3, Number(count) || 5));
  const specialized = /reason/i.test(skill) ? REASONING : [];
  const pool = [...specialized, ...stemsFor(skill)];
  const filtered = type ? pool.filter((q) => q.type === type) : pool;
  const source = (filtered.length ? filtered : pool).slice(0, n);
  return source.map((q) => ({
    type: q.type,
    prompt: q.prompt,
    options: q.options || [],
    correctOptionIndex: q.correctOptionIndex ?? 0,
    points: q.points ?? 10,
    skillTag: q.skillTag || skill,
    rubric: q.rubric || '',
    language: q.language || '',
    required: true,
  }));
}
