/**
 * Self-schedule booking — Professional+, gated by scheduling.selfBook.
 * Public routes for candidates; authenticated routes for creating links.
 */
const express = require('express');
const router = express.Router();
const SchedulingLink = require('../models/SchedulingLink');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Interview = require('../models/Interview');
const Application = require('../models/Application');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireRecruiterOrAbove } = require('../middleware/rbacMiddleware');
const { requireOrganization, tenantScope } = require('../middleware/tenantMiddleware');
const { requireFeature } = require('../middleware/featureMiddleware');
const { planHasFeature } = require('../config/planFeatures');
const { getAdapter } = require('../adapters');

const generateSlots = (link, daysAhead = 14) => {
  const slots = [];
  const now = new Date();
  const duration = link.durationMinutes || 30;

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    if (!link.availableDays.includes(dow)) continue;

    for (let h = link.startHour; h < link.endHour; h++) {
      const slotStart = new Date(day);
      slotStart.setHours(h, 0, 0, 0);
      if (slotStart <= now) continue;
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);
      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
    }
  }
  return slots.slice(0, 50);
};

const resolveLink = async (tokenOrSlug) => {
  let link = await SchedulingLink.findOne({ token: tokenOrSlug, isActive: true });
  if (!link) {
    const org = await Organization.findOne({ slug: tokenOrSlug.toLowerCase() });
    if (org) {
      link = await SchedulingLink.findOne({ organizationId: org._id, isActive: true, bookedAt: { $exists: false } }).sort({ createdAt: -1 });
    }
  }
  return link;
};

/** GET /public/:tokenOrSlug — link info + available slots */
router.get('/public/:tokenOrSlug', async (req, res) => {
  try {
    const link = await resolveLink(req.params.tokenOrSlug);
    if (!link) return res.status(404).json({ success: false, message: 'Scheduling link not found' });
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'This scheduling link has expired.' });
    }
    if (link.bookedAt) {
      return res.json({ success: true, data: { booked: true, bookedSlot: link.bookedSlot } });
    }

    const org = await Organization.findById(link.organizationId).select('name slug plan');
    if (!org || !planHasFeature(org.plan, 'scheduling.selfBook')) {
      return res.status(403).json({ success: false, message: 'Self-scheduling is not available for this organization.' });
    }

    const interviewer = await User.findById(link.interviewerUserId).select('name email');
    const slots = generateSlots(link);

    res.json({
      success: true,
      data: {
        organizationName: org.name,
        durationMinutes: link.durationMinutes,
        timezone: link.timezone,
        interviewer: interviewer ? { name: interviewer.name } : null,
        slots
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** POST /public/:tokenOrSlug/book */
router.post('/public/:tokenOrSlug/book', async (req, res) => {
  try {
    const link = await resolveLink(req.params.tokenOrSlug);
    if (!link) return res.status(404).json({ success: false, message: 'Scheduling link not found' });
    if (link.bookedAt) return res.status(400).json({ success: false, message: 'This link has already been used.' });
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ success: false, message: 'This scheduling link has expired.' });
    }

    const org = await Organization.findById(link.organizationId).select('plan name');
    if (!org || !planHasFeature(org.plan, 'scheduling.selfBook')) {
      return res.status(403).json({ success: false, message: 'Self-scheduling is not available.' });
    }

    const { slotStart, candidateName, candidateEmail } = req.body;
    if (!slotStart || !candidateEmail) {
      return res.status(400).json({ success: false, message: 'slotStart and candidateEmail are required' });
    }

    const start = new Date(slotStart);
    const end = new Date(start.getTime() + (link.durationMinutes || 30) * 60000);
    let meetingLink = '';
    let calendarEventId = '';

    const calendarAdapter = await getAdapter(link.organizationId, 'calendar');
    if (calendarAdapter) {
      const interviewer = await User.findById(link.interviewerUserId).select('email name');
      const event = await calendarAdapter.createEvent({
        summary: `Interview — ${candidateName || candidateEmail}`,
        description: `Self-scheduled interview via SkillNix`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        timeZone: link.timezone || 'UTC',
        attendees: [candidateEmail, interviewer?.email].filter(Boolean),
        addMeetLink: true
      });
      calendarEventId = event.id || event.iCalUId || '';
      meetingLink = event.hangoutLink || event.onlineMeeting?.joinUrl || event.webLink || '';
    }

    if (!meetingLink) {
      const videoAdapter = await getAdapter(link.organizationId, 'video');
      if (videoAdapter?.createMeeting) {
        const meeting = await videoAdapter.createMeeting({
          topic: `Interview — ${candidateName || candidateEmail}`,
          startTime: start.toISOString(),
          duration: link.durationMinutes || 30
        });
        meetingLink = meeting.joinUrl || meeting.link || '';
      }
    }

    let interview = null;
    if (link.applicationId) {
      const app = await Application.findById(link.applicationId);
      if (app) {
        interview = new Interview({
          organizationId: link.organizationId,
          applicationId: app._id,
          candidateId: app.candidateId,
          jobId: app.jobId,
          interviewers: [{ userId: link.interviewerUserId }],
          scheduledAt: start,
          duration: link.durationMinutes || 30,
          type: 'video',
          meetingLink,
          calendarEventId,
          status: 'scheduled',
          createdBy: link.interviewerUserId
        });
        await interview.save();
      }
    }

    link.bookedAt = new Date();
    link.bookedSlot = start;
    link.candidateEmail = candidateEmail;
    link.interviewId = interview?._id;
    link.isActive = false;
    await link.save();

    res.json({
      success: true,
      data: {
        scheduledAt: start,
        meetingLink,
        interviewId: interview?._id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Authenticated routes ─────────────────────────────────────────────
router.use(verifyToken, requireOrganization, tenantScope, requireFeature('scheduling.selfBook'), requireRecruiterOrAbove);

/** POST /links — create scheduling link */
router.post('/links', async (req, res) => {
  try {
    const {
      interviewerUserId, applicationId, jobId, durationMinutes,
      timezone, availableDays, startHour, endHour, expiresAt
    } = req.body;

    const link = new SchedulingLink({
      organizationId: req.user.organizationId,
      interviewerUserId: interviewerUserId || req.user.id,
      applicationId,
      jobId,
      durationMinutes: durationMinutes || 30,
      timezone: timezone || 'UTC',
      availableDays: availableDays || [1, 2, 3, 4, 5],
      startHour: startHour ?? 9,
      endHour: endHour ?? 17,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: req.user.id
    });
    await link.save();
    res.status(201).json({ success: true, data: link });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** GET /links */
router.get('/links', async (req, res) => {
  try {
    const links = await SchedulingLink.find({ organizationId: req.user.organizationId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, data: links });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
