/**
 * Core candidate field catalog — shared by all orgs.
 * Custom org fields are stored separately and merged at read time.
 */

const CORE_CANDIDATE_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', required: true, showInTable: true, showInForm: true, importAliases: ['name', 'candidate name', 'full name'], order: 10 },
  { key: 'email', label: 'Email', type: 'text', required: true, showInTable: true, showInForm: true, importAliases: ['email', 'e-mail', 'mail'], order: 20 },
  { key: 'contact', label: 'Contact', type: 'text', required: true, showInTable: true, showInForm: true, importAliases: ['contact', 'phone', 'mobile', 'cell'], order: 30 },
  { key: 'position', label: 'Position', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['position', 'designation', 'role', 'job title'], order: 40 },
  { key: 'companyName', label: 'Company', type: 'text', required: true, showInTable: true, showInForm: true, importAliases: ['company', 'company name', 'employer', 'current company'], order: 50 },
  { key: 'location', label: 'Location', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['location', 'city', 'place'], order: 60 },
  { key: 'experience', label: 'Experience', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['experience', 'exp', 'years'], order: 70 },
  { key: 'ctc', label: 'CTC', type: 'select', required: true, showInTable: true, showInForm: true, importAliases: ['ctc', 'current ctc', 'salary'], order: 80 },
  { key: 'expectedCtc', label: 'Expected CTC', type: 'select', required: false, showInTable: true, showInForm: true, importAliases: ['expected ctc', 'expected salary', 'ectc'], order: 90 },
  { key: 'noticePeriod', label: 'Notice Period', type: 'select', required: false, showInTable: true, showInForm: true, importAliases: ['notice', 'notice period', 'np'], order: 100 },
  { key: 'status', label: 'Status', type: 'select', required: false, showInTable: true, showInForm: true, importAliases: ['status', 'candidate status'], order: 110 },
  { key: 'source', label: 'Source', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['source', 'source of cv', 'cv source'], order: 120 },
  { key: 'client', label: 'Client', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['client', 'client name'], order: 130 },
  { key: 'spoc', label: 'SPOC', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['spoc', 'poc', 'hr'], order: 140 },
  { key: 'remark', label: 'Remark', type: 'text', required: false, showInTable: false, showInForm: true, importAliases: ['remark', 'remarks', 'notes'], order: 150 },
  { key: 'date', label: 'Date', type: 'date', required: false, showInTable: true, showInForm: true, importAliases: ['date', 'created date'], order: 160 },
  { key: 'fls', label: 'FLS', type: 'text', required: false, showInTable: true, showInForm: true, importAliases: ['fls'], order: 170 },
  { key: 'state', label: 'State', type: 'text', required: false, showInTable: false, showInForm: true, importAliases: ['state'], order: 180 },
  { key: 'feedback', label: 'Feedback', type: 'text', required: false, showInTable: false, showInForm: true, importAliases: ['feedback'], order: 190 },
];

const CORE_KEYS = new Set(CORE_CANDIDATE_FIELDS.map((f) => f.key));

/** UI / ATS field names → globalValidation detect field names */
const UI_TO_DETECT_FIELD = {
  contact: 'phone',
  companyName: 'company',
  expectedCtc: 'expectedSalary',
  source: 'sourceOfCV',
};

const DETECT_TO_UI_FIELD = {
  phone: 'contact',
  company: 'companyName',
  expectedSalary: 'expectedCtc',
  sourceOfCV: 'source',
};

function slugifyFieldKey(label) {
  return String(label || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || `field_${Date.now()}`;
}

function mergeCandidateFields(org) {
  const prefs = org?.atsSettings?.coreFieldPrefs || {};
  const custom = Array.isArray(org?.atsSettings?.candidateFields)
    ? org.atsSettings.candidateFields
    : [];

  const core = CORE_CANDIDATE_FIELDS.map((f) => {
    const p = prefs[f.key] || {};
    return {
      ...f,
      isCore: true,
      showInTable: p.showInTable !== undefined ? !!p.showInTable : f.showInTable,
      showInForm: p.showInForm !== undefined ? !!p.showInForm : f.showInForm,
    };
  });

  const customs = custom
    .filter((f) => f && f.key && !CORE_KEYS.has(f.key))
    .map((f, idx) => ({
      key: f.key,
      label: f.label || f.key,
      type: ['text', 'number', 'date', 'select', 'boolean'].includes(f.type) ? f.type : 'text',
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options : [],
      showInTable: f.showInTable !== false,
      showInForm: f.showInForm !== false,
      importAliases: Array.isArray(f.importAliases) ? f.importAliases : [],
      order: typeof f.order === 'number' ? f.order : 1000 + idx,
      isCore: false,
    }));

  return [...core, ...customs].sort((a, b) => (a.order || 0) - (b.order || 0));
}

module.exports = {
  CORE_CANDIDATE_FIELDS,
  CORE_KEYS,
  UI_TO_DETECT_FIELD,
  DETECT_TO_UI_FIELD,
  slugifyFieldKey,
  mergeCandidateFields,
};
