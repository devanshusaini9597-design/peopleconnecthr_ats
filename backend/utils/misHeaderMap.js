/**
 * MIS spreadsheet header aliases.
 * Tracker files often use the same meaning with different labels.
 */

function headerNorm(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

const POSITION_EXACT = new Set([
  'position', 'designation', 'role', 'jobrole', 'profile',
  'roleapply', 'roleapplied', 'appliedrole', 'appliedfor', 'jobapplied',
  'ruleapply', 'ruleapplied',
]);

const COMPANY_EXACT = new Set([
  'company', 'companyname', 'currentcompany', 'presentcompany',
  'employer', 'organisation', 'organization',
]);

const CTC_EXACT = new Set([
  'ctc', 'currentctc', 'cctc', 'presentctc', 'currentsalary',
]);

const EXPECTED_CTC_EXACT = new Set([
  'expectedctc', 'ectc', 'expectedsalary', 'expectedcc',
]);

const NOTICE_EXACT = new Set([
  'notice', 'noticeperiod', 'np', 'npdays', 'npday', 'noticedays', 'npindays',
]);

const LOCATION_EXACT = new Set([
  'location', 'city', 'branch', 'branches', 'basebranch', 'worklocation', 'workcity',
]);

function autoDetectHeaderMapping(headerRow) {
  const candidates = {};
  const set = (field, col, priority) => {
    if (!candidates[field] || candidates[field].priority < priority) {
      candidates[field] = { col, priority };
    }
  };

  headerRow.eachCell((cell, colNumber) => {
    const header = String(cell.value || '').toLowerCase().trim();
    const norm = headerNorm(header);
    if (!norm) return;
    const has = (s) => header.includes(s) || norm.includes(String(s).replace(/[^a-z0-9]/g, ''));

    if (norm === 'name' || norm === 'candidatename' || norm === 'fullname') set('name', colNumber, 10);
    else if ((has('name') || has('candidate')) && !has('company')) set('name', colNumber, 5);

    if (norm === 'email' || norm === 'emailid') set('email', colNumber, 10);
    else if (has('email') || has('mail')) set('email', colNumber, 5);

    if (norm === 'contact' || norm === 'phone' || norm === 'mobile' || norm === 'contactno' || norm === 'mobileno') {
      set('contact', colNumber, 10);
    } else if (has('contact') || has('phone') || has('mobile')) {
      set('contact', colNumber, 5);
    }

    if (POSITION_EXACT.has(norm)) set('position', colNumber, 10);
    else if (has('position') || has('designation') || has('role')) set('position', colNumber, 5);

    if (COMPANY_EXACT.has(norm)) set('companyName', colNumber, 10);
    else if (has('company') || has('employer') || has('organisation') || has('organization')) set('companyName', colNumber, 5);

    if (norm === 'experience' || norm === 'exp' || norm === 'workexp') set('experience', colNumber, 10);
    else if (has('experience') || (has('exp') && !has('expected'))) set('experience', colNumber, 5);

    if (EXPECTED_CTC_EXACT.has(norm) || (has('expected') && (has('ctc') || has('salary')))) {
      set('expectedCtc', colNumber, 12);
    } else if (CTC_EXACT.has(norm)) {
      set('ctc', colNumber, 10);
    } else if (has('ctc') && !has('expected')) {
      set('ctc', colNumber, 5);
    }

    if (NOTICE_EXACT.has(norm)) set('noticePeriod', colNumber, 10);
    else if (has('notice') || (norm.startsWith('np') && (has('day') || has('period')))) {
      set('noticePeriod', colNumber, 5);
    }

    if (LOCATION_EXACT.has(norm)) set('location', colNumber, 10);
    else if (has('location') || has('city') || has('branch')) set('location', colNumber, 5);

    if (norm === 'skills' || norm === 'skill') set('skills', colNumber, 10);
    else if (has('skill')) set('skills', colNumber, 5);

    if (norm === 'product') set('product', colNumber, 10);
    else if (has('product')) set('product', colNumber, 5);

    if (norm === 'client') set('client', colNumber, 10);
    else if (has('client')) set('client', colNumber, 5);

    if (norm === 'fls' || norm === 'nonfls') set('fls', colNumber, 10);
    else if (has('fls')) set('fls', colNumber, 5);

    if (norm === 'source') set('source', colNumber, 10);
    else if (has('source')) set('source', colNumber, 5);

    if (norm === 'remark' || norm === 'remarks' || norm === 'notes') set('remark', colNumber, 10);
    else if (has('remark') || has('note')) set('remark', colNumber, 5);

    // Tracker "Date" / added-on — not upload time
    if (
      norm === 'date'
      || norm === 'addedon'
      || norm === 'addeddate'
      || norm === 'entrydate'
      || norm === 'recorddate'
      || norm === 'leaddate'
      || norm === 'createddate'
      || norm === 'dated'
    ) {
      set('recordDate', colNumber, 10);
    } else if (
      (has('date') || has('dated'))
      && !has('update')
      && !has('birth')
      && !has('join')
      && !has('notice')
    ) {
      set('recordDate', colNumber, 5);
    }
  });

  const map = {};
  Object.keys(candidates).forEach((k) => { map[k] = candidates[k].col; });
  return map;
}

module.exports = {
  headerNorm,
  autoDetectHeaderMapping,
};
