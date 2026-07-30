// Enterprise-grade Resume Parser Service with Advanced AI-like Extraction
// Multi-Strategy Pipeline: text extract → pdfjs-dist → OCR (tesseract.js)
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Strategy 2: pdfjs-dist for robust text extraction
let pdfjsLib;
try {
  pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
  console.log('✅ pdfjs-dist loaded for advanced PDF text extraction');
} catch (e) {
  pdfjsLib = null;
  console.warn('⚠️ pdfjs-dist not available:', e.message);
}

// Strategy 3: tesseract.js OCR for image-based documents
let Tesseract;
try {
  Tesseract = require('tesseract.js');
  console.log('✅ tesseract.js loaded for OCR capability');
} catch (e) {
  Tesseract = null;
  console.warn('⚠️ tesseract.js not available:', e.message);
}

// Optional: textract for DOCX/DOC/RTF
let textract;
let extractText;
try {
  textract = require('textract');
  const { promisify } = require('util');
  extractText = promisify(textract.fromBufferWithMime);
} catch (e) {
  console.warn('⚠️ textract not available:', e.message);
  textract = null;
  extractText = null;
}

// ─── Enterprise PDF Text Extraction via pdfjs-dist ───
async function extractTextWithPdfJs(buffer) {
  if (!pdfjsLib) return '';
  try {
    const uint8 = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data: uint8, useSystemFonts: true }).promise;
    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map(item => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText.trim();
  } catch (err) {
    console.warn('⚠️ pdfjs-dist extraction failed:', err.message);
    return '';
  }
}

// ─── PDF to Image rendering via @napi-rs/canvas + pdfjs-dist ───
let napiCanvas;
try {
  napiCanvas = require('@napi-rs/canvas');
  console.log('✅ @napi-rs/canvas loaded for PDF page rendering');
} catch (e) {
  napiCanvas = null;
  console.warn('⚠️ @napi-rs/canvas not available:', e.message);
}

// Custom CanvasFactory for pdfjs-dist rendering with @napi-rs/canvas
class NodeCanvasFactory {
  create(width, height) {
    const canvas = napiCanvas.createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function renderPdfPageToImage(pdfDoc, pageNum) {
  if (!napiCanvas) return null;
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x for quality OCR
    const canvas = napiCanvas.createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    // Fill white background (scanned PDFs may have transparent bg)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    // pdfjs-dist render needs a canvas-compatible context + canvasFactory
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvasFactory: napiCanvas ? new NodeCanvasFactory() : undefined
    }).promise;

    // Export as PNG buffer
    const pngBuffer = canvas.toBuffer('image/png');
    console.log(`   📸 Page ${pageNum} rendered: ${pngBuffer.length} bytes PNG (${Math.round(viewport.width)}x${Math.round(viewport.height)})`);
    return pngBuffer;
  } catch (err) {
    console.warn(`⚠️ Failed to render PDF page ${pageNum}:`, err.message);
    return null;
  }
}

// ─── Enterprise OCR Pipeline via tesseract.js ───
async function ocrPdfBuffer(buffer) {
  if (!Tesseract) {
    console.warn('⚠️ OCR not available (tesseract.js not installed)');
    return '';
  }
  try {
    const header = buffer.slice(0, 5).toString('ascii');

    // For PDF files: render pages to images first, then OCR each image
    if (header.startsWith('%PDF')) {
      if (!pdfjsLib || !napiCanvas) {
        console.warn('⚠️ Cannot OCR scanned PDF: requires pdfjs-dist + @napi-rs/canvas');
        return '';
      }

      console.log('🔍 Rendering PDF pages to images for OCR...');
      const uint8 = new Uint8Array(buffer);
      const pdfDoc = await pdfjsLib.getDocument({
        data: uint8,
        canvasFactory: napiCanvas ? new NodeCanvasFactory() : undefined
      }).promise;
      const numPages = Math.min(pdfDoc.numPages, 5); // Limit to first 5 pages
      let allText = '';

      const worker = await Tesseract.createWorker('eng', 1, {
        errorHandler: (err) => {
          console.warn('⚠️ Tesseract worker error (handled):', err.message);
        }
      });

      for (let i = 1; i <= numPages; i++) {
        console.log(`📄 Processing page ${i}/${numPages}...`);
        const imgBuffer = await renderPdfPageToImage(pdfDoc, i);
        if (imgBuffer) {
          const { data } = await worker.recognize(imgBuffer);
          allText += (data.text || '') + '\n';
          console.log(`   → Page ${i}: ${data.text.length} chars`);
        }
      }

      await worker.terminate();
      console.log(`✅ OCR complete: extracted ${allText.length} characters from ${numPages} pages`);
      return allText.trim();
    }

    // For image buffers, run OCR directly
    console.log('🔍 Starting OCR on image buffer...');
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r🔍 OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      errorHandler: (err) => {
        console.warn('⚠️ Tesseract worker error (handled):', err.message);
      }
    });

    const { data } = await worker.recognize(buffer);
    await worker.terminate();

    console.log(`\n✅ OCR complete: extracted ${data.text.length} characters`);
    return data.text || '';
  } catch (err) {
    console.warn('⚠️ OCR failed:', err.message);
    return '';
  }
}

// ─── Enterprise OCR for image files ───
async function ocrImageBuffer(buffer) {
  if (!Tesseract) return '';
  try {
    console.log('🔍 Running OCR on image...');
    const worker = await Tesseract.createWorker('eng');
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    console.log(`✅ Image OCR complete: ${data.text.length} characters`);
    return data.text || '';
  } catch (err) {
    console.warn('⚠️ Image OCR failed:', err.message);
    return '';
  }
}

