/**
 * RoleLoginScreen - Rol Bazlı Giriş Ekranı
 * Belirli bir rol için giriş ekranı (Şoför, ATT, Paramedik)
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Car, Stethoscope, Heart, ArrowLeft, LogIn, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import SessionManager from '../services/SessionManager';
import { authAPI } from '../api';

// Rol ikonları
const RoleIcon = ({ role, className }) => {
  const icons = {
    sofor: Car,
    att: Stethoscope,
    paramedik: Heart
  };
  const Icon = icons[role];
  return Icon ? <Icon className={className} /> : null;
};

const RoleLoginScreen = () => {
  const { role } = useParams();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const roleInfo = SessionManager.getRoleInfo(role);
  
  useEffect(() => {
    // Geçersiz rol kontrolü
    if (!SessionManager.FIELD_ROLES.includes(role)) {
      toast.error('Geçersiz rol');
      navigate('/multi-login');
    }
    
    // Zaten oturum varsa direkt dashboard'a git
    if (SessionManager.hasSession(role)) {
      SessionManager.setActiveRole(role);
      navigate('/dashboard');
    }
  }, [role, navigate]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Login öncesi mevcut token'ı temizle (interceptor eski token'ı göndermesin)
      // NOT: Bu sadece header'ı temizler, localStorage'daki diğer oturumları etkilemez
      const { setAuthToken } = await import('../api');
      console.log('[RoleLogin] Clearing auth header before login...');
      setAuthToken(null);
      
      // API'ye giriş isteği gönder (temiz header ile)
      const response = await authAPI.login(email, password);
      const { session_token, user } = response.data;
      
      // Debug: token ve user bilgilerini detaylı logla
      const tokenFingerprint = session_token ? '...' + session_token.slice(-10) : 'null';
      let tokenUserId = 'unknown';
      try {
        if (session_token) {
          const parts = session_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            tokenUserId = payload.sub || payload.user_id || payload.id || 'unknown';
          }
        }
      } catch (e) {
        tokenUserId = 'decode-error';
      }
      
      const userId = user?.id || user?._id;
      console.log('[RoleLogin] === LOGIN RESPONSE ===');
      console.log(`[RoleLogin] Role: ${role}`);
      console.log(`[RoleLogin] User: ${user?.name} (ID: ${userId})`);
      console.log(`[RoleLogin] User role from API: ${user?.role}`);
      console.log(`[RoleLogin] Token fingerprint: ${tokenFingerprint}`);
      console.log(`[RoleLogin] Token decoded user_id: ${tokenUserId}`);
      
      // Token-User eşleşmesi kontrolü
      if (tokenUserId !== 'unknown' && tokenUserId !== userId && tokenUserId !== user?.email) {
        console.error(`[RoleLogin] ⚠️ TOKEN MISMATCH! Token belongs to ${tokenUserId}, but API returned user ${userId}`);
      }
      
      // Rol kontrolü - kullanıcının rolü seçilen rol ile eşleşmeli
      if (user.role !== role) {
        setError(`Bu hesap ${SessionManager.ROLE_LABELS[role]} rolüne ait değil. Hesabınızın rolü: ${SessionManager.ROLE_LABELS[user.role] || user.role}`);
        setLoading(false);
        return;
      }
      
      // Oturumu SessionManager'a kaydet
      SessionManager.addSession(role, user, session_token);
      
      // Aktif rolü ayarla
      SessionManager.setActiveRole(role);
      
      // localStorage'a da kaydet (eski sistem uyumluluğu için)
      localStorage.setItem('token', session_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('[RoleLogin] Session saved, navigating to dashboard...');
      
      toast.success(`${roleInfo.label} olarak giriş yapıldı`);
      
      // Sayfa yenileyerek AuthContext'in yeni oturumu algılamasını sağla
      window.location.href = '/dashboard';
      
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.status === 401) {
        setError('E-posta veya şifre hatalı');
      } else if (err.response?.data?.detail) {
        // detail bir obje veya array olabilir, string'e dönüştür
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map(d => d.msg || d).join(', '));
        } else if (typeof detail === 'object') {
          setError(detail.msg || JSON.stringify(detail));
        } else {
          setError('Giriş yapılamadı');
        }
      } else {
        setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
    navigate('/multi-login');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Geri Butonu */}
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-4 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        
        {/* Login Kartı */}
        <Card className={`border-2 ${roleInfo.colors?.border || 'border-slate-600'} bg-slate-800/80 backdrop-blur`}>
          <CardHeader className="text-center pb-2">
            {/* Rol İkonu */}
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${roleInfo.colors?.bg || 'bg-slate-700'}`}>
              <RoleIcon role={role} className="h-10 w-10 text-white" />
            </div>
            
            <CardTitle className="text-2xl text-white">
              {roleInfo.label} Girişi
            </CardTitle>
            <p className="text-slate-400 text-sm">
              {roleInfo.label} hesabınızla giriş yapın
            </p>
          </CardHeader>
          
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hata Mesajı */}
              {error && (
                <Alert variant="destructive" className="bg-red-900/50 border-red-800 text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {/* E-posta */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ornek@healmedy.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-white"
                />
              </div>
              
              {/* Şifre */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-white pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {/* Giriş Butonu */}
              <Button
                type="submit"
                disabled={loading}
                className={`w-full ${roleInfo.colors?.bg || 'bg-blue-600'} ${roleInfo.colors?.hover || 'hover:bg-blue-700'} text-white`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Giriş Yap
                  </>
                )}
              </Button>
            </form>
            
            {/* Diğer oturumlar bilgisi */}
            {SessionManager.getSessionCount() > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <p className="text-slate-400 text-sm text-center">
                  {SessionManager.getSessionCount()} aktif oturum mevcut
                </p>
                <div className="flex justify-center gap-2 mt-2">
                  {SessionManager.getLoggedInFieldRoles().map(loggedRole => {
                    const info = SessionManager.getRoleInfo(loggedRole);
                    return (
                      <div 
                        key={loggedRole}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${info.colors?.bg || 'bg-slate-600'}`}
                        title={info.label}
                      >
                        <RoleIcon role={loggedRole} className="h-4 w-4 text-white" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoleLoginScreen;

