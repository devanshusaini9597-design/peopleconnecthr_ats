/**
 * Org-scoped email templates — CRUD + enterprise starter-pack seed.
 */
const EmailTemplate = require('../models/EmailTemplate');
const User = require('../models/User');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function resolveOrgContext(userId, organizationIdHint) {
  if (organizationIdHint) {
    return { userId, organizationId: String(organizationIdHint) };
  }
  const user = await User.findById(userId).select('organizationId').lean();
  if (!user?.organizationId) {
    throw httpError('Create your organization first to use email templates.', 400, {
      code: 'ORG_REQUIRED',
    });
  }
  return { userId, organizationId: String(user.organizationId) };
}

const SIGN_OFF = `Best regards,
{{company}}`;

const SUBSCRIBE_BODY = `Dear {{candidateName}},

Thank you for your interest in {{company}}. Stay connected with opportunities that fit your profile — subscribe once, and we will keep you informed.

When you subscribe, you will receive:
• Curated job alerts matched to your skills and preferences
• Early notice of hiring drives and new openings
• Occasional career insights from our talent team

One click to subscribe. You can unsubscribe at any time from future emails.

${SIGN_OFF}`;

function subscribeTemplatePayload(userId, organizationId) {
  return {
    organizationId,
    name: 'Subscribe for Updates',
    category: 'marketing',
    subject: 'Stay connected with {{company}} — job alerts & career updates',
    body: SUBSCRIBE_BODY,
    variables: ['candidateName', 'company', 'subscribeLink'],
    isDefault: true,
    createdBy: userId,
  };
}

