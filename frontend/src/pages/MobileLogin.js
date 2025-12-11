/**
 * Mobil Giriş Ekranı - Çoklu Oturum Yönetimi
 * 3 kullanıcı aynı anda giriş yapabilir
 * Oturumlar sürekli açık kalır, şifresiz geçiş yapılır
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  User, LogIn, Plus, ChevronRight, Ambulance, 
  Wifi, WifiOff, Battery, Clock, Shield, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NativeBridge from '../native';

// Rol renkleri ve etiketleri
const roleConfig = {
  sofor: { label: 'Şoför', color: 'bg-blue-600', icon: '🚗' },
  att: { label: 'ATT', color: 'bg-green-600', icon: '🩺' },
  paramedik: { label: 'Paramedik', color: 'bg-purple-600', icon: '💉' },
  hemsire: { label: 'Hemşire', color: 'bg-pink-600', icon: '👩‍⚕️' },
  operasyon_muduru: { label: 'Operasyon Müdürü', color: 'bg-red-600', icon: '👔' },
  merkez_ofis: { label: 'Merkez Ofis', color: 'bg-gray-600', icon: '🏢' }
};

const MobileLogin = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [sessions, setSessions] = useState({ activeSessionId: null, sessions: [] });
  const [loading, setLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState({ connected: true });
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // Oturumları yükle
  useEffect(() => {
    loadSessions();
    checkNetworkStatus();
    
    // Ağ durumu değişikliklerini dinle
    if (NativeBridge.isNativeApp()) {
      NativeBridge.watchNetworkStatus((status) => {
        setNetworkStatus(status);
      });
    }
  }, []);
  
  const loadSessions = async () => {
    try {
      const sessionData = await NativeBridge.getSessions();
      setSessions(sessionData);
    } catch (error) {
      console.error('Load sessions error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const checkNetworkStatus = async () => {
    try {
      const status = await NativeBridge.getNetworkStatus();
      setNetworkStatus(status);
    } catch (error) {
      setNetworkStatus({ connected: true });
    }
  };
  
  // Oturuma geç (şifresiz)
  const handleSwitchSession = async (session) => {
    if (session.status === 'empty') {
      setLoginDialogOpen(true);
      return;
    }
    
    try {
      await NativeBridge.switchSession(session.id);
      toast.success(`${session.userName} olarak devam ediliyor`);
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // Yeni kullanıcı girişi
  const handleNewLogin = async (e) => {
    e.preventDefault();
    
    if (!loginForm.username || !loginForm.password) {
      toast.error('Kullanıcı adı ve şifre gerekli');
      return;
    }
    
    setLoginLoading(true);
    
    try {
      const response = await login(loginForm.username, loginForm.password);
      
      if (response.success) {
        await NativeBridge.addSession({
          userId: response.user.id,
          userName: response.user.name,
          role: response.user.role,
          avatar: response.user.avatar,
          token: response.token,
          refreshToken: response.refreshToken,
          shiftId: response.user.activeShiftId
        });
        
        toast.success(`Hoş geldiniz, ${response.user.name}!`);
        setLoginDialogOpen(false);
        setLoginForm({ username: '', password: '' });
        await loadSessions();
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.message || 'Giriş başarısız');
    } finally {
      setLoginLoading(false);
    }
  };
  
  // Oturumu kapat
  const handleLogout = async (sessionId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Bu oturumu kapatmak istediğinize emin misiniz?')) {
      return;
    }
    
    try {
      await NativeBridge.logoutSession(sessionId);
      toast.success('Oturum kapatıldı');
      await loadSessions();
    } catch (error) {
      toast.error('Oturum kapatılamadı');
    }
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600">Aktif</Badge>;
      case 'idle':
        return <Badge className="bg-yellow-600">Beklemede</Badge>;
      case 'empty':
        return <Badge variant="outline">Boş Slot</Badge>;
      default:
        return null;
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-600 to-red-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-600 to-red-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 text-white">
        <div className="flex items-center space-x-3">
          <Ambulance className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-bold">HEALMEDY</h1>
            <p className="text-xs text-red-200">Ambulans Sistemi</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-sm">
          {networkStatus.connected ? (
            <Wifi className="h-4 w-4 text-green-300" />
          ) : (
            <WifiOff className="h-4 w-4 text-yellow-300" />
          )}
          <Battery className="h-4 w-4" />
        </div>
      </div>
      
      {/* Oturum Kartları */}
      <div className="space-y-4 mb-6">
        <h2 className="text-white text-lg font-semibold flex items-center">
          <Shield className="h-5 w-5 mr-2" />
          Aktif Oturumlar
        </h2>
        
        {sessions.sessions.map((session, index) => (
          <Card 
            key={session.id}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${
              session.status === 'active' ? 'ring-2 ring-green-500' :
              session.status === 'idle' ? 'ring-1 ring-yellow-400' :
              'opacity-80'
            }`}
            onClick={() => handleSwitchSession(session)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {session.status === 'empty' ? (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <Plus className="h-6 w-6 text-gray-400" />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-full ${roleConfig[session.role]?.color || 'bg-gray-600'} flex items-center justify-center text-white text-xl`}>
                      {roleConfig[session.role]?.icon || '👤'}
                    </div>
                  )}
                  
                  <div>
                    {session.status === 'empty' ? (
                      <>
                        <p className="font-medium text-gray-600">Boş Slot {index + 1}</p>
                        <p className="text-sm text-gray-400">Yeni giriş yapın</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">{session.userName}</p>
                        <p className="text-sm text-gray-500">
                          {roleConfig[session.role]?.label || session.role}
                        </p>
                        {session.lastActive && (
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <Clock className="h-3 w-3 mr-1" />
                            Son: {new Date(session.lastActive).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getStatusBadge(session.status)}
                  
                  {session.status !== 'empty' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
                      onClick={(e) => handleLogout(session.id, e)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Bilgi Notu */}
      <div className="bg-white/10 rounded-lg p-4 text-white text-sm">
        <p className="flex items-center mb-2">
          <Shield className="h-4 w-4 mr-2" />
          <strong>Çoklu Oturum Sistemi</strong>
        </p>
        <ul className="list-disc list-inside text-red-100 space-y-1 text-xs">
          <li>3 kullanıcı aynı anda giriş yapabilir</li>
          <li>Oturumlar sürekli açık kalır</li>
          <li>Geçiş yapmak için karta dokunun</li>
          <li>Çıkış için X butonunu kullanın</li>
        </ul>
      </div>
      
      {/* Ağ Durumu Uyarısı */}
      {!networkStatus.connected && (
        <div className="fixed bottom-4 left-4 right-4 bg-yellow-500 text-yellow-900 rounded-lg p-3 flex items-center">
          <WifiOff className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium text-sm">Çevrimdışı Mod</p>
            <p className="text-xs">İnternet bağlantısı yok. Veriler senkronize edilecek.</p>
          </div>
        </div>
      )}
      
      {/* Yeni Giriş Dialog */}
      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <LogIn className="h-5 w-5 mr-2 text-red-600" />
              Yeni Kullanıcı Girişi
            </DialogTitle>
            <DialogDescription>
              Hesap bilgilerinizi girerek oturum açın
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleNewLogin} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Kullanıcı Adı</Label>
              <Input
                type="text"
                placeholder="Kullanıcı adınız"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                disabled={loginLoading}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Şifre</Label>
              <Input
                type="password"
                placeholder="Şifreniz"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                disabled={loginLoading}
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLoginDialogOpen(false)}
                disabled={loginLoading}
                className="flex-1"
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={loginLoading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {loginLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Giriş Yap
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileLogin;

