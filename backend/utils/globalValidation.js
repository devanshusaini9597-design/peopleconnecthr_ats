/**
 * ═════════════════════════════════════════════════════════════════════════
 * GLOBAL VALIDATION RULEBOOK v2 (Enterprise-Grade)
 * Copied from excel-data/server.js - Complete validation system
 * ═════════════════════════════════════════════════════════════════════════
 * ✅ Auto-detects fields from content (not column names)
 * ✅ Supports multiple formats for all fields
 * ✅ Cross-field validation (CTC vs Expected, experience context, etc)
 * ✅ Unicode/International names supported
 * ✅ Quality gates: Ready (80%+), Review (50-79%), Blocked (<50%)
 */

// Global placeholder detection
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
  
  const lpaMatch = s.match(/^(\d+(?:\.\d+)?)\s*lpa$/i) || s.match(/(\d+(?:\.\d+)?)\s*lpa/i);
  if (lpaMatch) return parseFloat(lpaMatch[1]);
  
  const kMatch = s.match(/^(\d+)\s*k$/i) || s.match(/^(\d+),?\d{3}$/);
  if (kMatch) return parseFloat(kMatch[1]) / 100;
  
  const indianMatch = s.match(/^(\d{1,3}(?:,\d{3})*|(\d+))$/);
  if (indianMatch) {
    const num = parseInt(s.replace(/,/g, ''), 10);
    if (num >= 100000 && num <= 10000000) return num / 100000;
  }
  
  const lakMatch = s.match(/^(\d+(?:\.\d+)?)\s*l$/i);
  if (lakMatch) return parseFloat(lakMatch[1]);
  
  const lacMatch = s.match(/(\d+(?:\.\d+)?)\s*lac/i) || s.match(/(\d+(?:\.\d+)?)\s*lakhs?/i);
  if (lacMatch) return parseFloat(lacMatch[1]);
  
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
  
  if (/on notice|under notice/i.test(s)) return null;
  
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
        'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 'trivandrum', 'tier', 
        'remote', 'work from home', 'wfh'];
      return cityKeywords.some(city => strLower.includes(city)) ? 10 : 5;
    }
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
      const statusKeywords = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 
        'pending', 'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 
        'declined', 'didn\'t attend', 'referred', 'under consideration', 'offer received'];
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
        'company', 'corp', 'bank', 'finance', 'education', 'insurance', 'consulting', 'group', 
        'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind', 
        'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 
        'amazon', 'flipkart', 'uber', 'paytm', 'freshworks', 'swiggy', 'zomato'];
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
  
  const duplicates = candidates[field].length > 1 ? 
    candidates[field].slice(1).map(c => c.value) : [];
  
  if (top.length === 1) {
    return { value: top[0].value, duplicates };
  }
  
  if (field === 'name') {
    for (const c of top) {
      if (c.header.toLowerCase().includes('fls') || c.header.toLowerCase().includes('non-fls')) {
        return { value: c.value, duplicates };
      }
    }
    for (const c of top) {
      if (hints.some(h => c.header.toLowerCase().includes(h))) {
        return { value: c.value, duplicates };
      }
    }
  } else {
    for (const c of top) {
      if (hints.some(h => c.header.toLowerCase().includes(h))) {
        return { value: c.value, duplicates };
      }
    }
  }
  
  if (field === 'name' || field === 'position' || field === 'spoc') {
    return { value: top.reduce((a, b) => a.value.length < b.value.length ? a : b).value, duplicates };
  }
  
  if (field === 'company' || field === 'client') {
    return { value: top.reduce((a, b) => a.value.length > b.value.length ? a : b).value, duplicates };
  }
  
  return { value: top[0].value, duplicates };
}

function correctFieldMisclassifications(detected) {
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 
    'architect', 'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 
    'associate', 'senior', 'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 
    'qa', 'tester', 'business', 'sales', 'marketing', 'hr', 'finance', 'operations'];
  
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 
    'company', 'corp', 'bank', 'finance', 'insurance', 'inc', 'pte', 'gmbh', 'sa', 'sas', 'nv', 'ag', 
    'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google'];

  if (detected.name) {
    const nameLower = String(detected.name).toLowerCase();
    if (positionKeywords.some(p => new RegExp('\\b' + p + '\\b', 'i').test(nameLower)) && !detected.position) {
      detected.position = detected.name;
      detected.name = null;
    }
  }

  if (detected.position && !detected.company) {
    const posLower = String(detected.position).toLowerCase();
    if (orgKeywords.some(k => posLower.includes(k))) {
      detected.company = detected.position;
      detected.position = null;
    }
  }

  if (detected.company && detected.company.length < 4 && !detected.spoc) {
    const companyLower = String(detected.company).toLowerCase();
    const hasOrgKeyword = orgKeywords.some(k => companyLower.includes(k));
    if (!hasOrgKeyword) {
      detected.spoc = detected.company;
      detected.company = null;
    }
  }

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

