import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, getAuthToken, authAPI } from '../api';
import SessionManager from '../services/SessionManager';

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
   * Rol değiştir (oturum açık roller arasında geçiş)
   */
  const switchRole = useCallback(async (role) => {
    console.log(`[Auth] Starting role switch to: ${role}`);
    
    // Switching flag'i aç - diğer context'ler bunu kontrol edecek
    setIsSwitchingRole(true);
    
    const session = SessionManager.getSession(role);
    if (!session?.token) {
      console.log(`[Auth] No session found for role: ${role}`);
      setIsSwitchingRole(false);
      throw new Error('Bu rol için oturum bulunamadı');
    }
    
    // Debug: session'daki user bilgisini logla
    console.log(`[Auth] Session found for ${role}:`, {
      storedUserName: session.user?.name,
      storedUserId: session.user?.id || session.user?._id,
      storedUserRole: session.user?.role,
      tokenPreview: session.token.substring(0, 20) + '...'
    });
    
    try {
      // Önce mevcut user'ı temizle - temiz geçiş için
      setUser(null);
      
      // Token'ı değiştir
      console.log(`[Auth] Setting auth token for role: ${role}`);
      setAuthToken(session.token);
      SessionManager.setActiveRole(role);
      
      // localStorage'ı hemen güncelle
      localStorage.setItem('token', session.token);
      
      // Kullanıcı bilgisini API'den al
      console.log(`[Auth] Calling authAPI.me() to verify token...`);
      const response = await authAPI.me();
      const userData = response.data;
      
      console.log(`[Auth] authAPI.me() returned:`, {
        id: userData.id || userData._id,
        name: userData.name,
        role: userData.role
      });
      
      // Session'daki user ile API'den dönen user karşılaştır
      const storedUserId = session.user?.id || session.user?._id;
      const returnedUserId = userData.id || userData._id;
      if (storedUserId !== returnedUserId) {
        console.error(`[Auth] USER MISMATCH! Stored: ${storedUserId}, Returned: ${returnedUserId}`);
        console.error('[Auth] This indicates the wrong token was stored during login!');
      }
      
      // Session'ı güncelle
      SessionManager.updateUserData(role, userData);
      
      // localStorage'ı güncelle
      localStorage.setItem('user', JSON.stringify(userData));
      
      // State'i güncelle - en son yapılacak
      setActiveRole(role);
      setUser(userData);
      
      console.log(`[Auth] Switched to role: ${role}, user ID: ${userData.id || userData._id}, name: ${userData.name}`);
      
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
