import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, getAuthToken, authAPI, clearAllCookies, notificationsAPI } from '../api';
import SessionManager from '../services/SessionManager';
import { Capacitor } from '@capacitor/core';

// FCM Token'ı localStorage veya SharedPreferences'dan al
const getCurrentFCMToken = () => {
  try {
    // Android'de SharedPreferences'dan al
    if (Capacitor.isNativePlatform()) {
      // WebView'da localStorage kullanılıyor (MainActivity token'ı buraya yazıyor)
      return localStorage.getItem('healmedy_fcm_token') || null;
    }
    return null;
  } catch (e) {
    console.warn('[Auth] FCM token get error:', e);
    return null;
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(null);
  const [isMultiSessionMode, setIsMultiSessionMode] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Önce çoklu oturum kontrolü yap
      const storedActiveRole = SessionManager.getActiveRole();
      const activeSession = SessionManager.getActiveSession();
      
      if (storedActiveRole && activeSession?.token) {
        // Çoklu oturum modundayız
        setIsMultiSessionMode(true);
        setActiveRole(storedActiveRole);
        setAuthToken(activeSession.token);
        
        try {
          // Token'ı doğrula
          const response = await authAPI.me();
          setUser(response.data);
          
          // Session'ı güncelle
          SessionManager.updateUserData(storedActiveRole, response.data);
          
          console.log(`[Auth] Multi-session mode active for role: ${storedActiveRole}`);
        } catch (error) {
          console.log('[Auth] Multi-session token invalid, clearing...');
          SessionManager.removeSession(storedActiveRole);
          setUser(null);
          setActiveRole(null);
          setAuthToken(null);
        }
      } else {
        // Normal tek oturum modu
        const savedToken = getAuthToken();
        if (savedToken) {
          setAuthToken(savedToken);
          
          try {
            const response = await authAPI.me();
            setUser(response.data);
          } catch (error) {
            console.log('[Auth] Not authenticated or token invalid');
            setUser(null);
            setAuthToken(null);
          }
        }
      }
    } catch (error) {
      console.error('[Auth] Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('[Auth] === LOGIN START ===');
      console.log('[Auth] Calling authAPI.login...');
      
      const response = await authAPI.login(email, password);
      
      console.log('[Auth] === LOGIN RESPONSE ===');
      console.log('[Auth] Full response:', response);
      console.log('[Auth] response.data:', response?.data);
      console.log('[Auth] response.data.user:', response?.data?.user);
      console.log('[Auth] response.data.session_token:', response?.data?.session_token ? '...' + response.data.session_token.slice(-10) : 'MISSING');
      
      // Token'ı kaydet (response'da session_token var)
      if (response.data.session_token) {
        setAuthToken(response.data.session_token);
        console.log('[Auth] Token saved to localStorage');
      } else {
        console.error('[Auth] ⚠️ NO SESSION TOKEN IN RESPONSE!');
      }
      
      if (response.data.user) {
        setUser(response.data.user);
        console.log('[Auth] User set:', response.data.user.name, response.data.user.role);
      } else {
        console.error('[Auth] ⚠️ NO USER IN RESPONSE!');
      }
      
      return response.data;
    } catch (error) {
      console.error('[Auth] === LOGIN ERROR ===');
      console.error('[Auth] Error:', error);
      console.error('[Auth] Error message:', error.message);
      console.error('[Auth] Error response:', error.response);
      throw error;
    }
  };

  /**
   * Rol bazlı giriş (çoklu oturum modu için)
   */
  const loginForRole = async (email, password, role) => {
    try {
      const response = await authAPI.login(email, password);
      const { session_token, user: userData } = response.data;
      
      // Rol kontrolü
      if (userData.role !== role) {
        throw new Error(`Bu hesap ${SessionManager.ROLE_LABELS[role]} rolüne ait değil`);
      }
      
      // SessionManager'a kaydet
      SessionManager.addSession(role, userData, session_token);
      SessionManager.setActiveRole(role);
      
      // Context state'i güncelle
      setAuthToken(session_token);
      setUser(userData);
      setActiveRole(role);
      setIsMultiSessionMode(true);
      
      console.log(`[Auth] Logged in as ${role}`);
      return response.data;
    } catch (error) {
      console.error('[Auth] Role login failed:', error);
      throw error;
    }
  };

  /**
   * Token'ın benzersiz parmak izini al
   */
  const getTokenFingerprint = (token) => {
    if (!token) return 'null';
    return '...' + token.slice(-10);
  };

  /**
   * JWT token'dan user ID'yi çıkar
   */
  const decodeTokenUserId = (token) => {
    try {
      if (!token) return 'null';
      const parts = token.split('.');
      if (parts.length !== 3) return 'invalid';
      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || payload.user_id || payload.id || 'unknown';
    } catch (e) {
      return 'decode-error';
    }
  };

  /**
   * Rol değiştir (oturum açık roller arasında geçiş)
   */
  const switchRole = useCallback(async (role) => {
    console.log(`[Auth] === ROLE SWITCH START ===`);
    console.log(`[Auth] Target role: ${role}`);
    
    // Switching flag'i aç - diğer context'ler bunu kontrol edecek
    setIsSwitchingRole(true);
    
    const session = SessionManager.getSession(role);
    if (!session?.token) {
      console.log(`[Auth] No session found for role: ${role}`);
      setIsSwitchingRole(false);
      throw new Error('Bu rol için oturum bulunamadı');
    }
    
    // Debug: session'daki token bilgisini detaylı logla
    const sessionFingerprint = getTokenFingerprint(session.token);
    const sessionTokenUserId = decodeTokenUserId(session.token);
    const storedUserId = session.user?.id || session.user?._id;
    
    console.log(`[Auth] Session from SessionManager:`);
    console.log(`[Auth]   - User: ${session.user?.name} (ID: ${storedUserId})`);
    console.log(`[Auth]   - Token fingerprint: ${sessionFingerprint}`);
    console.log(`[Auth]   - Token decoded user_id: ${sessionTokenUserId}`);
    
    // Token-User eşleşmesi kontrolü
    if (sessionTokenUserId !== 'unknown' && sessionTokenUserId !== storedUserId) {
      console.error(`[Auth] ⚠️ SESSION TOKEN MISMATCH DETECTED!`);
      console.error(`[Auth]   Token belongs to: ${sessionTokenUserId}`);
      console.error(`[Auth]   Session user ID: ${storedUserId}`);
      console.error(`[Auth]   This means the wrong token was stored for this role!`);
    }
    
    try {
      // Önce mevcut user'ı temizle - temiz geçiş için
      setUser(null);
      
      // ÖNEMLİ: Cookie'leri temizle - backend cookie'den session okuyabilir
      console.log(`[Auth] Clearing all cookies before role switch...`);
      await clearAllCookies();
      
      // Token'ı değiştir
      console.log(`[Auth] Setting auth token...`);
      setAuthToken(session.token);
      SessionManager.setActiveRole(role);
      
      // localStorage'ı hemen güncelle
      localStorage.setItem('token', session.token);
      
      // Kullanıcı bilgisini API'den al
      console.log(`[Auth] Calling authAPI.me() to verify token...`);
      const response = await authAPI.me();
      const userData = response.data;
      
      const returnedUserId = userData.id || userData._id;
      console.log(`[Auth] authAPI.me() returned:`);
      console.log(`[Auth]   - User: ${userData.name} (ID: ${returnedUserId})`);
      console.log(`[Auth]   - Role: ${userData.role}`);
      
      // Session'daki user ile API'den dönen user karşılaştır
      if (storedUserId !== returnedUserId) {
        console.error(`[Auth] ⚠️ USER MISMATCH CONFIRMED!`);
        console.error(`[Auth]   Expected (stored): ${storedUserId}`);
        console.error(`[Auth]   Got (from API): ${returnedUserId}`);
        console.error(`[Auth]   This confirms the wrong token was stored during login!`);
      } else {
        console.log(`[Auth] ✓ User match confirmed: ${returnedUserId}`);
      }
      
      // Session'ı güncelle
      SessionManager.updateUserData(role, userData);
      
      // localStorage'ı güncelle
      localStorage.setItem('user', JSON.stringify(userData));
      
      // State'i güncelle - en son yapılacak
      setActiveRole(role);
      setUser(userData);
      
      console.log(`[Auth] === ROLE SWITCH COMPLETE ===`);
      
      // Küçük bir gecikme ekle - React'ın state'i propagate etmesi için
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return userData;
    } catch (error) {
      console.error('[Auth] Role switch failed:', error);
      // Token geçersiz, oturumu kaldır
      SessionManager.removeSession(role);
      throw error;
    } finally {
      // Switching flag'i kapat
      setIsSwitchingRole(false);
    }
  }, []);

  /**
   * Üst menüye dön (oturumu kapatmadan)
   */
  const returnToMultiLogin = useCallback(() => {
    // Aktif rolü temizle ama oturumları silme
    SessionManager.clearActiveRole();
    setActiveRole(null);
    // User'ı temizleme - sadece aktif role dön
    console.log('[Auth] Returned to multi-login screen');
  }, []);

  /**
   * Belirli bir rolden çıkış yap
   */
  const logoutFromRole = async (role) => {
    const session = SessionManager.getSession(role);
    
    if (session?.token) {
      // Geçici olarak bu token'ı kullan
      const currentToken = getAuthToken();
      setAuthToken(session.token);
      
      try {
        // FCM token'ı backend'den kaldır (bildirim gitmemesi için)
        const fcmToken = getCurrentFCMToken();
        if (fcmToken) {
          try {
            await notificationsAPI.unregisterFCM(fcmToken);
            console.log('[Auth] FCM token unregistered for role:', role);
          } catch (fcmError) {
            console.warn('[Auth] FCM unregister error (ignored):', fcmError.message);
          }
        }
        
        await authAPI.logout();
      } catch (error) {
        console.log('[Auth] Logout error (ignored):', error.message);
      }
      
      // Token'ı eski haline getir veya temizle
      if (currentToken && currentToken !== session.token) {
        setAuthToken(currentToken);
      }
    }
    
    // Session'ı kaldır
    SessionManager.removeSession(role);
    
    // Eğer aktif rol bu ise, state'i temizle
    if (activeRole === role) {
      setUser(null);
      setActiveRole(null);
      setAuthToken(null);
    }
    
    console.log(`[Auth] Logged out from role: ${role}`);
  };

  /**
   * Tüm oturumlardan çıkış
   */
  const logoutAll = async () => {
    // Tüm oturumları kapat
    const roles = SessionManager.getLoggedInRoles();
    for (const role of roles) {
      await logoutFromRole(role);
    }
    
    // Her şeyi temizle
    SessionManager.clearAllSessions();
    setAuthToken(null);
    setUser(null);
    setActiveRole(null);
    setIsMultiSessionMode(false);
    
    console.log('[Auth] Logged out from all sessions');
  };

  const register = async (email, password, name, role) => {
    try {
      const response = await authAPI.register({ email, password, name, role });
      
      // Token'ı kaydet
      if (response.data.session_token) {
        setAuthToken(response.data.session_token);
        console.log('[Auth] Token saved to localStorage after register');
      }
      
      setUser(response.data.user);
      return response.data;
    } catch (error) {
      console.error('[Auth] Register failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    // Çoklu oturum modundaysak, sadece aktif rolden çıkış yap
    if (isMultiSessionMode && activeRole) {
      await logoutFromRole(activeRole);
      return;
    }
    
    // Normal çıkış
    try {
      // FCM token'ı backend'den kaldır (bildirim gitmemesi için)
      const fcmToken = getCurrentFCMToken();
      if (fcmToken) {
        try {
          await notificationsAPI.unregisterFCM(fcmToken);
          console.log('[Auth] FCM token unregistered on logout');
        } catch (fcmError) {
          console.warn('[Auth] FCM unregister error (ignored):', fcmError.message);
        }
      }
      
      await authAPI.logout();
    } catch (error) {
      console.log('[Auth] Logout error (ignored):', error.message);
    } finally {
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

  // Oturum açık roller
  const getLoggedInRoles = useCallback(() => {
    return SessionManager.getLoggedInFieldRoles();
  }, []);

  // Belirli bir rolün oturumu var mı?
  const hasSessionForRole = useCallback((role) => {
    return SessionManager.hasSession(role);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      // State
      user, 
      loading, 
      isAuthenticated,
      activeRole,
      isMultiSessionMode,
      isSwitchingRole,
      
      // Normal auth
      login, 
      register, 
      logout, 
      checkAuth,
      handleGoogleAuthRedirect,
      
      // Multi-session
      loginForRole,
      switchRole,
      returnToMultiLogin,
      logoutFromRole,
      logoutAll,
      getLoggedInRoles,
      hasSessionForRole
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
