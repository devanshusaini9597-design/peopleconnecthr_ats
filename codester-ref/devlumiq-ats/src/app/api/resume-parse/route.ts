import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-permission';
import { rateLimitAsync, getClientIp } from '@/lib/rate-limit';
import { isAIEnabled, parseResumeWithAI } from '@/lib/ai';
import { hasFeature } from '@/lib/plan-limits';
import { getPlanContext } from '@/lib/with-plan';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);
const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.txt']);

// ─────────────────────────────────────────────────────────────────────────────
// Skill taxonomy — 150+ keywords across tech, business, design, data
// ─────────────────────────────────────────────────────────────────────────────
const SKILL_KEYWORDS = [
  // Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust',
  'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R', 'MATLAB', 'Perl', 'Shell',
  'Bash', 'Groovy', 'Dart', 'Lua', 'Haskell', 'Elixir', 'Clojure',
  // Frontend
  'React', 'Angular', 'Vue', 'Next.js', 'Nuxt', 'Svelte', 'Tailwind CSS',
  'SASS', 'SCSS', 'CSS', 'HTML', 'HTML5', 'CSS3', 'Bootstrap', 'Material UI',
  'shadcn/ui', 'Redux', 'Zustand', 'MobX', 'RxJS', 'GraphQL', 'Apollo',
  'Webpack', 'Vite', 'Babel', 'ESLint', 'Storybook', 'Cypress', 'Playwright',
  'Jest', 'Vitest', 'Testing Library',
  // Backend
  'Node.js', 'Express', 'NestJS', 'Fastify', 'Hapi', 'Django', 'FastAPI',
  'Flask', 'Spring Boot', 'Laravel', '.NET', 'ASP.NET', 'Rails', 'Gin', 'Echo',
  'gRPC', 'REST', 'WebSocket', 'Socket.io', 'Kafka', 'RabbitMQ', 'Celery',
  'Prisma', 'TypeORM', 'Sequelize', 'Mongoose', 'SQLAlchemy',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Vercel', 'Netlify', 'Heroku',
  'Docker', 'Kubernetes', 'Helm', 'Terraform', 'Ansible', 'Pulumi',
  'CI/CD', 'Jenkins', 'GitHub Actions', 'CircleCI', 'GitLab CI',
  'Linux', 'Nginx', 'Apache', 'CloudFormation', 'CDK', 'Serverless',
  // Databases
  'PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'Oracle', 'MongoDB',
  'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'CockroachDB',
  'Supabase', 'Firebase', 'Neo4j', 'InfluxDB', 'BigQuery', 'Snowflake',
  'Redshift', 'dbt', 'Airflow',
  // Mobile
  'iOS', 'Android', 'React Native', 'Flutter', 'SwiftUI', 'Jetpack Compose',
  'Expo', 'Xcode', 'Android Studio',
  // AI / ML / Data
  'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'LLM',
  'TensorFlow', 'PyTorch', 'Keras', 'Scikit-learn', 'HuggingFace',
  'OpenAI', 'LangChain', 'Pandas', 'NumPy', 'Matplotlib', 'Seaborn',
  'Power BI', 'Tableau', 'Looker', 'Excel', 'Spark', 'Hadoop',
  'MLflow', 'Weights & Biases', 'Jupyter', 'MLOps',
  // Design
  'Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'InDesign',
  'After Effects', 'Canva', 'UX Research', 'Prototyping', 'Wireframing',
  'User Research', 'Design Systems', 'Accessibility', 'WCAG',
  // Business / PM
  'Agile', 'Scrum', 'Kanban', 'SAFe', 'Jira', 'Confluence', 'Notion',
  'Asana', 'Trello', 'Monday.com', 'Product Management', 'Roadmapping',
  'OKRs', 'Stakeholder Management', 'Project Management', 'PMP',
  'Salesforce', 'HubSpot', 'Zendesk', 'Intercom',
  // Security
  'Cybersecurity', 'Penetration Testing', 'OWASP', 'SOC 2', 'ISO 27001',
  'SIEM', 'Zero Trust', 'IAM', 'SSO', 'OAuth', 'JWT', 'TLS', 'PKI',
  // Soft skills
  'Leadership', 'Mentoring', 'Team Management', 'Communication',
  'Problem Solving', 'Critical Thinking', 'Cross-functional',
];