/** Enterprise ATS starter pack — seeded per organization by name. */
function buildDefaultCatalog(userId, organizationId) {
  const base = (tpl) => ({ ...tpl, organizationId, isDefault: true, createdBy: userId });
  return [
    base({
      name: 'Application Received',
      category: 'hiring',
      subject: 'We received your application – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Thank you for applying for the {{position}} role at {{company}}.

Our talent team is reviewing your application. If your profile aligns with the role requirements, we will contact you with next steps.

This is an automated acknowledgement — no action is needed from you at this time.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company'],
    }),
    base({
      name: 'Hiring Drive Invitation',
      category: 'hiring',
      subject: 'Hiring Drive – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

We are conducting a hiring drive for {{position}} with {{company}}.

Role details:
• CTC: {{ctc}}
• Experience: {{experience}}
• Location: {{location}}

Drive schedule: {{date}} | {{time}}

Please reply to confirm your availability. If you are unable to attend, share alternate slots so we can assist further.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'ctc', 'experience', 'location', 'date', 'time'],
    }),
    base({
      name: 'Profile Shortlisted',
      category: 'hiring',
      subject: 'Your profile is shortlisted – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Congratulations. Your profile has been shortlisted for {{position}} at {{company}}.

Our team will share interview or assessment details shortly. Please keep your phone and email available over the next business day.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company'],
    }),
    base({
      name: 'Status Update – Under Review',
      category: 'hiring',
      subject: 'Application update – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Thank you for your patience. Your application for {{position}} at {{company}} is still under review with the hiring team.

We will update you as soon as a decision or next step is available. We appreciate your interest in this opportunity.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company'],
    }),
    base({
      name: 'Screening Call Invitation',
      category: 'interview',
      subject: 'Screening call – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

We would like to schedule a brief screening conversation for the {{position}} role at {{company}}.

Proposed schedule:
• Date: {{date}}
• Time: {{time}}
• Mode / Venue: {{venue}}
• SPOC: {{spoc}}

Please confirm if this slot works, or reply with 2–3 alternate times.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Interview Schedule',
      category: 'interview',
      subject: 'Interview scheduled – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Your interview for {{position}} at {{company}} has been scheduled.

Interview details:
• Date: {{date}}
• Time: {{time}}
• Location / Link: {{venue}}
• SPOC: {{spoc}}

Please join on time and keep the following ready:
• Updated resume
• Government-issued photo ID
• Any portfolio or work samples relevant to the role

Reply to this email if you need to reschedule.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Technical Interview Invitation',
      category: 'interview',
      subject: 'Technical interview – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

You are invited to a technical interview for {{position}} at {{company}}.

Schedule:
• Date: {{date}}
• Time: {{time}}
• Venue / Meeting link: {{venue}}
• SPOC: {{spoc}}

Please be prepared to discuss your recent projects, problem-solving approach, and role-relevant tools. A stable internet connection is recommended for virtual rounds.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Final Round Interview',
      category: 'interview',
      subject: 'Final interview – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Congratulations on progressing to the final interview for {{position}} at {{company}}.

Final round details:
• Date: {{date}}
• Time: {{time}}
• Venue / Link: {{venue}}
• SPOC: {{spoc}}

This round typically covers role fit, expectations, and next steps. Please arrive (or join) 5–10 minutes early.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Interview Reschedule',
      category: 'interview',
      subject: 'Interview reschedule – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

We need to reschedule your interview for {{position}} at {{company}}.

Updated schedule:
• Date: {{date}}
• Time: {{time}}
• Venue / Link: {{venue}}
• SPOC: {{spoc}}

Apologies for any inconvenience. Please confirm the new slot at your earliest convenience.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Interview No-Show Follow-up',
      category: 'interview',
      subject: 'Missed interview – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

We noticed you were unable to attend the scheduled interview for {{position}} at {{company}} on {{date}} at {{time}}.

If you are still interested, reply within 48 hours with preferred alternate slots. If we do not hear back, we may close this application for the current drive.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time'],
    }),
    base({
      name: 'Post-Interview Thank You',
      category: 'interview',
      subject: 'Thank you for interviewing – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Thank you for speaking with our team about the {{position}} opportunity at {{company}}.

We are consolidating feedback and will share an update soon. If you have any additional information relevant to your application, feel free to reply to this email.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company'],
    }),
    base({
      name: 'Assessment Invitation',
      category: 'assessment',
      subject: 'Complete your assessment – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

As part of the selection process for {{position}} at {{company}}, please complete the assessment shared with you.

Recommended window:
• Complete by: {{date}}
• Suggested time: {{time}}

Instructions will be included in the assessment invite. Please attempt the assessment in a quiet environment without external assistance unless stated otherwise.

Contact {{spoc}} if you face access issues.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'spoc'],
    }),
    base({
      name: 'Offer Intimation',
      category: 'offer',
      subject: 'Offer update – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

We are pleased to inform you that {{company}} would like to extend an offer for the {{position}} role.

Offer summary:
• Position: {{position}}
• CTC: {{ctc}}
• Location: {{location}}
• Tentative joining: {{date}}

A formal offer document will follow shortly. Please reply to confirm your intent to proceed, or share any questions for clarification.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'ctc', 'location', 'date'],
    }),
    base({
      name: 'Offer Acceptance Reminder',
      category: 'offer',
      subject: 'Action required – offer response for {{position}}',
      body: `Dear {{candidateName}},

This is a gentle reminder regarding the offer for {{position}} at {{company}}.

Please share your acceptance (or questions) by {{date}} so we can proceed with onboarding formalities on schedule.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date'],
    }),
    base({
      name: 'Application Rejection',
      category: 'rejection',
      subject: 'Application status – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Thank you for your interest in {{position}} at {{company}} and for the time you invested in our process.

After careful review, we have decided to move forward with other candidates whose experience more closely matches the current requirements.

We encourage you to stay connected for future openings that align with your skills. We wish you every success in your career search.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company'],
    }),
    base({
      name: 'Document Request',
      category: 'document',
      subject: 'Documents required – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

To proceed with your candidature for {{position}} at {{company}}, please share the following documents:

1. Updated resume / CV
2. Government-issued photo ID
3. Educational certificates and mark sheets
4. Previous employment / experience letters
5. Last 3 months’ salary slips (if applicable)

Kindly reply with the documents within 3 business days. Incomplete submissions may delay the next stage.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company'],
    }),
    base({
      name: 'Background Verification Notice',
      category: 'document',
      subject: 'Background verification – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

As part of pre-joining formalities for {{position}} at {{company}}, a background verification check will be initiated.

Please ensure your submitted documents and employment details are accurate. Our verification partner or HR SPOC ({{spoc}}) may contact you if additional information is required.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'spoc'],
    }),
    base({
      name: 'Onboarding Welcome',
      category: 'onboarding',
      subject: 'Welcome aboard – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

Welcome to {{company}}. We are delighted to have you join as {{position}}.

Joining details:
• Date: {{date}}
• Reporting time: {{time}}
• Location: {{venue}}
• SPOC: {{spoc}}

Please carry:
• Original ID proof
• Educational certificates
• Offer / joining letter (if issued)
• Two passport-sized photographs

Reach out if you need any support before day one. We look forward to working with you.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Day-One Reminder',
      category: 'onboarding',
      subject: 'Reminder – joining tomorrow | {{company}}',
      body: `Dear {{candidateName}},

This is a quick reminder about your joining for {{position}} at {{company}}.

• Date: {{date}}
• Time: {{time}}
• Venue: {{venue}}
• SPOC: {{spoc}}

Please arrive on time and complete any pending paperwork shared earlier. We are excited to welcome you.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'date', 'time', 'venue', 'spoc'],
    }),
    base({
      name: 'Talent Pool Nurture',
      category: 'marketing',
      subject: 'A role that may fit your profile – {{position}} | {{company}}',
      body: `Dear {{candidateName}},

We reviewed profiles in our talent network and believe you may be a strong match for {{position}}.

Highlights:
• CTC: {{ctc}}
• Experience: {{experience}}
• Location: {{location}}
• Employer: {{jobEmployer}}

If you are open to exploring this opportunity, reply to this email or share an updated resume.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'jobEmployer', 'ctc', 'experience', 'location', 'subscribeLink'],
    }),
    base({
      name: 'Open Role Spotlight',
      category: 'marketing',
      subject: 'Open opportunity – {{position}}',
      body: `Dear {{candidateName}},

We came across your profile and thought this opening may be a strong match.

Role: {{position}}
Job ID: {{jobCode}}
Employer: {{jobEmployer}}
CTC: {{ctc}}
Experience: {{experience}}
Location: {{location}}

If you would like to be considered, reply to this email or use the button below to apply.

{{applyLink}}

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'jobEmployer', 'ctc', 'experience', 'location', 'jobCode', 'applyLink', 'subscribeLink'],
    }),
    base({
      name: 'Job Alert – New Opening',
      category: 'marketing',
      subject: 'New opening – {{position}} | {{location}}',
      body: `Dear {{candidateName}},

A role that may fit your background is now open.

Role: {{position}}
Job ID: {{jobCode}}
Employer: {{jobEmployer}}
CTC: {{ctc}}
Experience: {{experience}}
Location: {{location}}

Apply using the link below:
{{applyLink}}

Reply if you would like us to consider your profile.

${SIGN_OFF}`,
      variables: ['candidateName', 'position', 'company', 'jobEmployer', 'ctc', 'experience', 'location', 'jobCode', 'applyLink', 'subscribeLink'],
    }),
    base({
      name: 'Hiring Drive Broadcast',
      category: 'marketing',
      subject: 'Hiring drive – {{position}} | {{date}} | {{company}}',
      body: `Dear {{candidateName}},

We are running a hiring drive for {{position}} with {{company}}.

Drive details:
• Date: {{date}}
• Time: {{time}}
• Location: {{location}}
• CTC: {{ctc}}
• Experience: {{experience}}

Reply to confirm interest, or subscribe for future drive invites.

${SIGN_OFF}`,
      variables: [
        'candidateName',
        'position',
        'company',
        'date',
        'time',
        'location',
        'ctc',
        'experience',
        'subscribeLink',
      ],
    }),
    base({
      name: 'Talent Re-engagement',
      category: 'marketing',
      subject: 'Still exploring roles? Stay connected with {{company}}',
      body: `Dear {{candidateName}},

It has been a while since we connected. {{company}} continues to work on roles that may match your background.

Stay on our talent network to receive curated openings — or unsubscribe if you prefer not to hear from us.

${SIGN_OFF}`,
      variables: ['candidateName', 'company', 'subscribeLink'],
    }),
    subscribeTemplatePayload(userId, organizationId),
  ];
}

