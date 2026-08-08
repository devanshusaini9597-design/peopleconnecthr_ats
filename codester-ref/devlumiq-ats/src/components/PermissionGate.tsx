'use client';

import { useAuth } from '@/hooks/useAuth';
import { Permission, Role } from '@/lib/roles';

interface PermissionGateProps {
  /** Require a single permission */
  permission?: Permission;
  /** Require any one of these permissions (OR logic) */
  permissions?: Permission[];
  /** Use AND logic when checking multiple permissions */
  requireAll?: boolean;
  /** Restrict to one or more roles */
  role?: Role | Role[];
  /** Rendered when access is denied (default: nothing) */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally render children based on the current user's role/permissions.
 *
 * Examples:
 *   <PermissionGate permission="CREATE_JOB">
 *     <CreateJobButton />
 *   </PermissionGate>
 *
 *   <PermissionGate role="ADMIN" fallback={<p>Admins only</p>}>
 *     <AdminPanel />
 *   </PermissionGate>
 *
 *   <PermissionGate permissions={["MANAGE_USERS","MANAGE_SETTINGS"]} requireAll>
 *     <DangerZone />
 *   </PermissionGate>
 */
export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  role,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { user, loading, hasPermission, hasAnyPermission } = useAuth();

  if (loading) return null;
  if (!user) return <>{fallback}</>;

  // Role check
  if (role !== undefined) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role as Role)) return <>{fallback}</>;
  }

  // Single permission
  if (permission && !hasPermission(permission)) return <>{fallback}</>;

  // Multiple permissions
  if (permissions && permissions.length > 0) {
    const granted = requireAll
      ? permissions.every((p) => hasPermission(p))
      : hasAnyPermission(permissions);
    if (!granted) return <>{fallback}</>;
  }

  return <>{children}</>;
}