// ─────────────────────────────────────────────────────────────────────────────
// Certification keywords
// ─────────────────────────────────────────────────────────────────────────────
const CERT_PATTERNS = [
  /AWS\s+Certified[^,\n]*/i,
  /Google\s+(Cloud\s+)?Certified[^,\n]*/i,
  /Microsoft\s+(Certified|Azure)[^,\n]*/i,
  /Certified\s+Kubernetes\s+(Administrator|Developer)[^,\n]*/i,
  /CKA|CKAD|CKS/,
  /Cisco\s+(CCNA|CCNP|CCIE)[^,\n]*/i,
  /CCNA|CCNP|CCIE/,
  /PMP(\s+Certified)?/,
  /Certified\s+Scrum\s+(Master|Product\s+Owner)[^,\n]*/i,
  /CSM|CSPO|SAFe/,
  /CISSP|CISM|CEH|CompTIA\s+(Security\+|Network\+|A\+)[^,\n]*/i,
  /Security\+|Network\+/,
  /Oracle\s+Certified[^,\n]*/i,
  /Salesforce\s+Certified[^,\n]*/i,
  /Professional\s+(Data\s+)?Engineer[^,\n]*/i,
  /Terraform\s+Associate/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function isCleanText(text: string): boolean {
  if (!text || text.length < 30) return false;
  const words = text.split(/\s+/).filter(w => w.length >= 2);
  if (words.length < 5) return false;
  const readable = words.filter(w => /^[a-zA-Z'.,-]+$/.test(w));
  return readable.length / words.length > 0.35;
}

function titleCase(s: string) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function isValidName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 60) return false;
  const alpha = name.replace(/[^a-zA-Z]/g, '');
  if (alpha.length < name.replace(/\s/g, '').length * 0.65) return false;
  if (!/[aeiouAEIOU]/.test(name)) return false;
  return true;
}

// Convert month name/abbreviation to 1-indexed number
const MONTHS: Record<string, number> = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  january:1, february:2, march:3, april:4, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};

function parseDate(raw: string): Date | null {
  const s = raw.trim().toLowerCase();
  if (/present|current|now|till date|to date/.test(s)) return new Date();
  // "Jan 2021" or "January 2021"
  const m1 = s.match(/^([a-z]+)[\s,.-]+(\d{4})$/);
  if (m1) {
    const mo = MONTHS[m1[1]];
    if (mo) return new Date(parseInt(m1[2]), mo - 1, 1);
  }
  // "2021" only
  const m2 = s.match(/^(\d{4})$/);
  if (m2) return new Date(parseInt(m2[1]), 0, 1);
  // "03/2021" or "2021/03"
  const m3 = s.match(/^(\d{1,2})[/](\d{4})$/) ?? s.match(/^(\d{4})[/](\d{1,2})$/);
  if (m3) return new Date(parseInt(m3[2] || m3[1]), (parseInt(m3[1] || m3[2]) || 1) - 1, 1);
  return null;
}

