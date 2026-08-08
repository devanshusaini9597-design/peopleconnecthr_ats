'use client';

import { useEffect, useState } from 'react';
import { Role, hasPermission as checkPermission, hasAnyPermission as checkAnyPermission, Permission } from '@/lib/roles';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser(data.user);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return checkPermission(user.role, permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!user) return false;
    return checkAnyPermission(user.role, permissions);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isRecruiter = user?.role === 'RECRUITER' || user?.role === 'ADMIN';
  const isHiringManager = user?.role === 'HIRING_MANAGER' || user?.role === 'RECRUITER' || user?.role === 'ADMIN';

  return {
    user,
    loading,
    hasPermission,
    hasAnyPermission,
    isAdmin,
    isRecruiter,
    isHiringManager,
    isAuthenticated: !!user,
  };
}