// Enterprise-grade keyword databases
const JOB_TITLES = [
  // Technical Roles
  'software engineer', 'software developer', 'full stack developer', 'frontend developer', 'backend developer',
  'senior software engineer', 'lead developer', 'principal engineer', 'architect', 'tech lead',
  'devops engineer', 'site reliability engineer', 'system administrator', 'database administrator',
  'data scientist', 'data analyst', 'machine learning engineer', 'ai engineer', 'data engineer',
  'qa engineer', 'test engineer', 'automation engineer', 'security engineer', 'cloud engineer',
  'mobile developer', 'ios developer', 'android developer', 'react native developer',

  // Management Roles
  'project manager', 'product manager', 'program manager', 'engineering manager', 'technical manager',
  'team lead', 'scrum master', 'agile coach', 'delivery manager', 'it manager',

  // Business Roles
  'business analyst', 'system analyst', 'requirements analyst', 'functional analyst',
  'consultant', 'senior consultant', 'solution architect', 'enterprise architect',

  // Banking & Finance Roles
  'branch manager', 'assistant branch manager', 'relationship manager', 'credit analyst',
  'loan officer', 'investment banker', 'financial analyst', 'risk analyst', 'compliance officer',
  'assistant vice president', 'vice president', 'branch head', 'branch operations manager',
  'operations manager', 'area manager', 'regional manager', 'cluster manager',
  'portfolio manager', 'wealth manager', 'insurance advisor', 'underwriter',
  'audit manager', 'accounts manager', 'finance manager', 'treasury manager',

  // HR & Admin Roles
  'hr manager', 'hr executive', 'recruiter', 'talent acquisition', 'hr coordinator',
  'admin executive', 'office manager', 'executive assistant', 'receptionist',

  // Sales & Marketing Roles
  'sales manager', 'sales executive', 'marketing manager', 'marketing executive',
  'business development manager', 'business development executive', 'account manager',
  'key account manager', 'territory manager',

  // Support Roles
  'technical support', 'customer support', 'help desk', 'system support', 'application support'
];

const COMPANY_KEYWORDS = [
  'ltd', 'limited', 'inc', 'incorporated', 'corp', 'corporation', 'llc', 'llp',
  'pvt', 'private', 'technologies', 'solutions', 'systems', 'software', 'services',
  'consulting', 'labs', 'studios', 'group', 'holdings', 'enterprises', 'ventures',
  'bank', 'finance', 'capital', 'insurance', 'associates', 'partners', 'agency',
  'industries', 'international', 'global', 'infosys', 'wipro', 'tcs', 'hcl',
  'infotech', 'techno', 'infocom', 'infra', 'foundation', 'trust', 'company'
];

const LOCATION_KEYWORDS = {
  cities: [
    'mumbai', 'delhi', 'bangalore', 'chennai', 'hyderabad', 'pune', 'kolkata', 'ahmedabad',
    'jaipur', 'surat', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal',
    'visakhapatnam', 'pimpri-chinchwad', 'patna', 'vadodara', 'ghaziabad', 'ludhiana',
    'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 'kalyan-dombivli', 'vasai-virar',
    'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad',
    'ranchi', 'howrah', 'coimbatore', 'jabalpur', 'gwalior', 'vijayawada', 'jodhpur',
    'madurai', 'raipur', 'kota', 'guwahati', 'solapur', 'hubli-dharwad', 'bareilly',
    'moradabad', 'mysore', 'tiruchirappalli', 'tiruppur', 'salem', 'thiruvananthapuram',
    'bhiwandi', 'saharanpur', 'gorakhpur', 'guna', 'bikaner', 'amravati', 'noida',
    'jamshedpur', 'bhilai', 'cuttack', 'firozabad', 'kochi', 'nellore', 'bhavnagar',
    'dehradun', 'durgapur', 'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer',
    'akola', 'gulbarga', 'jamnagar', 'ujjain', 'loni', 'siliguri', 'jhansi', 'ulhasnagar',
    'jammu', 'sangli-miraj', 'mangalore', 'ebbw vale', 'belgaum', 'ambattur', 'tirunelveli',
    'malegaon', 'gaya', 'jalgaon', 'udaipur', 'maheshtala', 'tirupati', 'davanagere',
    'kozhikode', 'akola', 'kurnool', 'rajpur sonarpur', 'bokaro', 'south dum dum',
    'bellary', 'patiala', 'gopalpur', 'agra', 'dhule', 'bhagalpur', 'muzaffarpur',
    'bhatpara', 'panihati', 'latur', 'dhule', 'rohtak', 'korba', 'bhilwara', 'berhampur',
    'muzaffarnagar', 'ahmednagar', 'mathura', 'kollam', 'avadi', 'kadapa', 'kamarhati',
    'sambalpur', 'bilaspur', 'shahjahanpur', 'satara', 'bijapur', 'rampur', 'shoranur',
    'aligarh', 'nadiad', 'secunderabad', 'puri', 'hosur', 'pondicherry'
  ],
  states: [
    'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
    'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
    'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
    'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
    'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'jammu and kashmir',
    'ladakh', 'puducherry', 'chandigarh', 'dadra and nagar haveli', 'daman and diu',
    'lakshadweep', 'andaman and nicobar islands'
  ]
};

const SKILL_KEYWORDS = [
  // Programming Languages
  'javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift',
  'kotlin', 'scala', 'r', 'matlab', 'perl', 'bash', 'powershell',

  // Web Technologies
  'html', 'css', 'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask',
  'spring', 'asp.net', 'jquery', 'bootstrap', 'sass', 'less', 'webpack', 'babel',

  // Databases
  'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle', 'sql server',
  'sqlite', 'cassandra', 'dynamodb', 'firebase',

  // Cloud Platforms
  'aws', 'azure', 'gcp', 'heroku', 'digitalocean', 'linode', 'docker', 'kubernetes',
  'terraform', 'ansible', 'jenkins', 'gitlab ci', 'github actions',

  // Tools & Frameworks
  'git', 'svn', 'jira', 'confluence', 'slack', 'postman', 'swagger', 'figma', 'sketch',
  'adobe xd', 'photoshop', 'illustrator', 'premiere', 'after effects',

  // Banking & Finance Skills
  'risk management', 'credit analysis', 'loan processing', 'compliance', 'aml',
  'kyc', 'financial analysis', 'portfolio management', 'wealth management',
  'banking operations', 'treasury', 'forex', 'mutual funds', 'insurance',
  'underwriting', 'audit', 'accounting', 'tally', 'sap', 'erp',
  'ms excel', 'excel', 'powerpoint', 'word', 'ms office',
  'communication', 'leadership', 'team management', 'customer service',
  'negotiation', 'presentation', 'problem solving', 'analytical skills'
];

// Advanced regex patterns with confidence scoring
const PATTERNS = {
  email: [
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, confidence: 95 },
    { regex: /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/g, confidence: 85 }
  ],
  phone: [
    { regex: /(\+91[-.\s]?)?[6-9]\d{9}/g, confidence: 95 },
    { regex: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, confidence: 90 },
    { regex: /(\+\d{1,3}[-.\s]?)?\d{10,13}/g, confidence: 80 },
    { regex: /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g, confidence: 85 }
  ],
  experience: [
    { regex: /(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i, confidence: 95 },
    { regex: /(?:experience|exp)\s*(?:of\s*|:\s*)?(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i, confidence: 90 },
    { regex: /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:work|professional|industry|IT|total)/i, confidence: 85 },
    { regex: /(?:total|overall)\s*(?:experience|exp)\s*(?:of\s*|:\s*)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i, confidence: 92 }
  ]
};

