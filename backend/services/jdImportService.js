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
  ['summary', /^(job\s*summary|summary|about the role|overview|position summary|about (the )?company)$/i],
  ['responsibilities', /^(key\s*)?responsibilit(y|ies)|duties|what you.?ll do|role (and )?responsibilit/i],
  ['requirements', /^(candidate\s*)?(requirements?|qualifications)|must have|what you.?ll need/i],
  ['preferred', /^(preferred|nice to have|good to have|candidate profile|preferred candidate)/i],
  ['skills', /^(skills?|skill set|competenc(y|ies))$/i],
  ['locations', /^(locations?|job location|work location)$/i],
];

function classifyHeading(line) {
  const cleaned = String(line || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/[:\-–—]+\s*$/, '')
    .trim();
  if (!cleaned || cleaned.length > 60) return null;
  for (const [key, re] of HEADING_MAP) {
    if (re.test(cleaned)) return key;
  }
  return null;
}

function parseMetaLine(line, fields) {
  const m = String(line || '').match(/^([A-Za-z][A-Za-z /]+)\s*[:\-–]\s*(.+)$/);
  if (!m) return false;
  const label = m[1].trim().toLowerCase();
  const value = m[2].trim();
  if (!value) return false;
  if (/job title|role|position/.test(label) && !fields.role) fields.role = value;
  else if (/client/.test(label) && !fields.clientName) fields.clientName = value;
  else if (/industry/.test(label) && !fields.industry) fields.industry = value;
  else if (/grade/.test(label) && !fields.grade) fields.grade = value;
  else if (/ctc|salary|compensation/.test(label) && !fields.ctc) fields.ctc = value;
  else if (/experience/.test(label) && !fields.experience) fields.experience = value;
  else if (/location/.test(label) && !fields.locations.length) {
    fields.locations = value.split(/[,;/]+/).map((v) => v.trim()).filter(Boolean);
  } else if (/skill/.test(label) && !fields.skills.length) {
    fields.skills = value.split(/[,;/]+/).map((v) => v.trim()).filter(Boolean);
  } else {
    return false;
  }
  return true;
}

function parseJdText(raw) {
  const text = String(raw || '').replace(/\r/g, '').trim();
  const fields = {
    role: '',
    clientName: '',
    industry: '',
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
    const heading = classifyHeading(line);
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

module.exports = { parseJdText, parseUploadedJd, extractJdFileText };
