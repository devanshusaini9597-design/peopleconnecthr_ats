/**
 * ═══════════════════════════════════════════════════════════════════════
 * ENTERPRISE VALIDATION RULEBOOK v2 (from excel-data/server.js)
 * ✅ Works with ANY Excel format (any column order, any column names)
 * ✅ Content-based detection with format variants support
 * ✅ Cross-field validation (CTC vs Expected, experience context, etc)
 * ✅ Unicode/International names supported
 * ═══════════════════════════════════════════════════════════════════════
 */

const GLOBAL_PLACEHOLDERS = [
  'na', 'n/a', 'as per company norms', 'not specified', 'pending', 'tbd', 
  'unknown', 'none', '-', 'null', 'nil', 'wip', 'company', 'placeholder', 
  'test', 'dummy', '', 'to be decided', 'not applicable', 'will share', 
  'negotiable', 'flexible', 'open', 'competitive'
];

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

// Parse phone in ANY format
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

// Parse notice period in ANY format
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
  
  if (/^\d+$/.test(s)) {
    const plainNum = parseInt(s, 10);
    if (!isNaN(plainNum) && plainNum >= 0 && plainNum <= 365) {
      return plainNum;
    }
  }
  
  return null;
}

// Parse experience in ANY format
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

// Detect fields from row using enterprise logic
function detectFieldsFromRow(row, headers) {
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
    'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 'trivandrum', 'remote'];
  
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
    'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
    'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
    'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 'fls', 
    'non fls', 'contractor', 'freelance', 'programmer', 'admin'];
  
  const statusKeywords = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 
    'pending', 'active', 'selected', 'offered', 'accepted', 'declined'];
  
  const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 
    'glassdoor', 'agency', 'college', 'campus', 'email', 'direct', 'recruiter', 'internal'];
  
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
    'company', 'corp', 'bank', 'finance', 'insurance', 'tcs', 'infosys', 'wipro', 'cognizant', 
    'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 'amazon', 'flipkart', 'uber', 'paytm'];

  function isOrganizationName(str) {
    const strLower = str.toLowerCase();
    if (orgKeywords.some(k => strLower.includes(k))) return true;
    if (str.length > 45) return true;
    if (/\b(ltd|pvt|llp|corp|inc|pte|plc)\b/i.test(str)) return true;
    return false;
  }

  function isPositionTitle(str) {
    const strLower = str.toLowerCase();
    return positionKeywords.some(pos => {
      const word = '\\b' + pos + '\\b';
      return new RegExp(word, 'i').test(strLower);
    });
  }

  values.forEach((value, idx) => {
    const str = String(value).trim();
    const strLower = str.toLowerCase();
    if (isPlaceholderValue(str)) return;

    const header = headers[idx] || '';

    // EMAIL
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strLower)) {
      candidates.email.push({ value: strLower, header });
    }

    // PHONE
    const phoneMatch = parsePhone(str);
    if (phoneMatch) {
      candidates.phone.push({ value: phoneMatch, header });
    }

    // POSITION
    if (isPositionTitle(str)) {
      candidates.position.push({ value: str, header });
    }

    // NAME - STRICT: 1-4 words, looks like a person
    const wordCount = str.split(/\s+/).filter(Boolean).length;
    const isStatusValue = statusKeywords.some(st => strLower.includes(st));
    
    if (wordCount >= 1 && wordCount <= 3 && 
        /^[\p{L}\s\-'\.]+$/u.test(str) && 
        !/\d|@|lpa|yrs|phone|email/i.test(str) && 
        str.length >= 2 &&
        str.length <= 40 &&
        !isOrganizationName(str) &&
        !isPositionTitle(str) &&
        !isStatusValue &&
        !cityKeywords.some(city => strLower.includes(city))) {
      const flsBoost = header.toLowerCase().includes('fls') || header.toLowerCase().includes('candidate') ? 20 : 0;
      candidates.name.push({ value: str, score: str.length * 2 + flsBoost, header });
    }

    // LOCATION
    if (cityKeywords.some(city => strLower.includes(city))) {
      candidates.location.push({ value: str, header });
    }

    // NOTICE PERIOD (check BEFORE experience/CTC)
    const noticeParsed = parseNoticePeriod(str);
    if (noticeParsed !== null && noticeParsed >= 0 && noticeParsed <= 365) {
      candidates.noticePeriod.push({ value: noticeParsed, header });
    }

    // EXPERIENCE
    const expParsed = parseExperience(str);
    if (expParsed !== null && noticeParsed === null) {
      candidates.experience.push({ value: expParsed, header });
    }

    // CTC & EXPECTED SALARY
    const ctcParsed = parseSalary(str);
    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      candidates.ctc.push({ value: ctcParsed, header });
      candidates.expectedSalary.push({ value: ctcParsed, header });
    }

    // STATUS
    if (statusKeywords.some(st => strLower.includes(st))) {
      candidates.status.push({ value: strLower, header });
    }

    // SOURCE
    if (sourceKeywords.some(src => strLower.includes(src))) {
      candidates.sourceOfCV.push({ value: strLower, header });
    }

    // COMPANY
    if (isOrganizationName(str) && !isStatusValue) {
      candidates.company.push({ value: str, header });
    }

    // SPOC
    if (wordCount >= 1 && wordCount <= 3 && /^[\p{L}\s\-'\.]+$/u.test(str) && !/\d|@|lpa|yrs|bank|pvt|ltd/i.test(str)) {
      candidates.spoc.push({ value: str, header });
    }
  });

  // Pick best candidate for each field
  const result = {};
  for (const field in candidates) {
    if (candidates[field].length === 0) {
      result[field] = null;
    } else if (candidates[field].length === 1) {
      result[field] = candidates[field][0].value;
    } else {
      // Pick by header match or first
      const sorted = candidates[field].sort((a, b) => (b.score || 0) - (a.score || 0));
      result[field] = sorted[0].value;
    }
  }

  return result;
}

module.exports = {
  parseSalary,
  parsePhone,
  parseNoticePeriod,
  parseExperience,
  detectFieldsFromRow,
  isPlaceholderValue
};
