/**
 * ═══════════════════════════════════════════════════════════════════════
 * GLOBAL VALIDATION RULEBOOK v2 (Enterprise-Grade)
 * ✅ Works with ANY Excel format (any column order, any column names)
 * ✅ Content-based detection - doesn't trust column headers
 * ✅ Multiple salary/phone/experience formats recognized
 * ═══════════════════════════════════════════════════════════════════════
 */

// Values we never assign to any field (placeholders / invalid)
const GLOBAL_PLACEHOLDERS = [
  'na', 'n/a', 'as per company norms', 'not specified', 'pending', 'tbd', 
  'unknown', 'none', '-', 'null', 'nil', 'wip', 'company', 'placeholder', 
  'test', 'dummy', '', 'to be decided', 'not applicable', 'will share', 
  'negotiable', 'flexible', 'open', 'competitive'
];

// Utility: Check if value is placeholder
function isPlaceholderValue(s) {
  const t = String(s).toLowerCase().trim();
  return GLOBAL_PLACEHOLDERS.includes(t) || /^as per\s|^tbd\s|^will.*share|^negotiable|^flexible|^to be|^open|^competitive/i.test(t);
}

// Parse salary in ANY format: "1LPA", "1,50,000", "150K", "1.5L", etc.
function parseSalary(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  // Format: "1LPA", "2.5LPA"
  const lpaMatch = s.match(/^(\d+(?:\.\d+)?)\s*lpa$/i) || s.match(/(\d+(?:\.\d+)?)\s*lpa/i);
  if (lpaMatch) return parseFloat(lpaMatch[1]);
  
  // Format: "150K", "150000"
  const kMatch = s.match(/^(\d+)\s*k$/i) || s.match(/^(\d+),?\d{3}$/);
  if (kMatch) return parseFloat(kMatch[1]) / 100;
  
  // Format: "1,50,000" (Indian style)
  const indianMatch = s.match(/^(\d{1,3}(?:,\d{3})*|(\d+))$/);
  if (indianMatch) {
    const num = parseInt(s.replace(/,/g, ''), 10);
    if (num >= 100000 && num <= 10000000) return num / 100000;
  }
  
  // Format: "1.5L", "2L"
  const lakMatch = s.match(/^(\d+(?:\.\d+)?)\s*l$/i);
  if (lakMatch) return parseFloat(lakMatch[1]);
  
  // Format: "1,20,000" with "lac" suffix
  const lacMatch = s.match(/(\d+(?:\.\d+)?)\s*lac/i) || s.match(/(\d+(?:\.\d+)?)\s*lakhs?/i);
  if (lacMatch) return parseFloat(lacMatch[1]);
  
  // Plain number: ONLY accept >= 1.5 LPA
  const plainNum = parseFloat(s);
  if (!isNaN(plainNum)) {
    if (plainNum >= 1.5 && plainNum <= 100) return plainNum;
    if (plainNum > 100 && plainNum <= 10000000) return plainNum / 100000;
  }
  
  return null;
}

// Parse phone in ANY format: "7359355840", "+91-7359355840", "91-735-9355840"
function parsePhone(str) {
  if (!str) return null;
  const s = String(str).trim();
  const digits = s.replace(/\D/g, '');
  
  let phone = digits;
  if (digits.startsWith('91') && digits.length === 12) {
    phone = digits.slice(2);
  }
  
  if (/^[6-9]\d{9}$/.test(phone)) {
    return phone;
  }
  
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return last10;
    }
  }
  
  return null;
}

// Parse notice period in ANY format: "90 days", "3 months", "Immediate"
function parseNoticePeriod(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  if (s === 'immediate' || s === '0 days' || s === '0' || /^immediate[d]?\s*(joinner?)?/i.test(s)) return 0;
  
  const daysMatch = s.match(/^(\d+)\s*days?$/i);
  if (daysMatch) return parseInt(daysMatch[1], 10);
  
  const weeksMatch = s.match(/^(\d+)\s*weeks?$/i);
  if (weeksMatch) return parseInt(weeksMatch[1], 10) * 7;
  
  const monthsMatch = s.match(/^(\d+)\s*months?$/i);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) * 30;
  
  if (/on notice|under notice/i.test(s)) return null;
  
  if (/^\d+$/.test(s)) {
    const plainNum = parseInt(s, 10);
    if (!isNaN(plainNum) && plainNum >= 0 && plainNum <= 365) {
      return plainNum;
    }
  }
  
  return null;
}

