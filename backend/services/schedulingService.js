/**
 * Self-schedule booking domain logic.
 * Professional+, gated by scheduling.selfBook (enforced in routes).
 */
const SchedulingLink = require('../models/SchedulingLink');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Interview = require('../models/Interview');
const Application = require('../models/Application');
const { planHasFeature } = require('../config/planFeatures');
const { getAdapter } = require('../adapters');

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function generateSlots(link, daysAhead = 14) {
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
}

async function resolveLink(tokenOrSlug) {
  let link = await SchedulingLink.findOne({ token: tokenOrSlug, isActive: true });
  if (!link) {
    const org = await Organization.findOne({ slug: tokenOrSlug.toLowerCase() });
    if (org) {
      link = await SchedulingLink.findOne({
        organizationId: org._id,
        isActive: true,
        bookedAt: { $exists: false },
      }).sort({ createdAt: -1 });
    }
  }
  return link;
}

/** Public: link info + available slots (or booked state) */
async function getPublicLink(tokenOrSlug) {
  const link = await resolveLink(tokenOrSlug);
  if (!link) throw httpError('Scheduling link not found', 404);
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw httpError('This scheduling link has expired.', 410);
  }
  if (link.bookedAt) {
    return { booked: true, bookedSlot: link.bookedSlot };
  }

  const org = await Organization.findById(link.organizationId).select('name slug plan');
  if (!org || !planHasFeature(org.plan, 'scheduling.selfBook')) {
    throw httpError('Self-scheduling is not available for this organization.', 403);
  }

  const interviewer = await User.findById(link.interviewerUserId).select('name email');
  const slots = generateSlots(link);

  return {
    organizationName: org.name,
    durationMinutes: link.durationMinutes,
    timezone: link.timezone,
    interviewer: interviewer ? { name: interviewer.name } : null,
    slots,
  };
}

/** Public: book a slot on a scheduling link */
async function bookPublicSlot(tokenOrSlug, body) {
  const link = await resolveLink(tokenOrSlug);
  if (!link) throw httpError('Scheduling link not found', 404);
  if (link.bookedAt) throw httpError('This link has already been used.', 400);
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw httpError('This scheduling link has expired.', 410);
  }

  const org = await Organization.findById(link.organizationId).select('plan name');
  if (!org || !planHasFeature(org.plan, 'scheduling.selfBook')) {
    throw httpError('Self-scheduling is not available.', 403);
  }

  const { slotStart, candidateName, candidateEmail } = body;
  if (!slotStart || !candidateEmail) {
    throw httpError('slotStart and candidateEmail are required', 400);
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
      addMeetLink: true,
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
        duration: link.durationMinutes || 30,
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
        createdBy: link.interviewerUserId,
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

  return {
    scheduledAt: start,
    meetingLink,
    interviewId: interview?._id,
  };
}

/** Authenticated: create scheduling link */
async function createSchedulingLink(user, body) {
  const {
    interviewerUserId,
    applicationId,
    jobId,
    durationMinutes,
    timezone,
    availableDays,
    startHour,
    endHour,
    expiresAt,
  } = body;

  const link = new SchedulingLink({
    organizationId: user.organizationId,
    interviewerUserId: interviewerUserId || user.id,
    applicationId,
    jobId,
    durationMinutes: durationMinutes || 30,
    timezone: timezone || 'UTC',
    availableDays: availableDays || [1, 2, 3, 4, 5],
    startHour: startHour ?? 9,
    endHour: endHour ?? 17,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    createdBy: user.id,
  });
  await link.save();
  return link;
}

/** Authenticated: list org scheduling links */
async function listSchedulingLinks(organizationId) {
  return SchedulingLink.find({ organizationId })
    .sort({ createdAt: -1 })
    .limit(50);
}

module.exports = {
  generateSlots,
  resolveLink,
  getPublicLink,
  bookPublicSlot,
  createSchedulingLink,
  listSchedulingLinks,
};
