const pdfParse = require('pdf-parse');
const { promisify } = require('util');
const logger = require('../utils/logger');

let extractText = null;
try {
  extractText = promisify(require('textract').fromBufferWithMime);
} catch {
  extractText = null;
}

/** Separators that mean "Label: value" — never a bare hyphen inside words (client-facing). */
const LABEL_SEP = String.raw`(?:\s*(?::|–|—)\s*|\s+-\s+)`;

const NEXT_FIELD_STOP = String.raw`(?=\s+(?:Job\s*Title|Designation|Typical\s*Grade|Grade|Legal\s*Entity|Client\s*Name|Company\s*Name|Function|Department|Business\s*Unit|Division|CTC|Salary|Compensation|Reporting\s*To|Reporting\s*Manager|Direct\s*Reports|Indirect\s*Reports|Travel\s*required|Level\s*of\s*travel|Level|Experience|Education|Location|Locations|Industry|Sector|Skills?|Languages?|Job\s*Summary|Key\s*Responsib|Purpose\s*of\s*the\s*role|JOB\s*DIMENSIONS|EDUCATION|Number\s*of\s*years|Type\s*of\s*companies|Computer\s*/?\s*technical|Prepared\s*by|Ref\.?\s*No)|$)`;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toHtml(block) {
  const lines = String(block || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s*•\-–—]+/, '').trim())
    .filter(Boolean);
  if (!lines.length) return '';
  const short = lines.filter((line) => line.length < 180).length;
  if (lines.length > 1 && short >= Math.max(2, Math.floor(lines.length * 0.55))) {
    return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
  }
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
}

const HEADING_MAP = [
  ['summary', /^(job\s*summary|summary|about the role|overview|position summary|about (the )?company|purpose of the role|role description)$/i],
  ['responsibilities', /^(key\s*)?responsibilit(y|ies)|duties|what you.?ll do|role (and )?responsibilit|team building|indicative tasks?$/i],
  ['kpis', /^(key results?\s*area|kra|key performance indicator|kpis?)$/i],
  ['requirements', /^(candidate\s*)?(requirements?|qualifications)|education and experience|desired experience|must have|what you.?ll need$/i],
  ['preferred', /^(preferred|nice to have|good to have|candidate profile|preferred candidate)/i],
  ['skills', /^(skills?|skill set|computer\s*\/?\s*technical skills?)$/i],
  ['locations', /^(locations?|job location|work location)$/i],
];

const SECTION_SPLIT_RE = /\b(job\s*dimensions|purpose of the role|role description|key responsibilities|indicative tasks?|education and experience|desired experience(?:\s*&\s*qualification)?|candidate requirements?|qualifications|key results?\s*area|kra|preferred candidate(?:\s*profile)?|job summary|about the role)\s*(?::|–|—)?\s*/gi;

function isBlankish(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  return /^(n\/?a|na|n\.a\.?|nil|none|null|-|—|–|\.)$/i.test(v);
}

function cleanScalar(value, { maxLen = 80 } = {}) {
  let v = String(value || '').replace(/\s+/g, ' ').trim();
  if (!v || isBlankish(v)) return '';
  // Cut at a following Label: if still jammed.
  const cut = v.search(
    /\s+(?:Job\s*Title|Designation|Typical\s*Grade|Grade|Function|Department|Business\s*Unit|Division|CTC|Salary|Reporting\s*To|Reporting\s*Manager|Direct\s*Reports|Travel\s*required|Level\s*of\s*travel|Experience|Education|Location|Locations|Languages?)\s*(?::|–|—)/i,
  );
  if (cut > 0) v = v.slice(0, cut).trim();
  if (isBlankish(v)) return '';
  if (v.length > maxLen) return '';
  return v;
}

function looksLikeClientName(value) {
  const v = cleanScalar(value, { maxLen: 70 });
  if (!v) return '';
  if (/\b(facing|satisfaction|responsib|support|management|analyst|ensure|collaborate|teams?\s+to)\b/i.test(v)) {
    return '';
  }
  if (v.split(/\s+/).length > 8) return '';
  return v;
}

