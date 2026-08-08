/**
 * Job board provider adapters — live HTTP posting when org credentials exist.
 *
 * Credential fields (stored encrypted at rest via credentials API):
 *   LinkedIn: accessToken + settings.companyId (optional refreshToken)
 *   Indeed:   apiKey (+ optional settings.endpoint, settings.employerId)
 *   Glassdoor: apiKey + apiSecret (+ optional settings.endpoint, settings.partnerId)
 *
 * Without credentials → draft DB record (buyer can configure later).
 * With credentials → live partner API call; failures stored as status=error.
 */

export type JobBoardId = 'LINKEDIN' | 'INDEED' | 'GLASSDOOR';

export interface JobPostPayload {
  jobId: string;
  title: string;
  description: string;
  location?: string | null;
  employmentType?: string | null;
  companyName: string;
  applyUrl: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
}

export interface BoardCredentials {
  apiKey?: string | null;
  apiSecret?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  accountName?: string | null;
  settings?: Record<string, unknown> | null;
}

export type PostResult =
  | { status: 'posted'; externalId: string; postUrl: string }
  | { status: 'draft'; reason: 'needs_credentials' | 'not_configured' }
  | { status: 'error'; message: string };

export interface JobBoardAdapter {
  board: JobBoardId;
  post(job: JobPostPayload, creds: BoardCredentials | null): Promise<PostResult>;
  unpublish(externalId: string, creds: BoardCredentials | null): Promise<{ ok: boolean; message?: string }>;
}

function settingsOf(creds: BoardCredentials | null): Record<string, unknown> {
  return (creds?.settings as Record<string, unknown>) || {};
}

async function refreshLinkedInToken(creds: BoardCredentials): Promise<string | null> {
  const refresh = creds.refreshToken?.trim();
  const clientId = String(settingsOf(creds).clientId || process.env.LINKEDIN_CLIENT_ID || '');
  const clientSecret = String(settingsOf(creds).clientSecret || process.env.LINKEDIN_CLIENT_SECRET || '');
  if (!refresh || !clientId || !clientSecret) return creds.accessToken || null;

  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) return creds.accessToken || null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token || creds.accessToken || null;
  } catch {
    return creds.accessToken || null;
  }
}

