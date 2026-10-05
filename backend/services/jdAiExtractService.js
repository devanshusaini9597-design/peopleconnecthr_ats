const OrgListItem = require('../models/OrgListItem');
const Client = require('../models/Client');
const Position = require('../models/Position');
const { getAdapter } = require('../adapters');
const { createAiAdapter } = require('../adapters/aiAdapter');
const { platformAiConfig } = require('../adapters/platformAi');
const { parseJsonLoose } = require('./aiFeatureHelpers');
const { parseJdText, composeInternalNotes } = require('./jdImportService');
const {
  matchOne,
  matchMany,
  matchExperience,
  matchCtc,
  matchEmployment,
} = require('../utils/jdPicklistMap');
const logger = require('../utils/logger');

const FIELD_LABELS = {
  role: 'title',
  clientName: 'client',
  industry: 'industry',
  department: 'department',
  grade: 'grade',
  ctc: 'CTC',
  experience: 'experience',
  employmentType: 'employment',
  locations: 'locations',
  skills: 'skills',
  openings: 'openings',
  summary: 'summary',
  responsibilities: 'responsibilities',
  requirements: 'requirements',
  preferred: 'preferred profile',
  reportingTo: 'reports to',
  languages: 'languages',
  kpis: 'KRAs',
};

const FIELD_KEYS = [
  'role',
  'clientName',
  'industry',
  'department',
  'grade',
  'ctc',
  'experience',
  'employmentType',
  'locations',
  'skills',
  'openings',
  'summary',
  'responsibilities',
  'requirements',
  'preferred',
  'reportingTo',
  'languages',
  'kpis',
];

function isBlank(value) {
  if (Array.isArray(value)) return !value.filter(Boolean).length;
  const v = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return !v || /^(n\/?a|na|nil|none|-)$/i.test(v);
}

function clampConf(n, fallback = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

function asList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/[,;/|\n]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlFromLlm(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/^[\s*•\-–—]+/, '').trim()).filter(Boolean);
  if (lines.length > 1 && lines.filter((l) => l.length < 180).length >= Math.max(2, Math.floor(lines.length * 0.5))) {
    return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
  }
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function pickScalar(llmVal, regexVal, llmConf) {
  const llmEmpty = isBlank(llmVal);
  const regexEmpty = isBlank(regexVal);
  if (!llmEmpty && (llmConf >= 0.4 || regexEmpty)) {
    return { value: String(llmVal).trim(), source: 'ai', confidence: llmConf };
  }
  if (!regexEmpty) {
    return { value: String(regexVal).trim(), source: 'regex', confidence: llmEmpty ? 0.64 : Math.max(0.5, 1 - llmConf) };
  }
  return { value: '', source: 'none', confidence: 0 };
}

function pickHtml(llmVal, regexVal, llmConf) {
  const llmHtml = htmlFromLlm(llmVal);
  const regexHtml = String(regexVal || '').trim();
  const llmLen = llmHtml.replace(/<[^>]+>/g, ' ').trim().length;
  const regexLen = regexHtml.replace(/<[^>]+>/g, ' ').trim().length;
  if (llmLen >= 40 && (llmConf >= 0.4 || llmLen >= regexLen)) {
    return { value: llmHtml, source: 'ai', confidence: Math.max(llmConf, 0.7) };
  }
  if (regexLen) {
    return { value: regexHtml, source: 'regex', confidence: 0.62 };
  }
  if (llmLen) return { value: llmHtml, source: 'ai', confidence: llmConf || 0.5 };
  return { value: '', source: 'none', confidence: 0 };
}

async function loadCatalogs(organizationId) {
  if (!organizationId) {
    return {
      location: [],
      product: [],
      experience: [],
      ctc: [],
      grade: [],
      industry: [],
      clients: [],
      positions: [],
    };
  }
  const scope = { organizationId, isActive: true };
  const [lists, clients, positions] = await Promise.all([
    OrgListItem.find(scope).select('listKey name').lean().limit(2500),
    Client.find({ organizationId, isActive: { $ne: false } }).select('name').lean().limit(500),
    Position.find({ organizationId, isActive: { $ne: false } }).select('name').lean().limit(500),
  ]);
  const byKey = {
    location: [],
    product: [],
    experience: [],
    ctc: [],
    grade: [],
    industry: [],
  };
  for (const row of lists) {
    if (byKey[row.listKey]) byKey[row.listKey].push(row.name);
  }
  return {
    ...byKey,
    clients: clients.map((c) => c.name).filter(Boolean),
    positions: positions.map((p) => p.name).filter(Boolean),
  };
}

function catalogSnippet(list, cap = 80) {
  return (list || []).slice(0, cap).join(' | ');
}

