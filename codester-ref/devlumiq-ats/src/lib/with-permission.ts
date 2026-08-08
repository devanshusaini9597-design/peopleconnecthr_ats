import { NextRequest, NextResponse } from 'next/server';
import { getSession, SessionUser } from '@/lib/auth';
import { hasPermission, hasAnyPermission, Permission, Role } from '@/lib/roles';
import { validateCsrf } from '@/lib/csrf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteContext = { params: Promise<any> };
type AuthedHandler<T extends RouteContext = RouteContext> = (
  req: NextRequest,
  ctx: T,
  session: SessionUser,
) => Promise<NextResponse> | NextResponse;

/** Cookie-session CSRF check; skipped for Bearer API-key callers (no cookie CSRF risk). */
function csrfGuard(req: NextRequest): NextResponse | null {
  if (req.headers.get('authorization')?.startsWith('Bearer ')) return null;
  return validateCsrf(req);
}

/**
 * Wraps an API route handler and enforces a single permission check.
 * Returns 401 if unauthenticated, 403 if missing permission.
 * Mutating methods also run CSRF origin validation.
 *
 * Usage:
 *   export const POST = withPermission('CREATE_JOB', async (req, ctx, session) => { ... });
 */
export function withPermission<T extends RouteContext>(
  permission: Permission,
  handler: AuthedHandler<T>,
) {
  return async (req: NextRequest, ctx: T) => {
    const csrfError = csrfGuard(req);
    if (csrfError) return csrfError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session.role as Role, permission)) {
      return NextResponse.json(
        { error: 'Forbidden', required: permission },
        { status: 403 },
      );
    }
    return handler(req, ctx, session);
  };
}

/**
 * Like withPermission but accepts multiple permissions (OR logic by default).
 * Pass requireAll: true for AND logic.
 */
export function withAnyPermission<T extends RouteContext>(
  permissions: Permission[],
  handler: AuthedHandler<T>,
  requireAll = false,
) {
  return async (req: NextRequest, ctx: T) => {
    const csrfError = csrfGuard(req);
    if (csrfError) return csrfError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = session.role as Role;
    const granted = requireAll
      ? permissions.every((p) => hasPermission(role, p))
      : hasAnyPermission(role, permissions);

    if (!granted) {
      return NextResponse.json(
        { error: 'Forbidden', required: permissions },
        { status: 403 },
      );
    }
    return handler(req, ctx, session);
  };
}

/**
 * Only requires authentication — no specific permission needed.
 * Use for routes that just need to know who the user is.
 * Mutating methods also run CSRF origin validation.
 */
export function withAuth<T extends RouteContext>(handler: AuthedHandler<T>) {
  return async (req: NextRequest, ctx: T) => {
    const csrfError = csrfGuard(req);
    if (csrfError) return csrfError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, ctx, session);
  };
}
