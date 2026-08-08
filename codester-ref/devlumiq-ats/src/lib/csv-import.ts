/**
 * CSV / spreadsheet parsing helpers for candidate bulk import.
 * Pure utilities — no DB access.
 */

export const CANDIDATE_IMPORT_FIELDS = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'source', label: 'Source', required: false },
  { key: 'currentTitle', label: 'Current title', required: false },
  { key: 'currentCompany', label: 'Current company', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'country', label: 'Country', required: false },
  { key: 'experience', label: 'Years of experience', required: false },
  { key: 'skills', label: 'Skills (comma-separated)', required: false },
  { key: 'tags', label: 'Tags (comma-separated)', required: false },
  { key: 'linkedInUrl', label: 'LinkedIn URL', required: false },
  { key: 'githubUrl', label: 'GitHub URL', required: false },
  { key: 'portfolioUrl', label: 'Portfolio URL', required: false },
  { key: 'jobTitle', label: 'Job title (to apply)', required: false },
] as const;

export type CandidateImportFieldKey = (typeof CANDIDATE_IMPORT_FIELDS)[number]['key'];

export type ColumnMapping = Partial<Record<CandidateImportFieldKey, string>>;

const HEADER_ALIASES: Record<string, CandidateImportFieldKey> = {
  name: 'name',
  'full name': 'name',
  fullname: 'name',
  'candidate name': 'name',
  email: 'email',
  'e-mail': 'email',
  'e mail': 'email',
  'email address': 'email',
  phone: 'phone',
  mobile: 'phone',
  telephone: 'phone',
  'phone number': 'phone',
  source: 'source',
  title: 'currentTitle',
  'current title': 'currentTitle',
  'job title': 'currentTitle',
  position: 'currentTitle',
  company: 'currentCompany',
  'current company': 'currentCompany',
  employer: 'currentCompany',
  location: 'location',
  city: 'city',
  country: 'country',
  experience: 'experience',
  'years of experience': 'experience',
  'years experience': 'experience',
  yoe: 'experience',
  skills: 'skills',
  skill: 'skills',
  tags: 'tags',
  tag: 'tags',
  linkedin: 'linkedInUrl',
  'linkedin url': 'linkedInUrl',
  'linkedin profile': 'linkedInUrl',
  github: 'githubUrl',
  'github url': 'githubUrl',
  portfolio: 'portfolioUrl',
  'portfolio url': 'portfolioUrl',
  website: 'portfolioUrl',
  'job to apply': 'jobTitle',
  'apply to': 'jobTitle',
  'open position': 'jobTitle',
  'job title apply': 'jobTitle',
};

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ');
}

/** Auto-map CSV headers to known candidate fields */
export function autoMapHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const field = HEADER_ALIASES[normalized];
    if (field && !mapping[field] && !used.has(header)) {
      mapping[field] = header;
      used.add(header);
    }
  }
  return mapping;
}

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = splitCsvLines(text);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim();
    });
    // Skip completely empty rows
    if (Object.values(row).every((v) => !v)) continue;
    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLines(text: string): string[] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      if (inQuotes && normalized[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || text.endsWith('\n')) lines.push(current);
  return lines;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export interface MappedCandidateRow {
  rowNumber: number;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  currentTitle?: string;
  currentCompany?: string;
  location?: string;
  city?: string;
  country?: string;
  experience?: number | null;
  skills?: string[];
  tags?: string[];
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  jobTitle?: string;
}

export interface RowValidationError {
  rowNumber: number;
  email?: string;
  field?: string;
  message: string;
}

export function mapRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  rowNumber: number,
): { data?: MappedCandidateRow; error?: RowValidationError } {
  const get = (key: CandidateImportFieldKey): string => {
    const header = mapping[key];
    if (!header) return '';
    return (row[header] ?? '').trim();
  };

  const name = get('name');
  const email = get('email').toLowerCase();

  if (!name) {
    return { error: { rowNumber, email: email || undefined, field: 'name', message: 'Name is required' } };
  }
  if (!email) {
    return { error: { rowNumber, field: 'email', message: 'Email is required' } };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: { rowNumber, email, field: 'email', message: 'Invalid email format' } };
  }

  const experienceRaw = get('experience');
  let experience: number | null = null;
  if (experienceRaw) {
    const n = parseFloat(experienceRaw.replace(/[^\d.]/g, ''));
    if (Number.isNaN(n) || n < 0 || n > 80) {
      return { error: { rowNumber, email, field: 'experience', message: 'Experience must be a number between 0 and 80' } };
    }
    experience = Math.round(n);
  }

  const splitList = (raw: string) =>
    raw
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    data: {
      rowNumber,
      name,
      email,
      phone: get('phone') || undefined,
      source: get('source') || 'csv_import',
      currentTitle: get('currentTitle') || undefined,
      currentCompany: get('currentCompany') || undefined,
      location: get('location') || undefined,
      city: get('city') || undefined,
      country: get('country') || undefined,
      experience,
      skills: splitList(get('skills')),
      tags: splitList(get('tags')),
      linkedInUrl: get('linkedInUrl') || undefined,
      githubUrl: get('githubUrl') || undefined,
      portfolioUrl: get('portfolioUrl') || undefined,
      jobTitle: get('jobTitle') || undefined,
    },
  };
}

export function validateAndMapRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): { valid: MappedCandidateRow[]; errors: RowValidationError[] } {
  const valid: MappedCandidateRow[] = [];
  const errors: RowValidationError[] = [];
  const seenEmails = new Set<string>();

  if (!mapping.name || !mapping.email) {
    errors.push({ rowNumber: 0, message: 'Column mapping must include name and email' });
    return { valid, errors };
  }

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1-indexed + header
    const { data, error } = mapRow(row, mapping, rowNumber);
    if (error) {
      errors.push(error);
      return;
    }
    if (!data) return;
    if (seenEmails.has(data.email)) {
      errors.push({
        rowNumber,
        email: data.email,
        field: 'email',
        message: 'Duplicate email in import file',
      });
      return;
    }
    seenEmails.add(data.email);
    valid.push(data);
  });

  return { valid, errors };
}
