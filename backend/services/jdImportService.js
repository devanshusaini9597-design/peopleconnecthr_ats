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

const NEXT_FIELD_STOP = String.raw`(?=\s+(?:Job\s*Title|Designation|Typical\s*Grade|Grade|Legal\s*Entity|Client\s*Name|Company\s*Name|Function|Department|Business\s*Unit|Division|CTC|Salary|Compensation|Reporting\s*Manager|Direct\s*Reports|Indirect\s*Reports|Travel\s*required|Level\s*of\s*travel|Experience|Education|Location|Locations|Industry|Sector|Skills?|Job\s*Summary|Key\s*Responsib|Purpose\s*of\s*the\s*role|JOB\s*DIMENSIONS|EDUCATION)|$)`;

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
  ['responsibilities', /^(key\s*)?responsibilit(y|ies)|duties|what you.?ll do|role (and )?responsibilit|team building$/i],
  ['requirements', /^(candidate\s*)?(requirements?|qualifications)|education and experience|desired experience|must have|what you.?ll need|key results? area|kra$/i],
  ['preferred', /^(preferred|nice to have|good to have|candidate profile|preferred candidate)/i],
  ['skills', /^(skills?|skill set|competenc(y|ies))$/i],
  ['locations', /^(locations?|job location|work location)$/i],
];

const SECTION_SPLIT_RE = /\b(job\s*dimensions|purpose of the role|role description|key responsibilities|responsibilities|duties|education and experience|desired experience(?:\s*&\s*qualification)?|candidate requirements?|qualifications|key results?\s*area|kra|preferred candidate(?:\s*profile)?|skills?|job summary|about the role)\s*(?::|–|—)?\s*/gi;

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
    /\s+(?:Job\s*Title|Designation|Typical\s*Grade|Grade|Function|Department|CTC|Salary|Reporting\s*Manager|Direct\s*Reports|Experience|Education|Location|Locations)\s*(?::|–|—)/i,
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

  text = text.replace(SECTION_SPLIT_RE, '\n$1:\n');

  // Break only on Label: / Label – (colon or dash with spaces), never bare hyphen.
  const breakLabels = [
    'Job Title', 'Designation', 'Typical Grade', 'Grade', 'Legal Entity', 'Client Name',
    'Company Name', 'Function', 'Department', 'Business Unit', 'Division', 'CTC', 'Salary',
    'Compensation', 'Reporting Manager', 'Direct Reports', 'Indirect Reports',
    'Experience', 'Education', 'Location', 'Locations', 'Industry', 'Sector', 'Skills',
  ];
  for (const label of breakLabels) {
    const re = new RegExp(`\\b(${label.replace(/\s+/g, '\\s+')})${LABEL_SEP}`, 'gi');
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
  const m = String(line || '').match(/^([A-Za-z][A-Za-z0-9 &/]+?)\s*(?::|–|—)\s*(.+)$/)
    || String(line || '').match(/^([A-Za-z][A-Za-z0-9 &/]+?)\s+-\s+(.+)$/);
  if (!m) return false;
  const label = m[1].trim().toLowerCase();
  let value = m[2].trim();
  if (!value) return false;

  const nextLabel = value.search(
    /\s+\b(?:job\s*title|designation|typical\s*grade|grade|legal\s*entity|client\s*name|company\s*name|function|industry|department|ctc|salary|experience|education|location|skills?|reporting\s*manager|direct\s*reports|travel required|business unit|division|prepared by|ref\.?\s*no)\s*(?::|–|—)/i,
  );
  if (nextLabel > 0) value = value.slice(0, nextLabel).trim();
  if (!value || isBlankish(value)) {
    // Consume known empty meta so it does not pollute summary.
    if (/^(job title|role|position|designation|typical grade|grade|client|client name|legal entity|company|function|industry|department|ctc|salary|compensation|experience|locations?|reporting manager|direct reports)$/.test(label)) {
      return true;
    }
    return false;
  }

  if (/^(job title|role|position|designation|role title|position title)$/.test(label) && !fields.role) {
    fields.role = cleanScalar(value, { maxLen: 100 });
  } else if (/^(client name|legal entity|company name|organisation|organization)$/.test(label) && !fields.clientName) {
    fields.clientName = looksLikeClientName(value);
  } else if (/^(function|industry|sector)$/.test(label) && !fields.industry) {
    fields.industry = cleanScalar(value, { maxLen: 60 });
  } else if (/^department$/.test(label) && !fields.department) {
    fields.department = cleanScalar(value, { maxLen: 80 });
  } else if (/^(typical grade|grade)$/.test(label) && !fields.grade) {
    fields.grade = cleanScalar(value, { maxLen: 60 });
  } else if (/^(ctc|salary|compensation|pay range)$/.test(label) && !fields.ctc) {
    fields.ctc = looksLikeCtc(value);
  } else if (/^experience$/.test(label) && !fields.experience) {
    const years = value.match(/(\d+\s*[-–to]+\s*\d+\s*years?|\d+\+?\s*years?)/i);
    fields.experience = years
      ? years[1].replace(/\s+/g, ' ').trim()
      : cleanScalar(value.split(/[.]/)[0], { maxLen: 40 });
  } else if (/^locations?$|^job location$|^work location$/.test(label)) {
    const parts = value.split(/[,;/|]+/).map((v) => v.trim()).filter((v) => v && !isBlankish(v));
    if (parts.length) {
      fields.locations = [...new Set([...(fields.locations || []), ...parts])];
    }
  } else if (/^skills?$|^skill set$/.test(label) && !fields.skills.length) {
    fields.skills = value.split(/[,;/]+/).map((v) => v.trim()).filter((v) => v && !isBlankish(v));
  } else if (/prepared by|ref\.?\s*no|travel required|level of travel|^level$|business unit|division|reporting manager|direct reports|indirect reports|geographic spread|^education$/.test(label)) {
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
    const years = text.match(/(\d+\s*[-–]\s*\d+)\s*years?\s+of\s+experience/i)
      || text.match(/\bExperience\s*(?::|–|—)\s*(\d+\+?\s*years?)/i)
      || text.match(/(\d+)\s*years?\s+of\s+experience/i);
    if (years) {
      fields.experience = years[1].includes('year')
        ? years[1].replace(/\s+/g, ' ').trim()
        : `${String(years[1]).replace(/\s+/g, '')} years`;
    }
  }

  const cities = extractCitiesFromText(text);
  if (cities.length) {
    fields.locations = [...new Set([...(fields.locations || []).map((v) => String(v).toUpperCase()), ...cities])];
  }

  // Drop leftover blankish locations
  fields.locations = (fields.locations || []).filter((v) => v && !isBlankish(v));
}

