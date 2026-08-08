import {
  Crown,
  Briefcase,
  UserCog,
  UserCheck,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { ROLE_DISPLAY_NAMES, type Role } from '@/lib/roles';

/** Single source of truth for role colors/icons across Admin Console, Users, header, etc. */
export const ROLE_UI: Record<
  Role,
  {
    label: string;
    badge: string;
    icon: LucideIcon;
    barFrom: string;
    barTo: string;
  }
> = {
  ADMIN: {
    label: ROLE_DISPLAY_NAMES.ADMIN,
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    icon: Crown,
    barFrom: 'from-violet-500',
    barTo: 'to-violet-300',
  },
  RECRUITER: {
    label: ROLE_DISPLAY_NAMES.RECRUITER,
    badge: 'bg-brand-100 text-brand-700 border-brand-200',
    icon: Briefcase,
    barFrom: 'from-brand-500',
    barTo: 'to-brand-300',
  },
  HIRING_MANAGER: {
    label: ROLE_DISPLAY_NAMES.HIRING_MANAGER,
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: UserCog,
    barFrom: 'from-amber-500',
    barTo: 'to-amber-300',
  },
  INTERVIEWER: {
    label: ROLE_DISPLAY_NAMES.INTERVIEWER,
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: UserCheck,
    barFrom: 'from-sky-500',
    barTo: 'to-sky-300',
  },
  VIEWER: {
    label: ROLE_DISPLAY_NAMES.VIEWER,
    badge: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: Eye,
    barFrom: 'from-stone-500',
    barTo: 'to-stone-300',
  },
};

export function roleBadgeClass(role: string | null | undefined): string {
  if (role && role in ROLE_UI) return ROLE_UI[role as Role].badge;
  return ROLE_UI.VIEWER.badge;
}
