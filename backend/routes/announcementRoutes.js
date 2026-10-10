const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { requireFeature } = require('../middleware/featureMiddleware');
const { requireAdmin } = require('../middleware/rbacMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { listTargetOptions } = require('../services/announcementAudience');
const {
  userIdOf,
  presentAnnouncement,
  writeAudit,
  stampUser,
  notifyAudience,
  resetEngagement,
  receiptRoster,
  attachmentDir,
  safeStoredName,
  removeAnnouncementFiles,
  escapeRegex,
  publishedMatch,
} = require('../services/announcementOps');
const { multerFileFilter, resumeFileError } = require('../utils/uploadAllowlist');
const {
  AUDIENCES,
  SEVERITIES,
  ATTACHMENT_MAX,
  ATTACHMENT_BYTES,
  validateAnnouncementContent,
  parseWhen,
  cleanLabels,
  cleanIdList,
  toPlainText,
} = require('../utils/announcementContent');

router.use(requireFeature('announcements'));
router.use(requirePermission('modules.announcements'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: ATTACHMENT_BYTES, files: ATTACHMENT_MAX },
  fileFilter: multerFileFilter,
});

function audienceFilterForRole(role) {
  if (role === 'freelancer') return ['freelancers'];
  if (['owner', 'admin', 'hr_manager'].includes(role)) return ['all', 'admins', 'recruiters'];
  if (['hr_recruiter', 'recruiter', 'sales'].includes(role)) return ['all', 'recruiters'];
  return [];
}

function liveWindow(now = new Date()) {
  return {
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gt: now } }],
  };
}

function activeAudienceFilter(req) {
  const now = new Date();
  return {
    organizationId: req.user.organizationId,
    isActive: true,
    audience: { $in: audienceFilterForRole(req.user.role) },
    $and: [publishedMatch(), liveWindow(now)],
  };
}

function activeBannerFilter(req) {
  return {
    ...activeAudienceFilter(req),
    dismissedBy: { $ne: userIdOf(req) },
  };
}

function activeUnreadFilter(req) {
  return {
    ...activeAudienceFilter(req),
    seenBy: { $ne: userIdOf(req) },
  };
}

let legacyMigrated = false;
async function migrateLegacyOnce() {
  if (legacyMigrated) return;
  legacyMigrated = true;
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    await Announcement.updateMany(
      {
        isActive: true,
        endsAt: { $ne: null, $lte: now },
        createdAt: { $gte: since },
        status: { $ne: 'draft' },
      },
      { $set: { endsAt: null } }
    );
    await Announcement.updateMany(
      { readBy: { $exists: false } },
      [{ $set: {
        readBy: { $ifNull: ['$seenBy', []] },
        status: { $ifNull: ['$status', 'published'] },
      } }]
    );
  } catch {
    legacyMigrated = false;
  }
}

router.use(async (_req, _res, next) => {
  migrateLegacyOnce().finally(() => next());
});

function pageQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

function searchClause(q) {
  const query = String(q || '').trim();
  if (!query) return null;
  const rx = new RegExp(escapeRegex(query), 'i');
  return { $or: [{ title: rx }, { body: rx }] };
}

function readTargets(body = {}) {
  const raw = body.targets && typeof body.targets === 'object' ? body.targets : body;
  return {
    departments: cleanLabels(raw.departments),
    locations: cleanLabels(raw.locations),
    offices: cleanLabels(raw.offices),
    teamManagerIds: cleanIdList(raw.teamManagerIds || raw.teams),
  };
}

function readSchedule(body) {
  const starts = parseWhen(body.startsAt);
  if (starts && starts.error) return { error: 'Start date is invalid' };
  const ends = parseWhen(body.endsAt);
  if (ends && ends.error) return { error: 'End date is invalid' };
  if (starts && ends && ends <= starts) return { error: 'End must be after the start' };
  return { startsAt: starts || new Date(), endsAt: ends };
}