function looksLikeCtc(value) {
  const v = cleanScalar(value, { maxLen: 40 });
  if (!v) return '';
  if (/reporting|direct reports|manager|department|location/i.test(v)) return '';
  if (/^(n\/?a|na)$/i.test(v)) return '';
  // Accept money-ish or short band text
  if (/[\d]/.test(v) || /\b(lpa|lakh|lac|inr|ctc)\b/i.test(v)) return v;
  return '';
}

function classifyHeading(line) {
  const cleaned = String(line || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/[:\-–—]+\s*$/, '')
    .trim();
  if (!cleaned || cleaned.length > 80) return null;
  for (const [key, re] of HEADING_MAP) {
    if (re.test(cleaned)) return key;
  }
  return null;
}

function normalizeJdText(raw) {
  let text = String(raw || '').replace(/\r/g, '').trim();
  if (!text) return '';

  text = text
    .replace(/\bReporting\s+To\s+(?=[A-Z])/gi, '\nReporting To: ')
    .replace(/\bDirect\s+Reports\s+(\d+)\b/gi, '\nDirect Reports: $1')
    .replace(/\bNumber of years of experience\s*\(range\)\s*(?::|–|—)?\s*/gi, '\nExperience: ')
    .replace(/\bComputer\s*\/?\s*technical skills(?:\s*\(if any\))?\s*(?::|–|—)\s*/gi, '\nSkills: ');

  text = text.replace(SECTION_SPLIT_RE, '\n$1:\n');

  const colonSep = String.raw`(?:\s*(?::|–|—)\s*)`;
  const colonOnly = new Set(['Skills', 'Languages', 'Level', 'Grade', 'Experience', 'Education']);
  const breakLabels = [
    'Job Title', 'Designation', 'Typical Grade', 'Grade', 'Legal Entity', 'Client Name',
    'Company Name', 'Function', 'Department', 'Business Unit', 'Division', 'CTC', 'Salary',
    'Compensation', 'Reporting To', 'Reporting Manager', 'Direct Reports', 'Indirect Reports',
    'Travel required', 'Level of travel', 'Level', 'Experience', 'Education', 'Location', 'Locations',
    'Industry', 'Sector', 'Skills', 'Languages', 'Prepared by', 'Ref. No',
    'Number of years of experience', 'Type of companies/sector worked for',
    'Purpose of the role',
  ];
  for (const label of breakLabels) {
    const sep = colonOnly.has(label) ? colonSep : LABEL_SEP;
    const re = new RegExp(`\\b(${label.replace(/\s+/g, '\\s+').replace(/\//g, '\\/')})${sep}`, 'gi');
    text = text.replace(re, '\n$1: ');
  }

  text = text
    .split('\n')
    .map((line) => {
      if (line.length < 220) return line;
      return line.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n');
    })
    .join('\n');

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function parseMetaLine(line, fields) {
  const m = String(line || '').match(/^([A-Za-z][A-Za-z0-9 &/().]+?)\s*(?::|–|—)\s*(.+)$/)
    || String(line || '').match(/^([A-Za-z][A-Za-z0-9 &/().]+?)\s+-\s+(.+)$/);
  if (!m) return false;
  const label = m[1].trim().toLowerCase();
  let value = m[2].trim();
  if (!value) return false;

  const nextLabel = value.search(
    /\s+\b(?:Job\s*Title|Designation|Typical\s*Grade|Grade|Legal\s*Entity|Client\s*Name|Company\s*Name|Function|Industry|Department|Business\s*Unit|Division|CTC|Salary|Experience|Education|Location|Skills|Languages|Reporting\s*To|Reporting\s*Manager|Direct\s*Reports|Travel\s*required|Level\s*of\s*travel|Prepared\s*by|Ref\.?\s*No\.?|Purpose\s*of\s*the\s*role|Job\s*Dimensions?)\s*(?::|–|—)/i,
  );
  if (nextLabel > 0) value = value.slice(0, nextLabel).trim();
  value = value.replace(/\s*Ref\.?\s*No\.?:?\s*$/i, '').replace(/\s*\bJob\s*Dimensions?\b\.?\s*$/i, '').trim();
  if (!value || isBlankish(value)) {
    if (/^(job title|role|position|designation|typical grade|grade|client|client name|legal entity|company|function|industry|department|ctc|salary|compensation|experience|locations?|reporting to|reporting manager|direct reports|travel required|level of travel|level|business unit|division|prepared by|ref\.?\s*no)$/.test(label)) {
      return true;
    }
    return false;
  }

  if (/^(job title|role|position|designation|role title|position title)$/.test(label)) {
    if (!fields.role) fields.role = cleanScalar(value, { maxLen: 100 });
  } else if (/^(client name|legal entity|company name|organisation|organization)$/.test(label)) {
    if (!fields.clientName) fields.clientName = looksLikeClientName(value);
  } else if (/^(function|industry|sector)$/.test(label)) {
    if (!fields.industry) fields.industry = cleanScalar(value, { maxLen: 60 });
  } else if (/^type of companies/.test(label)) {
    if (!fields.industry) {
      const sector = value.match(/\b(banking|insurance|bfsi|nbfc|it(?:es)?|fmcg|pharma|healthcare|retail)\b/i);
      fields.industry = sector ? sector[1] : cleanScalar(value.split(/[–,]/)[0], { maxLen: 40 });
    }
  } else if (/^department$/.test(label)) {
    if (!fields.department) fields.department = cleanScalar(value, { maxLen: 80 });
  } else if (/^business unit$/.test(label)) {
    if (!fields.businessUnit) fields.businessUnit = cleanScalar(value, { maxLen: 80 });
  } else if (/^division$/.test(label)) {
    if (!fields.division) fields.division = cleanScalar(value, { maxLen: 80 });
  } else if (/^(typical grade|grade)$/.test(label)) {
    if (!fields.grade) fields.grade = cleanScalar(value, { maxLen: 60 });
  } else if (/^(ctc|salary|compensation|pay range)$/.test(label)) {
    if (!fields.ctc) fields.ctc = looksLikeCtc(value);
  } else if (/experience/.test(label)) {
    if (!fields.experience) {
      const years = value.match(/(\d+\s*[-–to]+\s*\d+\s*years?|\d+\+?\s*years?)/i);
      fields.experience = years
        ? years[1].replace(/\s+/g, ' ').trim()
        : cleanScalar(value.split(/[.]/)[0], { maxLen: 40 });
    }
  } else if (/^locations?$|^job location$|^work location$/.test(label)) {
    const parts = value.split(/[,;/|]+/).map((v) => v.trim()).filter((v) => v && !isBlankish(v));
    if (parts.length) {
      fields.locations = [...new Set([...(fields.locations || []), ...parts])];
    }
  } else if (/^skills$|^skill set$|^computer/.test(label)) {
    const extra = value
      .replace(/^good in\s+/i, '')
      .replace(/^\(if any\)\s*:?\s*/i, '')
      .split(/[,;/]+/)
      .map((v) => v.trim().replace(/^\(if any\)\s*:?\s*/i, ''))
      .filter((v) => v && !isBlankish(v) && v.length < 40 && !/including |if any/i.test(v));
    if (extra.length) {
      fields.skills = [...new Set([...(fields.skills || []), ...extra])];
    }
  } else if (/^languages$/.test(label)) {
    if (!fields.languages) fields.languages = value.replace(/\s+/g, ' ').trim().slice(0, 240);
  } else if (/^(reporting to|reporting manager)$/.test(label)) {
    if (!fields.reportingTo) fields.reportingTo = cleanScalar(value, { maxLen: 80 });
  } else if (/^direct reports$/.test(label)) {
    if (!fields.directReports) fields.directReports = cleanScalar(value, { maxLen: 20 });
  } else if (/^travel required$/.test(label)) {
    if (!fields.travelRequired) fields.travelRequired = cleanScalar(value, { maxLen: 20 });
  } else if (/^level of travel$/.test(label)) {
    if (!fields.travelLevel) fields.travelLevel = cleanScalar(value, { maxLen: 40 });
  } else if (/^level$/.test(label)) {
    if (!fields.jobLevel) fields.jobLevel = cleanScalar(value.replace(/\bjob dimensions?\b/i, ''), { maxLen: 40 });
  } else if (/^prepared by$/.test(label)) {
    if (!fields.preparedBy) fields.preparedBy = cleanScalar(value, { maxLen: 80 });
  } else if (/prepared by|ref\.?\s*no|geographic spread|^education$/.test(label)) {
    return true;
  } else {
    return false;
  }
  return true;
}

const CITY_HINTS = [
  'NEW DELHI', 'NAVI MUMBAI', 'BENGALURU', 'BANGALORE', 'HYDERABAD', 'AHMEDABAD', 'CHENNAI',
  'KOLKATA', 'MUMBAI', 'PUNE', 'DELHI', 'NOIDA', 'GURUGRAM', 'GURGAON', 'FARIDABAD', 'GHAZIABAD',
  'CHANDIGARH', 'JAIPUR', 'LUCKNOW', 'KANPUR', 'INDORE', 'BHOPAL', 'NAGPUR', 'SURAT', 'VADODARA',
  'COIMBATORE', 'KOCHI', 'THIRUVANANTHAPURAM', 'TRIVANDRUM', 'MYSORE', 'MYSURU', 'MANGALORE',
  'VISAKHAPATNAM', 'VIJAYAWADA', 'PATNA', 'RANCHI', 'BHUBANESWAR', 'GUWAHATI', 'DEHRADUN',
  'AMRITSAR', 'LUDHIANA', 'JALANDHAR', 'RAJKOT', 'JODHPUR', 'UDAIPUR', 'AGRA', 'VARANASI',
  'MEERUT', 'NASHIK', 'AURANGABAD', 'THANE', 'KALYAN', 'HOWRAH', 'SECUNDERABAD', 'TRICHY',
  'MADURAI', 'SALEM', 'HUBLI', 'BELGAUM', 'GOA', 'PANAJI', 'SHIMLA', 'HARIDWAR',
];

function extractCitiesFromText(text) {
  const upper = String(text || '').toUpperCase();
  const found = [];
  for (const city of CITY_HINTS) {
    const re = new RegExp(`\\b${city.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(upper)) found.push(city);
  }
  return [...new Set(found)];
}

function extractInlineFields(text, fields) {
  const patterns = [
    { key: 'role', re: new RegExp(String.raw`\b(?:Job\s*Title|Designation|Position(?:\s*Title)?)${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
    { key: 'grade', re: new RegExp(String.raw`\b(?:Typical\s*Grade|Grade)${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
    { key: 'clientName', re: new RegExp(String.raw`\b(?:Legal\s*Entity|Client\s*Name|Company\s*Name)${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
    { key: 'department', re: new RegExp(String.raw`\bDepartment${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
    { key: 'industry', re: new RegExp(String.raw`\b(?:Function|Industry|Sector)${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
    { key: 'ctc', re: new RegExp(String.raw`\b(?:CTC|Salary|Compensation)${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
    { key: 'experience', re: new RegExp(String.raw`\bExperience${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'i') },
  ];

  for (const { key, re } of patterns) {
    if (fields[key]) continue;
    const m = text.match(re);
    if (!m?.[1]) continue;
    let value = m[1].trim().replace(/\s+/g, ' ');
    if (key === 'clientName') value = looksLikeClientName(value);
    else if (key === 'ctc') value = looksLikeCtc(value);
    else if (key === 'experience') {
      const years = value.match(/(\d+\s*[-–to]+\s*\d+\s*years?|\d+\+?\s*years?)/i)
        || value.match(/(\d+\+?\s*years?)/i);
      value = years ? years[1].replace(/\s+/g, ' ').trim() : cleanScalar(value, { maxLen: 40 });
    } else {
      value = cleanScalar(value, { maxLen: key === 'role' ? 100 : 80 });
    }
    if (value) fields[key] = value;
  }

  // Collect all Location: values (skip NA); later cities win over earlier blanks.
  const locRe = new RegExp(String.raw`\bLocations?${LABEL_SEP}([^:\n]+?)${NEXT_FIELD_STOP}`, 'gi');
  let locMatch;
  const locParts = [];
  while ((locMatch = locRe.exec(text)) !== null) {
    locMatch[1].split(/[,;/|]+/).forEach((part) => {
      const p = part.trim();
      if (p && !isBlankish(p)) locParts.push(p);
    });
  }
  if (locParts.length) {
    fields.locations = [...new Set([...(fields.locations || []), ...locParts])];
  }

  if (!fields.experience) {
    const years = text.match(/experience(?:\s*\(range\))?\s*(?::|–|—)?\s*(\d+\s*[-–to]+\s*\d+\s*years?|\d+\+?\s*years?)/i)
      || text.match(/(\d+\s*[-–]\s*\d+)\s*years?\s+of\s+experience/i)
      || text.match(/\bExperience\s*(?::|–|—)\s*(\d+\+?\s*years?)/i)
      || text.match(/\b(\d+\s*[-–]\s*\d+)\s*years\b/i)
      || text.match(/(\d+)\s*years?\s+of\s+experience/i);
    if (years) {
      fields.experience = years[1].includes('year')
        ? years[1].replace(/\s+/g, ' ').trim()
        : `${String(years[1]).replace(/\s+/g, '')} years`;
    }
  }

  if (!fields.industry) {
    if (/\b(small finance bank|private sector banks|psu banks|cooperative banks|rural banks|nbfc|bfsi)\b/i.test(text)) {
      fields.industry = 'BFSI';
    } else if (/\bbanking\b/i.test(text)) {
      fields.industry = 'BANKING';
    }
  }

  if (!fields.employmentType && /\b(legal entity|grade|designation)\b/i.test(text) && !/\b(contract|intern|freelance|part[- ]time)\b/i.test(text)) {
    fields.employmentType = 'full_time';
  }

  const chained = [];
  const chainRe = /((?:[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+-\s+){2,}[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/g;
  let chainMatch;
  while ((chainMatch = chainRe.exec(text)) !== null) {
    chainMatch[1].split(/\s+-\s+/).forEach((part) => {
      const s = part.trim();
      if (s.length >= 3 && s.length <= 40 && s.split(/\s+/).length <= 4 && !/perspective|responsible/i.test(s)) {
        chained.push(s);
      }
    });
  }
  const mentioned = [];
  for (const hint of ['KYC', 'AML', 'MS Office', 'Banking Software']) {
    if (new RegExp(`\\b${hint.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) mentioned.push(hint);
  }
  const extraSkills = [...chained, ...mentioned].filter((v) => v && !isBlankish(v));
  if (extraSkills.length) {
    fields.skills = [...new Set([...(fields.skills || []), ...extraSkills])];
  }

  const cities = extractCitiesFromText(text);
  if (cities.length) {
    fields.locations = [...new Set([...(fields.locations || []).map((v) => String(v).toUpperCase()), ...cities])];
  }

  // Drop leftover blankish locations
  fields.locations = (fields.locations || []).filter((v) => v && !isBlankish(v));
}

function composeInternalNotes(fields) {
  const lines = [];
  if (fields.preparedBy) lines.push(`Prepared by: ${fields.preparedBy}`);
  if (fields.businessUnit) lines.push(`Business unit: ${fields.businessUnit}`);
  if (fields.division) lines.push(`Division: ${fields.division}`);
  if (fields.reportingTo) lines.push(`Reports to: ${fields.reportingTo}`);
  if (fields.directReports) lines.push(`Direct reports: ${fields.directReports}`);
  if (fields.jobLevel) lines.push(`Level: ${fields.jobLevel}`);
  const travel = [fields.travelRequired, fields.travelLevel].filter(Boolean).join(' · ');
  if (travel) lines.push(`Travel: ${travel}`);
  if (fields.languages) lines.push(`Languages: ${fields.languages}`);
  return lines.join('\n');
}

function parseJdText(raw) {
  const original = String(raw || '');
  const text = normalizeJdText(original);
  const fields = {
    role: '',
    clientName: '',
    industry: '',
    department: '',
    businessUnit: '',
    division: '',
    grade: '',
    ctc: '',
    experience: '',
    employmentType: '',
    locations: [],
    skills: [],
    summary: '',
    responsibilities: '',
    requirements: '',
    preferred: '',
    kpis: '',
    languages: '',
    reportingTo: '',
    directReports: '',
    travelRequired: '',
    travelLevel: '',
    jobLevel: '',
    preparedBy: '',
    internalNotes: '',
  };
  if (!text) return fields;

  extractInlineFields(text, fields);

  const buckets = {
    summary: [],
    responsibilities: [],
    requirements: [],
    preferred: [],
    skills: [],
    locations: [],
    kpis: [],
  };
  let current = 'summary';
  const lines = text.split('\n');
  let consumedTitle = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(job dimensions?|competenc(?:y|ies)|indicative tasks?)$/i.test(line.replace(/:$/, ''))) continue;
    const heading = classifyHeading(line.replace(/:$/, ''));
    if (heading) {
      current = heading;
      continue;
    }
    if (parseMetaLine(line, fields)) continue;
    if (
      !consumedTitle
      && !fields.role
      && line.length <= 80
      && !/[:@]/.test(line)
      && !/^(prepared by|role description|job dimension|indicative tasks|competenc)/i.test(line)
    ) {
      fields.role = cleanScalar(line.replace(/^job title\s*(?::|–|—)\s*/i, ''), { maxLen: 100 });
      consumedTitle = true;
      continue;
    }
    consumedTitle = true;
    if (!buckets[current]) current = 'summary';
    buckets[current].push(line);
  }

  if (!fields.locations.length && buckets.locations.length) {
    fields.locations = buckets.locations.join(' ')
      .split(/[,;/]+/)
      .map((v) => v.trim())
      .filter((v) => v && !isBlankish(v));
  }
  if (buckets.skills.length) {
    const fromBucket = buckets.skills.join(' ')
      .replace(/^good in\s+/i, '')
      .replace(/\(if any\)/gi, '')
      .split(/[,;/]+/)
      .map((v) => v.trim())
      .filter((v) => v && !isBlankish(v) && v.length < 40 && !/including /i.test(v));
    fields.skills = [...new Set([...(fields.skills || []), ...fromBucket])];
  }

  fields.summary = toHtml(buckets.summary.join('\n'));
  fields.responsibilities = toHtml(buckets.responsibilities.join('\n'));
  fields.requirements = toHtml(buckets.requirements.join('\n'));
  fields.preferred = toHtml(buckets.preferred.join('\n'));
  fields.kpis = toHtml(buckets.kpis.join('\n'));

  if (!fields.summary && !fields.responsibilities && !fields.requirements) {
    fields.summary = toHtml(text);
  }

  if (fields.languages && !fields.preferred) {
    fields.preferred = toHtml(`Languages: ${fields.languages}`);
  } else if (fields.languages && fields.preferred && !/language/i.test(fields.preferred)) {
    fields.preferred += `<p>${escapeHtml(`Languages: ${fields.languages}`)}</p>`;
  }

  fields.internalNotes = composeInternalNotes(fields);

  // Final sanitizers
  fields.clientName = looksLikeClientName(fields.clientName);
  fields.ctc = looksLikeCtc(fields.ctc);
  fields.role = cleanScalar(fields.role, { maxLen: 100 });
  fields.grade = cleanScalar(fields.grade, { maxLen: 60 });
  fields.industry = cleanScalar(fields.industry, { maxLen: 60 });
  fields.department = cleanScalar(fields.department, { maxLen: 80 });
  fields.locations = (fields.locations || [])
    .map((v) => String(v).trim())
    .filter((v) => v && !isBlankish(v));
  fields.skills = (fields.skills || [])
    .map((v) => String(v).replace(/\s+/g, ' ').trim())
    .filter((v) => v && v.length < 60 && !isBlankish(v));

  return fields;
}

async function extractJdFileText(buffer, mimetype, filename = '') {
  const name = String(filename || '').toLowerCase();
  const mime = String(mimetype || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return String(data.text || '').trim();
  }
  if (mime.includes('text/plain') || name.endsWith('.txt')) {
    return buffer.toString('utf8').trim();
  }
  if (extractText) {
    const text = await extractText(mimetype || 'application/octet-stream', buffer);
    return String(text || '').trim();
  }
  throw new Error('Upload a PDF or TXT file (Word requires document extraction on the server)');
}

async function parseUploadedJd({ buffer, mimetype, filename }) {
  const text = await extractJdFileText(buffer, mimetype, filename);
  if (!text || text.length < 20) {
    throw Object.assign(new Error('Could not read text from this file. Try a text-based PDF or TXT.'), { statusCode: 400 });
  }
  const fields = parseJdText(text);
  logger.info('JD import parsed', { filename, chars: text.length, role: fields.role || null });
  return { ...fields, text };
}

module.exports = { parseJdText, parseUploadedJd, extractJdFileText, normalizeJdText, composeInternalNotes };
