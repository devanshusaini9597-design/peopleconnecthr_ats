const pdfParse = require('pdf-parse');
const { promisify } = require('util');
const logger = require('../utils/logger');

let extractText = null;
try {
  extractText = promisify(require('textract').fromBufferWithMime);
} catch {
  extractText = null;
}

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
  ['requirements', /^(candidate\s*)?(requirements?|qualifications)|desired experience|must have|what you.?ll need|key results? area|kra$/i],
  ['preferred', /^(preferred|nice to have|good to have|candidate profile|preferred candidate)/i],
  ['skills', /^(skills?|skill set|competenc(y|ies))$/i],
  ['locations', /^(locations?|job location|work location)$/i],
];

/** Inline labels found in WhatsApp / bank JD pastes (often one long line). */
const INLINE_LABELS = [
  { key: 'role', re: /\b(?:designation|job\s*title|position\s*title|role\s*title)\s*[:\-–]\s*/gi },
  { key: 'grade', re: /\bgrade\s*[:\-–]\s*/gi },
  { key: 'clientName', re: /\b(?:legal\s*entity|client(?:\s*name)?|company(?:\s*name)?|organisation|organization)\s*[:\-–]\s*/gi },
  { key: 'industry', re: /\b(?:industry|sector|type of companies\/sector worked for)\s*[:\-–]\s*/gi },
  { key: 'department', re: /\bdepartment\s*[:\-–]\s*/gi },
  { key: 'ctc', re: /\b(?:ctc|salary|compensation|pay\s*range)\s*[:\-–]\s*/gi },
  { key: 'experience', re: /\b(?:desired\s*)?experience(?:\s*&\s*qualification)?\s*[:\-–]\s*/gi },
  { key: 'locations', re: /\b(?:locations?|job\s*location|work\s*location|geographic\s*spread)\s*[:\-–]\s*/gi },
  { key: 'skills', re: /\b(?:skills?|skill\s*set)\s*[:\-–]\s*/gi },
];

const SECTION_SPLIT_RE = /\b(purpose of the role|role description|key responsibilities|responsibilities|duties|desired experience(?:\s*&\s*qualification)?|candidate requirements?|qualifications|key results?\s*area|kra|preferred candidate(?:\s*profile)?|skills?|job summary|about the role)\s*[:\-–]?\s*/gi;

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

  // Insert breaks before common section titles in flattened pastes.
  text = text.replace(SECTION_SPLIT_RE, '\n$1:\n');

  // Break before known Label: patterns when jammed on one line.
  for (const { re } of INLINE_LABELS) {
    re.lastIndex = 0;
    text = text.replace(re, (match) => `\n${match}`);
  }

  // Soft-wrap very long lines on sentence boundaries for bucket parsing.
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
  const m = String(line || '').match(/^([A-Za-z][A-Za-z0-9 &/]+?)\s*[:\-–]\s*(.+)$/);
  if (!m) return false;
  const label = m[1].trim().toLowerCase();
  let value = m[2].trim();
  if (!value) return false;

  // Stop value at the next jammed Label: on the same remnant.
  const nextLabel = value.search(
    /\s+\b(?:designation|job\s*title|grade|legal\s*entity|client|company|industry|department|ctc|salary|experience|location|skills?|travel required|level of travel|business unit|division|prepared by|ref\.?\s*no)\s*[:\-–]/i,
  );
  if (nextLabel > 0) value = value.slice(0, nextLabel).trim();
  if (!value) return false;

  if (/^(job title|role|position|designation|role title|position title)$/.test(label) && !fields.role) {
    fields.role = value;
  } else if (/^(client|client name|legal entity|company|company name|organisation|organization)$/.test(label) && !fields.clientName) {
    fields.clientName = value;
  } else if (/^(industry|sector|type of companies\/sector worked for)$/.test(label) && !fields.industry) {
    fields.industry = value;
  } else if (/^department$/.test(label) && !fields.department) {
    fields.department = value;
  } else if (/^grade$/.test(label) && !fields.grade) {
    fields.grade = value;
  } else if (/^(ctc|salary|compensation|pay range)$/.test(label) && !fields.ctc) {
    fields.ctc = value;
  } else if (/experience/.test(label) && !fields.experience) {
    const years = value.match(/(\d+\s*[-–to]+\s*\d+\s*years?|\d+\+?\s*years?)/i);
    fields.experience = years ? years[1].replace(/\s+/g, ' ').trim() : value.split(/[.]/)[0].trim();
  } else if (/location|geographic spread/.test(label) && !fields.locations.length) {
    fields.locations = value.split(/[,;/]+/).map((v) => v.trim()).filter(Boolean);
  } else if (/^skills?$|^skill set$/.test(label) && !fields.skills.length) {
    fields.skills = value.split(/[,;/]+/).map((v) => v.trim()).filter(Boolean);
  } else if (/prepared by|ref\.?\s*no|travel required|level of travel|^level$|business unit|division|reporting to|direct reports|indirect reports/.test(label)) {
    // Recognized but unused metadata — consume so it doesn't pollute summary.
  } else {
    return false;
  }
  return true;
}

