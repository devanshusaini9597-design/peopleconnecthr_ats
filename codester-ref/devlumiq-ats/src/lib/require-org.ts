/**
 * Fail-closed organization scoping.
 *
 * Never return `{}` when organizationId is missing — that silently opens
 * every tenant's data. Callers must require an org or return 403.
 */

import { NextResponse } from 'next/server';

type OrgSession = { organizationId?: string | null };

/** Returns the organization id, or a 403 response if missing. */
export function requireOrgId(session: OrgSession): string | NextResponse {
  if (!session.organizationId) {
    return NextResponse.json(
      { error: 'Organization context required' },
      { status: 403 },
    );
  }
  return session.organizationId;
}

/** Prisma where clause scoped to organizationId, or 403 if missing. */
export function requireOrgFilter(session: OrgSession): { organizationId: string } | NextResponse {
  const orgId = requireOrgId(session);
  if (orgId instanceof NextResponse) return orgId;
  return { organizationId: orgId };
}

/** Prisma where clause scoped to companyId (Job model), or 403 if missing. */
export function requireCompanyFilter(session: OrgSession): { companyId: string } | NextResponse {
  const orgId = requireOrgId(session);
  if (orgId instanceof NextResponse) return orgId;
  return { companyId: orgId };
}

export function isOrgError(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
