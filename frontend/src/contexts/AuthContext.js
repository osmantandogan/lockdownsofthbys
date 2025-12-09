import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { setAuthToken, getAuthToken, authAPI } from '../api';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Önce kayıtlı token var mı kontrol et
      const savedToken = getAuthToken();
      if (savedToken) {
        // Token varsa header'a ekle
        setAuthToken(savedToken);
      }
      
      // /me endpoint'ini çağır
      const response = await authAPI.me();
      setUser(response.data);
    } catch (error) {
      console.log('[Auth] Not authenticated or token invalid');
      setUser(null);
      // Token geçersizse temizle
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      
      // Token'ı kaydet (response'da session_token var)
      if (response.data.session_token) {
        setAuthToken(response.data.session_token);
        console.log('[Auth] Token saved to localStorage');
      }
      
      setUser(response.data.user);
      return response.data;
    } catch (error) {
      console.error('[Auth] Login failed:', error);
      throw error;
    }
  };

  const register = async (email, password, name, role) => {
    const response = await axios.post(`${API_URL}/auth/register`, 
      { email, password, name, role },
      { 
        withCredentials: true,
        headers: getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {}
      }
    );
    
    // Token'ı kaydet
    if (response.data.session_token) {
      setAuthToken(response.data.session_token);
    }
    
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.log('[Auth] Logout error (ignored):', error.message);
    } finally {
      // Token'ı temizle
      setAuthToken(null);
      setUser(null);
    }
  };

  const handleGoogleAuthRedirect = () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  // isAuthenticated: user var ve loading bitti
  const isAuthenticated = !loading && !!user;

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAuthenticated,
      login, 
      register, 
      logout, 
      checkAuth,
      handleGoogleAuthRedirect 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