function extractInlineFields(text, fields) {
  const patterns = [
    { key: 'role', re: /\b(?:Designation|Job\s*Title|Position(?:\s*Title)?|Role(?:\s*Title)?)\s*[:\-–]\s*([^:\n]+?)(?=\s+(?:Grade|Legal\s*Entity|Client|Company|Business\s*Unit|Division|Department|Travel|Level|Job\s*Dimension|Purpose|Key\s*Responsib)|$)/i },
    { key: 'grade', re: /\bGrade\s*[:\-–]\s*([A-Za-z0-9/.\- ]{1,40}?)(?=\s+(?:Legal\s*Entity|Client|Company|Business\s*Unit|Division|Department|Travel|Level|Job\s*Dimension|Purpose)|$)/i },
    { key: 'clientName', re: /\b(?:Legal\s*Entity|Client(?:\s*Name)?|Company(?:\s*Name)?)\s*[:\-–]\s*([^:\n]+?)(?=\s+(?:Business\s*Unit|Division|Department|Travel|Level|Grade|Job\s*Dimension|Purpose|Industry)|$)/i },
    { key: 'department', re: /\bDepartment\s*[:\-–]\s*([^:\n]+?)(?=\s+(?:Travel|Level|Job\s*Dimension|Purpose|Key\s*Responsib|Business\s*Unit)|$)/i },
    { key: 'industry', re: /\b(?:Industry|Sector|Type of companies\/sector worked for)\s*[:\-–]\s*([^:\n]+?)(?=\s+(?:Graduation|Post-?graduation|Professional|Certifications|Desired|Key)|$)/i },
    { key: 'experience', re: /\b(?:Desired\s*)?Experience(?:\s*&\s*Qualification)?\s*[:\-–]\s*([^:\n]+?)(?=\s+(?:Type of companies|Graduation|Post-?graduation|Professional|Certifications|Key)|$)/i },
  ];

  for (const { key, re } of patterns) {
    if (fields[key]) continue;
    const m = text.match(re);
    if (!m?.[1]) continue;
    let value = m[1].trim().replace(/\s+/g, ' ');
    if (key === 'experience') {
      const years = value.match(/(\d+\s*[-–to]+\s*\d+\s*years?|\d+\+?\s*years?)/i);
      value = years ? years[1].replace(/\s+/g, ' ').trim() : value.split(/[.]/)[0].trim();
    }
    if (value) fields[key] = value;
  }

  if (!fields.experience) {
    const years = text.match(/(\d+\s*[-–]\s*\d+)\s*years?\s+of\s+experience/i);
    if (years) fields.experience = `${years[1].replace(/\s+/g, '')} years`;
  }
}

function parseJdText(raw) {
  const text = normalizeJdText(raw);
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

  // Pull structured fields from the flattened original before line bucketing.
  extractInlineFields(String(raw || ''), fields);

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
      fields.role = line.replace(/^job title\s*[:\-]\s*/i, '').trim();
      consumedTitle = true;
      continue;
    }
    consumedTitle = true;
    if (!buckets[current]) current = 'summary';
    buckets[current].push(line);
  }

  if (!fields.locations.length && buckets.locations.length) {
    fields.locations = buckets.locations.join(' ').split(/[,;/]+/).map((v) => v.trim()).filter(Boolean);
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

  // If role still empty, try designation from original once more with a looser grab.
  if (!fields.role) {
    const loose = String(raw || '').match(/\bDesignation\s*[:\-–]\s*([A-Za-z][A-Za-z0-9 /&-]{2,80}?)(?=\s+Grade\b|\s+Legal\b|$)/i);
    if (loose?.[1]) fields.role = loose[1].trim();
  }

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
