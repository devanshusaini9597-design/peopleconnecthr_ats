import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BASE_API_URL } from '../config';
import { getEntitlements } from '../config/planFeatures';
import { handleLogout as hardLogout, isPublicAuthPath } from '../utils/authUtils';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [entitlements, setEntitlements] = useState([]);
  // Session auth is HttpOnly ats_token cookie only — no JWT in localStorage.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const profileRequestId = useRef(0);

  const clearLocalAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('orgId');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userData');
    localStorage.removeItem('orgData');
    localStorage.removeItem('userRole');
    localStorage.removeItem('orgName');
    setUser(null);
    setOrganization(null);
    setEntitlements([]);
    setIsAuthenticated(false);
  }, []);

  const fetchProfile = useCallback(async () => {
    const requestId = ++profileRequestId.current;
    try {
      const response = await fetch(`${BASE_API_URL}/api/profile`, {
        credentials: 'include',
        cache: 'no-store',
      });

      // A newer login/acceptSession invalidated this in-flight check
      if (requestId !== profileRequestId.current) return;

      if (!response.ok) {
        let code = '';
        try {
          const body = await response.json();
          code = body?.code || '';
        } catch {
          /* ignore non-JSON */
        }
        if (
          code === 'SESSION_EXPIRED' ||
          code === 'SESSION_IDLE_TIMEOUT' ||
          code === 'SESSION_REVOKED' ||
          code === 'ACCOUNT_DEACTIVATED'
        ) {
          clearLocalAuth();
          if (!isPublicAuthPath()) {
            window.location.replace('/login?reason=expired');
          }
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      if (requestId !== profileRequestId.current) return;

      setUser(data.user);
      setOrganization(data.organization);
      setEntitlements(data.entitlements || []);
      setIsAuthenticated(true);
      if (data.organization?._id) {
        localStorage.setItem('orgId', data.organization._id);
      }
    } catch (error) {
      if (requestId !== profileRequestId.current) return;
      console.error('Auth verification failed:', error);
      clearLocalAuth();
    } finally {
      if (requestId === profileRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [clearLocalAuth]);

  useEffect(() => {
    // Clear any legacy JWT left in localStorage from older builds
    localStorage.removeItem('token');
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const handleUnauth = () => {
      profileRequestId.current += 1;
      clearLocalAuth();
      if (!isPublicAuthPath()) {
        window.location.replace('/login?reason=expired');
      }
    };
    const onPageShow = (event) => {
      if (!event.persisted) return;
      fetch(`${BASE_API_URL}/api/profile`, { credentials: 'include', cache: 'no-store' })
        .then((res) => {
          if (!res.ok) {
            profileRequestId.current += 1;
            clearLocalAuth();
            if (!isPublicAuthPath()) {
              window.location.replace('/login');
            }
          }
        })
        .catch(() => {
          profileRequestId.current += 1;
          clearLocalAuth();
          if (!isPublicAuthPath()) {
            window.location.replace('/login');
          }
        });
    };
    window.addEventListener('auth:unauthorized', handleUnauth);
    window.addEventListener('auth:session-expired', handleUnauth);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauth);
      window.removeEventListener('auth:session-expired', handleUnauth);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [clearLocalAuth]);

  const login = async (email, password) => {
    const response = await fetch(`${BASE_API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.displayMessage || data.message || 'Login failed');
    }

    if (data.requiresOtp || data.requiresMfa || data.requiresMfaEnrollment) {
      return data;
    }

    profileRequestId.current += 1;
    if (data.organization && data.organization._id) {
      localStorage.setItem('orgId', data.organization._id);
    }

    setUser(data.user);
    setOrganization(data.organization);
    setEntitlements(data.entitlements || []);
    setIsAuthenticated(true);
    setIsLoading(false);

    return data;
  };

  const register = async (data) => {
    const response = await fetch(`${BASE_API_URL}/api/onboarding/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.message || 'Registration failed');
    }

    return resData;
  };

  const logout = async () => {
    profileRequestId.current += 1;
    // Hard logout navigates once — clearing React auth first would soft-route
    // to /login via ProtectedRoute, then hard-reload again (double flash).
    await hardLogout();
    setUser(null);
    setOrganization(null);
    setEntitlements([]);
    setIsAuthenticated(false);
  };

  /** Apply an already-authenticated API payload (login / MFA). */
  const acceptSession = useCallback((data) => {
    // Invalidate any in-flight anonymous profile check so it can't wipe this session
    profileRequestId.current += 1;
    if (data?.organization?._id) {
      localStorage.setItem('orgId', data.organization._id);
    }
    if (data?.user) {
      localStorage.setItem('userData', JSON.stringify(data.user));
      localStorage.setItem('userEmail', data.user.email || '');
      localStorage.setItem('userName', data.user.name || '');
      localStorage.setItem('userRole', data.user.role || '');
      localStorage.setItem('isLoggedIn', 'true');
    }
    if (data?.organization) {
      localStorage.setItem('orgData', JSON.stringify(data.organization));
      localStorage.setItem('orgName', data.organization.name || '');
    }
    setUser(data?.user || null);
    setOrganization(data?.organization || null);
    setEntitlements(data?.entitlements || getEntitlements(data?.organization?.plan));
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));
  const updateOrganization = useCallback((data) => {
    setOrganization((prev) => {
      const next = { ...(prev || {}), ...data };
      try {
        const existing = JSON.parse(localStorage.getItem('orgData') || '{}');
        localStorage.setItem('orgData', JSON.stringify({ ...existing, ...next }));
        if (next.name) localStorage.setItem('orgName', next.name);
      } catch { /* ignore */ }
      if (data?.plan) setEntitlements(getEntitlements(next.plan));
      return next;
    });
  }, []);
  const refreshProfile = () => fetchProfile();

  useEffect(() => {
    const onOrgUpdated = (event) => {
      const payload = event?.detail;
      if (payload && typeof payload === 'object') {
        updateOrganization(payload);
        return;
      }
      fetchProfile();
    };
    window.addEventListener('orgDataUpdated', onOrgUpdated);
    return () => window.removeEventListener('orgDataUpdated', onOrgUpdated);
  }, [updateOrganization, fetchProfile]);

  const value = useMemo(() => ({
    user,
    organization,
    entitlements,
    token: null,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    acceptSession,
    updateUser,
    updateOrganization,
    refreshProfile,
  }), [
    user,
    organization,
    entitlements,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    acceptSession,
    updateUser,
    updateOrganization,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
