const User = require('../models/User');
const TeamMember = require('../models/TeamMember');
const { organizationIdMatch } = require('../utils/dataScope');
const {
  rolesForAudience,
  norm,
  normList,
  userMatchesTargets,
  hasTargets,
} = require('../utils/announcementContent');

function orgFilter(organizationId) {
  return organizationIdMatch(organizationId) || { organizationId };
}

async function listTargetOptions(organizationId) {
  const org = orgFilter(organizationId);
  const [departments, locations, offices, reportGroups, managers] = await Promise.all([
    TeamMember.distinct('department', { ...org, department: { $nin: ['', null] } }),
    User.distinct('deskDefaults.location', { ...org, 'deskDefaults.location': { $nin: ['', null] } }),
    TeamMember.distinct('office', { ...org, office: { $nin: ['', null] } }),
    User.aggregate([
      { $match: { ...org, reportsTo: { $ne: null }, isActive: { $ne: false } } },
      { $group: { _id: '$reportsTo', count: { $sum: 1 } } },
    ]),
    User.find({ ...org, isActive: { $ne: false }, role: { $in: rolesForAudience('all') } })
      .select('name email')
      .lean(),
  ]);

  const counts = new Map(reportGroups.map((row) => [String(row._id), row.count]));
  const teams = managers
    .filter((user) => counts.has(String(user._id)))
    .map((user) => ({
      id: String(user._id),
      name: user.name || user.email || 'Manager',
      reportCount: counts.get(String(user._id)) || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const clean = (values) => [...new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return {
    departments: clean(departments),
    locations: clean(locations),
    offices: clean(offices),
    teams,
  };
}

/**
 * Active users in the audience, then narrowed by department / location / office / team.
 * Public notices have no in-app recipients.
 */
async function resolveAnnouncementRecipientIds(organizationId, announcement) {
  const audience = announcement?.audience || 'all';
  if (!organizationId || audience === 'public') return [];

  const roles = rolesForAudience(audience);
  if (!roles.length) return [];

  const users = await User.find({
    ...orgFilter(organizationId),
    isActive: { $ne: false },
    role: { $in: roles },
  }).select('_id email role reportsTo deskDefaults.location').lean();

  if (!users.length) return [];

  const targets = announcement.targets || {};
  if (!hasTargets(targets)) return users.map((user) => user._id);

  const emails = users.map((user) => norm(user.email)).filter(Boolean);
  const directory = await TeamMember.find({
    ...orgFilter(organizationId),
    email: { $in: emails },
  }).select('email department office').lean();

  const byEmail = new Map();
  for (const row of directory) {
    byEmail.set(norm(row.email), row);
  }

  const wantedDepartments = new Set(normList(targets.departments));
  const wantedLocations = new Set(normList(targets.locations));
  const wantedOffices = new Set(normList(targets.offices));
  const wantedTeams = (targets.teamManagerIds || []).map((id) => String(id));

  return users
    .filter((user) => {
      const directoryRow = byEmail.get(norm(user.email));
      return userMatchesTargets({
        id: user._id,
        reportsTo: user.reportsTo,
        department: directoryRow?.department || '',
        location: user.deskDefaults?.location || '',
        office: directoryRow?.office || '',
      }, {
        departments: [...wantedDepartments],
        locations: [...wantedLocations],
        offices: [...wantedOffices],
        teamManagerIds: wantedTeams,
      });
    })
    .map((user) => user._id);
}

module.exports = {
  listTargetOptions,
  resolveAnnouncementRecipientIds,
};
