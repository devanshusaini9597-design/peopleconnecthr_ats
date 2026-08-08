export const getOriginal = (c, fieldKey) => {
  const o = c?.originalData || {};
  const keyMap = {
    name: ['name', 'candidate', 'candidate name', 'full name'],
    email: ['email', 'e-mail', 'mail', 'mail id'],
    contact: ['contact', 'phone', 'mobile', 'number', 'contact no'],
    position: ['position', 'designation', 'role', 'job title'],
    companyName: ['company', 'company name', 'current company', 'employer'],
    location: ['location', 'city', 'place'],
    ctc: ['ctc', 'current ctc', 'salary'],
    expectedCtc: ['expected', 'expected ctc', 'expected salary'],
    experience: ['experience', 'exp', 'years'],
    noticePeriod: ['notice', 'notice period', 'np'],
    status: ['status', 'candidate status'],
    source: ['source', 'source of cv'],
    client: ['client', 'client name'],
    spoc: ['spoc', 'hr', 'poc'],
    remark: ['remark', 'remarks', 'notes'],
    date: ['date', 'created', 'created date'],
  };
  const keys = keyMap[fieldKey] || [fieldKey];
  for (const k of keys) {
    const found = Object.entries(o).find(([key]) => key.toLowerCase().trim() === k.toLowerCase());
    if (found && found[1] != null && String(found[1]).trim() !== '') return found[1];
  }
  if (o[fieldKey] != null && String(o[fieldKey]).trim() !== '') return o[fieldKey];
  return null;
};

export const isImportReady = (c) => {
  const email = String(c.email || '').trim();
  const phone = String(c.contact || '').replace(/\D/g, '');
  return Boolean(
    String(c.name || '').trim()
    && email
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
    && phone.length >= 10
    && String(c.companyName || '').trim()
    && String(c.ctc || '').trim()
  );
};

export const buildEditPayload = (editing) => ({
  name: String(editing.name || '').trim(),
  email: String(editing.email || '').trim().toLowerCase(),
  contact: String(editing.contact || '').trim(),
  position: editing.position || '',
  companyName: String(editing.companyName || '').trim(),
  location: String(editing.location || '').trim(),
  ctc: editing.ctc || '',
  expectedCtc: editing.expectedCtc || '',
  experience: editing.experience != null ? String(editing.experience) : '',
  noticePeriod: editing.noticePeriod || '',
  status: editing.status || 'Applied',
  source: editing.source || '',
  client: editing.client || '',
  spoc: String(editing.spoc || '').trim(),
  remark: String(editing.remark || '').trim(),
  fls: editing.fls || '',
  date: editing.date || '',
});

export const validateEditFields = (editing) => {
  const err = {};
  if (!(editing?.name || '').trim()) err.name = 'Required';
  if (!(editing?.email || '').trim()) err.email = 'Required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(editing.email).trim())) err.email = 'Invalid email';
  const phone = String(editing?.contact || '').replace(/\D/g, '');
  if (phone.length < 10) err.contact = '10-digit mobile required';
  if (!(editing?.companyName || '').trim()) err.companyName = 'Required';
  if (!(editing?.ctc || '').trim()) err.ctc = 'Required';
  return err;
};