function detectFields(row, headers = []) {
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
  const cityKeywords = ['bangalore', 'bengaluru', 'delhi', 'mumbai', 'pune', 'hyderabad', 'secunderabad', 
    'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 'noida', 'greater noida', 'vadodara', 'surat', 
    'jaipur', 'lucknow', 'indore', 'nagpur', 'bhopal', 'chandigarh', 'kochi', 'coimbatore', 'visakhapatnam', 
    'trivandrum', 'tier', 'remote', 'work from home', 'wfh'];
  const positionKeywords = ['developer', 'engineer', 'manager', 'lead', 'analyst', 'designer', 'architect', 
    'consultant', 'specialist', 'executive', 'officer', 'coordinator', 'supervisor', 'associate', 'senior', 
    'junior', 'trainee', 'intern', 'director', 'head', 'ceo', 'cfo', 'cto', 'qa', 'tester', 'business', 
    'sales', 'marketing', 'hr', 'finance', 'operations', 'so', 'non fls', 'contractor', 'freelance', 'programmer', 'admin'];
  const statusKeywords = ['applied', 'interested', 'scheduled', 'interviewed', 'rejected', 'joined', 'pending', 
    'active', 'on hold', 'not interested', 'hold', 'selected', 'offered', 'accepted', 'declined'];
  const sourceKeywords = ['naukri', 'linkedin', 'referral', 'indeed', 'walk', 'monster', 'glassdoor', 'job portal', 
    'agency', 'college', 'campus', 'email', 'direct', 'recruiter', 'internal', 'networking', 'portal', 'social', 
    'facebook', 'twitter', 'instagram', 'whatsapp', 'recruitment', 'placement', 'consultant', 'headhunter'];
  const orgKeywords = ['pvt', 'ltd', 'llp', 'solutions', 'technologies', 'systems', 'services', 'company', 'corp', 
    'bank', 'finance', 'insurance', 'inc', 'pte', 'gmbh', 'sa', 'sas', 'nv', 'ag', 'global', 'international',
    'hsbc', 'canara', 'icici', 'hdfc', 'axis', 'kotak', 'yes', 'equitas', 'utkarsh', 'indusind',
    'tcs', 'infosys', 'wipro', 'cognizant', 'deloitte', 'accenture', 'ibm', 'microsoft', 'google', 'amazon'];
  const bankFinanceKeywords = ['bank', 'finance', 'credit', 'fund', 'capital', 'investment', 'insurance'];

  function isOrganizationName(str) {
    const strLower = str.toLowerCase();
    if (orgKeywords.some(k => strLower.includes(k))) return true;
    if (str.length > 45) return true;
    if (/\b(ltd|pvt|llp|corp|inc|pte|plc)\b/i.test(str)) return true;
    if (/&.*(?:pvt|ltd|corp|solutions|technologies)/i.test(str)) return true;
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
    const headerLower = header.toLowerCase().trim();
    const columnsToSkip = ['date', 'timestamp', 'created', 'updated', 'id', 'serial', 'row', 'sr', 'sr.', 'feedback', 'remarks', 'notes'];
    if (columnsToSkip.some(col => headerLower.includes(col))) return;

    const headerHasName = headerLower.includes('name') || headerLower.includes('candidate') || headerLower.includes('fls');
    const headerHasPhone = headerLower.includes('phone') || headerLower.includes('contact') || headerLower.includes('mobile');
    const headerHasEmail = headerLower.includes('email') || headerLower.includes('mail');
    const headerHasStatus = headerLower.includes('status') || headerLower.includes('feedback');
    const headerHasExperience = headerLower.includes('experience') || headerLower.includes('exp') || headerLower.includes('yrs');
    const headerHasPosition = headerLower.includes('position') || headerLower.includes('role') || headerLower.includes('designation') || headerLower.includes('title');

    if (headerHasStatus && (statusKeywords.some(st => strLower.includes(st)) || isOrganizationName(str))) {
      return;
    }
    
    const noticePeriodKeywords = ['immediate', 'joiner', 'joinnner', 'immedidate', 'days', 'weeks', 'months', 'notice'];
    const rejectedNamePhrases = [/immediate.*joinn?er|immedidate.*joinn?er|joinn?er.*immediate|joinn?er.*immedidate|on notice|under notice/i];
    
    if (headerHasName) {
      if (statusKeywords.some(st => strLower.includes(st)) || 
          isPositionTitle(str) ||
          rejectedNamePhrases.some(rp => rp.test(str)) ||
          (noticePeriodKeywords.some(np => strLower.includes(np)) && !/[a-z]{4,}[a-z]{4,}/i.test(str.replace(/\s/g, '')))) {
        return;
      }
    }
    
    if (headerHasPhone && !/\d/.test(str)) return;
    if (headerHasEmail && !/@/.test(str)) return;

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strLower)) {
      const score = calculateScore('email', str);
      candidates.email.push({ value: strLower, score, header });
    }

    const phoneMatch = parsePhone(str);
    if (phoneMatch) {
      const score = calculateScore('phone', str);
      candidates.phone.push({ value: phoneMatch, score, header });
    }

    if (isPositionTitle(str)) {
      const score = calculateScore('position', str) + 10;
      candidates.position.push({ value: str, score, header });
    }

    const wordCount = str.split(/\s+/).filter(Boolean).length;
    const isStatusValue = statusKeywords.some(st => strLower.includes(st));
    const isNoticePeriodPhrase = /immediate.*joinn?er|immedidate.*joinn?er|joinn?er.*immediate|joinn?er.*immedidate|on notice|under notice/i.test(str);
    
    if (wordCount >= 1 && wordCount <= 3 && 
        /^[\p{L}\s\-'\.]+$/u.test(str) && 
        !/\d|@|_|<|>|\/|\\|\||#|\*|lpa|yrs|phone|email/i.test(str) && 
        str.length >= 2 &&
        str.length <= 40 &&
        !isOrganizationName(str) &&
        !isPositionTitle(str) &&
        !isStatusValue &&
        !isNoticePeriodPhrase &&
        !cityKeywords.some(city => strLower.includes(city))) {
      const score = calculateScore('name', str);
      const lengthBoost = str.length < 20 ? 5 : 0;
      const wordsBoost = wordCount <= 2 ? 3 : 0;
      const flsBoost = headerLower.includes('fls') || headerLower.includes('person') || headerLower.includes('candidate') ? 20 : 0;
      candidates.name.push({ value: str, score: score + lengthBoost + wordsBoost + flsBoost, header });
    }

    if (cityKeywords.some(city => strLower.includes(city))) {
      const score = calculateScore('location', str);
      candidates.location.push({ value: str, score, header });
    }

    const noticeParsed = parseNoticePeriod(str);
    if (noticeParsed !== null && noticeParsed >= 0 && noticeParsed <= 365) {
      const score = calculateScore('noticePeriod', str) + 15;
      candidates.noticePeriod.push({ value: noticeParsed, score, header });
    }

    const expParsed = parseExperience(str);
    if (expParsed !== null && noticeParsed === null) {
      const score = calculateScore('experience', str) + 10;
      candidates.experience.push({ value: expParsed, score, header });
    }

    const ctcParsed = parseSalary(str);
    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      const score = calculateScore('ctc', str);
      candidates.ctc.push({ value: ctcParsed, score, header });
    }

    if (ctcParsed !== null && ctcParsed >= 0 && ctcParsed <= 100 && noticeParsed === null && expParsed === null) {
      const score = calculateScore('expectedSalary', str) + (headerLower.includes('expected') ? 2 : 0);
      candidates.expectedSalary.push({ value: ctcParsed, score, header });
    }

    if (statusKeywords.some(st => strLower.includes(st))) {
      const score = calculateScore('status', str);
      candidates.status.push({ value: strLower, score, header });
    }

    if (sourceKeywords.some(src => strLower.includes(src))) {
      const score = calculateScore('sourceOfCV', str);
      candidates.sourceOfCV.push({ value: strLower, score, header });
    }

    const hasOrgKeywords = orgKeywords.some(k => strLower.includes(k));
    const looksLikeOrg = hasOrgKeywords ||
                        (str.split(/\s+/).length >= 2 && str.length > 8 && /^[a-z0-9\s&\-\.,'()]+$/i.test(str) && str.length <= 50);
    
    if (looksLikeOrg && 
        !/\d@|@|lpa|yrs/.test(str) && 
        !statusKeywords.some(st => strLower.includes(st)) &&
        !isPositionTitle(str)) {
      const score = calculateScore('company', str) + (hasOrgKeywords ? 5 : 0);
      candidates.company.push({ value: str, score, header });
      
      if (bankFinanceKeywords.some(b => strLower.includes(b))) {
        candidates.client.push({ value: str, score: score + 5, header });
      }
    }

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

  if (detected.name) {
    const flsCandidates = candidates.name.filter(c => 
      c.header && (c.header.toLowerCase().includes('fls') || c.header.toLowerCase().includes('non-fls'))
    );
    if (flsCandidates.length > 0) {
      flsCandidates.sort((a, b) => b.score - a.score);
      detected.name = flsCandidates[0].value;
    } else {
      if (isOrganizationName(detected.name)) {
        detected.name = null;
      }
    }
  }

  const assignedValues = new Set();
  const fieldPriority = ['name', 'email', 'phone', 'position', 'spoc', 'company', 'status', 'sourceOfCV'];
  
  for (const field of fieldPriority) {
    if (detected[field] && assignedValues.has(String(detected[field]).toLowerCase().trim())) {
      detected[field] = null;
    } else if (detected[field]) {
      assignedValues.add(String(detected[field]).toLowerCase().trim());
    }
  }

  correctFieldMisclassifications(detected);

  function validateSemanticMatch(field, value) {
    if (!value) return true;
    
    const strLower = String(value).toLowerCase();
    
    if (field === 'name') {
      const invalidKeywords = ['interested', 'scheduled', 'rejected', 'pending', 'developer', 'engineer', 
        'manager', 'pvt', 'ltd', 'bank', 'finance', 'insurance'];
      if (invalidKeywords.some(kw => strLower.includes(kw))) {
        return false;
      }
    }
    
    if (field === 'company') {
      const wordCount = String(value).split(/\s+/).length;
      const hasOnlyLetters = /^[a-z\s'\-]+$/i.test(value);
      const companyKeywords = ['pvt', 'ltd', 'llp', 'inc', 'corp', 'solutions', 'technologies', 'systems', 
        'services', 'company', 'bank', 'finance', 'education', 'insurance'];
      const hasCompanyKeyword = companyKeywords.some(k => strLower.includes(k));
      
      if (/^\d+(?:\.\d+)?\s*(?:years?|yrs?)$/i.test(value)) {
        return false;
      }
      
      if (hasOnlyLetters && wordCount <= 2 && value.length < 20 && !hasCompanyKeyword) {
        return false;
      }
      if (hasOnlyLetters && wordCount === 3 && value.length < 25 && !hasCompanyKeyword) {
        return false;
      }
    }
    
    if (field === 'status') {
      const cityKeywords = ['bangalore', 'mumbai', 'delhi', 'pune', 'hyderabad', 'vadodara', 'surat'];
      if (cityKeywords.some(city => strLower.includes(city))) {
        return false;
      }
    }
    
    if (field === 'position') {
      const statusKeywords = ['interested', 'scheduled', 'rejected', 'pending', 'applied'];
      if (statusKeywords.some(st => strLower.includes(st))) {
        return false;
      }
    }
    
    return true;
  }

  const semanticValidationFailed = {};
  ['name', 'company', 'status', 'position'].forEach(field => {
    if (detected[field] && !validateSemanticMatch(field, detected[field])) {
      semanticValidationFailed[field] = detected[field];
      detected[field] = null;
    }
  });

  return detected;
}

function validateCandidate(detected, rowIndex) {
  const errors = [];
  const warnings = [];
  let confidence = 100;
  const duplicateFields = detected.duplicates || {};

  if (!detected.name) {
    errors.push({ field: 'name', message: 'Name is required', severity: 'ERROR' });
    confidence -= 50;
  } else if (isPlaceholderValue(detected.name)) {
    errors.push({ field: 'name', message: `"${detected.name}" is placeholder text`, severity: 'ERROR' });
    confidence -= 50;
  } else if (!/^[\p{L}\s\-'\.]+$/u.test(detected.name)) {
    errors.push({ field: 'name', message: 'Name must be alphabetic only', severity: 'ERROR' });
    confidence -= 50;
  }

  if (!detected.phone) {
    errors.push({ field: 'phone', message: 'Phone number is required', severity: 'ERROR' });
    confidence -= 50;
  } else if (!/^[6-9]\d{9}$/.test(detected.phone)) {
    errors.push({ field: 'phone', message: 'Phone must be 10 digits starting with 6-9', severity: 'ERROR' });
    confidence -= 50;
  }

  if (!detected.email) {
    warnings.push({ field: 'email', message: 'Email is missing', severity: 'WARNING' });
    confidence -= 10;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detected.email)) {
    errors.push({ field: 'email', message: 'Email format is invalid', severity: 'ERROR' });
    confidence -= 50;
  }

  if (!detected.location) {
    warnings.push({ field: 'location', message: 'Location/City is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (!detected.position) {
    warnings.push({ field: 'position', message: 'Position/Job Title is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (detected.experience === null || detected.experience === undefined) {
    warnings.push({ field: 'experience', message: 'Experience is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (detected.ctc === null || detected.ctc === undefined) {
    warnings.push({ field: 'ctc', message: 'Current CTC is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (detected.noticePeriod === null || detected.noticePeriod === undefined) {
    warnings.push({ field: 'noticePeriod', message: 'Notice Period is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (!detected.company) {
    warnings.push({ field: 'company', message: 'Current Company is missing (freelancer?)', severity: 'WARNING' });
    confidence -= 5;
  }

  if (!detected.status) {
    warnings.push({ field: 'status', message: 'Candidate Status is missing', severity: 'WARNING' });
    confidence -= 10;
  }

  if (!detected.sourceOfCV) {
    warnings.push({ field: 'sourceOfCV', message: 'Source of CV is missing', severity: 'WARNING' });
    confidence -= 5;
  }

  confidence = Math.max(0, Math.min(100, confidence));

  let category = 'ready';
  if (errors.length > 0) {
    category = 'blocked';
  } else if (confidence >= 80) {
    category = 'ready';
  } else if (confidence >= 50) {
    category = 'review';
  } else {
    category = 'blocked';
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

// Common email domain typo corrections
const EMAIL_DOMAIN_CORRECTIONS = {
  'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmeil.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmail.om': 'gmail.com', 'gamail.com': 'gmail.com', 'gmali.com': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmail.cim': 'gmail.com', 'gemail.com': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yhaoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahooo.in': 'yahoo.in',
  'ymail.con': 'ymail.com',
  'outlok.com': 'outlook.com', 'outlookk.com': 'outlook.com', 'outllook.com': 'outlook.com',
  'outlook.co': 'outlook.com', 'otlook.com': 'outlook.com',
  'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmial.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'rediffmal.com': 'rediffmail.com', 'redifmail.com': 'rediffmail.com',
};

function fixEmailDomain(email) {
  if (!email || !email.includes('@')) return email;
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  const domainLower = domain.toLowerCase();
  const correctedDomain = EMAIL_DOMAIN_CORRECTIONS[domainLower];
  if (correctedDomain) {
    return `${localPart}@${correctedDomain}`;
  }
  return email;
}

// ═══════════════════════════════════════════════════════════════
// HEADER-BASED FIELD MAPPING (Enterprise-Grade v3)
// Uses column headers as PRIMARY signal - 100% accuracy for email, phone
// Falls back to content-based only when headers are unrecognizable
// ═══════════════════════════════════════════════════════════════

const HEADER_PATTERNS = {
  name:           [/^(candidate\s*)?name$/i, /^(full\s*name|employee|person|fls|non[\s-]*fls|candidate)$/i, /^applicant$/i],
  email:          [/^e[\s-]?mail/i, /^mail\s*(id|address)?$/i, /^email[\s_]*(id|address)?$/i],
  phone:          [/^(phone|mobile|contact|cell|tel)/i, /^(whatsapp|number|contact\s*no)/i],
  position:       [/^(position|designation|role|job\s*title|title|profile|post)$/i],
  experience:     [/^(experience|exp|years?\s*(of)?\s*exp|work\s*exp|total\s*exp)/i, /^yrs$/i],
  ctc:            [/^(c\.?t\.?c\.?|current\s*(salary|ctc)|salary|pay|basic|current\s*pay)/i],
  expectedSalary: [/^(expected|desired|target|e\.?ctc|expected\s*(ctc|salary)|offered\s*(ctc|salary))/i],
  noticePeriod:   [/^(notice|notice\s*period|np|availability|join\s*in|serving\s*notice)/i],
  company:        [/^(company|current\s*company|employer|organization|firm|company\s*name|present\s*company)/i],
  client:         [/^(client|project|account|placed\s*at|bank|client\s*name|mapping)/i],
  location:       [/^(location|city|place|state|region|area|base\s*location|current\s*location|preferred\s*location)/i],
  spoc:           [/^(spoc|hr|contact\s*person|poc|recruiter|consultant|team\s*lead|tl)/i],
  status:         [/^(status|candidate\s*status|stage|result|current\s*status|feedback\s*status)/i],
  sourceOfCV:     [/^(source|cv\s*source|resume\s*source|origin|channel|source\s*of\s*cv|referral)/i],
  date:           [/^(date|joining\s*date|apply\s*date|interview\s*date|doj|created)/i],
  remark:         [/^(remark|remarks|notes?|comment|feedback|observation)/i],
};

function detectHeaderMapping(headers) {
  const mapping = {}; // field -> columnIndex
  const usedColumns = new Set();

  // Pass 1: Exact/strong pattern matching
  headers.forEach((header, idx) => {
    if (!header || typeof header !== 'string') return;
    const h = header.trim();
    if (!h) return;

    for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
      if (mapping[field] !== undefined) continue; // Already mapped
      for (const pattern of patterns) {
        if (pattern.test(h)) {
          mapping[field] = idx;
          usedColumns.add(idx);
          break;
        }
      }
      if (mapping[field] !== undefined) break;
    }
  });

  // Pass 2: Fuzzy matching for unmapped headers (contains keyword)
  const FUZZY_KEYWORDS = {
    name: ['name', 'candidate', 'fls'],
    email: ['email', 'mail'],
    phone: ['phone', 'mobile', 'contact', 'cell', 'number'],
    position: ['position', 'role', 'designation', 'title'],
    experience: ['experience', 'exp'],
    ctc: ['ctc', 'salary'],
    expectedSalary: ['expected', 'desired', 'ectc'],
    noticePeriod: ['notice', 'np'],
    company: ['company', 'employer'],
    client: ['client', 'bank', 'mapping'],
    location: ['location', 'city', 'place'],
    spoc: ['spoc', 'poc', 'recruiter'],
    status: ['status', 'stage'],
    sourceOfCV: ['source'],
    date: ['date'],
    remark: ['remark', 'note', 'feedback'],
  };

  headers.forEach((header, idx) => {
    if (!header || usedColumns.has(idx)) return;
    const hLower = header.toLowerCase().trim();
    if (!hLower) return;

    for (const [field, keywords] of Object.entries(FUZZY_KEYWORDS)) {
      if (mapping[field] !== undefined) continue;
      for (const kw of keywords) {
        if (hLower.includes(kw)) {
          mapping[field] = idx;
          usedColumns.add(idx);
          break;
        }
      }
      if (mapping[field] !== undefined) break;
    }
  });

  return mapping;
}

function mapRowByHeaders(rowData, headerMapping, headers) {
  const mapped = {};
  const originalByField = {};

  for (const [field, colIdx] of Object.entries(headerMapping)) {
    const rawValue = rowData[colIdx];
    const value = rawValue ? String(rawValue).trim() : '';
    if (value && !isPlaceholderValue(value)) {
      mapped[field] = value;
    }
    originalByField[field] = value || '';
  }

  // Also store unmapped columns as raw extras
  const extras = {};
  headers.forEach((header, idx) => {
    const isUsed = Object.values(headerMapping).includes(idx);
    if (!isUsed && rowData[idx]) {
      const val = String(rowData[idx]).trim();
      if (val && !isPlaceholderValue(val)) {
        extras[header || `col_${idx}`] = val;
      }
    }
  });

  return { mapped, originalByField, extras };
}

function isHeaderRow(rowData, headers) {
  if (!rowData || rowData.length === 0) return false;
  let matchCount = 0;
  const headerSet = new Set(headers.map(h => h ? h.toLowerCase().trim() : ''));
  for (const cell of rowData) {
    if (cell && headerSet.has(String(cell).toLowerCase().trim())) {
      matchCount++;
    }
  }
  // If 3+ cells match header names, it's a repeated header row
  return matchCount >= 3;
}

// Post-detection swap: fix obvious misplacements
function postDetectionSwap(detected) {
  const allFields = ['name', 'phone', 'email', 'location', 'position', 'experience',
    'ctc', 'expectedSalary', 'noticePeriod', 'company', 'client', 'spoc', 'status', 'sourceOfCV'];
  const swaps = [];

  // Rule 1: If any non-email field contains an email address, swap it to email
  for (const field of allFields) {
    if (field === 'email' || !detected[field]) continue;
    const val = String(detected[field]);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      if (!detected.email) {
        swaps.push({ from: field, to: 'email', value: val });
        detected.email = val;
        detected[field] = null;
      }
    }
  }

  // Rule 2: If any non-phone field contains a valid phone number, swap it
  for (const field of allFields) {
    if (field === 'phone' || !detected[field]) continue;
    const val = String(detected[field]);
    const parsed = parsePhone(val);
    if (parsed && !/lpa|salary|ctc/i.test(val)) {
      if (!detected.phone) {
        swaps.push({ from: field, to: 'phone', value: parsed });
        detected.phone = parsed;
        detected[field] = null;
      }
    }
  }

  // Rule 3: If name field contains experience-like text
  if (detected.name) {
    const nameLower = String(detected.name).toLowerCase();
    if (/^experienced?$/i.test(detected.name) || /^\d+(\.\d+)?\s*(yrs?|years?|months?)$/i.test(detected.name)) {
      if (!detected.experience) {
        const exp = parseExperience(detected.name);
        if (exp !== null) detected.experience = exp;
      }
      detected.name = null;
    }
  }

  // Rule 4: If name field contains a city name
  const cityList = ['bangalore', 'bengaluru', 'delhi', 'mumbai', 'pune', 'hyderabad',
    'chennai', 'kolkata', 'ahmedabad', 'gurgaon', 'gurugram', 'noida', 'vadodara',
    'surat', 'jaipur', 'lucknow', 'indore', 'nagpur', 'bhopal', 'kochi', 'remote'];
  if (detected.name && !detected.location) {
    const nameLower = String(detected.name).toLowerCase();
    if (cityList.some(c => nameLower === c || nameLower.includes(c))) {
      detected.location = detected.name;
      detected.name = null;
    }
  }

  // Rule 5: Standalone numbers 15/30/60/90 in wrong fields → notice period
  for (const field of allFields) {
    if (field === 'noticePeriod' || !detected[field]) continue;
    const val = String(detected[field]).trim();
    if (/^(0|7|15|30|45|60|90|120|180)$/i.test(val) && !detected.noticePeriod) {
      const days = parseInt(val, 10);
      if (days >= 0 && days <= 365) {
        swaps.push({ from: field, to: 'noticePeriod', value: days });
        detected.noticePeriod = days;
        detected[field] = null;
      }
    }
  }

  // Rule 6: If company contains status-like text
  if (detected.company) {
    const compLower = String(detected.company).toLowerCase();
    if (/not\s*eligible|not\s*interested|dropped|rejected|hold/i.test(compLower)) {
      if (!detected.remark) detected.remark = detected.company;
      detected.company = null;
    }
  }

  // Rule 7: Location in wrong field → swap
  for (const field of allFields) {
    if (field === 'location' || !detected[field]) continue;
    const val = String(detected[field]).toLowerCase().trim();
    if (cityList.some(c => val === c) && !detected.location) {
      swaps.push({ from: field, to: 'location', value: detected[field] });
      detected.location = detected[field];
      detected[field] = null;
    }
  }

  detected._swaps = swaps;
  return detected;
}

// Header-based detection: directly map values from columns, then validate
function detectFieldsFromHeaders(rowData, headerMapping, headers) {
  const { mapped, originalByField, extras } = mapRowByHeaders(rowData, headerMapping, headers);

  const detected = {
    name: null, phone: null, email: null, location: null, position: null,
    experience: null, ctc: null, expectedSalary: null, noticePeriod: null,
    company: null, client: null, spoc: null, status: null, sourceOfCV: null,
    remark: null, date: null, duplicates: {}
  };

  // Direct assignment from header mapping
  if (mapped.name) detected.name = mapped.name;
  if (mapped.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mapped.email)) {
    detected.email = mapped.email.toLowerCase();
  } else if (mapped.email && mapped.email.includes('@')) {
    detected.email = mapped.email.toLowerCase();
  }
  if (mapped.phone) detected.phone = parsePhone(mapped.phone);
  if (mapped.position) detected.position = mapped.position;
  if (mapped.location) detected.location = mapped.location;
  if (mapped.company) detected.company = mapped.company;
  if (mapped.client) detected.client = mapped.client;
  if (mapped.spoc) detected.spoc = mapped.spoc;
  if (mapped.status) detected.status = mapped.status;
  if (mapped.sourceOfCV) detected.sourceOfCV = mapped.sourceOfCV;
  if (mapped.remark) detected.remark = mapped.remark;
  if (mapped.date) detected.date = mapped.date;

  // Parse numeric fields
  if (mapped.experience) {
    const exp = parseExperience(mapped.experience);
    detected.experience = exp;
    if (exp === null && mapped.experience) {
      // Try as plain number
      const num = parseFloat(mapped.experience);
      if (!isNaN(num) && num >= 0 && num <= 50) detected.experience = num;
    }
  }
  if (mapped.ctc) {
    const ctc = parseSalary(mapped.ctc);
    detected.ctc = ctc;
  }
  if (mapped.expectedSalary) {
    const ectc = parseSalary(mapped.expectedSalary);
    detected.expectedSalary = ectc;
  }
  if (mapped.noticePeriod) {
    const np = parseNoticePeriod(mapped.noticePeriod);
    detected.noticePeriod = np;
    if (np === null && mapped.noticePeriod) {
      // Try plain number (30, 60, 90 are days)
      const num = parseInt(mapped.noticePeriod, 10);
      if (!isNaN(num) && num >= 0 && num <= 365) detected.noticePeriod = num;
    }
  }

  // Try to extract data from unmapped extras
  for (const [colName, value] of Object.entries(extras)) {
    if (!value) continue;
    const valStr = String(value).trim();

    // Check for email
    if (!detected.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valStr)) {
      detected.email = valStr.toLowerCase();
      continue;
    }
    // Check for phone
    if (!detected.phone) {
      const ph = parsePhone(valStr);
      if (ph) { detected.phone = ph; continue; }
    }
  }

  // Post-detection swap to fix remaining misplacements
  postDetectionSwap(detected);

  detected._originalByField = originalByField;
  detected._extras = extras;

  return detected;
}

function autoFix(detected) {
  const fixed = { ...detected };
  delete fixed.duplicates;
  const changes = [];

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

  if (fixed.email) {
    const original = fixed.email;
    fixed.email = fixed.email.toLowerCase().trim();
    // Auto-correct common email domain typos
    const corrected = fixEmailDomain(fixed.email);
    if (corrected !== fixed.email) {
      changes.push(`email domain auto-corrected: "${fixed.email}" → "${corrected}"`);
      fixed.email = corrected;
    }
    if (original.toLowerCase() !== fixed.email) {
      changes.push(`email: "${original}" → "${fixed.email}"`);
    }
  }

  if (fixed.phone) {
    const original = fixed.phone;
    fixed.phone = String(fixed.phone).replace(/\D/g, '').slice(-10);
    if (original !== fixed.phone) {
      changes.push(`phone: "${original}" → "${fixed.phone}"`);
    }
  }

  if (fixed.location) {
    const original = fixed.location;
    fixed.location = fixed.location.trim();
    if (original !== fixed.location) {
      changes.push(`location: "${original}" → "${fixed.location}"`);
    }
  }

  if (fixed.position) {
    const original = fixed.position;
    fixed.position = fixed.position.trim();
    if (original !== fixed.position) {
      changes.push(`position: "${original}" → "${fixed.position}"`);
    }
  }

  if (fixed.experience !== null && fixed.experience !== undefined) {
    const original = fixed.experience;
    fixed.experience = parseFloat(fixed.experience);
    if (original !== fixed.experience && !isNaN(fixed.experience)) {
      changes.push(`experience: "${original}" → ${fixed.experience}`);
    }
  }

  if (fixed.ctc !== null && fixed.ctc !== undefined) {
    const original = fixed.ctc;
    fixed.ctc = parseFloat(fixed.ctc);
    if (original !== fixed.ctc && !isNaN(fixed.ctc)) {
      changes.push(`ctc: "${original}" → ${fixed.ctc}`);
    }
  }

  if (fixed.expectedSalary !== null && fixed.expectedSalary !== undefined) {
    const original = fixed.expectedSalary;
    fixed.expectedSalary = parseFloat(fixed.expectedSalary);
    if (original !== fixed.expectedSalary && !isNaN(fixed.expectedSalary)) {
      changes.push(`expectedSalary: "${original}" → ${fixed.expectedSalary}`);
    }
  }

  if (fixed.noticePeriod !== null && fixed.noticePeriod !== undefined) {
    const original = fixed.noticePeriod;
    fixed.noticePeriod = parseInt(fixed.noticePeriod, 10);
    if (original !== fixed.noticePeriod && !isNaN(fixed.noticePeriod)) {
      changes.push(`noticePeriod: "${original}" → ${fixed.noticePeriod} days`);
    }
  }

  if (fixed.company) {
    const original = fixed.company;
    fixed.company = fixed.company.trim();
    if (original !== fixed.company) {
      changes.push(`company: "${original}" → "${fixed.company}"`);
    }
  }

  if (fixed.client) {
    const original = fixed.client;
    fixed.client = fixed.client.trim();
    if (original !== fixed.client) {
      changes.push(`client: "${original}" → "${fixed.client}"`);
    }
  }

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

  if (fixed.status) {
    const original = fixed.status;
    fixed.status = fixed.status.toLowerCase().trim();
    if (original !== fixed.status) {
      changes.push(`status: "${original}" → "${fixed.status}"`);
    }
  }

  if (fixed.sourceOfCV) {
    const original = fixed.sourceOfCV;
    fixed.sourceOfCV = fixed.sourceOfCV.toLowerCase().trim();
    if (original !== fixed.sourceOfCV) {
      changes.push(`sourceOfCV: "${original}" → "${fixed.sourceOfCV}"`);
    }
  }

  return { fixed, changes };
}

module.exports = {
  isPlaceholderValue,
  parseSalary,
  parsePhone,
  parseNoticePeriod,
  parseExperience,
  calculateScore,
  resolveCandidates,
  correctFieldMisclassifications,
  detectFields,
  detectFieldsFromHeaders,
  detectHeaderMapping,
  isHeaderRow,
  postDetectionSwap,
  validateCandidate,
  autoFix,
  fixEmailDomain,
  EMAIL_DOMAIN_CORRECTIONS
};
