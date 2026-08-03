/**
 * Careers chatbot — careers.chatbot (Professional+)
 * Authenticated config + public chat endpoint.
 */

const express = require('express');
const router = express.Router();
const Organization = require('../models/Organization');
const Job = require('../models/Job');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { planHasFeature } = require('../config/planFeatures');

// ── Authenticated admin config (must be registered before /:orgSlug) ──

router.get(
  '/admin/settings',
  verifyToken,
  requireOrganization,
  tenantScope,
  requireFeature('careers.chatbot'),
  requireAdmin,
  async (req, res) => {
    try {
      const org = await Organization.findById(req.user.organizationId).select('atsSettings.chatbot');
      res.json({
        success: true,
        data: org?.atsSettings?.chatbot || { enabled: false, greeting: '', faqs: [] }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

router.put(
  '/admin/settings',
  verifyToken,
  requireOrganization,
  tenantScope,
  requireFeature('careers.chatbot'),
  requireAdmin,
  async (req, res) => {
    try {
      const { enabled, greeting, faqs } = req.body;
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
        req.user.organizationId,
        { $set: update },
        { new: true }
      ).select('atsSettings.chatbot');

      res.json({ success: true, data: org.atsSettings.chatbot });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── Public chat (no session) ─────────────────────────────────────────

/** GET /api/chatbot/:orgSlug/config — public widget config */
router.get('/:orgSlug/config', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug })
      .select('name plan atsSettings.chatbot atsSettings.brandColor');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    if (!planHasFeature(org.plan, 'careers.chatbot') || !org.atsSettings?.chatbot?.enabled) {
      return res.json({ success: true, data: { enabled: false } });
    }
    res.json({
      success: true,
      data: {
        enabled: true,
        orgName: org.name,
        greeting: org.atsSettings.chatbot.greeting,
        brandColor: org.atsSettings?.brandColor || '#0d9488',
        faqCount: (org.atsSettings.chatbot.faqs || []).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /api/chatbot/:orgSlug/ask — { message } */
router.post('/:orgSlug/ask', async (req, res) => {
  try {
    const org = await Organization.findOne({ slug: req.params.orgSlug })
      .select('name plan atsSettings.chatbot');
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });
    if (!planHasFeature(org.plan, 'careers.chatbot')) {
      return res.status(403).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        message: 'Careers chatbot is not available on this plan.',
        feature: 'careers.chatbot'
      });
    }
    if (!org.atsSettings?.chatbot?.enabled) {
      return res.status(404).json({ success: false, message: 'Chatbot is not enabled' });
    }

    const message = String(req.body.message || '').trim().toLowerCase();
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });

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
      return res.json({
        success: true,
        data: { reply: best.answer, source: 'faq' }
      });
    }

    if (/(job|role|opening|position|hiring|vacanc)/i.test(message)) {
      const jobs = await Job.find({
        organizationId: org._id,
        isPublished: true,
        status: 'Open'
      }).select('title location department').limit(5).lean();

      if (!jobs.length) {
        return res.json({
          success: true,
          data: {
            reply: `We don't have open roles listed right now. Check back soon on our careers page.`,
            source: 'jobs'
          }
        });
      }

      const list = jobs.map((j) => `• ${j.title}${j.location ? ` (${j.location})` : ''}`).join('\n');
      return res.json({
        success: true,
        data: {
          reply: `Here are some open roles at ${org.name}:\n${list}\n\nOpen a role on the careers page to apply.`,
          source: 'jobs',
          jobs
        }
      });
    }

    const greeting = org.atsSettings.chatbot.greeting
      || 'Hi! Ask me about open roles or how to apply.';
    res.json({
      success: true,
      data: {
        reply: `${greeting}\n\nTry asking about open jobs, benefits, or the application process.`,
        source: 'fallback'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