// ─── Smart Text Segmenter ───
// PDF text often comes as one big blob. This function intelligently splits
// it into logical segments using section headers and formatting cues.
function smartSegment(text) {
  // Common resume section headers
  const sectionHeaders = [
    'ABOUT ME', 'ABOUT', 'SUMMARY', 'OBJECTIVE', 'PROFILE', 'PROFESSIONAL SUMMARY',
    'EDUCATION', 'ACADEMIC', 'QUALIFICATION', 'QUALIFICATIONS',
    'SKILLS', 'TECHNICAL SKILLS', 'KEY SKILLS', 'CORE COMPETENCIES', 'COMPETENCIES',
    'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'EMPLOYMENT',
    'PROJECTS', 'PROJECT DETAILS', 'KEY PROJECTS',
    'CERTIFICATION', 'CERTIFICATIONS', 'CERTIFICATES',
    'CONTACT', 'CONTACT DETAILS', 'CONTACT INFORMATION', 'PERSONAL DETAILS',
    'ACHIEVEMENTS', 'AWARDS', 'HOBBIES', 'INTERESTS', 'LANGUAGES',
    'DECLARATION', 'REFERENCES'
  ];

  // Build regex to split on section headers
  const headerPattern = new RegExp(
    '(?=\\b(' + sectionHeaders.map(h => h.replace(/\s+/g, '\\s+')).join('|') + ')\\b)',
    'gi'
  );

  // Split text into sections
  const sections = {};
  const parts = text.split(headerPattern).filter(p => p && p.trim().length > 0);

  let currentSection = 'HEADER'; // Everything before first section header
  sections['HEADER'] = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const upperPart = part.toUpperCase().trim();

    // Check if this part is a section header
    const isHeader = sectionHeaders.some(h =>
      upperPart === h || upperPart.replace(/\s+/g, ' ') === h
    );

    if (isHeader) {
      currentSection = upperPart.replace(/\s+/g, ' ');
      if (!sections[currentSection]) sections[currentSection] = '';
    } else {
      sections[currentSection] = ((sections[currentSection] || '') + ' ' + part).trim();
    }
  }

  return sections;
}

// ─── OCR Text Cleanup ───
// OCR often produces concatenated words like "SUBODHJHA" or "DateOfBirth".
// This function tries to add spaces at camelCase/PascalCase boundaries.
function cleanOcrText(text) {
  let cleaned = text;
  // Split camelCase/PascalCase: "DateOfBirth" → "Date Of Birth"
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Split when lowercase is followed by uppercase run: "fromBASTAR" → "from BASTAR"
  cleaned = cleaned.replace(/([a-z])([A-Z]{2,})/g, '$1 $2');
  // Split when uppercase run is followed by uppercase+lowercase: "SUBODHJha" → "SUBODH Jha"
  cleaned = cleaned.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
  // Split concatenated all-caps words using known keywords as boundary hints
  const KNOWN_WORDS = ['UNIVERSITY', 'COLLEGE', 'INSTITUTE', 'SCHOOL', 'EDUCATION', 'EXPERIENCE',
    'SKILLS', 'CONTACT', 'SUMMARY', 'OBJECTIVE', 'CERTIFICATION', 'ACHIEVEMENT',
    'DEPARTMENT', 'MANAGEMENT', 'DEVELOPMENT', 'ENGINEERING', 'TECHNOLOGY',
    'BACHELOR', 'MASTER', 'DIPLOMA', 'DEGREE', 'COMMERCE', 'SCIENCE', 'ARTS'];
  for (const word of KNOWN_WORDS) {
    // Add space before known word if preceded by other letters without space
    const regex = new RegExp(`([A-Za-z])${word}`, 'g');
    cleaned = cleaned.replace(regex, `$1 ${word}`);
    // Add space after known word if followed by other letters  
    const regex2 = new RegExp(`${word}([A-Za-z])`, 'g');
    cleaned = cleaned.replace(regex2, `${word} $1`);
  }
  // Fix common OCR artifacts: multiple spaces, stray punctuation
  cleaned = cleaned.replace(/\s{3,}/g, '  ');
  return cleaned;
}