/** LinkedIn Job Posting API (partner) — live when accessToken + companyId present */
export const linkedInAdapter: JobBoardAdapter = {
  board: 'LINKEDIN',
  async post(job, creds) {
    if (!creds?.accessToken && !creds?.refreshToken) {
      return { status: 'draft', reason: 'needs_credentials' };
    }
    const companyId = String(settingsOf(creds).companyId || '');
    if (!companyId) {
      return { status: 'error', message: 'LinkedIn companyId missing in credential settings' };
    }

    try {
      const token = await refreshLinkedInToken(creds!);
      if (!token) return { status: 'error', message: 'LinkedIn access token unavailable' };

      const employmentType = (job.employmentType || 'FULL_TIME').toUpperCase().replace(/[\s-]/g, '_');
      const body = {
        author: `urn:li:organization:${companyId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: `${job.title} — apply: ${job.applyUrl}` },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      };

      // Prefer Jobs API when partner-enabled; fall back to UGC share with apply link
      const jobsEndpoint =
        String(settingsOf(creds).endpoint || '') || 'https://api.linkedin.com/v2/jobs';
      let res = await fetch(jobsEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          company: `urn:li:organization:${companyId}`,
          title: job.title,
          description: { text: job.description },
          locationDescription: job.location || undefined,
          listedAt: Date.now(),
          jobPostingOperationType: 'CREATE',
          employmentStatus: employmentType,
          applyMethod: { companyApplyUrl: job.applyUrl },
        }),
      });

      // If Jobs API not available (403/404), post as organization share with apply URL
      if (res.status === 403 || res.status === 404) {
        res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { status: 'error', message: `LinkedIn API ${res.status}: ${text.slice(0, 300)}` };
      }

      const data = (await res.json().catch(() => ({}))) as { id?: string };
      const externalId = String(data.id || `li-${job.jobId}-${Date.now()}`);
      const numericId = externalId.replace(/\D/g, '') || externalId;
      return {
        status: 'posted',
        externalId,
        postUrl: `https://www.linkedin.com/jobs/view/${numericId}`,
      };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'LinkedIn post failed' };
    }
  },
  async unpublish(externalId, creds) {
    if (!creds?.accessToken) return { ok: false, message: 'needs_credentials' };
    try {
      const token = await refreshLinkedInToken(creds);
      if (!token) return { ok: false, message: 'token unavailable' };
      const endpoint =
        String(settingsOf(creds).unpublishEndpoint || '') ||
        `https://api.linkedin.com/v2/jobs/${encodeURIComponent(externalId)}`;
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        return { ok: false, message: `LinkedIn unpublish ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'unpublish failed' };
    }
  },
};

/** Indeed Employer / Ads API — live when apiKey present */
export const indeedAdapter: JobBoardAdapter = {
  board: 'INDEED',
  async post(job, creds) {
    if (!creds?.apiKey) {
      return { status: 'draft', reason: 'needs_credentials' };
    }
    try {
      const endpoint =
        String(settingsOf(creds).endpoint || '') ||
        'https://apis.indeed.com/ads/v1/jobs';
      const employerId = String(settingsOf(creds).employerId || creds.accountName || '');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: job.title,
          description: job.description,
          location: job.location,
          company: job.companyName,
          applyUrl: job.applyUrl,
          employerId: employerId || undefined,
          jobType: job.employmentType || undefined,
          salary: job.salaryMin
            ? { min: job.salaryMin, max: job.salaryMax ?? job.salaryMin, currency: job.currency || 'USD' }
            : undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { status: 'error', message: `Indeed API ${res.status}: ${text.slice(0, 300)}` };
      }

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        jobKey?: string;
        url?: string;
        data?: { id?: string; url?: string };
      };
      const externalId =
        data.id || data.jobKey || data.data?.id || `indeed-${job.jobId}-${Date.now()}`;
      return {
        status: 'posted',
        externalId: String(externalId),
        postUrl: data.url || data.data?.url || `https://www.indeed.com/viewjob?jk=${externalId}`,
      };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'Indeed post failed' };
    }
  },
  async unpublish(externalId, creds) {
    if (!creds?.apiKey) return { ok: false, message: 'needs_credentials' };
    try {
      const base =
        String(settingsOf(creds).endpoint || '') ||
        'https://apis.indeed.com/ads/v1/jobs';
      const res = await fetch(`${base.replace(/\/$/, '')}/${encodeURIComponent(externalId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${creds.apiKey}` },
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        return { ok: false, message: `Indeed unpublish ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'unpublish failed' };
    }
  },
};

/** Glassdoor partner post — live when apiKey + apiSecret present */
export const glassdoorAdapter: JobBoardAdapter = {
  board: 'GLASSDOOR',
  async post(job, creds) {
    if (!creds?.apiKey || !creds?.apiSecret) {
      return { status: 'draft', reason: 'needs_credentials' };
    }
    try {
      const endpoint =
        String(settingsOf(creds).endpoint || '') ||
        'https://api.glassdoor.com/api/api.htm';
      const partnerId = String(settingsOf(creds).partnerId || '');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64')}`,
        },
        body: JSON.stringify({
          action: 'postJob',
          partnerId: partnerId || undefined,
          title: job.title,
          description: job.description,
          location: job.location,
          companyName: job.companyName,
          applyUrl: job.applyUrl,
          employmentType: job.employmentType || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { status: 'error', message: `Glassdoor API ${res.status}: ${text.slice(0, 300)}` };
      }

      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        id?: string;
        url?: string;
        response?: { jobId?: string; url?: string };
      };
      const externalId =
        data.jobId || data.id || data.response?.jobId || `gd-${job.jobId}-${Date.now()}`;
      return {
        status: 'posted',
        externalId: String(externalId),
        postUrl: data.url || data.response?.url || '',
      };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : 'Glassdoor post failed' };
    }
  },
  async unpublish(externalId, creds) {
    if (!creds?.apiKey || !creds?.apiSecret) return { ok: false, message: 'needs_credentials' };
    try {
      const endpoint =
        String(settingsOf(creds).endpoint || '') ||
        'https://api.glassdoor.com/api/api.htm';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64')}`,
        },
        body: JSON.stringify({ action: 'closeJob', jobId: externalId }),
      });
      if (!res.ok && res.status !== 404) {
        const text = await res.text().catch(() => '');
        return { ok: false, message: `Glassdoor unpublish ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'unpublish failed' };
    }
  },
};

const ADAPTERS: Record<string, JobBoardAdapter> = {
  LINKEDIN: linkedInAdapter,
  INDEED: indeedAdapter,
  GLASSDOOR: glassdoorAdapter,
};

export function getAdapter(board: string): JobBoardAdapter | null {
  return ADAPTERS[board.toUpperCase()] || null;
}

export async function postToBoard(
  board: string,
  job: JobPostPayload,
  creds: BoardCredentials | null
): Promise<PostResult> {
  const adapter = getAdapter(board);
  if (!adapter) {
    return { status: 'draft', reason: 'not_configured' };
  }
  return adapter.post(job, creds);
}

export async function unpublishFromBoard(
  board: string,
  externalId: string,
  creds: BoardCredentials | null
): Promise<{ ok: boolean; message?: string }> {
  const adapter = getAdapter(board);
  if (!adapter) return { ok: false, message: 'not_configured' };
  if (!externalId || externalId.startsWith('stub-') || externalId.startsWith('error-')) {
    return { ok: true }; // local-only draft/error rows
  }
  return adapter.unpublish(externalId, creds);
}
