import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BASE_API_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${BASE_API_URL}/api/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const data = await response.json();
      setUser(data.user);
      setOrganization(data.organization);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth verification failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = async (email, password) => {
    const response = await fetch(`${BASE_API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    localStorage.setItem('token', data.token);
    if (data.organization && data.organization._id) {
      localStorage.setItem('orgId', data.organization._id);
    }
    
    setToken(data.token);
    setUser(data.user);
    setOrganization(data.organization);
    setIsAuthenticated(true);
    
    return data;
  };

  const register = async (data) => {
    const response = await fetch(`${BASE_API_URL}/api/onboarding/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.message || 'Registration failed');
    }
    
    return resData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('orgId');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    setToken(null);
    setUser(null);
    setOrganization(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const updateUser = (data) => setUser(prev => ({ ...prev, ...data }));
  const updateOrganization = (data) => setOrganization(prev => ({ ...prev, ...data }));
  const refreshProfile = () => fetchProfile();

  const value = {
    user,
    organization,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    updateUser,
    updateOrganization,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
