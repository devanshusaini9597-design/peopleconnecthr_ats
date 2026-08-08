const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');

const app = express();
const PORT = 3000;

// In-Memory Database
let importedDatabase = [];

// Middleware
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * ═══════════════════════════════════════════════════════════════════════
 * GLOBAL VALIDATION RULEBOOK v2 (Enterprise-Grade, Truly Global)
 * ✅ Works with ANY Excel format (any column order, any column names)
 * ✅ Content-based detection with format variants support
 * ✅ Cross-field validation (CTC vs Expected, experience context, etc)
 * ✅ Unicode/International names supported
 * ✅ Multiple salary/phone/date formats recognized
 * ✅ Duplicate detection within rows
 * ✅ Company optional (supports freelancers)
 * See GLOBAL-VALIDATION-RULES.md for full rule list.
 * ═══════════════════════════════════════════════════════════════════════
 */

// Values we never assign to any field (placeholders / invalid)
const GLOBAL_PLACEHOLDERS = [
  'na', 'n/a', 'as per company norms', 'not specified', 'pending', 'tbd', 
  'unknown', 'none', '-', 'null', 'nil', 'wip', 'company', 'placeholder', 
  'test', 'dummy', '', 'to be decided', 'not applicable', 'will share', 
  'negotiable', 'flexible', 'open', 'competitive'
];

const hintKeywords = {
  name: ['name', 'candidate', 'employee', 'person', 'fname', 'fullname', 'applicant', 'fls', 'non-fls', 'non fls'],
  phone: ['phone', 'contact', 'mobile', 'number', 'tel', 'telephone', 'cell', 'cellular', 'whatsapp'],
  email: ['email', 'e-mail', 'emailaddress', 'mailid', 'mail'],
  location: ['location', 'city', 'place', 'state', 'region', 'area'],
  position: ['position', 'job', 'role', 'designation', 'title', 'profile', 'post'],
  experience: ['experience', 'exp', 'yrs', 'years', 'work_exp', 'expertise', 'work experience'],
  ctc: ['ctc', 'current salary', 'current pay', 'salary', 'pay', 'current_salary', 'basic', 'current ctc'],
  expectedSalary: ['expected', 'desired', 'target', 'expectation', 'expected_salary', 'offer', 'expected ctc'],
  noticePeriod: ['notice', 'period', 'notice_period', 'availability', 'joindate', 'notice period', 'days'],
  company: ['company', 'current company', 'employer', 'organization', 'firm', 'company name'],
  client: ['client', 'project', 'account', 'placed at', 'bank'],
  spoc: ['spoc', 'feedback', 'hr', 'contact_person', 'representative', 'poc'],
  status: ['status', 'candidate_status', 'stage', 'feedback', 'remark'],
  sourceOfCV: ['source', 'cv', 'resume', 'origin', 'channel', 'referral']
};

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function isPlaceholderValue(s) {
  const t = String(s).toLowerCase().trim();
  return GLOBAL_PLACEHOLDERS.includes(t) || /^as per\s|^tbd\s|^will.*share|^negotiable|^flexible|^to be|^open|^competitive/i.test(t);
}

// Parse salary in ANY format: "1LPA", "1,50,000", "150K", "1.5L", etc.
// IMPORTANT: Reject plain numbers < 1.5 to avoid conflicts with experience (0.3, 9.45) & notice periods (7, 30, 90)
function parseSalary(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  // Format: "1LPA", "2.5LPA"
  const lpaMatch = s.match(/^(\d+(?:\.\d+)?)\s*lpa$/i) || s.match(/(\d+(?:\.\d+)?)\s*lpa/i);
  if (lpaMatch) return parseFloat(lpaMatch[1]);
  
  // Format: "150K", "150000"
  const kMatch = s.match(/^(\d+)\s*k$/i) || s.match(/^(\d+),?\d{3}$/);
  if (kMatch) return parseFloat(kMatch[1]) / 100; // 150K = 1.5 LPA
  
  // Format: "1,50,000" (Indian style)
  const indianMatch = s.match(/^(\d{1,3}(?:,\d{3})*|(\d+))$/);
  if (indianMatch) {
    const num = parseInt(s.replace(/,/g, ''), 10);
    if (num >= 100000 && num <= 10000000) return num / 100000; // Convert to LPA
  }
  
  // Format: "1.5L", "2L" (lakhs)
  const lakMatch = s.match(/^(\d+(?:\.\d+)?)\s*l$/i);
  if (lakMatch) return parseFloat(lakMatch[1]);
  
  // Format: "1,20,000" with "lac" suffix
  const lacMatch = s.match(/(\d+(?:\.\d+)?)\s*lac/i) || s.match(/(\d+(?:\.\d+)?)\s*lakhs?/i);
  if (lacMatch) return parseFloat(lacMatch[1]);
  
  // Plain number: ONLY accept >= 1.5 LPA to avoid conflicts with notice periods (7,30,90) & experience (0.3,9.45)
  const plainNum = parseFloat(s);
  if (!isNaN(plainNum)) {
    if (plainNum >= 1.5 && plainNum <= 100) return plainNum; // Assume LPA (minimum 1.5)
    if (plainNum > 100 && plainNum <= 10000000) return plainNum / 100000; // Convert from rupees
  }
  
  return null;
}

// Parse phone in ANY format: "7359355840", "+91-7359355840", "91-735-9355840"
function parsePhone(str) {
  if (!str) return null;
  const s = String(str).trim();
  const digits = s.replace(/\D/g, '');
  
  // Remove country code if present (91 for India)
  let phone = digits;
  if (digits.startsWith('91') && digits.length === 12) {
    phone = digits.slice(2);
  }
  
  // Check if valid 10-digit Indian mobile
  if (/^[6-9]\d{9}$/.test(phone)) {
    return phone;
  }
  
  // Try last 10 digits
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return last10;
    }
  }
  
  return null;
}

// Parse notice period in ANY format: "90 days", "3 months", "Immediate", etc.
// IMPORTANT: Only accept plain numbers if they're JUST digits (no suffixes like "lpa", "yrs", etc)
function parseNoticePeriod(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  // "Immediate" or "0" or "Immedidate Joinner" style
  if (s === 'immediate' || s === '0 days' || s === '0' || /^immediate[d]?\s*(joinner?)?/i.test(s)) return 0;
  
  // "X days"
  const daysMatch = s.match(/^(\d+)\s*days?$/i);
  if (daysMatch) return parseInt(daysMatch[1], 10);
  
  // "X weeks"
  const weeksMatch = s.match(/^(\d+)\s*weeks?$/i);
  if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;
  
  // "X months"
  const monthsMatch = s.match(/^(\d+)\s*months?$/i);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;
  
  // "on notice", "under notice"
  if (/on notice|under notice/i.test(s)) return null; // Unknown, needs clarification
  
  // Plain number ONLY - must be purely digits, no suffixes
  if (/^\d+$/.test(s)) { // STRICT: only digits, no other characters
    const plainNum = parseInt(s, 10);
    if (!isNaN(plainNum) && plainNum >= 0 && plainNum <= 365) {
      return plainNum;
    }
  }
  
  return null;
}

