/**
 * MultiLoginScreen - Çoklu Giriş Ekranı
 * Ambulans ekibi için 3'lü rol seçim ekranı (Şoför, ATT, Paramedik)
 * Alt kısımda Merkez Giriş butonu
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Car, Stethoscope, Heart, Building2, CheckCircle, LogIn, User } from 'lucide-react';
import SessionManager from '../services/SessionManager';

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

const MultiLoginScreen = () => {
  const navigate = useNavigate();
  const [fieldRolesStatus, setFieldRolesStatus] = useState([]);
  
  useEffect(() => {
    // Rol durumlarını yükle
    loadRolesStatus();
  }, []);
  
  const loadRolesStatus = () => {
    const status = SessionManager.getFieldRolesStatus();
    setFieldRolesStatus(status);
  };
  
  // Rol kartına tıklandığında
  const handleRoleClick = (role) => {
    const roleInfo = SessionManager.getRoleInfo(role);
    
    if (roleInfo.hasSession) {
      // Oturum varsa direkt dashboard'a git
      SessionManager.setActiveRole(role);
      navigate('/dashboard');
    } else {
      // Oturum yoksa login ekranına git
      navigate(`/role-login/${role}`);
    }
  };
  
  // Merkez giriş ekranına git
  const handleCenterLogin = () => {
    navigate('/login');
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo / Başlık */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-red-600 rounded-xl flex items-center justify-center">
            <Heart className="h-10 w-10 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">HEALMEDY</h1>
        <p className="text-slate-400">Saha Ekibi Giriş Paneli</p>
      </div>
      
      {/* 3'lü Rol Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-8">
        {fieldRolesStatus.map((roleInfo) => (
          <Card 
            key={roleInfo.key}
            onClick={() => handleRoleClick(roleInfo.key)}
            className={`
              cursor-pointer transition-all duration-300 transform hover:scale-105
              border-2 overflow-hidden relative
              ${roleInfo.hasSession 
                ? `${roleInfo.colors.border} ${roleInfo.colors.light}` 
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
              }
            `}
          >
            {/* Oturum açık göstergesi */}
            {roleInfo.hasSession && (
              <div className="absolute top-3 right-3">
                <Badge className={`${roleInfo.colors.bg} text-white`}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Aktif
                </Badge>
              </div>
            )}
            
            <CardContent className="p-8 text-center">
              {/* Rol İkonu */}
              <div className={`
                w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4
                ${roleInfo.hasSession 
                  ? roleInfo.colors.bg 
                  : 'bg-slate-700'
                }
              `}>
                <RoleIcon 
                  role={roleInfo.key} 
                  className={`h-12 w-12 ${roleInfo.hasSession ? 'text-white' : 'text-slate-400'}`} 
                />
              </div>
              
              {/* Rol Adı */}
              <h2 className={`text-2xl font-bold mb-2 ${roleInfo.hasSession ? roleInfo.colors.text : 'text-white'}`}>
                {roleInfo.label}
              </h2>
              
              {/* Oturum Bilgisi */}
              {roleInfo.hasSession ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <User className="h-4 w-4" />
                    <span className="text-sm font-medium">{roleInfo.session?.user?.name || 'Kullanıcı'}</span>
                  </div>
                  <Button 
                    className={`w-full ${roleInfo.colors.bg} ${roleInfo.colors.hover} text-white`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoleClick(roleInfo.key);
                    }}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Devam Et
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm">Oturum açılmamış</p>
                  <Button 
                    variant="outline" 
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRoleClick(roleInfo.key);
                    }}
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    Giriş Yap
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Oturum Özeti */}
      {SessionManager.getSessionCount() > 0 && (
        <div className="text-center mb-6">
          <p className="text-slate-400 text-sm">
            <CheckCircle className="h-4 w-4 inline mr-1 text-green-500" />
            {SessionManager.getSessionCount()} aktif oturum
          </p>
        </div>
      )}
      
      {/* Ayırıcı Çizgi */}
      <div className="w-full max-w-md flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-slate-700"></div>
        <span className="text-slate-500 text-sm">veya</span>
        <div className="flex-1 h-px bg-slate-700"></div>
      </div>
      
      {/* Merkez Giriş Butonu */}
      <Button
        variant="outline"
        onClick={handleCenterLogin}
        className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white px-8 py-3"
      >
        <Building2 className="h-5 w-5 mr-2" />
        Merkez Giriş Ekranı
      </Button>
      
      {/* Alt Bilgi */}
      <div className="mt-8 text-center">
        <p className="text-slate-500 text-xs">
          Healmedy Ambulans Yönetim Sistemi v2.0
        </p>
      </div>
    </div>
  );
};

export default MultiLoginScreen;