function parseJdText(raw) {
  const original = String(raw || '');
  const text = normalizeJdText(original);
  const fields = {
    role: '',
    clientName: '',
    industry: '',
    department: '',
    grade: '',
    ctc: '',
    experience: '',
    locations: [],
    skills: [],
    summary: '',
    responsibilities: '',
    requirements: '',
    preferred: '',
  };
  if (!text) return fields;

  extractInlineFields(original, fields);

  const buckets = {
    summary: [],
    responsibilities: [],
    requirements: [],
    preferred: [],
    skills: [],
    locations: [],
  };
  let current = 'summary';
  const lines = text.split('\n');
  let consumedTitle = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = classifyHeading(line.replace(/:$/, ''));
    if (heading) {
      current = heading;
      continue;
    }
    if (parseMetaLine(line, fields)) continue;
    if (!consumedTitle && !fields.role && line.length <= 80 && !/[:@]/.test(line)) {
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
  if (!fields.skills.length && buckets.skills.length) {
    fields.skills = buckets.skills.join(' ').split(/[,;/]+/).map((v) => v.trim()).filter(Boolean);
  }

  fields.summary = toHtml(buckets.summary.join('\n'));
  fields.responsibilities = toHtml(buckets.responsibilities.join('\n'));
  fields.requirements = toHtml(buckets.requirements.join('\n'));
  fields.preferred = toHtml(buckets.preferred.join('\n'));

  if (!fields.summary && !fields.responsibilities && !fields.requirements) {
    fields.summary = toHtml(text);
  }

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

module.exports = { parseJdText, parseUploadedJd, extractJdFileText, normalizeJdText };