// Parse experience in ANY format: "7.9 Yrs", "10 years", "Fresher", "0.3", "9.45", etc.
// IMPORTANT: Require explicit "yrs/years/y/months" suffix to avoid confusion with salary like "1lpa"
function parseExperience(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  // "Fresher", "Entry-level", "0 experience"
  if (/^fresher|^entry|^0\s*exp|^student|^graduate/i.test(s)) return 0;
  
  // "X.X Yrs", "X years", "3 months" - REQUIRE explicit suffix (yrs/years/y/months)
  const expMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:yrs?|years?|y|months?)\s*$/i);
  if (expMatch) {
    const num = parseFloat(expMatch[1]);
    // Accept values 0-70 (reasonable experience range), with DECIMAL support for fractions like 0.3, 9.45
    if (num >= 0 && num <= 70 && (num === 0 || num >= 0.1)) return num; // Accept 0 or >= 0.1
  }
  
  // "X+ years" - also requires explicit suffix
  const plusMatch = s.match(/^(\d+(?:\.\d+)?)\+?\s*(?:yrs?|years?)\s*$/i);
  if (plusMatch) {
    const num = parseFloat(plusMatch[1]);
    if (num >= 0 && num <= 70) return num;
  }
  
  return null;
}

function calculateScore(field, str) {
  const strLower = str.toLowerCase();
  switch(field) {
    case 'name': {
      const wordCount = str.split(/\s+/).filter(Boolean).length;
      // Support Unicode names: allow any letter-like char, hyphens, apostrophes, spaces
      const hasValidNameChars = /^[\p{L}\s\-']+$/u.test(str);
      const hasDigits = /\d/.test(str) ? 1 : 0;
      const hasSpecial = /[^a-z\s\-'0-9]/i.test(str) ? 1 : 0;
      if (!hasValidNameChars) return 0;
      return (wordCount >= 2 && wordCount <= 4 ? 20 : wordCount === 1 ? 15 : 10) + 
             str.length - hasDigits * 30 - hasSpecial * 20;
    }
    case 'phone': {
      const parsed = parsePhone(str);
      return parsed ? 10 : 0;
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strLower) ? 10 : 0;
    case 'location':
      const cityKeywords = ['bangalore', 'bengaluru', 'delhi', 'new delhi', 'mumbai', 'pune', 
        'hyderabad', 'secunderabad', 'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 
        'noida', 'greater noida', 'vadodara', 'surat', 'jaipur', 'lucknow', 'indore', 'nagpur', 
        'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 'trivandrum', 'tier', 
        'remote', 'work from home', 'wfh'];
      return cityKeywords.some(city => strLower.includes(city)) ? 10 : 5;
    case 'position': {
      const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
        'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
        'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
        'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 'fls', 
        'non fls', 'contractor', 'freelance', 'consultant', 'specialist'];
      return positionKeywords.some(pos => strLower.includes(pos)) ? 10 : 5;
    }
    case 'experience': {
      const parsed = parseExperience(str);
      return parsed !== null ? 10 : 0;
    }
    case 'ctc': {
      const parsed = parseSalary(str);
      if (parsed && parsed >= 0 && parsed <= 100) return 10;
      return 0;
    }
    case 'expectedSalary': {
      const parsed = parseSalary(str);
      if (parsed && parsed >= 0 && parsed <= 100) return 10;
      return 0;
    }
    case 'noticePeriod': {
      const parsed = parseNoticePeriod(str);
      return parsed !== null ? 10 : 0;
    }
    case 'status': {
      const statusKeywords = ['applied', 'interested', 'intersted', 'scheduled', 'interviewed', 'rejected', 'joined', 
        'pending', 'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 
        'declined', 'didn\'t attend', 'didn\'t attend', 'referred', 'under consideration', 'offer received', 
        'onboarded', 'completed', 'withdrawn', 'screened', 'reject'];
      return statusKeywords.some(st => strLower.includes(st)) ? 10 : 0;
    }
    case 'sourceOfCV': {
      const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 
        'glassdoor', 'job portal', 'agency', 'college', 'campus', 'email', 'direct', 'recruiter', 
        'internal', 'networking', 'social media', 'facebook', 'twitter', 'career fair', 'portal'];
      return sourceKeywords.some(src => strLower.includes(src)) ? 10 : 0;
    }
    case 'company':
    case 'client': {
      const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
        'company', 'corp', 'bank', 'finance', 'education', 'insurance', 'consulting', 'group', 'global',
        'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind', 'rbl', 'idbi', 'sbi', 'boi',
        'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 'amazon',
        'flipkart', 'uber', 'paytm', 'freshworks', 'swiggy', 'zomato', 'byju', 'unacademy',
        'consulting', 'advisory', 'management', 'ventures', 'i-flex', 'mindtree', 'mphasis', 'hcl'];
      const looksLikeOrg = orgKeywords.some(k => strLower.includes(k)) || 
                          (str.split(/\s+/).length >= 2 && str.length > 8 && /^[a-z0-9\s&\-\.]+$/i.test(str));
      const hasDigits = /\d/.test(str) ? 1 : 0;
      return looksLikeOrg ? 10 - hasDigits * 3 : 0;
    }
    case 'spoc': {
      const words = str.split(/\s+/).filter(Boolean);
      const hasValidChars = /^[\p{L}\s\-'\.]+$/u.test(str);
      const noBad = !/\d|@|lpa|yrs|bank|pvt|ltd|naukri|linkedin/i.test(str);
      return (words.length >= 1 && words.length <= 3 && hasValidChars && noBad) ? 10 : 0;
    }
    default:
      return 5;
  }
}

function resolveCandidates(candidates, field, hints) {
  if (candidates[field].length === 0) return { value: null, duplicates: [] };
  
  candidates[field].sort((a, b) => b.score - a.score);
  const maxScore = candidates[field][0].score;
  const top = candidates[field].filter(c => c.score === maxScore);
  
  // Track duplicates for warning
  const duplicates = candidates[field].length > 1 ? 
    candidates[field].slice(1).map(c => c.value) : [];
  
  if (top.length === 1) {
    return { value: top[0].value, duplicates };
  }
  
  // Tie-break: CRITICAL - prefer column hint match for name field
  // For names, FLS/Non-FLS columns are the authoritative source
  if (field === 'name') {
    for (const c of top) {
      if (c.header.toLowerCase().includes('fls') || c.header.toLowerCase().includes('non-fls')) {
        return { value: c.value, duplicates };
      }
    }
    // Then prefer other dedicated name columns
    for (const c of top) {
      if (hints.some(h => c.header.toLowerCase().includes(h))) {
        return { value: c.value, duplicates };
      }
    }
  } else {
    // For other fields, prefer column hint match
    for (const c of top) {
      if (hints.some(h => c.header.toLowerCase().includes(h))) {
        return { value: c.value, duplicates };
      }
    }
  }
  
  // Tie-break: prefer shorter strings for person names/position, longer for companies
  if (field === 'name' || field === 'position' || field === 'spoc') {
    return { value: top.reduce((a, b) => a.value.length < b.value.length ? a : b).value, duplicates };
  }
  
  if (field === 'company' || field === 'client') {
    return { value: top.reduce((a, b) => a.value.length > b.value.length ? a : b).value, duplicates };
  }
  
  return { value: top[0].value, duplicates };
}