async function ensureDefaultCatalog(userId, organizationId, { syncBodies = false } = {}) {
  const catalog = buildDefaultCatalog(userId, organizationId);
  const catalogNames = catalog.map((tpl) => tpl.name);

  // One query instead of N findOne round-trips (was the main listTemplates delay).
  const existing = await EmailTemplate.find({
    organizationId,
    name: { $in: catalogNames },
  })
    .select('name')
    .lean();
  const existingNames = new Set(existing.map((row) => row.name));
  const missing = catalog.filter((tpl) => !existingNames.has(tpl.name));

  let added = 0;
  if (missing.length) {
    try {
      const inserted = await EmailTemplate.insertMany(missing, { ordered: false });
      added = inserted.length;
    } catch (err) {
      // Parallel seed races hit unique (organizationId, name) — count what landed.
      if (err?.code !== 11000 && err?.writeErrors) {
        added = missing.length - err.writeErrors.length;
      } else if (err?.code !== 11000 && !err?.writeErrors) {
        throw err;
      } else {
        const after = await EmailTemplate.countDocuments({
          organizationId,
          name: { $in: catalogNames },
        });
        added = Math.max(0, after - existingNames.size);
      }
    }
  }

  // Body sync is expensive; only on explicit seed-defaults, not every list.
  if (syncBodies || added > 0) {
    const subscribe = subscribeTemplatePayload(userId, organizationId);
    await EmailTemplate.findOneAndUpdate(
      { organizationId, name: 'Subscribe for Updates', category: 'marketing' },
      {
        $set: {
          subject: subscribe.subject,
          body: SUBSCRIBE_BODY,
          variables: ['candidateName', 'company', 'subscribeLink'],
          isDefault: true,
        },
      }
    );

    if (syncBodies) {
      await Promise.all(
        catalog.map((seed) =>
          EmailTemplate.findOneAndUpdate(
            { organizationId, name: seed.name, isDefault: true },
            {
              $set: {
                subject: seed.subject,
                body: seed.body,
                variables: seed.variables,
                category: seed.category,
                isDefault: true,
              },
            },
            { upsert: false }
          )
        )
      );
    }
  }

  return { added, total: catalog.length, organizationId };
}

