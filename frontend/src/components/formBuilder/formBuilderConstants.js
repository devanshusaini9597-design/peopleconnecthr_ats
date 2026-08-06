export const FORM_TOUR_KEY = 'skillnix_tour_form_builder_v1';
export const FORM_TOUR_STEPS = [
  {
    title: 'Application Forms',
    body: 'Build a custom careers apply form per job — fields, required rules, and optional show-when logic.',
  },
  {
    target: '[data-tour="form-settings"]',
    title: 'Job & form settings',
    body: 'Pick the job this form belongs to, set the form title, or remove the custom form to fall back to the default apply flow.',
    placement: 'right',
  },
  {
    target: '[data-tour="form-builder"]',
    title: 'Field builder',
    body: 'Add and configure fields — type, placeholder, required, dropdown options, and conditional visibility.',
    placement: 'left',
  },
  {
    target: '[data-tour="form-preview"]',
    title: 'Live preview',
    body: 'See how candidates will experience the form on the careers apply page.',
    placement: 'left',
  },
  {
    target: '[data-tour="form-save"]',
    title: 'Save',
    body: 'When you are ready, save the form so it goes live for that job’s public application.',
    placement: 'bottom',
  },
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Short text', description: 'Single-line answer' },
  { value: 'textarea', label: 'Long text', description: 'Multi-line answer' },
  { value: 'email', label: 'Email', description: 'Email address' },
  { value: 'phone', label: 'Phone', description: 'Phone number' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'date', label: 'Date', description: 'Date picker' },
  { value: 'select', label: 'Dropdown', description: 'Choose one option' },
  { value: 'radio', label: 'Radio', description: 'Radio group' },
  { value: 'checkbox', label: 'Checkbox', description: 'Checkbox control' },
  { value: 'yes_no', label: 'Yes / No', description: 'Binary choice' },
  { value: 'url', label: 'URL', description: 'Website link' },
  { value: 'file', label: 'File', description: 'File upload' }
];

export const emptyField = () => ({
  label: '',
  type: 'text',
  required: false,
  placeholder: '',
  options: ['Option 1', 'Option 2'],
  showWhen: { fieldKey: '', equals: '' }
});

export const DEFAULT_FIELDS = [
  { label: 'Full name', type: 'text', required: true, placeholder: 'Your name', options: [] },
  { label: 'Email', type: 'email', required: true, placeholder: 'you@email.com', options: [] },
  { label: 'Phone', type: 'phone', required: false, placeholder: '+91…', options: [] },
  { label: 'Cover letter', type: 'textarea', required: false, placeholder: 'Tell us about yourself', options: [] }
];

export function fieldKey(f, i) {
  if (f?.key) return f.key;
  const fromLabel = String(f?.label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return fromLabel || `field_${i}`;
}
