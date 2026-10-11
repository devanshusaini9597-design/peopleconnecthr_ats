import { synthesizeQuestions } from './questionTemplates';

function withSection(items, section) {
  return items.map((q) => ({
    ...q,
    section: q.section || section,
    required: true,
    options: q.options?.length ? q.options : ['', ''],
    hiddenTests: q.hiddenTests?.length ? q.hiddenTests : [{ name: '', input: '', expected: '' }],
    visibleTests: q.visibleTests?.length ? q.visibleTests : [{ name: 'Sample', input: '', expected: '' }],
  }));
}

export const ASSESSMENT_TEMPLATES = [
  {
    id: 'reasoning',
    title: 'Logical reasoning screen',
    category: 'Aptitude',
    summary: 'Short timed screen for judgement and pattern recognition.',
    durationMinutes: 30,
    instructions: 'Work independently. Select the best answer. You may not use external assistance.',
    build: () => ({
      description: 'General aptitude screen covering logical reasoning used in early hiring stages.',
      questions: withSection(synthesizeQuestions('Logical reasoning', 'multiple_choice', 6), 'Reasoning'),
    }),
  },
  {
    id: 'numerical',
    title: 'Numerical aptitude',
    category: 'Aptitude',
    summary: 'Percentages, ratios, and workplace number sense.',
    durationMinutes: 30,
    instructions: 'A calculator is not required unless stated. Show careful reading of each item.',
    build: () => ({
      description: 'Numerical aptitude for operations, finance support, and analyst screens.',
      questions: withSection(synthesizeQuestions('Numerical aptitude', 'multiple_choice', 6), 'Numerical'),
    }),
  },
  {
    id: 'verbal',
    title: 'Verbal ability',
    category: 'Aptitude',
    summary: 'Reading accuracy and workplace written English.',
    durationMinutes: 25,
    instructions: 'Read each item fully before answering. There is one best option unless stated otherwise.',
    build: () => ({
      description: 'Verbal ability screen for customer-facing and coordination roles.',
      questions: withSection(synthesizeQuestions('Verbal ability', '', 5), 'Verbal'),
    }),
  },
  {
    id: 'react',
    title: 'React.js technical screen',
    category: 'Technical',
    summary: 'Hooks, component design, and JavaScript judgement.',
    durationMinutes: 45,
    instructions: 'Answer from your own experience. Do not paste from documentation unless the question asks you to reason about an API.',
    build: () => ({
      description: 'Technical screen for React.js engineers covering fundamentals and practical judgement.',
      questions: withSection(synthesizeQuestions('React.js', '', 7), 'React.js'),
    }),
  },
  {
    id: 'java',
    title: 'Java fundamentals',
    category: 'Technical',
    summary: 'Core Java, OOP, and backend judgement.',
    durationMinutes: 45,
    instructions: 'Be specific. Where a written answer is required, outline your approach before the solution.',
    build: () => ({
      description: 'Java fundamentals for backend and full-stack hiring screens.',
      questions: withSection(synthesizeQuestions('Java', '', 7), 'Java'),
    }),
  },
  {
    id: 'sql',
    title: 'SQL and data',
    category: 'Technical',
    summary: 'Queries, joins, and data quality judgement.',
    durationMinutes: 40,
    instructions: 'Assume a standard relational database. State assumptions if a schema is incomplete.',
    build: () => ({
      description: 'SQL screen for analysts, data, and backend roles.',
      questions: withSection(synthesizeQuestions('SQL', '', 6), 'SQL'),
    }),
  },
  {
    id: 'communication',
    title: 'Workplace communication',
    category: 'Soft skill',
    summary: 'Written professionalism, stakeholder updates, and conflict notes.',
    durationMinutes: 35,
    instructions: 'Write as you would to a colleague or client. Keep responses concise and professional.',
    build: () => ({
      description: 'Communication assessment for coordinator, success, and people-facing roles.',
      questions: withSection(synthesizeQuestions('Communication', 'communication', 5), 'Communication'),
    }),
  },
  {
    id: 'behavioral',
    title: 'Behavioral interview written',
    category: 'Soft skill',
    summary: 'Structured written answers on ownership, conflict, and delivery.',
    durationMinutes: 40,
    instructions: 'Use real examples. Describe the situation, your actions, and the outcome.',
    build: () => ({
      description: 'Behavioral written assessment aligned to structured interviewing.',
      questions: withSection(synthesizeQuestions('Behavioral', 'text', 5), 'Behavioral'),
    }),
  },
  {
    id: 'excel',
    title: 'Microsoft Excel screen',
    category: 'Operations',
    summary: 'Spreadsheets, lookups, and reporting judgement.',
    durationMinutes: 30,
    instructions: 'Describe functions and steps clearly. You do not need to upload a file.',
    build: () => ({
      description: 'Excel and reporting screen for operations, HR coordination, and analyst support roles.',
      questions: withSection(synthesizeQuestions('Microsoft Excel', '', 6), 'Excel'),
    }),
  },
];