async function listTemplates(userId, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  // Skip seeding when the org already has templates (main latency fix).
  const hasAny = await EmailTemplate.exists({ organizationId });
  if (!hasAny) {
    await ensureDefaultCatalog(userId, organizationId, { syncBodies: false });
  }
  const templates = await EmailTemplate.find({ organizationId }).sort({
    isDefault: -1,
    category: 1,
    name: 1,
  });
  return templates;
}

async function ensureSubscribe(userId, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  const existing = await EmailTemplate.findOne({
    organizationId,
    name: 'Subscribe for Updates',
    category: 'marketing',
  });
  if (existing) return { template: existing, added: false };
  const template = await EmailTemplate.create(subscribeTemplatePayload(userId, organizationId));
  return { template, added: true };
}

async function getTemplate(userId, id, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  const template = await EmailTemplate.findOne({ _id: id, organizationId });
  if (!template) throw httpError('Template not found', 404);
  return template;
}

async function createTemplate(userId, body, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  const { name, category, subject, body: tplBody, variables } = body;
  if (!name || !subject || !tplBody) throw httpError('Name, subject and body are required');
  try {
    return await EmailTemplate.create({
      organizationId,
      name,
      category: category || 'custom',
      subject,
      body: tplBody,
      variables: variables || [],
      createdBy: userId,
      isDefault: false,
    });
  } catch (err) {
    if (err?.code === 11000) throw httpError('A template with this name already exists in your organization', 400);
    throw err;
  }
}

async function updateTemplate(userId, id, body, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  const template = await EmailTemplate.findOne({ _id: id, organizationId });
  if (!template) throw httpError('Template not found or not editable', 404);
  const { name, category, subject, body: tplBody, variables } = body;
  if (name) template.name = name;
  if (category) template.category = category;
  if (subject) template.subject = subject;
  if (tplBody) template.body = tplBody;
  if (variables) template.variables = variables;
  try {
    await template.save();
  } catch (err) {
    if (err?.code === 11000) throw httpError('A template with this name already exists in your organization', 400);
    throw err;
  }
  return template;
}

async function deleteTemplate(userId, id, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  const template = await EmailTemplate.findOneAndDelete({
    _id: id,
    organizationId,
    isDefault: false,
  });
  if (!template) throw httpError('Template not found or cannot be deleted', 404);
  return { message: 'Template deleted' };
}

async function seedDefaults(userId, organizationIdHint) {
  const { organizationId } = await resolveOrgContext(userId, organizationIdHint);
  const result = await ensureDefaultCatalog(userId, organizationId, { syncBodies: true });
  return {
    message: result.added
      ? `Added ${result.added} templates for your organization (${result.total} in catalog)`
      : `Organization template catalog ready (${result.total})`,
    seeded: result.added > 0,
    count: result.total,
    added: result.added,
    organizationId,
  };
}

module.exports = {
  listTemplates,
  ensureSubscribe,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  seedDefaults,
  buildDefaultCatalog,
  ensureDefaultCatalog,
  resolveOrgContext,
};