// ─── Enterprise-Grade Field Extraction ───
function extractFields(text) {
  // Apply OCR text cleanup before processing
  text = cleanOcrText(text);
  const rawText = text;
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into real lines (preserve original line breaks from PDF)
  const rawLines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Also create a single-line version for regex matching
  const flatText = cleanText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

  // Smart section segmentation
  const sections = smartSegment(flatText);

  console.log('📋 Detected sections:', Object.keys(sections).filter(k => sections[k].length > 0));

  const result = {
    name: { value: '', confidence: 0 },
    email: { value: '', confidence: 0 },
    contact: { value: '', confidence: 0 },
    position: { value: '', confidence: 0 },
    company: { value: '', confidence: 0 },
    experience: { value: '', confidence: 0 },
    location: { value: '', confidence: 0 },
    skills: { value: '', confidence: 0 },
    education: { value: '', confidence: 0 }
  };

  // ════════════════════════════════════════
  // 1. EMAIL EXTRACTION (highest accuracy)
  // ════════════════════════════════════════
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = flatText.match(emailRegex);
  if (emailMatches && emailMatches.length > 0) {
    // Pick the most likely personal email (not info@, hr@, etc.)
    const personalEmail = emailMatches.find(e => !/^(info|hr|admin|support|contact|careers|jobs|noreply)@/i.test(e)) || emailMatches[0];
    result.email = { value: personalEmail.toLowerCase(), confidence: 100 };
  }

  // ════════════════════════════════════════
  // 2. PHONE/CONTACT EXTRACTION
  // ════════════════════════════════════════
  // First try to find full number with country code from the text
  const fullPhonePatterns = [
    /\+91[-. ]?[6-9]\d{4}[-. ]?\d{5}/g,
    /\+91[-. ]?[6-9]\d{9}/g,
    /\+\d{1,3}[-. ]?\d{4,5}[-. ]?\d{4,6}/g
  ];
  const barePhonePatterns = [
    /(?<!\d)[6-9]\d{9}(?!\d)/g,
    /\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g
  ];

  // Priority: numbers with country code
  for (const pattern of fullPhonePatterns) {
    const matches = flatText.match(pattern);
    if (matches) {
      result.contact = { value: matches[0].trim(), confidence: 100 };
      break;
    }
  }

  // Fallback: bare 10-digit numbers (add +91 if Indian context)
  if (result.contact.confidence < 80) {
    for (const pattern of barePhonePatterns) {
      const matches = flatText.match(pattern);
      if (matches) {
        const phone = matches[0].trim();
        // Check if +91 appears anywhere in the text (Indian resume context)
        const hasIndianPrefix = /\+91/i.test(flatText);
        result.contact = {
          value: hasIndianPrefix ? '+91-' + phone : phone,
          confidence: 90
        };
        break;
      }
    }
  }

  // ════════════════════════════════════════
  // 3. NAME EXTRACTION (multi-strategy)
  // ════════════════════════════════════════
  const emailLocal = result.email.value ? result.email.value.split('@')[0] : '';

  // Strategy A: First line(s) of resume are usually the name
  // Look in the HEADER section or the first few raw lines
  const headerText = sections['HEADER'] || '';

  // Job-title stop words — if we hit one of these, the name has ended
  const TITLE_STOP_WORDS = new Set([
    'full', 'stack', 'software', 'senior', 'junior', 'lead', 'principal', 'chief',
    'developer', 'engineer', 'manager', 'analyst', 'designer', 'architect', 'consultant',
    'marketer', 'specialist', 'coordinator', 'executive', 'officer', 'director',
    'devops', 'frontend', 'backend', 'mobile', 'web', 'data', 'cloud', 'qa', 'test',
    'digital', 'marketing', 'product', 'project', 'program', 'business', 'system',
    'ui', 'ux', 'intern', 'trainee', 'associate', 'assistant', 'head', 'vp',
    'about', 'summary', 'objective', 'profile', 'education', 'skills', 'experience',
    'contact', 'certification', 'resume', 'curriculum', 'vitae', 'declaration'
  ]);

  // Non-name words — words that are never part of a person's name
  const NON_NAME_WORDS = new Set([
    'date', 'birth', 'dateofbirth', 'dob', 'gender', 'male', 'female', 'nationality',
    'address', 'phone', 'email', 'mobile', 'tel', 'fax', 'website', 'linkedin',
    'github', 'portfolio', 'objective', 'summary', 'career', 'page', 'resume', 'cv',
    'age', 'marital', 'status', 'father', 'mother', 'passport', 'visa', 'religion',
    'present', 'permanent', 'current', 'pincode', 'zip', 'country', 'state', 'city',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr',
    'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]);

  // Helper: Check if a word could be part of a person's name
  function isNameWord(w) {
    const lower = w.toLowerCase();
    if (TITLE_STOP_WORDS.has(lower)) return false;
    if (NON_NAME_WORDS.has(lower)) return false;
    if (/\d/.test(w)) return false; // Names don't contain digits
    if (w.length < 2) return false; // Too short
    if (w.length > 15) return false; // Too long for a name part
    return true;
  }

  // Strategy A1: Grab consecutive capitalized words from start, stop at title/section/non-name words
  const startWords = flatText.match(/^([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)*)/);
  if (startWords) {
    const allWords = startWords[1].split(/\s+/);
    const nameWords = [];
    for (const w of allWords) {
      if (!isNameWord(w)) break;
      nameWords.push(w);
    }
    if (nameWords.length >= 2 && nameWords.length <= 4) {
      const candidate = nameWords.join(' ');
      if (candidate.length >= 3 && candidate.length <= 45) {
        const titleCased = /^[A-Z\s.'-]+$/.test(candidate)
          ? candidate.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')
          : candidate;
        result.name = { value: titleCased, confidence: 95 };
      }
    }
  }

  // Strategy A2: All-caps name at start (e.g., "RAJU KUMAR")
  if (result.name.confidence < 90) {
    const allCaps = flatText.match(/^([A-Z]{2,}(?:\s+[A-Z]{2,})*)/);
    if (allCaps) {
      const allWords = allCaps[1].split(/\s+/);
      const nameWords = [];
      for (const w of allWords) {
        if (!isNameWord(w)) break;
        nameWords.push(w);
      }
      if (nameWords.length >= 2 && nameWords.length <= 4) {
        const titleCased = nameWords.map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
        result.name = { value: titleCased, confidence: 95 };
      }
    }
  }

  // Strategy A2b: Single all-caps name at start — only if email confirms it
  if (result.name.confidence < 90 && emailLocal) {
    const allCaps = flatText.match(/^([A-Z]{2,})/);
    if (allCaps) {
      const word = allCaps[1];
      if (isNameWord(word) && word.length >= 3) {
        // Try to split concatenated name using email hint: "SUBODHJHA" + email "subodh36garh@"
        const emailName = emailLocal.replace(/[0-9_]+/g, '').toLowerCase();
        // Check if the start of the caps matches the email prefix
        const lowerWord = word.toLowerCase();
        // Try finding a split point where the start matches the email name prefix
        let bestSplit = null;
        for (let splitPos = 2; splitPos < lowerWord.length - 1; splitPos++) {
          const firstPart = lowerWord.substring(0, splitPos);
          if (emailName.startsWith(firstPart) && firstPart.length >= 3) {
            bestSplit = splitPos;
          }
        }
        if (bestSplit) {
          const first = word.substring(0, bestSplit);
          const last = word.substring(bestSplit);
          const titleCased = [first, last].map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          result.name = { value: titleCased, confidence: 85 };
        }
      }
    }
  }

  // Strategy A3: Look in first 5 raw lines for a name-like pattern
  if (result.name.confidence < 80) {
    for (let i = 0; i < Math.min(5, rawLines.length); i++) {
      const line = rawLines[i].trim();
      // Name: 2-4 words, each starting with uppercase, no numbers, no special chars except hyphen
      if (/^[A-Z][a-zA-Z'-]+(\s+[A-Z][a-zA-Z'-]+){1,3}$/.test(line) && line.length <= 40) {
        const words = line.split(/\s+/);
        const validWords = words.filter(w => isNameWord(w));
        if (validWords.length >= 2 && validWords.length === words.length) {
          const lowerLine = line.toLowerCase();
          const isSection = ['about me', 'summary', 'education', 'skills', 'experience', 'contact'].includes(lowerLine);
          const isJobTitle = JOB_TITLES.some(t => lowerLine === t);
          if (!isSection && !isJobTitle) {
            result.name = { value: line, confidence: 90 };
            break;
          }
        }
      }
    }
  }

  // Strategy A4: Infer from email if we still don't have a name
  if (result.name.confidence < 70 && emailLocal) {
    const cleanLocal = emailLocal.replace(/[0-9_]+/g, '').replace(/[.]/g, ' ').trim();
    if (cleanLocal.length >= 3) {
      const nameParts = cleanLocal.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      if (nameParts.length >= 1 && nameParts.join(' ').length >= 3) {
        result.name = { value: nameParts.join(' '), confidence: 60 };
      }
    }
  }

  // Strategy A5: Cross-validate name with email — if name doesn't match email at all, try email-based name
  if (result.name.confidence > 0 && emailLocal) {
    const emailName = emailLocal.replace(/[0-9_@.]+/g, '').toLowerCase();
    const extractedNameLower = result.name.value.replace(/\s+/g, '').toLowerCase();
    // If extracted name doesn't overlap with email at all, email-based name might be better
    const emailInName = emailName.length >= 3 && (extractedNameLower.includes(emailName.substring(0, 3)) || emailName.includes(extractedNameLower.substring(0, 3)));
    if (!emailInName && result.name.confidence <= 85) {
      // Try email-based name instead
      const cleanLocal = emailLocal.replace(/[0-9_]+/g, '').replace(/[.]/g, ' ').trim();
      if (cleanLocal.length >= 3) {
        const nameParts = cleanLocal.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        if (nameParts.length >= 1) {
          result.name = { value: nameParts.join(' '), confidence: 70 };
        }
      }
    }
  }

  // ════════════════════════════════════════
  // 4. POSITION/JOB TITLE EXTRACTION
  // ════════════════════════════════════════
  // Strategy: Find job title keywords and extract ONLY the title, not the surrounding text

  // Build search area: text immediately after the name (where title usually lives)
  let positionSearchArea = '';
  if (result.name.value) {
    // Find where the name ends in the flat text
    const nameIdx = flatText.toLowerCase().indexOf(result.name.value.toLowerCase());
    if (nameIdx !== -1) {
      positionSearchArea = flatText.substring(nameIdx + result.name.value.length, nameIdx + result.name.value.length + 200).trim();
    }
  }
  if (!positionSearchArea) {
    positionSearchArea = flatText.substring(0, 300);
  }

  // Build a sorted list (longest first to match "senior software engineer" before "software engineer")
  const sortedTitles = [...JOB_TITLES].sort((a, b) => b.length - a.length);
  const lowerSearchArea = positionSearchArea.toLowerCase();

  for (const title of sortedTitles) {
    const idx = lowerSearchArea.indexOf(title);
    if (idx !== -1) {
      // Extract ONLY the title portion with proper casing from original
      let extracted = positionSearchArea.substring(idx, idx + title.length).trim();

      // Try to expand for compound titles: "Full Stack Developer | Digital Marketer"
      const afterTitle = positionSearchArea.substring(idx + title.length, idx + title.length + 80);
      const continuation = afterTitle.match(/^\s*[|\/&]\s*([A-Za-z][A-Za-z\s]{2,30}?)(?=\s*[+\d@(]|\s{2,}|$)/i);
      if (continuation) {
        extracted = positionSearchArea.substring(idx, idx + title.length + continuation[0].length).trim();
      }

      // Clean: remove any emails, phones that may have snuck in
      extracted = extracted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '').trim();
      extracted = extracted.replace(/\+?\d{10,}/g, '').trim();
      extracted = extracted.replace(/[|,\/&\s]+$/g, '').trim(); // Trailing separators

      // Title-case if all caps or all lowercase
      if (/^[A-Z\s|\/&]+$/.test(extracted) || /^[a-z\s|\/&]+$/.test(extracted)) {
        extracted = extracted.split(/\s+/).map(w =>
          ['|', '/', '&'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
      }

      if (extracted.length >= 5 && extracted.length <= 80) {
        result.position = { value: extracted, confidence: idx < 30 ? 95 : 85 };
        break;
      }
    }
  }

  // Fallback: Look for explicit "FULL STACK DEVELOPER | DIGITAL MARKETER" pattern after name
  if (result.position.confidence < 70) {
    const titleEndWords = 'DEVELOPER|ENGINEER|MANAGER|ANALYST|DESIGNER|ARCHITECT|CONSULTANT|LEAD|ADMINISTRATOR|MARKETER|SPECIALIST|COORDINATOR|EXECUTIVE|OFFICER|DIRECTOR|SCIENTIST|TESTER';
    const titleRegex = new RegExp('([A-Z][A-Za-z\\s|\\/&]+?(?:' + titleEndWords + ')(?:\\s*[|\\/&]\\s*[A-Za-z\\s]+?(?:' + titleEndWords + '))?)', 'i');
    const match = positionSearchArea.match(titleRegex);
    if (match) {
      let title = match[1].trim();
      // Title-case
      title = title.split(/\s+/).map(w =>
        ['|', '/', '&'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      if (title.length >= 5 && title.length <= 80) {
        result.position = { value: title, confidence: 75 };
      }
    }
  }

  // ════════════════════════════════════════
  // 5. SKILLS EXTRACTION (section-aware)
  // ════════════════════════════════════════
  // First try to find skills from SKILLS section
  const skillsSectionText = sections['SKILLS'] || sections['TECHNICAL SKILLS'] || sections['KEY SKILLS'] || sections['CORE COMPETENCIES'] || '';

  const foundSkills = new Set();

  // Search in skills section first (higher confidence), then full text
  const searchTexts = [
    { text: skillsSectionText.toLowerCase(), boost: 10 },
    { text: flatText.toLowerCase(), boost: 0 }
  ];

  for (const { text: searchText } of searchTexts) {
    if (!searchText) continue;
    for (const skill of SKILL_KEYWORDS) {
      // Word-boundary matching to avoid false positives (e.g., "react" in "reactive")
      const skillRegex = new RegExp('\\b' + skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[.\\s]*') + '\\b', 'i');
      if (skillRegex.test(searchText)) {
        // Capitalize skill name properly
        const properSkill = skill.split(/\s+/).map(w => {
          if (w.includes('.')) return w; // Keep node.js, asp.net, etc.
          if (w.length <= 3) return w.toUpperCase(); // CSS, PHP, SQL, etc.
          return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');
        foundSkills.add(properSkill);
      }
    }
  }

  // Also extract skills that aren't in our keyword list but appear in the skills section
  if (skillsSectionText) {
    // Clean the section content thoroughly
    const cleanedSkillSection = skillsSectionText
      .replace(/^\s*(SKILLS|TECHNICAL SKILLS|KEY SKILLS|CORE COMPETENCIES)\s*/i, '')
      .replace(/\b(Front\s*End|Back\s*End|Database|Programming|Languages?|Frameworks?|Tools?|Cloud|Web)\s*[-:–]\s*/gi, ', ') // Convert category labels to delimiters
      .replace(/\s*[-–]\s*/g, ', ') // Convert remaining dashes to commas
      .replace(/\s{2,}/g, ', ') // Convert large whitespace gaps to commas
      .trim();

    // Split on commas, semicolons, bullets, pipes
    const extraSkills = cleanedSkillSection
      .split(/[,;•|]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 2 && s.length <= 25) // Tighter max length
      .filter(s => !/^\d+$/.test(s))
      .filter(s => !['and', 'or', 'the', 'with', 'for', 'in', 'of', 'on', 'to', 'from', 'end', 'front', 'back', 'skills', 'technical', 'key', 'core', 'competencies'].includes(s.toLowerCase()))
      .filter(s => s.split(/\s+/).length <= 3); // Max 3 words per skill

    for (const skill of extraSkills.slice(0, 20)) {
      foundSkills.add(skill);
    }
  }

  if (foundSkills.size > 0) {
    // Deduplicate: normalize to lowercase for comparison, keep the prettiest version
    const skillMap = new Map();
    for (const skill of foundSkills) {
      const key = skill.toLowerCase().replace(/[.\s]+/g, '');
      // If we already have this skill, keep the shorter/cleaner version
      if (!skillMap.has(key) || skill.length < skillMap.get(key).length) {
        skillMap.set(key, skill);
      }
    }
    const dedupedSkills = [...skillMap.values()];
    result.skills = {
      value: dedupedSkills.slice(0, 15).join(', '),
      confidence: Math.min(95, 65 + dedupedSkills.length * 2)
    };
  }

  // ════════════════════════════════════════
  // 6. EDUCATION EXTRACTION (comprehensive)
  // ════════════════════════════════════════
  const educationSection = sections['EDUCATION'] || sections['ACADEMIC'] || sections['QUALIFICATION'] || sections['QUALIFICATIONS'] || '';
  const eduSearchText = educationSection || flatText;

  const educationPatterns = [
    // Full degree with field: "Master Of Science In Physics", "Bachelor Of Science"
    { regex: /(?:Master(?:'s)?|Bachelor(?:'s)?)\s+(?:of|Of|in|In)\s+(?:Science|Arts|Commerce|Engineering|Technology|Computer|Information|Business|Education|Medicine|Law|Architecture|Pharmacy|Design|Management)(?:\s+(?:in|In)\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3})?/gi, confidence: 92 },

    // Short degree codes with optional specialization
    { regex: /\b(B\.?Tech|M\.?Tech|B\.?E\.?|M\.?E\.?|MBA|MCA|BCA|M\.?Sc|B\.?Sc|B\.?Com|M\.?Com|Ph\.?D\.?|MBBS|BBA|BDS|LLB|LLM)(?:\s+(?:in|In)\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,3})?/gi, confidence: 88 },

    // Full degree names (longer form)
    { regex: /(?:Bachelor|Master|Doctorate|Diploma|Doctor)\s+(?:of|Of|in|In)\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,4}/gi, confidence: 90 },

    // "Degree from University" pattern
    { regex: /(?:B\.?Tech|M\.?Tech|B\.?E\.?|M\.?E\.?|MBA|MCA|BCA|B\.?Sc|M\.?Sc)[^,.\n]{0,50}(?:University|Institute|College|School)/gi, confidence: 85 }
  ];

  const allEducation = [];
  for (const { regex, confidence } of educationPatterns) {
    const matches = eduSearchText.match(regex);
    if (matches) {
      for (const m of matches) {
        const cleaned = m.trim().replace(/\s+/g, ' ');
        if (cleaned.length >= 3 && cleaned.length <= 80) {
          allEducation.push({ value: cleaned, confidence });
        }
      }
    }
  }

  if (allEducation.length > 0) {
    // Deduplicate: use lowercase for comparison, keep the longest version
    const eduMap = new Map();
    for (const e of allEducation) {
      // Normalize key: remove trailing single letters, extra spaces
      const cleaned = e.value.replace(/\s+[A-Z]$/g, '').replace(/\s+/g, ' ').trim();
      const key = cleaned.toLowerCase();
      if (!eduMap.has(key) || cleaned.length > eduMap.get(key).value.length) {
        eduMap.set(key, { value: cleaned, confidence: e.confidence });
      }
    }
    const uniqueEdu = [...eduMap.values()];
    uniqueEdu.sort((a, b) => b.confidence - a.confidence);

    // Combine top 2-3 degrees
    const topDegrees = uniqueEdu.slice(0, 3).map(e => e.value);
    result.education = {
      value: topDegrees.join(' | '),
      confidence: uniqueEdu[0].confidence
    };
  }

  // ════════════════════════════════════════
  // 7. EXPERIENCE EXTRACTION
  // ════════════════════════════════════════

  // Priority 1: Check for "Fresher" keyword FIRST (overrides date calculations)
  if (/\bfresher\b/i.test(flatText) || /\bfresh graduate\b/i.test(flatText) || /\bentry[\s-]?level\b/i.test(flatText) || /\bdedicated fresher\b/i.test(flatText)) {
    result.experience = { value: 'Fresher', confidence: 90 };
  }

  // Priority 2: Explicit experience mentions like "5 years of experience"
  if (result.experience.confidence < 85) {
    for (const { regex, confidence } of PATTERNS.experience) {
      const matches = flatText.match(regex);
      if (matches) {
        const expValue = matches[1] || matches[0];
        const numericExp = parseFloat(expValue);
        if (!isNaN(numericExp) && numericExp >= 0 && numericExp <= 50) {
          result.experience = {
            value: numericExp + (numericExp === 1 ? ' Year' : ' Years'),
            confidence
          };
          break;
        }
      }
    }
  }

  // Priority 3: Calculate from WORK EXPERIENCE date ranges (NOT education dates)
  if (result.experience.confidence < 70) {
    // Only look in experience/employment sections, NOT education section
    const expSectionForDates = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['PROFESSIONAL EXPERIENCE'] || sections['EMPLOYMENT'] || '';
    if (expSectionForDates) {
      const dateRanges = expSectionForDates.match(/(\d{4})\s*[-–to]+\s*(present|\d{4})/gi);
      if (dateRanges && dateRanges.length > 0) {
        let earliestStart = 9999, latestEnd = 0;
        const currentYear = new Date().getFullYear();
        for (const range of dateRanges) {
          const years = range.match(/(\d{4})/g);
          if (years && years.length >= 1) {
            const start = parseInt(years[0]);
            const end = years[1] ? (range.toLowerCase().includes('present') ? currentYear : parseInt(years[1])) : currentYear;
            if (start >= 1970 && start <= currentYear + 1) earliestStart = Math.min(earliestStart, start);
            if (end >= 1970 && end <= currentYear + 5) latestEnd = Math.max(latestEnd, end);
          }
        }
        if (earliestStart < 9999 && latestEnd > 0 && latestEnd >= earliestStart) {
          const totalYears = latestEnd - earliestStart;
          if (totalYears > 0 && totalYears <= 50) {
            result.experience = {
              value: totalYears + (totalYears === 1 ? ' Year' : ' Years'),
              confidence: 65
            };
          }
        }
      }
    }
  }

  // ════════════════════════════════════════
  // 8. COMPANY EXTRACTION
  // ════════════════════════════════════════
  const experienceSection = sections['EXPERIENCE'] || sections['WORK EXPERIENCE'] || sections['PROFESSIONAL EXPERIENCE'] || sections['EMPLOYMENT'] || '';
  const companySearchText = experienceSection || flatText;

  // Strategy: Look for company name patterns with stricter validation
  // Words that indicate the match is part of a sentence, not a standalone company name
  const SENTENCE_CONTEXT_WORDS = ['with', 'using', 'like', 'such', 'including', 'experience', 'hands-on',
    'knowledge', 'proficient', 'skilled', 'expertise', 'familiar', 'working', 'worked',
    'used', 'utilize', 'utilizing', 'various', 'multiple', 'different', 'building', 'built',
    'develop', 'developing', 'developed', 'learn', 'learning', 'learned', 'trained'];
  
  const companyPatterns = [
    // "Company Name Pvt Ltd", "ABC Technologies", etc. — require company suffix
    /([A-Z][A-Za-z\s&.]+(?:Pvt\.?\s*Ltd\.?|Private\s+Limited|Inc\.?|Corp\.?|Corporation|LLC|LLP|Limited))/g,
    // "at/with CompanyName" — require company suffix
    /(?:at|@|with)\s+([A-Z][A-Za-z\s&.]{3,40}?(?:Pvt\.?\s*Ltd\.?|Inc\.?|Corp\.?|LLC|Limited))(?:\s|$|[.,;])/gi,
    // "CompanyName - Role" or "CompanyName | Role"
    /([A-Z][A-Za-z\s&.]{5,40})\s*[-|]\s*(?:software|developer|engineer|manager|analyst|designer|lead|senior|junior|branch|assistant|vice)/gi
  ];

  for (const pattern of companyPatterns) {
    const matches = companySearchText.match(pattern);
    if (matches) {
      for (const match of matches) {
        let cleaned = match.replace(/(?:at|@|with)\s+/i, '').replace(/\s*[-|]\s*\w.*$/, '').trim();
        // Must be at least 3 chars and contain at least one company keyword
        const lowerCleaned = cleaned.toLowerCase();
        const hasCompanyKeyword = ['ltd', 'limited', 'inc', 'corp', 'corporation', 'llc', 'llp', 'pvt', 'private']
          .some(kw => lowerCleaned.includes(kw));
        
        // Check if this match appears inside a running sentence (false positive)
        const matchIdx = companySearchText.toLowerCase().indexOf(lowerCleaned);
        if (matchIdx > 0) {
          const before = companySearchText.substring(Math.max(0, matchIdx - 30), matchIdx).toLowerCase().trim();
          const lastWordBefore = before.split(/\s+/).pop();
          if (SENTENCE_CONTEXT_WORDS.includes(lastWordBefore)) continue; // Skip — it's part of a sentence
        }
        
        if (cleaned.length >= 5 && cleaned.length <= 60 && (hasCompanyKeyword || cleaned.split(/\s+/).length >= 2)) {
          // Verify it's not the candidate name
          if (result.name.value && cleaned.toLowerCase() === result.name.value.toLowerCase()) continue;
          // Verify it's not a generic phrase
          if (['web development', 'software development', 'application development'].includes(lowerCleaned)) continue;
          result.company = { value: cleaned, confidence: hasCompanyKeyword ? 85 : 70 };
          break;
        }
      }
      if (result.company.confidence > 0) break;
    }
  }

  // ════════════════════════════════════════
  // 9. LOCATION EXTRACTION
  // ════════════════════════════════════════
  const contactSection = sections['CONTACT'] || sections['CONTACT DETAILS'] || sections['PERSONAL DETAILS'] || '';
  // For location, prioritize header (near name) and contact sections over full text
  const locationSearchText = contactSection || headerText || flatText;
  const lowerLocText = locationSearchText.toLowerCase();

  // Check cities first (more specific) — require minimum city name length to avoid false matches
  for (const city of LOCATION_KEYWORDS.cities) {
    if (city.length < 3) continue; // Skip very short city names that could match random text
    const cityRegex = new RegExp('\\b' + city.replace(/[-]/g, '[-\\s]?') + '\\b', 'i');
    if (cityRegex.test(lowerLocText)) {
      // Try to get city + state together
      const cityIdx = lowerLocText.search(cityRegex);
      const surrounding = locationSearchText.substring(Math.max(0, cityIdx - 10), cityIdx + city.length + 50).trim();
      // Extract clean location: "City, State" or "City State PIN"
      const locMatch = surrounding.match(/([A-Za-z][A-Za-z\s-]{2,}(?:,\s*[A-Za-z][A-Za-z\s]+)?)/);
      let location = locMatch ? locMatch[1].trim() : city.charAt(0).toUpperCase() + city.slice(1);
      
      // Final validation: location should not contain company keywords
      const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
        'january', 'february', 'march', 'april', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const COMPANY_LOC_WORDS = ['bank', 'ltd', 'limited', 'pvt', 'private', 'inc', 'corp', 'llc', 'llp',
        'technologies', 'solutions', 'software', 'services', 'group', 'enterprises'];
      
      // Remove company words from the location
      const locWords = location.split(/\s+/);
      const cleanLocWords = locWords.filter(w => !COMPANY_LOC_WORDS.includes(w.toLowerCase()));
      location = cleanLocWords.join(' ').trim();
      
      if (location.length >= 3 && !MONTHS.includes(location.toLowerCase()) && cleanLocWords.length > 0) {
        result.location = { value: location.length <= 50 ? location : city.charAt(0).toUpperCase() + city.slice(1), confidence: 90 };
        break;
      }
    }
  }

  // Check states if no city found
  if (result.location.confidence < 70) {
    for (const state of LOCATION_KEYWORDS.states) {
      const stateRegex = new RegExp('\\b' + state.replace(/\s+/g, '\\s+') + '\\b', 'i');
      if (stateRegex.test(lowerLocText)) {
        result.location = { value: state.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), confidence: 80 };
        break;
      }
    }
  }

  // ════════════════════════════════════════
  // FINAL: Build clean response
  // ════════════════════════════════════════
  console.log('🎯 Extraction results:');
  for (const [key, val] of Object.entries(result)) {
    if (val.value) console.log(`   ${key}: "${val.value}" (${val.confidence}%)`);
    else console.log(`   ${key}: [not found]`);
  }

  return {
    name: result.name.value,
    email: result.email.value,
    contact: result.contact.value,
    position: result.position.value,
    company: result.company.value,
    experience: result.experience.value,
    location: result.location.value,
    skills: result.skills.value,
    education: result.education.value,
    confidence: {
      name: result.name.confidence,
      email: result.email.confidence,
      contact: result.contact.confidence,
      position: result.position.confidence,
      company: result.company.confidence,
      experience: result.experience.confidence,
      location: result.location.confidence,
      skills: result.skills.confidence,
      education: result.education.confidence
    }
  };
}

// ═══════════════════════════════════════════════════════════════════
// Enterprise Multi-Strategy Resume Parser
// Pipeline: pdf-parse → pdfjs-dist → OCR (tesseract.js) → result
// ═══════════════════════════════════════════════════════════════════
async function parseResume(buffer, mimetype, filename = '') {
  let text = '';
  let extractionMethod = 'none';

  try {
    if (mimetype === 'application/pdf') {
      // ── Strategy 1: pdf-parse (fast, works for most text-based PDFs) ──
      console.log('📄 [Strategy 1/3] Trying pdf-parse...');
      try {
        const data = await pdfParse(buffer);
        text = (data.text || '').trim();
        console.log(`   → pdf-parse extracted ${text.length} chars`);
        if (text.length >= 20) {
          extractionMethod = 'pdf-parse';
        }
      } catch (e) {
        console.log(`   → pdf-parse failed: ${e.message}`);
      }

      // ── Strategy 2: pdfjs-dist (handles PDFs that pdf-parse misses) ──
      if (text.length < 20 && pdfjsLib) {
        console.log('📄 [Strategy 2/3] Trying pdfjs-dist direct extraction...');
        const pdfjsText = await extractTextWithPdfJs(buffer);
        console.log(`   → pdfjs-dist extracted ${pdfjsText.length} chars`);
        if (pdfjsText.length > text.length) {
          text = pdfjsText;
          extractionMethod = 'pdfjs-dist';
        }
      }

      // ── Strategy 3: OCR via tesseract.js (for scanned/image-based PDFs) ──
      // Skip OCR in production (Render has 30s timeout, OCR takes 30-60s)
      if (text.length < 20 && Tesseract && process.env.NODE_ENV !== 'production') {
        console.log('📄 [Strategy 3/3] PDF appears image-based, running OCR...');
        const ocrText = await ocrPdfBuffer(buffer);
        console.log(`   → OCR extracted ${ocrText.length} chars`);
        if (ocrText.length > text.length) {
          text = ocrText;
          extractionMethod = 'tesseract-ocr';
        }
      } else if (text.length < 20 && process.env.NODE_ENV === 'production') {
        console.log('📄 [Strategy 3/3] Skipping OCR in production (timeout risk). PDF appears to be scanned/image-based.');
      }

      // ── textract as final fallback ──
      if (text.length < 20 && extractText) {
        console.log('📄 [Fallback] Trying textract...');
        try {
          const txText = await extractText('application/pdf', buffer);
          if (txText && txText.length > text.length) {
            text = txText;
            extractionMethod = 'textract';
          }
        } catch (e) {
          console.log(`   → textract failed: ${e.message}`);
        }
      }

    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      if (extractText) {
        text = await extractText(mimetype, buffer);
        extractionMethod = 'textract-docx';
      } else {
        throw new Error('DOCX/DOC parsing requires textract. Install it with: npm install textract');
      }

    } else if (mimetype === 'text/plain' || filename.toLowerCase().endsWith('.txt')) {
      text = buffer.toString('utf8');
      extractionMethod = 'plaintext';

    } else if (mimetype === 'application/rtf' || filename.toLowerCase().endsWith('.rtf')) {
      if (extractText) {
        text = await extractText('application/rtf', buffer);
        extractionMethod = 'textract-rtf';
      } else {
        throw new Error('RTF parsing requires textract. Install it with: npm install textract');
      }

    } else if (mimetype.startsWith('image/')) {
      // Direct image → OCR (skip in production due to timeout)
      if (Tesseract && process.env.NODE_ENV !== 'production') {
        text = await ocrImageBuffer(buffer);
        extractionMethod = 'tesseract-image-ocr';
      } else {
        throw new Error('This is an image file. Please upload a text-based PDF, DOCX, or TXT resume instead. Image/scanned resumes are not supported on cloud hosting.');
      }

    } else {
      throw new Error(`Unsupported file type: ${mimetype}. Supported: PDF, DOCX, DOC, TXT, RTF, Images`);
    }

    // ── Final validation ──
    const cleanText = (text || '').trim();
    console.log(`\n══════════════════════════════════════════`);
    console.log(`📊 Extraction Summary:`);
    console.log(`   File: ${filename}`);
    console.log(`   Method: ${extractionMethod}`);
    console.log(`   Characters: ${cleanText.length}`);
    console.log(`   Preview: "${cleanText.substring(0, 150)}..."`);
    console.log(`══════════════════════════════════════════\n`);

    if (cleanText.length === 0) {
      const strategies = ['pdf-parse'];
      if (pdfjsLib) strategies.push('pdfjs-dist');
      if (Tesseract && process.env.NODE_ENV !== 'production') strategies.push('tesseract-ocr');
      if (extractText) strategies.push('textract');

      // Check if OCR was attempted
      const ocrAttempted = Tesseract && process.env.NODE_ENV !== 'production';
      const errorMsg = ocrAttempted
        ? 'Could not extract text from this PDF even with OCR. The image quality may be too low or the PDF may be corrupted. ' +
          'Try uploading a clearer scan or a text-based PDF/DOCX file.'
        : 'This resume appears to be a scanned/image-based PDF. ' +
          'Please upload a text-based PDF or DOCX file instead. ' +
          'Tip: Open the PDF, try selecting text — if you can\'t select text, it\'s a scanned image.';

      throw new Error(errorMsg);
    }

    const parsed = extractFields(cleanText);

    // Log parsing results for debugging
    console.log('Resume parsing completed:', {
      filename,
      extractedFields: Object.keys(parsed).filter(k => parsed[k] && k !== 'confidence'),
      confidence: parsed.confidence
    });

    return parsed;

  } catch (error) {
    console.error('Resume parsing error:', error);
    throw new Error(`Resume parsing failed: ${error.message}`);
  }
}

module.exports = { parseResume };
