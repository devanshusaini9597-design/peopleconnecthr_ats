/**
 * Email template CRUD, seed, and subscribe ensure.
 */
const EmailTemplate = require('../models/EmailTemplate');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const SUBSCRIBE_BODY = `Dear {{candidateName}},

Thank you for your interest in {{company}}. We would like to keep you informed with relevant opportunities and updates.

What you'll receive when you subscribe:

• Curated job alerts matched to your skills and preferences
• Early notice of hiring drives and new openings from our partner companies
• Occasional industry insights and career tips from our HR team

Click the button below to subscribe. You will then be added to our mailing list and will receive future updates via email.

Subscribe now: {{subscribeLink}}

Best regards,
Skillnix Recruitment Services`;

function subscribeTemplatePayload(userId) {
  return {
    name: 'Subscribe for Updates',
    category: 'marketing',
    subject: 'Stay ahead with {{company}} – Job alerts and updates',
    body: SUBSCRIBE_BODY,
    variables: ['candidateName', 'company', 'subscribeLink'],
    isDefault: true,
    createdBy: userId
  };
}

async function listTemplates(userId) {
  const SUBSCRIBE_TEMPLATE = subscribeTemplatePayload(userId);
  let templates = await EmailTemplate.find({
    $or: [{ createdBy: userId }, { isDefault: true }]
  }).sort({ isDefault: -1, updatedAt: -1 });

  const hasSubscribe = templates.some((t) => t.name === 'Subscribe for Updates' && t.category === 'marketing');
  if (!hasSubscribe) {
    const created = await EmailTemplate.create(SUBSCRIBE_TEMPLATE);
    templates = [created, ...templates];
  } else {
    const existingSubscribe = templates.find((t) => t.name === 'Subscribe for Updates' && t.category === 'marketing');
    if (existingSubscribe && existingSubscribe.body && existingSubscribe.body.includes('unsubscribe')) {
      existingSubscribe.body = SUBSCRIBE_TEMPLATE.body;
      existingSubscribe.subject = SUBSCRIBE_TEMPLATE.subject;
      existingSubscribe.variables = SUBSCRIBE_TEMPLATE.variables;
      await existingSubscribe.save();
    }
  }
  templates.sort((a, b) => {
    const aFirst = (a.name === 'Subscribe for Updates' && a.category === 'marketing') ? 1 : 0;
    const bFirst = (b.name === 'Subscribe for Updates' && b.category === 'marketing') ? 1 : 0;
    if (bFirst !== aFirst) return bFirst - aFirst;
    return (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || (new Date(b.updatedAt) - new Date(a.updatedAt));
  });
  return templates;
}

async function ensureSubscribe(userId) {
  const existing = await EmailTemplate.findOne({ name: 'Subscribe for Updates', category: 'marketing' });
  if (existing) return { template: existing, added: false };
  const template = await EmailTemplate.create(subscribeTemplatePayload(userId));
  return { template, added: true };
}

async function getTemplate(userId, id) {
  const template = await EmailTemplate.findOne({
    _id: id,
    $or: [{ createdBy: userId }, { isDefault: true }]
  });
  if (!template) throw httpError('Template not found', 404);
  return template;
}

async function createTemplate(userId, body) {
  const { name, category, subject, body: tplBody, variables } = body;
  if (!name || !subject || !tplBody) throw httpError('Name, subject and body are required');
  return EmailTemplate.create({
    name,
    category: category || 'custom',
    subject,
    body: tplBody,
    variables: variables || [],
    createdBy: userId,
    isDefault: false
  });
}

async function updateTemplate(userId, id, body) {
  const template = await EmailTemplate.findOne({ _id: id, createdBy: userId });
  if (!template) throw httpError('Template not found or not editable', 404);
  const { name, category, subject, body: tplBody, variables } = body;
  if (name) template.name = name;
  if (category) template.category = category;
  if (subject) template.subject = subject;
  if (tplBody) template.body = tplBody;
  if (variables) template.variables = variables;
  await template.save();
  return template;
}

async function deleteTemplate(userId, id) {
  const template = await EmailTemplate.findOneAndDelete({ _id: id, createdBy: userId, isDefault: false });
  if (!template) throw httpError('Template not found or cannot be deleted', 404);
  return { message: 'Template deleted' };
}

async function seedDefaults(userId) {
  const existing = await EmailTemplate.countDocuments({ isDefault: true });
  const subscribeTemplate = subscribeTemplatePayload(userId);
  if (existing > 0) {
    await EmailTemplate.findOneAndUpdate(
      { name: 'Subscribe for Updates', category: 'marketing' },
      { $setOnInsert: subscribeTemplate },
      { upsert: true }
    );
    return { message: 'Default templates already exist; marketing template ensured', count: existing, seeded: false };
  }

  const defaults = [
    {
      name: 'Hiring Drive Invitation',
      category: 'hiring',
      subject: 'Hiring Drive – {{position}} | {{company}}',
      body: `Dear Candidate,

Greetings!

We are hiring for the profile of {{position}} with {{company}}.

CTC: {{ctc}}
Experience Required: {{experience}}
Location: {{location}}

If you are interested, we have an interview drive scheduled on {{date}} and timings {{time}}.

Kindly reply to this email to confirm your availability.

Best regards,
HR Team
Skillnix Recruitment Services`,
      variables: ['position', 'company', 'ctc', 'experience', 'location', 'date', 'time'],
      isDefault: true,
      createdBy: userId
    },
    {
      name: 'Interview Schedule',
      category: 'interview',
      subject: 'Interview Schedule – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Greetings!

We have an upcoming interview drive for the profile of {{position}} with {{company}}. Your interview has been scheduled as per the details below:

Date: {{date}}
Time: {{time}}

Interview Location:
{{venue}}

SPOC: {{spoc}}
Reference: Skillnix Recruitment Services

Kindly ensure your availability and carry all relevant documents for the interview.

Best regards,
HR Team
Skillnix Recruitment Services`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
      isDefault: true,
      createdBy: userId
    },
    {
      name: 'Application Rejection',
      category: 'rejection',
      subject: 'Application Status Update – {{position}}',
      body: `Dear {{candidateName}},

Thank you for your interest in the {{position}} position at {{company}}. After careful consideration of your application and qualifications, we regret to inform you that we have decided to move forward with other candidates whose experience more closely matches our current requirements.

We genuinely appreciate the time and effort you invested in your application. We encourage you to apply for future openings that align with your skills and experience.

We wish you the very best in your career.

Best regards,
HR Team
Skillnix Recruitment Services`,
      variables: ['candidateName', 'position', 'company'],
      isDefault: true,
      createdBy: userId
    },
    {
      name: 'Document Request',
      category: 'document',
      subject: 'Document Submission Required – {{position}}',
      body: `Dear {{candidateName}},

Congratulations on progressing to the next stage for the {{position}} position at {{company}}!

As the next step in our hiring process, we kindly request you to submit the following documents:

1. Updated Resume / CV
2. Valid Government-issued Photo ID
3. Educational Certificates & Mark Sheets
4. Previous Employment / Experience Letters
5. Last 3 months Salary Slips (if applicable)

Please reply to this email with the above documents within 3 business days.

Best regards,
HR Team
Skillnix Recruitment Services`,
      variables: ['candidateName', 'position', 'company'],
      isDefault: true,
      createdBy: userId
    },
    {
      name: 'Onboarding Welcome',
      category: 'onboarding',
      subject: 'Welcome Aboard – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Welcome aboard! We are thrilled to have you join our team as {{position}} at {{company}}.

Joining Date: {{date}}
Reporting Time: {{time}}
Location: {{venue}}

Please ensure you have completed all onboarding formalities and carry the following on your first day:
- Original ID Proof
- Educational Certificates
- Joining Letter (if received)
- 2 Passport-sized Photographs

If you have any questions before your start date, feel free to reach out to us.

We look forward to working with you!

Best regards,
HR Team
Skillnix Recruitment Services`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue'],
      isDefault: true,
      createdBy: userId
    },
    subscribeTemplate
  ];

  await EmailTemplate.insertMany(defaults);
  return { message: `${defaults.length} default templates created`, seeded: true };
}

module.exports = {
  listTemplates,
  ensureSubscribe,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  seedDefaults
};
