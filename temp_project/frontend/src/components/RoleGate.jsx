import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function RoleGate({ roles = [], children, fallback = null }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  
  if (!user || !roles.includes(user.role)) {
    return fallback;
  }
  
  return <>{children}</>;
}