router.get('/targets', requireAdmin, async (req, res) => {
  try {
    const data = await listTargetOptions(req.user.organizationId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const rows = await Announcement.find(activeBannerFilter(req))
      .populate('createdBy', 'name')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(30)
      .lean();
    res.json({
      success: true,
      data: rows.map((row) => presentAnnouncement(row, userIdOf(req))),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const count = await Announcement.countDocuments(activeUnreadFilter(req));
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/inbox', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const { page, limit, skip } = pageQuery(req);
    const view = String(req.query.view || 'all');
    const filter = { ...activeAudienceFilter(req) };
    if (view === 'unread') filter.readBy = { $ne: userId };
    if (view === 'read') filter.readBy = userId;
    const text = searchClause(req.query.q);
    const query = text ? { $and: [filter, text] } : filter;

    const audienceOnly = { ...activeAudienceFilter(req) };
    const [total, rows, unread, read] = await Promise.all([
      Announcement.countDocuments(query),
      Announcement.find(query)
        .populate('createdBy', 'name')
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Announcement.countDocuments({ ...audienceOnly, readBy: { $ne: userId } }),
      Announcement.countDocuments({ ...audienceOnly, readBy: userId }),
    ]);

    res.json({
      success: true,
      data: rows.map((row) => presentAnnouncement(row, userId)),
      total,
      page,
      limit,
      counts: { total: unread + read, unread, read },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Clears the sidebar badge only. Does not mark notices as read. */
router.post('/mark-seen', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const result = await Announcement.updateMany(
      activeUnreadFilter(req),
      { $addToSet: { seenBy: userId } }
    );
    res.json({ success: true, modified: result.modifiedCount || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/dismiss-all', async (req, res) => {
  try {
    const userId = userIdOf(req);
    const rows = await Announcement.find(activeAudienceFilter(req)).select('_id requiresAck ackedBy').lean();
    const eligible = rows.filter((row) => !row.requiresAck || includesAck(row, userId));
    await Promise.all(eligible.map((row) => stampUser(row._id, req.user.organizationId, userId, {
      seen: true, read: true, dismiss: true,
    })));
    res.json({ success: true, modified: eligible.length, skippedAck: rows.length - eligible.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function includesAck(row, userId) {
  return (row.ackedBy || []).some((id) => String(id) === String(userId));
}

router.get('/all', requireAdmin, async (req, res) => {
  try {
    const { page, limit, skip } = pageQuery(req);
    const now = new Date();
    const org = req.user.organizationId;
    const base = { organizationId: org };
    const published = publishedMatch();
    const live = liveWindow(now);
    const filterKey = String(req.query.filter || 'active');
    let filter = { ...base };
    if (filterKey === 'active') {
      filter = { ...base, isActive: true, $and: [published, live] };
    } else if (filterKey === 'inactive') {
      filter = { ...base, isActive: false, ...published };
    } else if (filterKey === 'draft') {
      filter = { ...base, status: 'draft' };
    } else if (filterKey === 'scheduled') {
      filter = { ...base, isActive: true, ...published, startsAt: { $gt: now } };
    }
    const text = searchClause(req.query.q);
    const query = text ? { $and: [filter, text] } : filter;

    const [rows, total, counts] = await Promise.all([
      Announcement.find(query)
        .populate('createdBy', 'name')
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Announcement.countDocuments(query),
      Promise.all([
        Announcement.countDocuments(base),
        Announcement.countDocuments({ ...base, isActive: true, $and: [published, live] }),
        Announcement.countDocuments({ ...base, isActive: false, ...published }),
        Announcement.countDocuments({ ...base, status: 'draft' }),
        Announcement.countDocuments({ ...base, isActive: true, ...published, startsAt: { $gt: now } }),
      ]),
    ]);

    res.json({
      success: true,
      data: rows.map((row) => presentAnnouncement(row, userIdOf(req), { manage: true })),
      total,
      page,
      limit,
      counts: {
        total: counts[0],
        active: counts[1],
        inactive: counts[2],
        draft: counts[3],
        scheduled: counts[4],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const validated = validateAnnouncementContent(req.body || {});
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });

    const audience = AUDIENCES.includes(req.body.audience) ? req.body.audience : 'all';
    const severity = SEVERITIES.includes(req.body.severity) ? req.body.severity : 'info';
    const asDraft = req.body.status === 'draft' || req.body.asDraft === true;
    const schedule = readSchedule(req.body || {});
    if (schedule.error) return res.status(400).json({ success: false, message: schedule.error });

    const actorId = userIdOf(req);
    const targets = audience === 'public' ? { departments: [], locations: [], offices: [], teamManagerIds: [] } : readTargets(req.body);
    const row = await Announcement.create({
      organizationId: req.user.organizationId,
      title: validated.title,
      body: validated.body,
      severity,
      audience,
      status: asDraft ? 'draft' : 'published',
      isActive: !asDraft,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      pinned: Boolean(req.body.pinned) && !asDraft,
      requiresAck: Boolean(req.body.requiresAck) && audience !== 'public',
      targets,
      createdBy: actorId,
      seenBy: [actorId],
      readBy: [actorId],
      receipts: [{ userId: actorId, seenAt: new Date(), readAt: new Date() }],
    });

    if (!asDraft) {
      await notifyAudience(row, req.user, { email: req.body.notifyEmail !== false });
    }
    await writeAudit(req, asDraft ? 'announcement.drafted' : 'announcement.published', row);

    const fresh = await Announcement.findById(row._id).populate('createdBy', 'name').lean();
    res.status(201).json({
      success: true,
      data: presentAnnouncement(fresh, actorId, { manage: true }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id/receipts', requireAdmin, async (req, res) => {
  try {
    const row = await Announcement.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).populate('createdBy', 'name').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const data = await receiptRoster(row);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/attachments', requireAdmin, (req, res) => {
  upload.array('files', ATTACHMENT_MAX)(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Each file must be 5 MB or smaller'
        : (err.message || 'Upload failed');
      return res.status(400).json({ success: false, message });
    }
    try {
      const row = await Announcement.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId,
      });
      if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
      const incoming = req.files || [];
      if (!incoming.length) return res.status(400).json({ success: false, message: 'Choose a file' });
      if ((row.attachments || []).length + incoming.length > ATTACHMENT_MAX) {
        return res.status(400).json({ success: false, message: `Up to ${ATTACHMENT_MAX} attachments` });
      }
      for (const file of incoming) {
        const problem = resumeFileError(file);
        if (problem) return res.status(400).json({ success: false, message: problem });
      }
      const dir = attachmentDir(req.user.organizationId, row._id);
      await fs.promises.mkdir(dir, { recursive: true });
      for (const file of incoming) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        await fs.promises.writeFile(path.join(dir, storedName), file.buffer);
        row.attachments.push({
          name: path.basename(file.originalname || 'file').slice(0, 180),
          storedName,
          mime: file.mimetype || '',
          size: file.size || file.buffer.length,
        });
      }
      await row.save();
      await writeAudit(req, 'announcement.updated', row, { message: 'Attachment added' });
      const fresh = await Announcement.findById(row._id).populate('createdBy', 'name').lean();
      res.json({ success: true, data: presentAnnouncement(fresh, userIdOf(req), { manage: true }) });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
});

router.get('/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const row = await Announcement.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const manage = ['owner', 'admin', 'hr_manager'].includes(req.user.role);
    const audiences = audienceFilterForRole(req.user.role);
    if (!manage && !audiences.includes(row.audience)) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    const file = (row.attachments || []).find((item) => String(item._id) === String(req.params.attachmentId));
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    const storedName = safeStoredName(file.storedName);
    if (!storedName) return res.status(400).json({ success: false, message: 'Invalid file' });
    const dir = path.resolve(attachmentDir(row.organizationId, row._id));
    const abs = path.resolve(dir, storedName);
    if (!abs.startsWith(`${dir}${path.sep}`)) {
      return res.status(400).json({ success: false, message: 'Invalid file' });
    }
    if (!fs.existsSync(abs)) return res.status(404).json({ success: false, message: 'File not found' });
    res.download(abs, file.name);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id/attachments/:attachmentId', requireAdmin, async (req, res) => {
  try {
    const row = await Announcement.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const file = (row.attachments || []).find((item) => String(item._id) === String(req.params.attachmentId));
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    const storedName = safeStoredName(file.storedName);
    if (storedName) {
      await fs.promises.unlink(path.join(attachmentDir(row.organizationId, row._id), storedName)).catch(() => {});
    }
    row.attachments = row.attachments.filter((item) => String(item._id) !== String(req.params.attachmentId));
    await row.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/dismiss', async (req, res) => {
  try {
    const row = await Announcement.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).select('requiresAck ackedBy').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    const userId = userIdOf(req);
    if (row.requiresAck && !includesAck(row, userId)) {
      return res.status(400).json({
        success: false,
        message: 'Acknowledge this notice before dismissing it',
      });
    }
    await stampUser(row._id, req.user.organizationId, userId, { dismiss: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Explicit "mark as read" — also hides the banner. */
router.post('/:id/seen', async (req, res) => {
  try {
    await stampUser(req.params.id, req.user.organizationId, userIdOf(req), {
      seen: true, read: true, dismiss: true,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/** Opened the notice in the board. Does not dismiss the banner. */
router.post('/:id/read', async (req, res) => {
  try {
    await stampUser(req.params.id, req.user.organizationId, userIdOf(req), {
      read: true,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/ack', async (req, res) => {
  try {
    const row = await Announcement.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).select('requiresAck').lean();
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await stampUser(row._id, req.user.organizationId, userIdOf(req), {
      seen: true, read: true, dismiss: true, ack: true,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const row = await Announcement.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });
    if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });

    const wasDraft = row.status === 'draft';
    if (typeof req.body.title === 'string' || typeof req.body.body === 'string') {
      const validated = validateAnnouncementContent({
        title: typeof req.body.title === 'string' ? req.body.title : row.title,
        body: typeof req.body.body === 'string' ? req.body.body : row.body,
      });
      if (validated.error) return res.status(400).json({ success: false, message: validated.error });
      row.title = validated.title;
      row.body = validated.body;
    }
    if (req.body.severity && SEVERITIES.includes(req.body.severity)) row.severity = req.body.severity;
    if (req.body.audience && AUDIENCES.includes(req.body.audience)) row.audience = req.body.audience;
    if (req.body.startsAt !== undefined || req.body.endsAt !== undefined) {
      const schedule = readSchedule({
        startsAt: req.body.startsAt !== undefined ? req.body.startsAt : row.startsAt,
        endsAt: req.body.endsAt !== undefined ? req.body.endsAt : row.endsAt,
      });
      if (schedule.error) return res.status(400).json({ success: false, message: schedule.error });
      row.startsAt = schedule.startsAt;
      row.endsAt = schedule.endsAt;
    }
    if (typeof req.body.pinned === 'boolean') row.pinned = req.body.pinned;
    if (typeof req.body.requiresAck === 'boolean') {
      row.requiresAck = req.body.requiresAck && row.audience !== 'public';
    }
    if (req.body.targets || req.body.departments || req.body.locations || req.body.offices || req.body.teams) {
      row.targets = row.audience === 'public'
        ? { departments: [], locations: [], offices: [], teamManagerIds: [] }
        : readTargets(req.body);
    }
    if (req.body.status === 'draft') {
      row.status = 'draft';
      row.isActive = false;
    } else if (req.body.status === 'published') {
      row.status = 'published';
      row.isActive = true;
    }
    if (typeof req.body.isActive === 'boolean' && row.status !== 'draft') {
      row.isActive = req.body.isActive;
    }

    const publishingDraft = wasDraft && row.status === 'published';
    const notifyAgain = req.body.notifyAgain === true && row.status === 'published' && row.isActive;
    if (notifyAgain || publishingDraft) {
      await resetEngagement(row, userIdOf(req));
    }

    await row.save();
    if (notifyAgain || publishingDraft) {
      await notifyAudience(row, req.user, { email: req.body.notifyEmail !== false });
    }

    let action = 'announcement.updated';
    if (publishingDraft) action = 'announcement.published';
    else if (req.body.isActive === false) action = 'announcement.deactivated';
    else if (req.body.isActive === true) action = 'announcement.reactivated';
    await writeAudit(req, action, row, {
      message: notifyAgain ? 'Updated and sent again' : '',
    });

    const fresh = await Announcement.findById(row._id).populate('createdBy', 'name').lean();
    const payload = presentAnnouncement(fresh, userIdOf(req), { manage: true });
    let warning = '';
    if (row.isActive && row.endsAt && new Date(row.endsAt) <= new Date()) {
      warning = 'Saved, but the end date is in the past so the notice stays hidden until you extend it.';
    }
    res.json({ success: true, data: payload, warning, plain: toPlainText(row.body) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const hard = String(req.query.hard || '') === '1';
    if (hard) {
      const row = await Announcement.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId,
      });
      if (!row) return res.status(404).json({ success: false, message: 'Announcement not found' });
      await removeAnnouncementFiles(row);
      await row.deleteOne();
      await writeAudit(req, 'announcement.deleted', row);
      return res.json({ success: true, deleted: true });
    }

    const row = await Announcement.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, status: { $ne: 'draft' } },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!row) {
      const draft = await Announcement.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId,
        status: 'draft',
      });
      if (!draft) return res.status(404).json({ success: false, message: 'Announcement not found' });
      await removeAnnouncementFiles(draft);
      await draft.deleteOne();
      await writeAudit(req, 'announcement.deleted', draft);
      return res.json({ success: true, deleted: true });
    }
    await writeAudit(req, 'announcement.deactivated', row);
    res.json({ success: true, deactivated: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