async function resolveAiAdapter(organizationId) {
  try {
    const viaOrg = await getAdapter(organizationId, 'ai');
    if (viaOrg) return viaOrg;
  } catch {
    /* fall through to platform key */
  }
  const platform = platformAiConfig();
  if (!platform) return null;
  try {
    return createAiAdapter(platform);
  } catch {
    return null;
  }
}

async function extractWithLlm(adapter, text, catalogs) {
  const clipped = String(text || '').slice(0, 14000);
  const prompt = `You extract structured fields from a recruiting job description for an ATS.
Return JSON only with this exact shape:
{
  "role": string,
  "clientName": string,
  "industry": string,
  "department": string,
  "grade": string,
  "ctc": string,
  "experience": string,
  "employmentType": "full_time"|"part_time"|"contract"|"internship"|"freelance"|"" ,
  "locations": string[],
  "skills": string[],
  "openings": number|null,
  "summary": string,
  "responsibilities": string,
  "requirements": string,
  "preferred": string,
  "kpis": string,
  "languages": string,
  "reportingTo": string,
  "businessUnit": string,
  "division": string,
  "travelRequired": string,
  "travelLevel": string,
  "jobLevel": string,
  "directReports": string,
  "preparedBy": string,
  "confidence": { "role":0-1, "clientName":0-1, "industry":0-1, "department":0-1, "grade":0-1, "ctc":0-1, "experience":0-1, "employmentType":0-1, "locations":0-1, "skills":0-1, "openings":0-1, "summary":0-1, "responsibilities":0-1, "requirements":0-1, "preferred":0-1, "kpis":0-1, "languages":0-1, "reportingTo":0-1 }
}

Rules:
- Extract only facts present in the JD. Use empty string / [] / null when unknown.
- Do not invent CTC, client, or locations. "NA" / "N/A" / "Yes/No" as a location means empty. If the JD names no city, locations must be [].
- clientName is the hiring company / legal entity, never a job duty that contains the word client.
- designation / job title → role. Typical Grade / Grade → grade (keep the full value, e.g. DM/Manager).
- Number of years of experience (range) such as 5-8 years → experience.
- Type of companies/sector (Banking, private/PSU/cooperative banks) → industry BFSI or BANKING.
- Computer/technical skills → skills (short names only: MS Office, Banking Software, KYC, AML).
- Competency words (Analytical Skills, Planning) may be skills. Do not paste whole paragraphs into skills.
- Key Responsibilities → responsibilities. Desired Experience & Qualification → requirements. KRA / KPI tables → kpis, not requirements.
- openings is headcount to hire. Direct Reports is NOT openings.
- Travel required / Level of travel / Reporting To / Business Unit belong in those fields, not in department.
- Prefer catalog values when the JD clearly matches one of them.
- summary / responsibilities / requirements / preferred / kpis: concise HTML <p> or <ul><li>.
- employmentType must be one of the enum values. Bank staff roles with no contract wording are full_time.

Job title catalog (sample): ${catalogSnippet(catalogs.positions, 60) || '(none)'}
Client catalog (sample): ${catalogSnippet(catalogs.clients, 60) || '(none)'}
Location catalog (sample): ${catalogSnippet(catalogs.location, 80) || '(none)'}
Skill catalog (sample): ${catalogSnippet(catalogs.product, 80) || '(none)'}
Experience bands: ${catalogSnippet(catalogs.experience, 40) || 'FRESHER | 0-1 YEARS | 1-2 YEARS | 2-3 YEARS | 3-5 YEARS | 5-8 YEARS'}
CTC bands (sample): ${catalogSnippet(catalogs.ctc, 40) || '(none)'}
Industry catalog: ${catalogSnippet(catalogs.industry, 40) || '(none)'}
Grade catalog: ${catalogSnippet(catalogs.grade, 40) || '(none)'}

JOB DESCRIPTION:
${clipped}`;

  const raw = await adapter.generateText({ prompt, maxTokens: 2200 });
  const parsed = parseJsonLoose(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed;
}

function mapFields(merged, catalogs) {
  const unmapped = { locations: [], skills: [] };

  const role = matchOne(merged.role.value, catalogs.positions);
  const clientName = matchOne(merged.clientName.value, catalogs.clients);
  const industry = matchOne(merged.industry.value, catalogs.industry);
  const grade = matchOne(merged.grade.value, catalogs.grade);
  const experience = matchExperience(merged.experience.value, catalogs.experience);
  const ctc = matchCtc(merged.ctc.value, catalogs.ctc);
  const employment = matchEmployment(merged.employmentType.value);
  const locs = matchMany(asList(merged.locations.value), catalogs.location);
  const skills = matchMany(asList(merged.skills.value), catalogs.product);

  unmapped.locations = locs.unmapped;
  unmapped.skills = skills.unmapped;

  const bump = (base, mappedConf) => {
    if (!base.value) return 0;
    return Math.min(0.99, (base.confidence || 0.55) * 0.45 + mappedConf * 0.55);
  };

  const fields = {
    role: role.value,
    clientName: clientName.value,
    industry: industry.value,
    department: merged.department.value,
    grade: grade.value,
    ctc: ctc.value,
    experience: experience.value,
    employmentType: employment.value,
    locations: locs.values,
    skills: skills.values,
    openings: merged.openings.value,
    summary: merged.summary.value,
    responsibilities: merged.responsibilities.value,
    requirements: merged.requirements.value,
    preferred: merged.preferred.value,
    reportingTo: merged.reportingTo?.value || '',
    languages: merged.languages?.value || '',
    kpis: merged.kpis?.value || '',
    internalNotes: merged.internalNotes?.value || '',
    businessUnit: merged.businessUnit?.value || '',
    division: merged.division?.value || '',
    travelRequired: merged.travelRequired?.value || '',
    travelLevel: merged.travelLevel?.value || '',
    jobLevel: merged.jobLevel?.value || '',
    directReports: merged.directReports?.value || '',
    preparedBy: merged.preparedBy?.value || '',
  };

  const confidence = {
    role: fields.role ? bump(merged.role, role.confidence) : 0,
    clientName: fields.clientName ? bump(merged.clientName, clientName.confidence) : 0,
    industry: fields.industry ? bump(merged.industry, industry.confidence) : 0,
    department: isBlank(fields.department) ? 0 : merged.department.confidence,
    grade: fields.grade ? bump(merged.grade, grade.confidence) : 0,
    ctc: fields.ctc ? bump(merged.ctc, ctc.confidence) : 0,
    experience: fields.experience ? bump(merged.experience, experience.confidence) : 0,
    employmentType: fields.employmentType ? bump(merged.employmentType, employment.confidence || 0.9) : 0,
    locations: fields.locations.length
      ? bump({ value: '1', confidence: merged.locations.confidence }, locs.hits[0]?.confidence || 0.7)
      : 0,
    skills: fields.skills.length
      ? bump({ value: '1', confidence: merged.skills.confidence }, skills.hits[0]?.confidence || 0.7)
      : 0,
    openings: fields.openings ? merged.openings.confidence : 0,
    summary: isBlank(fields.summary) ? 0 : merged.summary.confidence,
    responsibilities: isBlank(fields.responsibilities) ? 0 : merged.responsibilities.confidence,
    requirements: isBlank(fields.requirements) ? 0 : merged.requirements.confidence,
    preferred: isBlank(fields.preferred) ? 0 : merged.preferred.confidence,
    reportingTo: isBlank(fields.reportingTo) ? 0 : (merged.reportingTo?.confidence || 0.7),
    languages: isBlank(fields.languages) ? 0 : (merged.languages?.confidence || 0.7),
    kpis: isBlank(fields.kpis) ? 0 : (merged.kpis?.confidence || 0.65),
  };

  const sources = {
    role: merged.role.source,
    clientName: merged.clientName.source,
    industry: merged.industry.source,
    department: merged.department.source,
    grade: merged.grade.source,
    ctc: merged.ctc.source,
    experience: merged.experience.source,
    employmentType: merged.employmentType.source,
    locations: merged.locations.source,
    skills: merged.skills.source,
    openings: merged.openings.source,
    summary: merged.summary.source,
    responsibilities: merged.responsibilities.source,
    requirements: merged.requirements.source,
    preferred: merged.preferred.source,
    reportingTo: merged.reportingTo?.source || 'none',
    languages: merged.languages?.source || 'none',
    kpis: merged.kpis?.source || 'none',
  };

  return { fields, confidence, sources, unmapped };
}

function overallFrom(confidence) {
  const filled = FIELD_KEYS.filter((k) => Number(confidence[k]) > 0);
  if (!filled.length) return 0;
  const sum = filled.reduce((acc, k) => acc + Number(confidence[k] || 0), 0);
  return Math.round((sum / filled.length) * 100) / 100;
}

function filledCount(fields) {
  return FIELD_KEYS.filter((k) => !isBlank(fields[k])).length;
}

async function parseJdWithAi({ organizationId, text }) {
  const regexFields = parseJdText(text);
  const catalogs = await loadCatalogs(organizationId);

  let llm = null;
  let method = 'regex';
  const adapter = await resolveAiAdapter(organizationId);
  if (adapter) {
    try {
      llm = await extractWithLlm(adapter, text, catalogs);
      if (llm) method = 'ai';
    } catch (err) {
      logger.warn('[jdAiExtract] LLM failed, using regex', err.message);
    }
  }

  const llmConf = (llm && llm.confidence) || {};
  const llmOpeningsRaw = llm?.openings != null && llm.openings !== '' ? String(llm.openings) : '';
  const llmOpenings = regexFields.directReports && llmOpeningsRaw === String(regexFields.directReports)
    ? ''
    : llmOpeningsRaw;

  const merged = {
    role: pickScalar(llm?.role, regexFields.role, clampConf(llmConf.role, 0.7)),
    clientName: pickScalar(llm?.clientName, regexFields.clientName, clampConf(llmConf.clientName, 0.6)),
    industry: pickScalar(llm?.industry, regexFields.industry, clampConf(llmConf.industry, 0.55)),
    department: pickScalar(llm?.department, regexFields.department, clampConf(llmConf.department, 0.55)),
    grade: pickScalar(llm?.grade, regexFields.grade, clampConf(llmConf.grade, 0.55)),
    ctc: pickScalar(llm?.ctc, regexFields.ctc, clampConf(llmConf.ctc, 0.55)),
    experience: pickScalar(llm?.experience, regexFields.experience, clampConf(llmConf.experience, 0.6)),
    employmentType: pickScalar(llm?.employmentType, regexFields.employmentType || '', clampConf(llmConf.employmentType, 0.7)),
    locations: pickScalar(
      asList(llm?.locations).join(', '),
      (regexFields.locations || []).join(', '),
      clampConf(llmConf.locations, 0.65)
    ),
    skills: pickScalar(
      asList(llm?.skills).join(', '),
      (regexFields.skills || []).join(', '),
      clampConf(llmConf.skills, 0.6)
    ),
    openings: pickScalar(llmOpenings, '', clampConf(llmConf.openings, 0.7)),
    summary: pickHtml(llm?.summary, regexFields.summary, clampConf(llmConf.summary, 0.7)),
    responsibilities: pickHtml(llm?.responsibilities, regexFields.responsibilities, clampConf(llmConf.responsibilities, 0.7)),
    requirements: pickHtml(llm?.requirements, regexFields.requirements, clampConf(llmConf.requirements, 0.7)),
    preferred: pickHtml(llm?.preferred, regexFields.preferred, clampConf(llmConf.preferred, 0.6)),
    kpis: pickHtml(llm?.kpis, regexFields.kpis, clampConf(llmConf.kpis, 0.65)),
    languages: pickScalar(llm?.languages, regexFields.languages, clampConf(llmConf.languages, 0.7)),
    reportingTo: pickScalar(llm?.reportingTo, regexFields.reportingTo, clampConf(llmConf.reportingTo, 0.7)),
    businessUnit: pickScalar(llm?.businessUnit, regexFields.businessUnit, clampConf(0.7)),
    division: pickScalar(llm?.division, regexFields.division, clampConf(0.7)),
    travelRequired: pickScalar(llm?.travelRequired, regexFields.travelRequired, clampConf(0.7)),
    travelLevel: pickScalar(llm?.travelLevel, regexFields.travelLevel, clampConf(0.7)),
    jobLevel: pickScalar(llm?.jobLevel, regexFields.jobLevel, clampConf(0.7)),
    directReports: pickScalar(llm?.directReports, regexFields.directReports, clampConf(0.75)),
    preparedBy: pickScalar(llm?.preparedBy, regexFields.preparedBy, clampConf(0.75)),
    internalNotes: pickScalar('', regexFields.internalNotes, 0.8),
  };

  const mapped = mapFields(merged, catalogs);
  const notes = composeInternalNotes(mapped.fields);
  if (notes) mapped.fields.internalNotes = notes;
  const overallConfidence = overallFrom(mapped.confidence);
  const filled = filledCount(mapped.fields);
  const skipped = FIELD_KEYS.filter((k) => isBlank(mapped.fields[k])).map((k) => FIELD_LABELS[k] || k);

  logger.info('JD parse enriched', {
    method,
    role: mapped.fields.role || null,
    filled,
    overallConfidence,
  });

  return {
    ...mapped.fields,
    text,
    unmapped: mapped.unmapped,
    confidence: mapped.confidence,
    sources: mapped.sources,
    meta: {
      method,
      overallConfidence,
      filled,
      total: FIELD_KEYS.length,
      skipped,
    },
  };
}

module.exports = {
  parseJdWithAi,
  loadCatalogs,
  mapFields,
  FIELD_KEYS,
  isBlank,
};
