/**
 * Careers chatbot — admin config + public ask.
 */
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const { planHasFeature } = require('../config/planFeatures');

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function getAdminSettings(organizationId) {
  const org = await Organization.findById(organizationId).select('atsSettings.chatbot');
  return org?.atsSettings?.chatbot || { enabled: false, greeting: '', faqs: [] };
}

async function updateAdminSettings(organizationId, body) {
  const { enabled, greeting, faqs } = body;
  const update = {};
  if (typeof enabled === 'boolean') update['atsSettings.chatbot.enabled'] = enabled;
  if (greeting !== undefined) update['atsSettings.chatbot.greeting'] = String(greeting).slice(0, 500);
  if (Array.isArray(faqs)) {
    update['atsSettings.chatbot.faqs'] = faqs
      .filter((f) => f && f.question && f.answer)
      .slice(0, 40)
      .map((f) => ({
        question: String(f.question).trim().slice(0, 300),
        answer: String(f.answer).trim().slice(0, 2000)
      }));
  }

  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: update },
    { new: true }
  ).select('atsSettings.chatbot');

  return org.atsSettings.chatbot;
}

async function getPublicConfig(orgSlug) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name plan atsSettings.chatbot atsSettings.brandColor');
  if (!org) throw httpError('Organization not found', 404);
  if (!planHasFeature(org.plan, 'careers.chatbot') || !org.atsSettings?.chatbot?.enabled) {
    return { enabled: false };
  }
  return {
    enabled: true,
    orgName: org.name,
    greeting: org.atsSettings.chatbot.greeting,
    brandColor: org.atsSettings?.brandColor || '#0d9488',
    faqCount: (org.atsSettings.chatbot.faqs || []).length
  };
}

async function ask(orgSlug, rawMessage) {
  const org = await Organization.findOne({ slug: orgSlug })
    .select('name plan atsSettings.chatbot');
  if (!org) throw httpError('Organization not found', 404);
  if (!planHasFeature(org.plan, 'careers.chatbot')) {
    throw httpError('Careers chatbot is not available on this plan.', 403, {
      code: 'UPGRADE_REQUIRED',
      feature: 'careers.chatbot'
    });
  }
  if (!org.atsSettings?.chatbot?.enabled) {
    throw httpError('Chatbot is not enabled', 404);
  }

  const message = String(rawMessage || '').trim().toLowerCase();
  if (!message) throw httpError('message is required');

  const faqs = org.atsSettings.chatbot.faqs || [];
  let best = null;
  let bestScore = 0;
  for (const faq of faqs) {
    const q = String(faq.question || '').toLowerCase();
    if (!q) continue;
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const hits = words.filter((w) => message.includes(w)).length;
    const score = words.length ? hits / words.length : 0;
    if (message.includes(q) || q.includes(message)) {
      best = faq;
      bestScore = 1;
      break;
    }
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  if (best && bestScore >= 0.35) {
    return { reply: best.answer, source: 'faq' };
  }

  if (/(job|role|opening|position|hiring|vacanc)/i.test(message)) {
    const jobs = await Job.find({
      organizationId: org._id,
      isPublished: true,
      status: 'Open'
    }).select('title location department').limit(5).lean();

    if (!jobs.length) {
      return {
        reply: `We don't have open roles listed right now. Check back soon on our careers page.`,
        source: 'jobs'
      };
    }

    const list = jobs.map((j) => `• ${j.title}${j.location ? ` (${j.location})` : ''}`).join('\n');
    return {
      reply: `Here are some open roles at ${org.name}:\n${list}\n\nOpen a role on the careers page to apply.`,
      source: 'jobs',
      jobs
    };
  }

  const greeting = org.atsSettings.chatbot.greeting
    || 'Hi! Ask me about open roles or how to apply.';
  return {
    reply: `${greeting}\n\nTry asking about open jobs, benefits, or the application process.`,
    source: 'fallback'
  };
}

module.exports = {
  getAdminSettings,
  updateAdminSettings,
  getPublicConfig,
  ask,
};