// Parse experience in ANY format: "7.9 Yrs", "10 years", "Fresher", "0.3"
function parseExperience(str) {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();
  
  if (/^fresher|^entry|^0\s*exp|^student|^graduate/i.test(s)) return 0;
  
  const expMatch = s.match(/^(\d+(?:\.\d+)?)\s*(?:yrs?|years?|y|months?)\s*$/i);
  if (expMatch) {
    const num = parseFloat(expMatch[1]);
    if (num >= 0 && num <= 70 && (num === 0 || num >= 0.1)) return num;
  }
  
  const plusMatch = s.match(/^(\d+(?:\.\d+)?)\+?\s*(?:yrs?|years?)\s*$/i);
  if (plusMatch) {
    const num = parseFloat(plusMatch[1]);
    if (num >= 0 && num <= 70) return num;
  }
  
  return null;
}

// Calculate score for a field value
function calculateScore(field, str) {
  const strLower = str.toLowerCase();
  
  switch(field) {
    case 'name': {
      const wordCount = str.split(/\s+/).filter(Boolean).length;
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
    case 'location': {
      const cityKeywords = ['bangalore', 'bengaluru', 'delhi', 'new delhi', 'mumbai', 'pune', 
        'hyderabad', 'secunderabad', 'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 
        'noida', 'greater noida', 'vadodara', 'surat', 'jaipur', 'lucknow', 'indore', 'nagpur', 
        'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 'trivandrum', 'remote', 'wfh'];
      return cityKeywords.some(city => strLower.includes(city)) ? 10 : 5;
    }
    case 'position': {
      const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
        'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
        'associate', 'senior', 'junior', 'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'so', 'fls'];
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
      const statusKeywords = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 
        'pending', 'active', 'selected', 'offered', 'accepted', 'declined'];
      return statusKeywords.some(st => strLower.includes(st)) ? 10 : 0;
    }
    case 'sourceOfCV': {
      const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 
        'glassdoor', 'portal', 'agency', 'campus', 'recruiter'];
      return sourceKeywords.some(src => strLower.includes(src)) ? 10 : 0;
    }
    case 'company':
    case 'client': {
      const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
        'bank', 'finance', 'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture'];
      const looksLikeOrg = orgKeywords.some(k => strLower.includes(k)) || 
                          (str.split(/\s+/).length >= 2 && str.length > 8);
      return looksLikeOrg ? 10 : 0;
    }
    case 'spoc': {
      const words = str.split(/\s+/).filter(Boolean);
      const hasValidChars = /^[\p{L}\s\-'\.]+$/u.test(str);
      const noBad = !/\d|@|lpa|yrs|bank|pvt|ltd/i.test(str);
      return (words.length >= 1 && words.length <= 3 && hasValidChars && noBad) ? 10 : 0;
    }
    default:
      return 5;
  }
}

// Classify a value to find what field it belongs to
function classifyValue(value) {
  if (isPlaceholderValue(value)) return { field: null, score: 0 };
  
  const valueStr = String(value).trim();
  if (!valueStr) return { field: null, score: 0 };
  
  const fields = ['email', 'phone', 'name', 'location', 'position', 'experience', 'ctc', 'expectedSalary', 'noticePeriod', 'status', 'sourceOfCV', 'company', 'client', 'spoc'];
  
  const scores = {};
  fields.forEach(field => {
    scores[field] = calculateScore(field, valueStr);
  });
  
  const maxField = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  
  return {
    field: scores[maxField] > 0 ? maxField : null,
    score: scores[maxField]
  };
}

// Normalize/fix a value based on its field type
function normalizeValue(field, value) {
  if (!field || isPlaceholderValue(value)) return null;
  
  const valueStr = String(value).trim();
  
  switch(field) {
    case 'email':
      return valueStr.toLowerCase();
    case 'phone':
      return parsePhone(valueStr);
    case 'name':
      return valueStr.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    case 'location':
      return valueStr;
    case 'position':
      return valueStr;
    case 'experience':
      const exp = parseExperience(valueStr);
      return exp !== null ? String(exp) : null;
    case 'ctc':
      const ctc = parseSalary(valueStr);
      return ctc !== null ? String(ctc) : null;
    case 'expectedSalary':
      const expSal = parseSalary(valueStr);
      return expSal !== null ? String(expSal) : null;
    case 'noticePeriod':
      const notice = parseNoticePeriod(valueStr);
      return notice !== null ? String(notice) : null;
    case 'status':
      return valueStr;
    case 'sourceOfCV':
      return valueStr;
    case 'company':
    case 'client':
      return valueStr;
    case 'spoc':
      return valueStr;
    default:
      return valueStr;
  }
}

/**
 * Validate single candidate record and return status: READY / REVIEW / BLOCKED
 * Based on excel-data folder enterprise validation logic
 * @param {Object} candidate - Candidate record with name, email, phone, position, etc.
 * @returns {Object} { status: 'READY'|'REVIEW'|'BLOCKED', errors: [], warnings: [], confidence: 0-100 }
 */
