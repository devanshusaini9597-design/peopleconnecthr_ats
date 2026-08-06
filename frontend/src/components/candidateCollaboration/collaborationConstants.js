export const TOUR_KEY = 'skillnix_tour_collaboration_v1';

export const COLLAB_TOUR_STEPS = [
  {
    title: 'Team Collaboration',
    body: 'Leave internal notes on candidates and @mention teammates so they get notified — like a hiring-team chat tied to each person.',
  },
  {
    target: '[data-tour="collab-candidates"]',
    title: 'Find a candidate',
    body: 'Browse recent candidates or search by name/email. Select someone to open their collaboration thread.',
    placement: 'right',
  },
  {
    target: '[data-tour="collab-thread"]',
    title: 'Candidate thread',
    body: 'All team notes for this candidate appear here — author, time, and @mentions highlighted.',
    placement: 'left',
  },
  {
    target: '[data-tour="collab-composer"]',
    title: 'Post a note',
    body: 'Write a comment and use @FirstName (or @emailPrefix) to notify a teammate. Tip: Ctrl/Cmd + Enter to post.',
    placement: 'top',
  },
];

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '';
  }
}
