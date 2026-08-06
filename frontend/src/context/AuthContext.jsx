import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BASE_API_URL } from '../config';
import { getEntitlements } from '../config/planFeatures';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [entitlements, setEntitlements] = useState([]);
  // Session auth is HttpOnly ats_token cookie only — no JWT in localStorage.
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalAuth = () => {
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
  };

  const fetchProfile = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_API_URL}/api/profile`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setUser(data.user);
      setOrganization(data.organization);
      setEntitlements(data.entitlements || []);
      setIsAuthenticated(true);
      if (data.organization?._id) {
        localStorage.setItem('orgId', data.organization._id);
      }
    } catch (error) {
      console.error('Auth verification failed:', error);
      clearLocalAuth();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Clear any legacy JWT left in localStorage from older builds
    localStorage.removeItem('token');
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const handleUnauth = () => {
      clearLocalAuth();
      window.location.href = '/login';
    };
    window.addEventListener('auth:unauthorized', handleUnauth);
    window.addEventListener('auth:session-expired', handleUnauth);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauth);
      window.removeEventListener('auth:session-expired', handleUnauth);
    };
  }, []);

  const login = async (email, password) => {
    const response = await fetch(`${BASE_API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    if (data.organization && data.organization._id) {
      localStorage.setItem('orgId', data.organization._id);
    }

    setUser(data.user);
    setOrganization(data.organization);
    setEntitlements(data.entitlements || []);
    setIsAuthenticated(true);

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
    try {
      await fetch(`${BASE_API_URL}/api/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      /* ignore network errors on logout */
    }
    clearLocalAuth();
    window.location.href = '/login';
  };

  /** Apply an already-authenticated API payload (login / demo-login / MFA). */
  const acceptSession = useCallback((data) => {
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
  const updateOrganization = (data) => {
    setOrganization((prev) => {
      const next = { ...prev, ...data };
      if (data.plan) setEntitlements(getEntitlements(next.plan));
      return next;
    });
  };
  const refreshProfile = () => fetchProfile();

  const value = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