function getValidationStatus(candidate) {
  const errors = [];     // Critical issues → BLOCKED
  const warnings = [];   // Non-critical issues → REVIEW
  let confidence = 100;
  
  // CRITICAL: Name (required)
  if (!candidate.name || isPlaceholderValue(candidate.name)) {
    errors.push({ field: 'name', message: 'Missing or invalid name' });
    confidence -= 20;
  } else if (!/[a-zA-Z]{2,}/.test(candidate.name)) {
    errors.push({ field: 'name', message: 'Name must contain at least 2 alphabetic characters' });
    confidence -= 15;
  }
  
  // CRITICAL: Email (required)
  if (!candidate.email || isPlaceholderValue(candidate.email)) {
    errors.push({ field: 'email', message: 'Missing or invalid email' });
    confidence -= 20;
  } else if (!candidate.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    errors.push({ field: 'email', message: 'Email format invalid' });
    confidence -= 20;
  }
  
  // CRITICAL: Phone (required)
  if (!candidate.contact || isPlaceholderValue(candidate.contact)) {
    errors.push({ field: 'contact', message: 'Missing or invalid phone number' });
    confidence -= 20;
  } else if (!/\d{5,}/.test(String(candidate.contact).replace(/\D/g, ''))) {
    errors.push({ field: 'contact', message: 'Phone must contain at least 5 digits' });
    confidence -= 15;
  }
  
  // CRITICAL: Position (required)
  if (!candidate.position || isPlaceholderValue(candidate.position)) {
    errors.push({ field: 'position', message: 'Missing or invalid position' });
    confidence -= 20;
  }
  
  // WARNINGS: Experience (optional but recommended)
  if (!candidate.experience || candidate.experience === '-' || candidate.experience === 'NA') {
    warnings.push({ field: 'experience', message: 'Experience not specified (for recruitment analytics)', severity: 'WARNING' });
    confidence -= 10;
  }
  
  // WARNINGS: Location (optional but recommended)
  if (!candidate.location || isPlaceholderValue(candidate.location)) {
    warnings.push({ field: 'location', message: 'Location missing (for targeted recruitment)', severity: 'WARNING' });
    confidence -= 8;
  }
  
  // WARNINGS: CTC (optional)
  if (!candidate.ctc || isPlaceholderValue(String(candidate.ctc))) {
    warnings.push({ field: 'ctc', message: 'Current salary not provided (for salary negotiation)', severity: 'INFO' });
    confidence -= 5;
  }
  
  // WARNINGS: Expected CTC (optional)
  if (!candidate.expectedCtc || isPlaceholderValue(String(candidate.expectedCtc))) {
    warnings.push({ field: 'expectedCtc', message: 'Expected salary not provided', severity: 'INFO' });
    confidence -= 5;
  }
  
  // WARNINGS: Notice Period (optional but helpful)
  if (!candidate.noticePeriod || isPlaceholderValue(String(candidate.noticePeriod))) {
    warnings.push({ field: 'noticePeriod', message: 'Notice period not specified (for interview planning)', severity: 'WARNING' });
    confidence -= 8;
  }
  
  // WARNINGS: Status (optional)
  if (!candidate.status || isPlaceholderValue(candidate.status)) {
    warnings.push({ field: 'status', message: 'Candidate status not set', severity: 'INFO' });
    confidence -= 3;
  }
  
  // WARNINGS: Source (optional but helpful for analytics)
  if (!candidate.source || isPlaceholderValue(candidate.source)) {
    warnings.push({ field: 'source', message: 'Source of CV is missing (for recruitment analytics)', severity: 'WARNING' });
    confidence -= 5;
  }
  
  // Normalize confidence to 0-100 range
  confidence = Math.max(0, Math.min(100, confidence));
  
  // Categorization - Enterprise logic (matching excel-data folder)
  let status = 'READY';
  if (errors.length > 0) {
    status = 'BLOCKED'; // Has critical errors
  } else if (confidence >= 80) {
    status = 'READY'; // All required fields, high confidence
  } else if (confidence >= 50) {
    status = 'REVIEW'; // Missing optional fields or some warnings
  } else {
    status = 'BLOCKED'; // Too many issues
  }
  
  return {
    status,
    errors,
    warnings,
    confidence,
    isValid: status !== 'BLOCKED'
  };
}

module.exports = {
  isPlaceholderValue,
  parseSalary,
  parsePhone,
  parseNoticePeriod,
  parseExperience,
  calculateScore,
  classifyValue,
  normalizeValue,
  getValidationStatus
};
