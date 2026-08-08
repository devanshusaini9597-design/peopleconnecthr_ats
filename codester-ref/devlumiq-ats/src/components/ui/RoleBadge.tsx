'use client';

import { ROLE_UI, roleBadgeClass } from '@/lib/roleUi';
import type { Role } from '@/lib/roles';

interface RoleBadgeProps {
  role: string;
  /** Show lucide icon next to label */
  showIcon?: boolean;
  className?: string;
  size?: 'sm' | 'xs';
}

export default function RoleBadge({
  role,
  showIcon = false,
  className = '',
  size = 'xs',
}: RoleBadgeProps) {
  const meta = role in ROLE_UI ? ROLE_UI[role as Role] : null;
  const label = meta?.label ?? role.replace(/_/g, ' ');
  const Icon = meta?.icon;
  const sizeCls =
    size === 'sm'
      ? 'text-xs px-2.5 py-1 gap-1.5'
      : 'text-[10px] px-2 py-0.5 gap-1';

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border uppercase tracking-wide ${sizeCls} ${roleBadgeClass(role)} ${className}`}
    >
      {showIcon && Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5'} />}
      {label}
    </span>
  );
}