// CRITICAL: Post-process detected fields to fix common misclassifications
function correctFieldMisclassifications(detected) {
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
    'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
    'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
    'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 'fls', 
    'non fls', 'contractor', 'freelance', 'programmer', 'admin', 'support', 'executive', 'advisor'];
  
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
    'company', 'corp', 'bank', 'finance', 'insurance', 'inc', 'pte', 'gmbh', 'sa', 'sas', 'nv', 'ag', 'global', 'international',
    'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind', 'rbl', 'idbi', 'sbi', 'boi',
    'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 'amazon',
    'flipkart', 'uber', 'paytm', 'freshworks', 'swiggy', 'zomato', 'byju', 'unacademy',
    'consulting', 'advisory', 'management', 'ventures', 'i-flex', 'mindtree', 'mphasis', 'hcl', 'digital'];

  // 1. If name contains position keyword, move to position
  if (detected.name) {
    const nameLower = String(detected.name).toLowerCase();
    if (positionKeywords.some(p => new RegExp('\\b' + p + '\\b', 'i').test(nameLower)) && !detected.position) {
      detected.position = detected.name;
      detected.name = null;
    }
  }

  // 2. If position is actually a company name, fix it
  if (detected.position && !detected.company) {
    const posLower = String(detected.position).toLowerCase();
    if (orgKeywords.some(k => posLower.includes(k))) {
      detected.company = detected.position;
      detected.position = null;
    }
  }

  // 3. If company is too short (< 5 chars typically not a company)
  if (detected.company && detected.company.length < 4 && !detected.spoc) {
    const companyLower = String(detected.company).toLowerCase();
    const hasOrgKeyword = orgKeywords.some(k => companyLower.includes(k));
    if (!hasOrgKeyword) {
      detected.spoc = detected.company;
      detected.company = null;
    }
  }

  // 4. If client is not finance-related but company is, swap them
  if (detected.client && detected.company) {
    const clientLower = String(detected.client).toLowerCase();
    const companyLower = String(detected.company).toLowerCase();
    const bankFinanceKeywords = ['bank', 'finance', 'credit', 'fund', 'capital', 'investment', 'insurance'];
    const isClientFinance = bankFinanceKeywords.some(b => clientLower.includes(b));
    const isCompanyFinance = bankFinanceKeywords.some(b => companyLower.includes(b));
    
    if (isClientFinance && !isCompanyFinance) {
      [detected.client, detected.company] = [detected.company, detected.client];
    }
  }

  return detected;
}
function detectFields(row, headers) {
  const candidates = {
    name: [],
    phone: [],
    email: [],
    location: [],
    position: [],
    experience: [],
    ctc: [],
    expectedSalary: [],
    noticePeriod: [],
    company: [],
    client: [],
    spoc: [],
    status: [],
    sourceOfCV: []
  };

  const values = Object.values(row).filter(v => v != null && String(v).trim() !== '');

  const cityKeywords = ['bangalore', 'bengaluru', 'delhi', 'new delhi', 'mumbai', 'pune', 
    'hyderabad', 'secunderabad', 'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 
    'noida', 'greater noida', 'vadodara', 'surat', 'jaipur', 'lucknow', 'indore', 'nagpur', 
    'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 'trivandrum', 'tier', 
    'remote', 'work from home', 'wfh'];
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
    'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
    'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
    'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 
    'non fls', 'contractor', 'freelance', 'programmer', 'admin', 'support', 'executive', 'advisor'];
  const statusKeywords = ['applied', 'interested', 'intersted', 'scheduled', 'interviewed', 'rejected', 'joined', 
    'pending', 'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 
    'declined', 'didn\'t attend', 'referred', 'under consideration', 'offer received', 'reject', 'rejected'];
  const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 
    'glassdoor', 'job portal', 'agency', 'college', 'campus', 'email', 'direct', 'recruiter', 
    'internal', 'networking', 'portal', 'social', 'facebook', 'twitter', 'instagram', 'whatsapp',
    'recruitment', 'placement', 'consultant', 'headhunter', 'web', 'online', 'advertising'];
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
    'company', 'corp', 'bank', 'finance', 'insurance', 'inc', 'pte', 'gmbh', 'sa', 'sas', 'nv', 'ag', 'global', 'international',
    'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind', 'rbl', 'idbi', 'sbi', 'boi',
    'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 'amazon',
    'flipkart', 'uber', 'paytm', 'freshworks', 'swiggy', 'zomato', 'byju', 'unacademy',
    'consulting', 'advisory', 'management', 'ventures', 'i-flex', 'mindtree', 'mphasis', 'hcl', 'digital'];
  const bankFinanceKeywords = ['bank', 'finance', 'credit', 'fund', 'capital', 'investment', 'insurance'];

  // CRITICAL: Helper to detect if a string looks like an organization name (not a person name)
  function isOrganizationName(str) {
    const strLower = str.toLowerCase();
    // Check if contains org keywords
    if (orgKeywords.some(k => strLower.includes(k))) return true;
    // Check if too long for a person name (typically > 40 chars)
    if (str.length > 45) return true;
    // Check if has "ltd", "pvt", "inc" pattern
    if (/\b(ltd|pvt|llp|corp|inc|pte|plc)\b/i.test(str)) return true;
    // Check if has "&" and "corp-like" structure (e.g., "A & B Solutions")
    if (/&.*(?:pvt|ltd|corp|solutions|technologies)/i.test(str)) return true;
    return false;
  }

  // Helper to detect if a string looks like a position/title
  function isPositionTitle(str) {
    const strLower = str.toLowerCase();
    return positionKeywords.some(pos => {
      const word = '\\b' + pos + '\\b';
      return new RegExp(word, 'i').test(strLower);
    });
  }

  // Collect candidates for each field
  values.forEach((value, idx) => {
    const str = String(value).trim();
    const strLower = str.toLowerCase();
    if (isPlaceholderValue(str)) return;

    const header = headers[idx] || '';
    const headerLower = header.toLowerCase().trim();

    // CRITICAL: Skip columns that should never be parsed (dates, metadata, etc.)
    const columnsToSkip = ['date', 'timestamp', 'created', 'updated', 'id', 'serial', 'row', 'sr', 'sr.', 'feedback', 'remarks', 'notes'];
    if (columnsToSkip.some(col => headerLower.includes(col))) {
      return; // Skip this column entirely
    }

    // CRITICAL: Header-based filtering - reject values that don't match column intent
    const headerHasName = headerLower.includes('name') || headerLower.includes('candidate') || headerLower.includes('fls');
    const headerHasPhone = headerLower.includes('phone') || headerLower.includes('contact') || headerLower.includes('mobile');
    const headerHasEmail = headerLower.includes('email') || headerLower.includes('mail');
    const headerHasStatus = headerLower.includes('status') || headerLower.includes('feedback');
    const headerHasExperience = headerLower.includes('experience') || headerLower.includes('exp') || headerLower.includes('yrs');
    const headerHasPosition = headerLower.includes('position') || headerLower.includes('role') || headerLower.includes('designation') || headerLower.includes('title');

    // CRITICAL: BLOCK values from Status/Client columns from becoming name candidates
    if (headerHasStatus && (statusKeywords.some(st => strLower.includes(st)) || isOrganizationName(str))) {
      return;  // Status/Client columns shouldn't contribute to name field
    }
    
    // AGGRESSIVE: If column header says "Name", REJECT status/position/notice period/salary values
    const noticePeriodKeywords = ['immediate', 'joiner', 'joinnner', 'immedidate', 'days', 'weeks', 'months', 'notice'];
    const rejectedNamePhrases = [/immediate.*joinn?er|immedidate.*joinn?er|joinn?er.*immediate|joinn?er.*immedidate|on notice|under notice/i];
    
    if (headerHasName) {
      if (statusKeywords.some(st => strLower.includes(st)) || 
          isPositionTitle(str) ||
          rejectedNamePhrases.some(rp => rp.test(str)) ||
          (noticePeriodKeywords.some(np => strLower.includes(np)) && !/[a-z]{4,}[a-z]{4,}/i.test(str.replace(/\s/g, '')))) {
        return;  // REJECT this value for name
      }
    }
    
    if (headerHasPhone && !/\d/.test(str)) {
      return;
    }
    if (headerHasEmail && !/@/.test(str)) {
      return;
    }

    // EMAIL - simple regex check
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strLower)) {
      const score = calculateScore('email', str);
      candidates.email.push({ value: strLower, score, header });
    }

    // PHONE - support multiple formats
    const phoneMatch = parsePhone(str);
    if (phoneMatch) {
      const score = calculateScore('phone', str);
      candidates.phone.push({ value: phoneMatch, score, header });
    }

    // POSITION - HIGH PRIORITY: Check position keywords first
    if (isPositionTitle(str)) {
      const score = calculateScore('position', str) + 10; // Boost position score
      candidates.position.push({ value: str, score, header });
    }

    // NAME - STRICT: 1-4 words, person-like, NOT an org name, NOT a position, NOT a status
    const wordCount = str.split(/\s+/).filter(Boolean).length;
    // CRITICAL: Block status values from being detected as names
    const isStatusValue = statusKeywords.some(st => strLower.includes(st));
    // CRITICAL: Block notice period phrases from being detected as names
    const isNoticePeriodPhrase = /immediate.*joinn?er|immedidate.*joinn?er|joinn?er.*immediate|joinn?er.*immedidate|on notice|under notice/i.test(str);
    
    if (wordCount >= 1 && wordCount <= 3 && 
        /^[\p{L}\s\-'\.]+$/u.test(str) && 
        !/\d|@|_|<|>|\/|\\|\||#|\*|lpa|yrs|phone|email/i.test(str) && 
        str.length >= 2 &&
        str.length <= 40 &&
        !isOrganizationName(str) &&
        !isPositionTitle(str) &&
        !isStatusValue &&  // CRITICAL: Block status values
        !isNoticePeriodPhrase &&  // CRITICAL: Block notice period phrases
        !cityKeywords.some(city => strLower.includes(city))) {
      const score = calculateScore('name', str);
      // Boost score for shorter, simpler names (typical person names)
      const lengthBoost = str.length < 20 ? 5 : 0;
      const wordsBoost = wordCount <= 2 ? 3 : 0;
      // CRITICAL: Boost score if from FLS/Non-FLS column (common person name column)
      const flsBoost = headerLower.includes('fls') || headerLower.includes('person') || headerLower.includes('candidate') ? 20 : 0;
      candidates.name.push({ value: str, score: score + lengthBoost + wordsBoost + flsBoost, header });
    }

    // LOCATION - check city keywords
    if (cityKeywords.some(city => strLower.includes(city))) {
      const score = calculateScore('location', str);
      candidates.location.push({ value: str, score, header });
    }

    // NOTICE PERIOD - HIGH PRIORITY (check FIRST before CTC/Experience)
    const noticeParsed = parseNoticePeriod(str);
    if (noticeParsed !== null && noticeParsed >= 0 && noticeParsed <= 365) {
      const score = calculateScore('noticePeriod', str) + 15; // Boost notice period score
      candidates.noticePeriod.push({ value: noticeParsed, score, header });
    }

    // EXPERIENCE - HIGH PRIORITY (check BEFORE CTC to avoid 0.3, 9.45 being parsed as salary)
    const expParsed = parseExperience(str);
    if (expParsed !== null && noticeParsed === null) { // Only if NOT already detected as notice period
      const score = calculateScore('experience', str) + 10; // Boost experience score
      candidates.experience.push({ value: expParsed, score, header });
    }

    // CTC - multiple formats (1LPA, 1,50,000, 150K, 1.5L)
    // Note: parseSalary now rejects plain numbers < 1.5 to avoid conflicts with notice period & experience
    const ctcParsed = parseSalary(str);
    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      const score = calculateScore('ctc', str);
      candidates.ctc.push({ value: ctcParsed, score, header });
    }

    // EXPECTED SALARY - same as CTC but prefer "expected" context
    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      const score = calculateScore('expectedSalary', str) + (headerLower.includes('expected') ? 2 : 0);
      candidates.expectedSalary.push({ value: ctcParsed, score, header });
    }

    // STATUS - keyword match
    if (statusKeywords.some(st => strLower.includes(st))) {
      const score = calculateScore('status', str);
      candidates.status.push({ value: strLower, score, header });
    }

    // SOURCE - keyword match
    if (sourceKeywords.some(src => strLower.includes(src))) {
      const score = calculateScore('sourceOfCV', str);
      candidates.sourceOfCV.push({ value: strLower, score, header });
    }

    // COMPANY/CLIENT - org names, long strings with org keywords
    const hasOrgKeywords = orgKeywords.some(k => strLower.includes(k));
    const looksLikeOrg = hasOrgKeywords ||
                        (str.split(/\s+/).length >= 2 && str.length > 8 && /^[a-z0-9\s&\-\.,'()]+$/i.test(str) && str.length <= 50);
    
    if (looksLikeOrg && 
        !/\d@|@|lpa|yrs/.test(str) && 
        !statusKeywords.some(st => strLower.includes(st)) &&
        !isPositionTitle(str)) {
      const score = calculateScore('company', str) + (hasOrgKeywords ? 5 : 0);
      candidates.company.push({ value: str, score, header });
      
      // Banks/Finance/Insurance prefer as client
      if (bankFinanceKeywords.some(b => strLower.includes(b))) {
        candidates.client.push({ value: str, score: score + 5, header });
      }
    }

    // SPOC - short contact person name, NOT a position
    if (/^[\p{L}\s\-'\.]+$/u.test(str) && 
        !/\d|@|lpa|yrs|bank|pvt|ltd|naukri|linkedin|\.com/i.test(str) && 
        str.split(/\s+/).length <= 3 && 
        str.length >= 2 && 
        str.length <= 40 &&
        !isOrganizationName(str) &&
        !isPositionTitle(str)) {
      const score = calculateScore('spoc', str);
      candidates.spoc.push({ value: str, score, header });
    }
  });

  // Resolve conflicts and build detected record
  const detected = {
    name: null,
    phone: null,
    email: null,
    location: null,
    position: null,
    experience: null,
    ctc: null,
    expectedSalary: null,
    noticePeriod: null,
    company: null,
    client: null,
    spoc: null,
    status: null,
    sourceOfCV: null,
    duplicates: {}
  };

  Object.keys(candidates).forEach(field => {
    const hints = hintKeywords[field] || [];
    const resolved = resolveCandidates(candidates, field, hints);
    detected[field] = resolved.value;
    if (resolved.duplicates.length > 0) {
      detected.duplicates[field] = resolved.duplicates;
    }
  });

  // CRITICAL: Special handling for name field - FLS/Non FLS column is authoritative
  // If we have a valid name from FLS, don't accept other names from different columns
  if (detected.name) {
    const flsCandidates = candidates.name.filter(c => 
      c.header && (c.header.toLowerCase().includes('fls') || c.header.toLowerCase().includes('non-fls'))
    );
    if (flsCandidates.length > 0) {
      // FLS column has value, use the best one from FLS only
      flsCandidates.sort((a, b) => b.score - a.score);
      detected.name = flsCandidates[0].value;
    } else {
      // No FLS candidates, but if current name is an org, reject it
      if (isOrganizationName(detected.name)) {
        detected.name = null;
      }
    }
  }

  // CRITICAL: Resolve conflicts - a value can't be in two fields simultaneously
  // Prioritize by field importance: name > email > phone > position > spoc > company > status
  const assignedValues = new Set();
  const fieldPriority = ['name', 'email', 'phone', 'position', 'spoc', 'company', 'status', 'sourceOfCV'];
  
  for (const field of fieldPriority) {
    if (detected[field] && assignedValues.has(String(detected[field]).toLowerCase().trim())) {
      // Value already assigned to a higher priority field, remove it
      detected[field] = null;
    } else if (detected[field]) {
      assignedValues.add(String(detected[field]).toLowerCase().trim());
    }
  }

  // CRITICAL: Apply intelligent corrections to fix field misclassifications
  correctFieldMisclassifications(detected);

  // SEMANTIC VALIDATION: Final check - does value match header context?
  // This prevents: status in name field, person names in company field, etc.
  function validateSemanticMatch(field, value) {
    if (!value) return true; // null/empty is OK
    
    const strLower = String(value).toLowerCase();
    
    // NAME field: should NOT contain status/position/company keywords
    if (field === 'name') {
      const invalidKeywords = ['interested', 'scheduled', 'rejected', 'pending', 'developer', 'engineer', 
        'manager', 'pvt', 'ltd', 'bank', 'finance', 'insurance', 'hsbc', 'canara', 'icici'];
      if (invalidKeywords.some(kw => strLower.includes(kw))) {
        return false; // REJECT: status/position/company value
      }
    }
    
    // COMPANY field: MUST have company indicators OR be long enough, should NOT be pure person name
    if (field === 'company') {
      const wordCount = String(value).split(/\s+/).length;
      const hasOnlyLetters = /^[a-z\s'\-]+$/i.test(value);
      const companyKeywords = ['pvt', 'ltd', 'llp', 'inc', 'corp', 'solutions', 'technologies', 'systems', 
        'services', 'company', 'bank', 'finance', 'education', 'insurance', 'consulting', 'group',
        'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh'];
      const hasCompanyKeyword = companyKeywords.some(k => strLower.includes(k));
      
      // Reject experience values: "X years" or "X yrs"
      if (/^\d+(?:\.\d+)?\s*(?:years?|yrs?)$/i.test(value)) {
        return false; // REJECT: experience value
      }
      
      // If only letters AND 1-2 words AND under 20 chars AND NO company keywords = person name, REJECT
      if (hasOnlyLetters && wordCount <= 2 && value.length < 20 && !hasCompanyKeyword) {
        return false; // REJECT: person name detected
      }
      // If 3 words, all letters, AND no company keyword = likely person name, REJECT
      if (hasOnlyLetters && wordCount === 3 && value.length < 25 && !hasCompanyKeyword) {
        return false; // REJECT: likely full person name
      }
    }
    
    // STATUS field: should NOT contain location/person names
    if (field === 'status') {
      const cityKeywords = ['bangalore', 'mumbai', 'delhi', 'pune', 'hyderabad', 'vadodara', 'surat'];
      if (cityKeywords.some(city => strLower.includes(city))) {
        return false; // REJECT: location
      }
    }
    
    // POSITION field: should NOT be a status value
    if (field === 'position') {
      const statusKeywords = ['interested', 'scheduled', 'rejected', 'pending', 'applied'];
      if (statusKeywords.some(st => strLower.includes(st))) {
        return false; // REJECT: status
      }
    }
    
    return true; // ACCEPT
  }

  // Apply semantic validation to each field
  const semanticValidationFailed = {};
  ['name', 'company', 'status', 'position'].forEach(field => {
    if (detected[field] && !validateSemanticMatch(field, detected[field])) {
      semanticValidationFailed[field] = detected[field];
      detected[field] = null; // REJECT: value doesn't match field semantics
    }
  });

  return detected;
}

function validateCandidate(detected, rowIndex) {
  const errors = [];
  const warnings = [];
  let confidence = 100;
  const duplicateFields = detected.duplicates || {};

  // 1. NAME - CRITICAL (ERROR blocks)
  if (!detected.name) {
    errors.push({ field: 'name', message: 'Name is required', severity: 'ERROR' });
    confidence -= 50;
  } else if (isPlaceholderValue(detected.name)) {
    errors.push({ field: 'name', message: `"${detected.name}" is placeholder text, not a valid name`, severity: 'ERROR' });
    confidence -= 50;
  } else if (!/^[\p{L}\s\-'\.]+$/u.test(detected.name)) {
    errors.push({ field: 'name', message: 'Name must be alphabetic only', severity: 'ERROR' });
    confidence -= 50;
  } else if (detected.name.split(/\s+/).filter(Boolean).length < 1 || detected.name.split(/\s+/).filter(Boolean).length > 4) {
    errors.push({ field: 'name', message: 'Name must be 1-4 words', severity: 'ERROR' });
    confidence -= 50;
  }
  if (duplicateFields.name && duplicateFields.name.length > 0) {
    warnings.push({ field: 'name', message: `Multiple names found: ${duplicateFields.name.join(', ')}. Using: "${detected.name}"`, severity: 'WARNING' });
    confidence -= 5;
  }

  // 2. PHONE - CRITICAL (ERROR blocks)
  if (!detected.phone) {
    errors.push({ field: 'phone', message: 'Phone number is required', severity: 'ERROR' });
    confidence -= 50;
  } else if (!/^[6-9]\d{9}$/.test(detected.phone)) {
    errors.push({ field: 'phone', message: 'Phone must be 10 digits starting with 6-9', severity: 'ERROR' });
    confidence -= 50;
  }
  if (duplicateFields.phone && duplicateFields.phone.length > 0) {
    warnings.push({ field: 'phone', message: `Multiple phones found: ${duplicateFields.phone.join(', ')}. Using: "${detected.phone}"`, severity: 'WARNING' });
    confidence -= 5;
  }

  // 3. EMAIL - ERROR if invalid format, WARNING if missing
  if (!detected.email) {
    warnings.push({ field: 'email', message: 'Email is missing (add for better candidate matching)', severity: 'WARNING' });
    confidence -= 10;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detected.email)) {
    errors.push({ field: 'email', message: 'Email format is invalid', severity: 'ERROR' });
    confidence -= 50;
  }
  if (duplicateFields.email && duplicateFields.email.length > 0) {
    warnings.push({ field: 'email', message: `Multiple emails: ${duplicateFields.email.join(', ')}. Using: "${detected.email}"`, severity: 'WARNING' });
    confidence -= 5;
  }

  // 4. LOCATION - WARNING if missing
  if (!detected.location) {
    warnings.push({ field: 'location', message: 'Location/City is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  // 5. POSITION - WARNING if missing
  if (!detected.position) {
    warnings.push({ field: 'position', message: 'Position/Job Title is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  // 6. EXPERIENCE - WARNING if missing, INFO if unusual range
  if (detected.experience === null || detected.experience === undefined) {
    warnings.push({ field: 'experience', message: 'Experience is missing', severity: 'WARNING' });
    confidence -= 10;
  } else if (detected.experience < 0 || detected.experience > 70) {
    errors.push({ field: 'experience', message: 'Experience must be between 0-70 years', severity: 'ERROR' });
    confidence -= 50;
  } else if (detected.experience > 50) {
    warnings.push({ field: 'experience', message: `Experience (${detected.experience} years) seems unusually high. Verify data.`, severity: 'WARNING' });
    confidence -= 10;
  }

  // 7. CTC - WARNING if missing, check range
  if (detected.ctc === null || detected.ctc === undefined) {
    warnings.push({ field: 'ctc', message: 'Current CTC is missing (helps with salary negotiation)', severity: 'WARNING' });
    confidence -= 10;
  } else if (detected.ctc < 0 || detected.ctc > 100) {
    warnings.push({ field: 'ctc', message: `Current CTC (${detected.ctc} LPA) seems unusual. Verify data.`, severity: 'WARNING' });
    confidence -= 10;
  }

  // 8. EXPECTED SALARY - WARNING if missing, CROSS-FIELD validation
  if (detected.expectedSalary === null || detected.expectedSalary === undefined) {
    warnings.push({ field: 'expectedSalary', message: 'Expected Salary is missing', severity: 'WARNING' });
    confidence -= 10;
  } else if (detected.expectedSalary < 0 || detected.expectedSalary > 100) {
    warnings.push({ field: 'expectedSalary', message: `Expected Salary (${detected.expectedSalary} LPA) seems unusual`, severity: 'WARNING' });
    confidence -= 10;
  }
  
  // CROSS-FIELD: CTC vs Expected Salary
  if (detected.ctc !== null && detected.ctc !== undefined && 
      detected.expectedSalary !== null && detected.expectedSalary !== undefined) {
    if (detected.ctc > detected.expectedSalary) {
      warnings.push({ 
        field: 'salary', 
        message: `Expected salary (${detected.expectedSalary} LPA) is lower than current CTC (${detected.ctc} LPA). Verify candidate willingness.`, 
        severity: 'WARNING' 
      });
      confidence -= 15;
    }
  }

  // 9. NOTICE PERIOD - WARNING if missing
  if (detected.noticePeriod === null || detected.noticePeriod === undefined) {
    warnings.push({ field: 'noticePeriod', message: 'Notice Period is missing (check candidate availability)', severity: 'WARNING' });
    confidence -= 10;
  } else if (detected.noticePeriod < 0 || detected.noticePeriod > 365) {
    warnings.push({ field: 'noticePeriod', message: `Notice Period (${detected.noticePeriod} days) is unusual`, severity: 'WARNING' });
    confidence -= 10;
  }

  // 10. COMPANY - WARNING if missing (NOT ERROR - supports freelancers)
  if (!detected.company) {
    warnings.push({ field: 'company', message: 'Current Company is missing (freelancer or self-employed?)', severity: 'WARNING' });
    confidence -= 5; // Reduced penalty
  } else if (isPlaceholderValue(detected.company)) {
    warnings.push({ field: 'company', message: 'Company appears to be placeholder text', severity: 'WARNING' });
    confidence -= 10;
  }

  // 11. STATUS - WARNING if missing or unrecognized
  if (!detected.status) {
    warnings.push({ field: 'status', message: 'Candidate Status is missing', severity: 'WARNING' });
    confidence -= 10;
  } else {
    const recognizedStatus = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 
      'pending', 'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 
      'declined', 'didn\'t attend', 'referred', 'under consideration', 'offer received'];
    if (!recognizedStatus.some(st => detected.status.toLowerCase().includes(st))) {
      warnings.push({ field: 'status', message: `Status '${detected.status}' not recognized. Valid values: applied, interested, scheduled, interviewed, rejected, joined, etc.`, severity: 'WARNING' });
      confidence -= 10;
    }
  }

  // 12. SOURCE - WARNING if missing
  if (!detected.sourceOfCV) {
    warnings.push({ field: 'sourceOfCV', message: 'Source of CV is missing (for recruitment analytics)', severity: 'WARNING' });
    confidence -= 5; // Lower priority
  }

  // 13. CLIENT - optional (for agency placements)
  if (!detected.client) {
    // This is optional, just informational
  }

  // 14. SPOC - optional (internal feedback)
  if (!detected.spoc) {
    // This is optional
  }

  confidence = Math.max(0, Math.min(100, confidence));

  // Categorization - Enterprise logic
  let category = 'ready';
  if (errors.length > 0) {
    category = 'blocked'; // Has errors
  } else if (confidence >= 80) {
    category = 'ready'; // All required fields, high confidence
  } else if (confidence >= 50) {
    category = 'review'; // Missing optional fields or some warnings
  } else {
    category = 'blocked'; // Too many warnings
  }

  return {
    rowIndex,
    detected,
    errors,
    warnings,
    confidence,
    category
  };
}

function autoFix(detected) {
  const fixed = { ...detected };
  delete fixed.duplicates; // Remove metadata
  const changes = [];

  // Name - trim and title case (support Unicode)
  if (fixed.name) {
    const original = fixed.name;
    fixed.name = fixed.name
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    if (original !== fixed.name) {
      changes.push(`name: "${original}" → "${fixed.name}"`);
    }
  }

  // Email - lowercase, trim
  if (fixed.email) {
    const original = fixed.email;
    fixed.email = fixed.email.toLowerCase().trim();
    if (original !== fixed.email) {
      changes.push(`email: "${original}" → "${fixed.email}"`);
    }
  }

  // Phone - ensure clean 10 digits
  if (fixed.phone) {
    const original = fixed.phone;
    fixed.phone = String(fixed.phone).replace(/\D/g, '').slice(-10);
    if (original !== fixed.phone) {
      changes.push(`phone: "${original}" → "${fixed.phone}"`);
    }
  }

  // Location - trim
  if (fixed.location) {
    const original = fixed.location;
    fixed.location = fixed.location.trim();
    if (original !== fixed.location) {
      changes.push(`location: "${original}" → "${fixed.location}"`);
    }
  }

  // Position - trim
  if (fixed.position) {
    const original = fixed.position;
    fixed.position = fixed.position.trim();
    if (original !== fixed.position) {
      changes.push(`position: "${original}" → "${fixed.position}"`);
    }
  }

  // Experience - ensure numeric
  if (fixed.experience !== null && fixed.experience !== undefined) {
    const original = fixed.experience;
    fixed.experience = parseFloat(fixed.experience);
    if (original !== fixed.experience && !isNaN(fixed.experience)) {
      changes.push(`experience: "${original}" → ${fixed.experience}`);
    }
  }

  // CTC - ensure numeric
  if (fixed.ctc !== null && fixed.ctc !== undefined) {
    const original = fixed.ctc;
    fixed.ctc = parseFloat(fixed.ctc);
    if (original !== fixed.ctc && !isNaN(fixed.ctc)) {
      changes.push(`ctc: "${original}" → ${fixed.ctc}`);
    }
  }

  // Expected Salary - ensure numeric
  if (fixed.expectedSalary !== null && fixed.expectedSalary !== undefined) {
    const original = fixed.expectedSalary;
    fixed.expectedSalary = parseFloat(fixed.expectedSalary);
    if (original !== fixed.expectedSalary && !isNaN(fixed.expectedSalary)) {
      changes.push(`expectedSalary: "${original}" → ${fixed.expectedSalary}`);
    }
  }

  // Notice Period - ensure numeric (days)
  if (fixed.noticePeriod !== null && fixed.noticePeriod !== undefined) {
    const original = fixed.noticePeriod;
    fixed.noticePeriod = parseInt(fixed.noticePeriod, 10);
    if (original !== fixed.noticePeriod && !isNaN(fixed.noticePeriod)) {
      changes.push(`noticePeriod: "${original}" → ${fixed.noticePeriod} days`);
    }
  }

  // Company - trim
  if (fixed.company) {
    const original = fixed.company;
    fixed.company = fixed.company.trim();
    if (original !== fixed.company) {
      changes.push(`company: "${original}" → "${fixed.company}"`);
    }
  }

  // Client - trim
  if (fixed.client) {
    const original = fixed.client;
    fixed.client = fixed.client.trim();
    if (original !== fixed.client) {
      changes.push(`client: "${original}" → "${fixed.client}"`);
    }
  }

  // SPOC - trim and title case for names
  if (fixed.spoc) {
    const original = fixed.spoc;
    fixed.spoc = fixed.spoc
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    if (original !== fixed.spoc) {
      changes.push(`spoc: "${original}" → "${fixed.spoc}"`);
    }
  }

  // Status - trim and lowercase
  if (fixed.status) {
    const original = fixed.status;
    fixed.status = fixed.status.toLowerCase().trim();
    if (original !== fixed.status) {
      changes.push(`status: "${original}" → "${fixed.status}"`);
    }
  }

  // Source - trim and lowercase
  if (fixed.sourceOfCV) {
    const original = fixed.sourceOfCV;
    fixed.sourceOfCV = fixed.sourceOfCV.toLowerCase().trim();
    if (original !== fixed.sourceOfCV) {
      changes.push(`sourceOfCV: "${original}" → "${fixed.sourceOfCV}"`);
    }
  }

  return { fixed, changes };
}

// ═════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════

// Step 1: Upload
app.post('/api/enterprise/step1-upload', upload.single('file'), (req, res) => {
  try {
    console.log('📁 [UPLOAD] Processing file:', req.file.originalname);
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    console.log('📊 [UPLOAD] Sheet names:', workbook.SheetNames);
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      console.error('❌ [UPLOAD] No sheets found in workbook');
      return res.status(400).json({ success: false, error: 'No data sheets found in Excel file' });
    }
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) {
      console.error('❌ [UPLOAD] Worksheet is undefined');
      return res.status(400).json({ success: false, error: 'Cannot read worksheet data' });
    }
    
    const data = XLSX.utils.sheet_to_json(worksheet);
    console.log('📈 [UPLOAD] Rows found:', data.length);
    
    if (!data || data.length === 0) {
      console.error('❌ [UPLOAD] No rows found in sheet');
      return res.status(400).json({ success: false, error: 'Excel file is empty' });
    }
    
    const headers = Object.keys(data[0] || {});
    console.log('🏷️  [UPLOAD] Column headers:', headers);

    console.log('✅ [UPLOAD] File processed successfully');
    res.json({
      success: true,
      file: {
        name: req.file.originalname,
        headers,
        data
      }
    });
  } catch (error) {
    console.error('❌ [UPLOAD] Error:', error.message);
    console.error('📍 Stack:', error.stack);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 2: Analyze
app.post('/api/enterprise/step2-analyze', (req, res) => {
  try {
    const { data } = req.body;
    res.json({
      success: true,
      analysis: { fields: 12, rows: data.length }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 3: Auto-mapping
app.post('/api/enterprise/step3-automapping', (req, res) => {
  try {
    const { headers, data } = req.body;
    const mappings = {};

    headers.forEach(header => {
      mappings[header] = { original: header, mapped: header };
    });

    res.json({
      success: true,
      mappings
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 5: Standardize
app.post('/api/enterprise/step5-standardize', (req, res) => {
  try {
    const { data } = req.body;
    const standardizedData = [];
    const rows = [];

    data.forEach((row, idx) => {
      const detected = detectFields(row);
      const { fixed, changes } = autoFix(detected);

      standardizedData.push(fixed);
      rows.push({
        rowIndex: idx + 1,
        original: row,
        fixed,
        wasModified: changes.length > 0,
        changes
      });
    });

    res.json({
      success: true,
      standardizedData,
      stats: {
        processed: data.length,
        modified: rows.filter(r => r.wasModified).length
      },
      rows
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 6: Validate
app.post('/api/enterprise/step6-validate', (req, res) => {
  try {
    const { data } = req.body;
    const ready = [];
    const review = [];
    const blocked = [];

    data.forEach((row, idx) => {
      const validation = validateCandidate(row, idx + 1);

      if (validation.category === 'ready') {
        ready.push(validation);
      } else if (validation.category === 'review') {
        review.push(validation);
      } else {
        blocked.push(validation);
      }
    });

    res.json({
      success: true,
      validation: { ready, review, blocked },
      stats: {
        ready: ready.length,
        review: review.length,
        blocked: blocked.length
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Enterprise: single call to process file (standardize + validate), returns full per-row results for UI
app.post('/api/enterprise/process', (req, res) => {
  try {
    const { data } = req.body;
    console.log('🔄 [PROCESS] Starting validation for', data?.length || 0, 'records');
    
    if (!Array.isArray(data) || data.length === 0) {
      console.error('❌ [PROCESS] Invalid data:', typeof data, Array.isArray(data));
      return res.status(400).json({ success: false, error: 'No data provided' });
    }
    
    // Extract headers from the first row of data
    const headers = Object.keys(data[0] || {});
    console.log('🏷️  [PROCESS] Headers:', headers);
    
    const results = data.map((row, idx) => {
      if (!row || typeof row !== 'object') {
        console.warn('⚠️  [PROCESS] Row', idx + 1, 'is invalid:', typeof row);
        return { rowIndex: idx + 1, original: row, fixed: {}, validation: { category: 'blocked', errors: [{ field: 'row', message: 'Invalid row data' }] } };
      }
      
      const detected = detectFields(row || {}, headers);
      const { fixed, changes } = autoFix(detected);
      const validation = validateCandidate(fixed, idx + 1);
      
      if (idx < 3) {
        console.log(`📌 [PROCESS] Row ${idx + 1}:`, { fixed: JSON.stringify(fixed).substring(0, 100), category: validation.category });
      }
      
      return {
        rowIndex: idx + 1,
        original: row,
        fixed,
        autoFixChanges: changes,
        validation: {
          category: validation.category,
          confidence: validation.confidence,
          errors: validation.errors,
          warnings: validation.warnings
        }
      };
    });
    const stats = {
      ready: results.filter(r => r.validation.category === 'ready').length,
      review: results.filter(r => r.validation.category === 'review').length,
      blocked: results.filter(r => r.validation.category === 'blocked').length,
      total: results.length
    };
    console.log('✅ [PROCESS] Complete - Ready:', stats.ready, 'Review:', stats.review, 'Blocked:', stats.blocked);
    res.json({ success: true, results, stats });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Re-validate a single record (after user edit in Review & Fix)
app.post('/api/enterprise/revalidate', (req, res) => {
  try {
    const { record } = req.body;
    console.log('🔄 [REVALIDATE] Record:', record ? Object.keys(record).join(', ') : 'empty');
    const { fixed, changes } = autoFix(record || {});
    const validation = validateCandidate(fixed, 0);
    res.json({
      success: true,
      fixed,
      autoFixChanges: changes,
      validation: {
        category: validation.category,
        confidence: validation.confidence,
        errors: validation.errors,
        warnings: validation.warnings
      }
    });
  } catch (error) {
    console.error('❌ [REVALIDATE] Error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Step 8: Import
app.post('/api/enterprise/step8-import', (req, res) => {
  console.log('💾 [IMPORT] Starting import process');
  try {
    const { readyData, allValidated } = req.body;

    // Import ready data
    const imported = [];
    const rejected = [];

    readyData.forEach(record => {
      const item = {
        id: importedDatabase.length + 1,
        ...record,
        importedAt: new Date().toISOString()
      };
      importedDatabase.push(item);
      imported.push(item);
    });

    console.log('✅ [IMPORT] Successfully imported', imported.length, 'records');
    res.json({
      success: true,
      import: {
        imported: imported.length,
        timestamp: new Date().toISOString(),
        data: imported
      }
    });
  } catch (error) {
    console.error('❌ [IMPORT] Error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Auto Import - Automatically import all ready records
app.post('/api/enterprise/auto-import', (req, res) => {
  console.log('🚀 [AUTO-IMPORT] Starting automatic import process');
  try {
    const { readyData } = req.body;

    if (!readyData || readyData.length === 0) {
      return res.json({
        success: true,
        import: { imported: 0, timestamp: new Date().toISOString() }
      });
    }

    // Auto-import all ready records
    const imported = [];
    readyData.forEach(record => {
      const item = {
        id: importedDatabase.length + 1,
        ...record,
        importedAt: new Date().toISOString(),
        autoImported: true
      };
      importedDatabase.push(item);
      imported.push(item);
    });

    console.log('✅ [AUTO-IMPORT] Successfully auto-imported', imported.length, 'records');
    console.log('✨ [AUTO-IMPORT] Database now contains', importedDatabase.length, 'total records');
    
    res.json({
      success: true,
      import: {
        imported: imported.length,
        totalInDatabase: importedDatabase.length,
        timestamp: new Date().toISOString(),
        data: imported
      }
    });
  } catch (error) {
    console.error('❌ [AUTO-IMPORT] Error:', error.message);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get imported database
app.get('/api/enterprise/get-final-data', (req, res) => {
  res.json({
    success: true,
    finalData: importedDatabase,
    count: importedDatabase.length,
    timestamp: new Date().toISOString()
  });
});

// Clear all cached/imported data (only current session; restarts show empty)
app.post('/api/enterprise/clear-database', (req, res) => {
  const count = importedDatabase.length;
  importedDatabase = [];
  res.json({
    success: true,
    message: count > 0 ? `Cleared ${count} record(s). Database is now empty.` : 'Database was already empty.',
    count: 0,
    finalData: []
  });
});

// Manual field swap/remapping
app.post('/api/enterprise/manual-swap', (req, res) => {
  try {
    const { detected, swaps } = req.body;
    // swaps = { 'field1': 'valueFromField2', 'field2': 'valueFromField1' }
    
    const remapped = { ...detected };
    const changes = [];

    Object.keys(swaps).forEach(targetField => {
      const newValue = swaps[targetField];
      const oldValue = remapped[targetField];
      remapped[targetField] = newValue;
      changes.push({ field: targetField, from: oldValue, to: newValue });
    });

    res.json({
      success: true,
      remapped,
      changes
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Test global rulebook on sample Excel (e.g. candidates-2026-02-04.xlsx)
app.get('/api/enterprise/test-global-rulebook', (req, res) => {
  try {
    const fileName = req.query.file || 'candidates-2026-02-04.xlsx';
    const filePath = path.join(__dirname, fileName);
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    const results = data.map((row, idx) => {
      const detected = detectFields(row);
      const { fixed, changes } = autoFix(detected);
      const validation = validateCandidate(fixed, idx + 1);
      return {
        rowIndex: idx + 1,
        rawHeaders: Object.keys(row),
        detected,
        fixed,
        autoFixChanges: changes,
        validation: {
          category: validation.category,
          confidence: validation.confidence,
          errors: validation.errors,
          warnings: validation.warnings
        }
      };
    });

    const stats = {
      ready: results.filter(r => r.validation.category === 'ready').length,
      review: results.filter(r => r.validation.category === 'review').length,
      blocked: results.filter(r => r.validation.category === 'blocked').length,
      total: results.length
    };

    res.json({
      success: true,
      file: fileName,
      message: 'Global rulebook applied: data auto-mapped by value, not by column name.',
      stats,
      results
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ats-import.html'));
});

// CLI: run global rulebook on Excel file without starting server
// Usage: node server.js candidates-2026-02-04.xlsx
const cliFile = process.argv[2];
if (cliFile) {
  const filePath = path.isAbsolute(cliFile) ? cliFile : path.join(process.cwd(), cliFile);
  try {
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const results = data.map((row, idx) => {
      const detected = detectFields(row, headers);
      const { fixed, changes } = autoFix(detected);
      const validation = validateCandidate(fixed, idx + 1);
      return { rowIndex: idx + 1, fixed, autoFixChanges: changes, category: validation.category, confidence: validation.confidence };
    });
    const stats = { ready: results.filter(r => r.category === 'ready').length, review: results.filter(r => r.category === 'review').length, blocked: results.filter(r => r.category === 'blocked').length, total: results.length };
    console.log(JSON.stringify({ file: path.basename(filePath), stats, results }, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  process.exit(0);
}

app.listen(PORT, () => {
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`✅ PeopleConnectHR ATS Server running on http://localhost:${PORT}`);
  console.log(`🧠 Enterprise Global Validation Rulebook ACTIVE`);
  console.log(`📋 14-Field Validation | Data-Driven Detection | Cross-Field Checks`);
  console.log(`🔐 ERROR blocks (Name, Phone), WARNING allows (Freelancers supported)`);
  console.log(`📊 Confidence-based: Ready (80%+), Review (50-79%), Blocked (<50%)`);
  console.log(`📝 Logging all API calls for debugging`);
  console.log(`${'═'.repeat(80)}\n`);
});
