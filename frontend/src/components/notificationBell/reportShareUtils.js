/** Parse deep-link from a report_shared notification. */
export function parseReportShareLink(linkUrl = '') {
  try {
    const u = new URL(String(linkUrl || '/analytics?tab=export'), 'https://app.local');
    return {
      href: `${u.pathname}${u.search}`,
      period: u.searchParams.get('period') || 'month',
      from: u.searchParams.get('from') || '',
      to: u.searchParams.get('to') || '',
      reportType: u.searchParams.get('report') || 'recruitment-summary',
      format: u.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'pdf',
      employee: u.searchParams.get('employee') || '',
    };
  } catch {
    return {
      href: '/analytics?tab=export',
      period: 'month',
      from: '',
      to: '',
      reportType: 'recruitment-summary',
      format: 'pdf',
      employee: '',
    };
  }
}

export function reportShareMeta(notif) {
  const parsed = parseReportShareLink(notif?.linkUrl);
  const bits = String(notif?.candidatePosition || '').split('·').map((s) => s.trim()).filter(Boolean);
  const formatLabel = parsed.format === 'xlsx' ? 'Excel' : 'PDF';
  return {
    ...parsed,
    reportLabel: bits[0] || (notif?.title || '').replace(/^Report shared:\s*/i, '') || 'Analytics report',
    periodLabel: bits[1] || '',
    formatLabel: bits[2] || formatLabel,
    note: (() => {
      const msg = String(notif?.message || '');
      const m = msg.match(/\n\nNote:\s*([\s\S]+)$/i) || msg.match(/Note:\s*"?([^"]+)"?\s*$/i);
      return m ? m[1].trim() : '';
    })(),
  };
}
