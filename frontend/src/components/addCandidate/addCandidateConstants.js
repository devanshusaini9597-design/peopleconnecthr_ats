/** Local calendar date YYYY-MM-DD (not UTC). */
export function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getInitialFormState() {
  return {
    srNo: '',
    date: todayLocalISO(),
    location: '',
    position: '',
    fls: '',
    name: '',
    contact: '',
    email: '',
    companyName: '',
    experience: '',
    ctc: '',
    expectedCtc: '',
    noticePeriod: '',
    status: 'APPLIED',
    client: '',
    spoc: '',
    source: '',
    resume: null,
    callBackDate: '',
    countryCode: '+91',
    skills: '',
    product: '',
    pan: '',
    remark: '',
  };
}

export function blankCandidateForm(role) {
  const next = getInitialFormState();
  if (role === 'freelancer') next.source = 'Freelance';
  return next;
}

/** @deprecated Prefer getInitialFormState() so date is always “today”. */
export const INITIAL_FORM_STATE = getInitialFormState();