/** Extract total years of experience by summing non-overlapping date ranges */
function calcTotalYears(text: string): number {
  // Match patterns like: "Jan 2018 – Mar 2022", "2016 - Present", "March 2015 to Current"
  const rangeRe = /([A-Za-z]*\.?\s*\d{4})\s*[-–—to]+\s*([A-Za-z]*\.?\s*\d{4}|present|current|now|till date|to date)/gi;
  let totalMs = 0;
  let m: RegExpExecArray | null;
  while ((m = rangeRe.exec(text)) !== null) {
    const start = parseDate(m[1]);
    const end = parseDate(m[2]);
    if (start && end && end >= start) {
      totalMs += end.getTime() - start.getTime();
    }
  }
  const years = totalMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(years * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section detector
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_HEADERS: Record<string, RegExp> = {
  summary:     /^(summary|profile|about|objective|professional\s*summary|career\s*objective|personal\s*statement)/i,
  experience:  /^(experience|employment|work\s*history|professional\s*experience|career\s*history|work\s*experience|positions\s*held)/i,
  education:   /^(education|academic|qualification|schooling|studies|degrees?)/i,
  skills:      /^(skills|technical\s*skills|core\s*competenc|technologies|tech\s*stack|proficienc|expertise)/i,
  certif:      /^(certif|licens|accreditation|credentials|award)/i,
  projects:    /^(projects?|portfolio|open[\s-]*source|side\s*projects?)/i,
  languages:   /^(languages?|spoken\s*languages?)/i,
  contact:     /^(contact|reach\s*me|get\s*in\s*touch)/i,
};

function detectSections(lines: string[]): Map<string, number> {
  const map = new Map<string, number>();
  lines.forEach((line, idx) => {
    const trimmed = line.replace(/[:\-_=*#•]+$/, '').trim();
    if (trimmed.length < 3 || trimmed.length > 60) return;
    for (const [key, re] of Object.entries(SECTION_HEADERS)) {
      if (re.test(trimmed) && !map.has(key)) map.set(key, idx);
    }
  });
  return map;
}

function extractSectionText(lines: string[], startIdx: number, sections: Map<string, number>): string {
  const nextSection = Math.min(
    ...[...sections.values()].filter(v => v > startIdx),
    lines.length,
  );
  return lines.slice(startIdx + 1, nextSection).filter(l => l.length > 2).join('\n').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Work experience item parser
// ─────────────────────────────────────────────────────────────────────────────
interface WorkItem { title: string; company: string; startDate: string; endDate: string; current: boolean; description: string }

function parseWorkItems(text: string): WorkItem[] {
  const items: WorkItem[] = [];
  // Split on blocks that contain a date range
  const blocks = text.split(/\n(?=\S)/);
  const dateRe = /([A-Za-z]*\.?\s*\d{4})\s*[-–—to]+\s*([A-Za-z]*\.?\s*\d{4}|present|current|now)/i;
  for (const block of blocks) {
    const dateMatch = block.match(dateRe);
    if (!dateMatch) continue;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const titleLine = lines[0] || '';
    const companyLine = lines[1] || '';
    const isCurrent = /present|current|now/i.test(dateMatch[2]);
    items.push({
      title:       titleLine.replace(dateRe, '').replace(/\|.*$/, '').trim(),
      company:     companyLine.replace(dateRe, '').replace(/\|.*$/, '').trim(),
      startDate:   dateMatch[1].trim(),
      endDate:     isCurrent ? 'Present' : dateMatch[2].trim(),
      current:     isCurrent,
      description: lines.slice(2).join(' ').slice(0, 400).trim(),
    });
    if (items.length >= 6) break;
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Education item parser
// ─────────────────────────────────────────────────────────────────────────────
interface EduItem { degree: string; institution: string; year: string; gpa: string }

function parseEducationItems(text: string): EduItem[] {
  const items: EduItem[] = [];
  const blocks = text.split(/\n(?=\S)/);
  const degreeRe = /(Bachelor|Master|PhD|Doctorate|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|B\.?E\.?|B\.?Tech|M\.?Tech|MBA|BBA|Associate|Diploma|Certificate)[^,\n]{0,80}/i;
  const yearRe = /\b(19|20)\d{2}\b/;
  const gpaRe = /\bgpa[:\s]+(\d+\.\d+)\b/i;
  for (const block of blocks) {
    const dm = block.match(degreeRe);
    const ym = block.match(yearRe);
    if (!dm && !ym) continue;
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    items.push({
      degree:      dm ? dm[0].trim() : '',
      institution: lines.find(l => !degreeRe.test(l) && l.length > 3 && !yearRe.test(l)) ?? '',
      year:        ym ? ym[0] : '',
      gpa:         block.match(gpaRe)?.[1] ?? '',
    });
    if (items.length >= 3) break;
  }
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────
function parseResume(text: string, fileName: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const sections = detectSections(lines);

  // ── Contact fields ──────────────────────────────────────────────────────────
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}/);
  const email = emailMatch ? emailMatch[0].toLowerCase() : '';

  let phone = '';
  const phonePatterns = [
    /(\+\d{1,3}[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/,
    /(\+\d{1,3}[\s.\-]?)?\d{5}[\s.\-]?\d{5}/,
    /(\+\d{1,2})\s\d{4,5}\s\d{4,6}/,
  ];
  for (const p of phonePatterns) { const m = text.match(p); if (m) { phone = m[0]; break; } }

  const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/profile\/)[a-zA-Z0-9\-_%]+/i);
  const linkedin = linkedinMatch ? `https://www.${linkedinMatch[0]}` : '';

  const githubMatch = text.match(/(?:github\.com\/)([a-zA-Z0-9\-]+)(?!\/[a-zA-Z0-9\-]+\/)/i);
  const github = githubMatch ? `https://github.com/${githubMatch[1]}` : '';

  const portfolioMatch = text.match(/https?:\/\/(?!linkedin|github)[a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?/i);
  const portfolio = portfolioMatch ? portfolioMatch[0].replace(/[,.)]+$/, '') : '';

  // ── Location ────────────────────────────────────────────────────────────────
  const locationRe = /\b([A-Z][a-zA-Z\s.]+,\s*(?:[A-Z]{2}|[A-Za-z\s]+)(?:,\s*[A-Z]{2,3})?)\b/;
  const locMatch = text.match(locationRe);
  const location = locMatch ? locMatch[1].trim() : '';

  // ── Name ────────────────────────────────────────────────────────────────────
  let name = '';
  const SECTION_STOP_RE = /^(summary|experience|education|skills|certif|project|contact|phone|email|objective|profile|employment|linkedin|github|address)/i;
  for (const line of lines.slice(0, 10)) {
    const clean = line.replace(/[^a-zA-Z\s.'\-]/g, '').trim();
    const words = clean.split(/\s+/);
    if (
      words.length >= 2 && words.length <= 5 &&
      clean.length > 3 && clean.length < 50 &&
      !line.includes('@') && !/\d{3}/.test(line) &&
      !SECTION_STOP_RE.test(clean) &&
      isValidName(clean)
    ) { name = titleCase(clean); break; }
  }
  if (!name) {
    // Try filename
    const fromFile = fileName
      .replace(/\.[^.]+$/, '').replace(/[_\-]/g, ' ')
      .replace(/resume|cv|curriculum\s*vitae|\d+/gi, '').trim();
    if (isValidName(fromFile)) name = titleCase(fromFile);
  }

  // ── Current title (first bolded / first-line-after-name pattern) ────────────
  const titleRe = /^(Senior|Lead|Principal|Staff|Junior|Mid|Head of|VP|Director|Manager|Engineer|Developer|Designer|Analyst|Consultant|Specialist|Architect|Product|Software|Frontend|Backend|Full.?Stack|DevOps|Data|QA|SRE|CTO|CIO|CEO|COO)[^.\n]{3,80}/i;
  let currentTitle = '';
  for (const line of lines.slice(0, 15)) {
    if (titleRe.test(line) && !line.includes('@')) { currentTitle = line.trim().slice(0, 80); break; }
  }

  // ── Skills ──────────────────────────────────────────────────────────────────
  const foundSkills: string[] = [];
  const skillsStartIdx = sections.get('skills');
  const skillsText = skillsStartIdx !== undefined
    ? extractSectionText(lines, skillsStartIdx, sections)
    : text;

  for (const skill of SKILL_KEYWORDS) {
    const re = new RegExp(`\\b${skill.replace(/[.+]/g, '\\$&')}\\b`, 'i');
    if (re.test(skillsText)) foundSkills.push(skill);
  }

  // ── Experience section ──────────────────────────────────────────────────────
  const expStartIdx = sections.get('experience');
  const expText = expStartIdx !== undefined ? extractSectionText(lines, expStartIdx, sections) : '';

  const workItems = parseWorkItems(expText || text);
  const totalYears = calcTotalYears(text);

  // Fallback: look for explicit "X years" mention
  let experienceYears: number | null = totalYears > 0 ? totalYears : null;
  if (!experienceYears) {
    const ym = text.match(/(\d+)\+?\s*years?\s*(of\s*)?(experience|in\s)/i);
    if (ym) experienceYears = parseInt(ym[1]);
  }

  // ── Education ──────────────────────────────────────────────────────────────
  const eduStartIdx = sections.get('education');
  const eduText = eduStartIdx !== undefined ? extractSectionText(lines, eduStartIdx, sections) : '';
  const educationItems = parseEducationItems(eduText || text);

  // ── Certifications ─────────────────────────────────────────────────────────
  const certs: string[] = [];
  const certIdx = sections.get('certif');
  const certText = certIdx !== undefined ? extractSectionText(lines, certIdx, sections) : text;
  for (const re of CERT_PATTERNS) {
    const m = certText.match(re);
    if (m && !certs.includes(m[0].trim())) certs.push(m[0].trim());
  }

  // ── Languages ──────────────────────────────────────────────────────────────
  const LANG_LIST = ['English', 'Spanish', 'French', 'German', 'Mandarin', 'Chinese',
    'Hindi', 'Arabic', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Italian', 'Dutch',
    'Swedish', 'Polish', 'Turkish', 'Vietnamese', 'Thai', 'Indonesian', 'Malay'];
  const langIdx = sections.get('languages');
  const langText = langIdx !== undefined ? extractSectionText(lines, langIdx, sections) : '';
  const languages = LANG_LIST.filter(l => new RegExp(`\\b${l}\\b`, 'i').test(langText || lower));

  // ── Summary ─────────────────────────────────────────────────────────────────
  const summaryIdx = sections.get('summary');
  let summary = summaryIdx !== undefined
    ? extractSectionText(lines, summaryIdx, sections).slice(0, 600)
    : '';
  if (!summary) {
    // Auto-generate from extracted data
    const parts: string[] = [];
    if (currentTitle) parts.push(currentTitle);
    if (experienceYears && experienceYears > 0) parts.push(`${experienceYears}+ years of experience`);
    if (foundSkills.length) parts.push(`skilled in ${foundSkills.slice(0, 4).join(', ')}`);
    summary = parts.join('. ') + (parts.length ? '.' : '');
  }

  // ── Confidence score ────────────────────────────────────────────────────────
  let confidence = 0;
  if (name && isValidName(name)) confidence += 20;
  if (email) confidence += 20;
  if (phone) confidence += 15;
  if (foundSkills.length > 0) confidence += 15;
  if (workItems.length > 0 || experienceYears) confidence += 15;
  if (educationItems.length > 0) confidence += 10;
  if (currentTitle) confidence += 5;

  return {
    // Core contact
    name:           name || 'Candidate',
    email,
    phone,
    location,
    linkedin,
    github,
    portfolio,
    // Role
    currentTitle,
    // Skills
    skills:         foundSkills.slice(0, 25),
    // Experience
    experienceYears,
    workExperience: workItems,
    // Education
    education:      educationItems,
    // Extra
    certifications: certs,
    languages,
    summary,
    // Meta
    _confidence:    Math.min(confidence, 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// File → text extraction
// ─────────────────────────────────────────────────────────────────────────────
async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<{ text: string; method: string }> {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();

  // DOCX / DOC  ─────────────────────────────────────────────────────────────
  if (ext === '.docx' || mimeType.includes('wordprocessingml') || ext === '.doc' || mimeType.includes('msword')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      if (isCleanText(result.value)) return { text: result.value.trim(), method: 'mammoth-docx' };
    } catch (e) { console.warn('[resume-parse] mammoth failed:', e); }
  }

  // TXT  ────────────────────────────────────────────────────────────────────
  if (ext === '.txt' || mimeType === 'text/plain') {
    const text = buffer.toString('utf-8');
    if (isCleanText(text)) return { text, method: 'plain-text' };
  }

  // PDF (primary)  ──────────────────────────────────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();
    if (isCleanText(text)) return { text, method: 'pdf-parse' };
  } catch (e) { console.warn('[resume-parse] pdf-parse failed:', e); }

  // Binary fallback — extract readable strings from PDF encoding  ───────────
  try {
    const raw = buffer.toString('latin1');
    const chunks = (raw.match(/\(([^\\)]{2,80})\)/g) ?? [])
      .map(b => b.slice(1, -1).replace(/\\(.)/g, '$1'))
      .filter(b => /[a-zA-Z]{2,}/.test(b));
    const text = chunks.join(' ');
    if (isCleanText(text)) return { text, method: 'binary-fallback' };
  } catch { /* ignore */ }

  return { text: '', method: 'none' };
}

// ─────────────────────────────────────────────────────────────────────────────
// API Route
// ─────────────────────────────────────────────────────────────────────────────
export const POST = withAuth(async (req: NextRequest, _ctx, session) => {
  try {
    // Rate limit: 10 parses per 10 minutes per IP
    const ip = getClientIp(req);
    const rl = await rateLimitAsync(`resume-parse:${ip}`, 10, 10 * 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in a few minutes.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // File size guard
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5 MB.' }, { status: 413 });
    }

    // File type guard (check both MIME and extension)
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_MIME.has(file.type) && !ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF, DOCX, DOC, or TXT.' },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract raw text
    const { text, method } = await extractText(buffer, file.type, file.name);

    // Always scan raw buffer for email/phone even if text extraction failed
    const rawStr = buffer.toString('latin1');
    const rawEmail = rawStr.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}/)?.[0]?.toLowerCase() ?? '';
    const rawPhone = rawStr.match(/(\+\d{1,3}[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/)?.[0] ?? '';

    // ── AI-Enhanced Parsing (if OPENAI_API_KEY is configured and plan allows) ──
    let aiAllowed = true;
    if (session?.organizationId) {
      const { plan } = await getPlanContext(session.organizationId);
      aiAllowed = hasFeature(plan, 'ai');
    }
    if (aiAllowed && isAIEnabled() && text.length > 50) {
      const aiResult = await parseResumeWithAI(text);
      if (aiResult) {
        // Backfill from raw buffer if AI didn't find email/phone
        if (!aiResult.email && rawEmail) aiResult.email = rawEmail;
        if (!aiResult.phone && rawPhone) aiResult.phone = rawPhone;

        return NextResponse.json({
          name: aiResult.name,
          email: aiResult.email,
          phone: aiResult.phone,
          location: aiResult.location,
          linkedin: aiResult.linkedin,
          github: aiResult.github,
          portfolio: aiResult.portfolio,
          currentTitle: aiResult.currentTitle,
          summary: aiResult.summary,
          skills: aiResult.skills,
          experience: aiResult.experienceYears,
          workExperience: aiResult.workExperience,
          education: aiResult.education,
          certifications: aiResult.certifications,
          languages: aiResult.languages,
          _confidence: 95,
          _meta: {
            parseMethod: 'ai',
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            textLength: text.length,
            fileName: file.name,
            fileSize: file.size,
            confidence: 95,
          },
        });
      }
      // AI call failed — fall through to rule-based parser
    }

    // ── Rule-based Parsing (fallback — always available) ─────────────────────
    const parsed = parseResume(text, file.name);

    // Backfill from raw buffer if not found in clean text
    if (!parsed.email && rawEmail) parsed.email = rawEmail;
    if (!parsed.phone && rawPhone) parsed.phone = rawPhone;

    return NextResponse.json({
      ...parsed,
      _meta: {
        parseMethod: method,
        textLength:  text.length,
        fileName:    file.name,
        fileSize:    file.size,
        confidence:  parsed._confidence,
      },
    });
  } catch (error) {
    console.error('[resume-parse] Unexpected error:', error);
    return NextResponse.json({ error: 'Failed to parse resume' }, { status: 500 });
  }
});
