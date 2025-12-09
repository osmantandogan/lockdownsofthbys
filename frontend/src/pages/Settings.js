import React, { useEffect, useState, useRef } from 'react';
import { settingsAPI, usersAPI, otpAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { User, Info, PenTool, Camera, Trash2, Upload, Smartphone, Shield, CheckCircle, RefreshCw, Copy, Eye, EyeOff } from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import axios from 'axios';

const Settings = () => {
  const [profile, setProfile] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    tc_no: ''
  });
  const [signature, setSignature] = useState(null);
  const [signatureSaving, setSignatureSaving] = useState(false);
  
  // Profil fotoğrafı
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  // OTP / Google Authenticator
  const [otpSetup, setOtpSetup] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifyCode, setOtpVerifyCode] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, systemRes, photoRes, otpRes] = await Promise.all([
        settingsAPI.getProfile(),
        settingsAPI.getSystemInfo(),
        usersAPI.getMyPhoto().catch(() => ({ data: { photo: null } })),
        otpAPI.getSetup().catch(() => ({ data: null }))
      ]);
      setProfile(profileRes.data);
      setSystemInfo(systemRes.data);
      setProfilePhoto(photoRes.data.photo);
      setOtpSetup(otpRes.data);
      setFormData({
        name: profileRes.data.name || '',
        phone: profileRes.data.phone || '',
        tc_no: profileRes.data.tc_no || ''
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Ayarlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // OTP kurulumunu doğrula
  const handleVerifyOtp = async () => {
    if (!otpVerifyCode || otpVerifyCode.length !== 6) {
      toast.error('Lütfen 6 haneli kodu girin');
      return;
    }
    
    setOtpLoading(true);
    try {
      const response = await otpAPI.verifySetup(otpVerifyCode);
      if (response.data.valid) {
        toast.success(response.data.message);
        setOtpSetup(prev => ({ ...prev, is_verified: true }));
        setOtpVerifyCode('');
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Doğrulama hatası');
    } finally {
      setOtpLoading(false);
    }
  };

  // OTP secret'ı yenile
  const handleRegenerateOtp = async () => {
    if (!confirm('Yeni QR kod oluşturulacak. Google Authenticator\'daki eski kod geçersiz olacak. Devam etmek istiyor musunuz?')) {
      return;
    }
    
    setOtpLoading(true);
    try {
      await otpAPI.regenerateSecret();
      const otpRes = await otpAPI.getSetup();
      setOtpSetup(otpRes.data);
      toast.success('Yeni QR kod oluşturuldu. Lütfen tekrar tarayın.');
    } catch (error) {
      toast.error('QR kod yenilenemedi');
    } finally {
      setOtpLoading(false);
    }
  };

  // Secret'ı kopyala
  const copySecret = () => {
    if (otpSetup?.secret) {
      navigator.clipboard.writeText(otpSetup.secret);
      toast.success('Secret kopyalandı');
    }
  };

  // Profil fotoğrafı yükleme
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Dosya tipi kontrolü
    if (!file.type.startsWith('image/')) {
      toast.error('Sadece resim dosyaları yüklenebilir');
      return;
    }
    
    // Boyut kontrolü (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Dosya boyutu 2MB\'dan küçük olmalı');
      return;
    }
    
    setPhotoLoading(true);
    
    try {
      // Resmi base64'e çevir
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        
        try {
          await usersAPI.uploadPhoto(base64);
          setProfilePhoto(base64);
          toast.success('Profil fotoğrafı güncellendi');
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Fotoğraf yüklenemedi');
        } finally {
          setPhotoLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Fotoğraf işlenemedi');
      setPhotoLoading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!profilePhoto) return;
    
    setPhotoLoading(true);
    try {
      await usersAPI.deletePhoto();
      setProfilePhoto(null);
      toast.success('Profil fotoğrafı silindi');
    } catch (error) {
      toast.error('Fotoğraf silinemedi');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await settingsAPI.updateProfile(formData);
      toast.success('Profil güncellendi');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Profil güncellenemedi');
    }
  };

  const handleSignatureUpdate = async () => {
    if (!signature) {
      toast.error('Lütfen önce imza atınız');
      return;
    }
    
    setSignatureSaving(true);
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
      await axios.post(`${API_URL}/settings/profile/signature`, 
        { signature },
        { withCredentials: true }
      );
      toast.success('İmza kaydedildi! Artık formlarda otomatik kullanılacak.');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İmza kaydedilemedi');
    } finally {
      setSignatureSaving(false);
    }
  };

  const roleLabels = {
    'merkez_ofis': 'Merkez Ofis',
    'operasyon_muduru': 'Operasyon Müdürü',
    'doktor': 'Doktor',
    'hemsire': 'Hemşire',
    'paramedik': 'Paramedik',
    'att': 'ATT',
    'bas_sofor': 'Baş Şoför',
    'sofor': 'Şoför',
    'cagri_merkezi': 'Çağrı Merkezi'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold">Ayarlar</h1>
        <p className="text-gray-500">Profil ve sistem ayarları</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Profil Bilgileri</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Profil Fotoğrafı */}
          <div className="flex items-center space-x-6 mb-6 pb-6 border-b">
            <div className="relative">
              {profilePhoto ? (
                <img 
                  src={profilePhoto} 
                  alt="Profil" 
                  className="w-24 h-24 rounded-full object-cover border-4 border-red-100"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-3xl font-bold border-4 border-red-100">
                  {(profile?.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {photoLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Profil Fotoğrafı</h4>
              <p className="text-sm text-gray-500">Vaka formlarında görünecek fotoğrafınız</p>
              <div className="flex space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <Button 
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoLoading}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {profilePhoto ? 'Değiştir' : 'Yükle'}
                </Button>
                {profilePhoto && (
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeletePhoto}
                    disabled={photoLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Sil
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400">Max 2MB, JPG/PNG</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile?.email || ''}
                disabled
                data-testid="email-field"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Input
                id="role"
                value={roleLabels[profile?.role] || ''}
                disabled
                data-testid="role-field"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Ad Soyad</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                data-testid="name-field"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                data-testid="phone-field"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tc_no">TC Kimlik No</Label>
              <Input
                id="tc_no"
                value={formData.tc_no}
                onChange={(e) => setFormData(prev => ({ ...prev, tc_no: e.target.value }))}
                maxLength={11}
                data-testid="tc-field"
              />
            </div>
            <Button type="submit" data-testid="save-profile-button">Kaydet</Button>
          </form>
        </CardContent>
      </Card>

      {/* Signature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PenTool className="h-5 w-5" />
            <span>İmza Ayarları</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-900">
              ℹ️ Buradan kaydedeceğiniz imza, tüm formlarda otomatik olarak kullanılacaktır.
            </p>
          </div>
          
          {profile?.signature && (
            <div className="space-y-2">
              <Label>Mevcut İmzanız</Label>
              <div className="border-2 border-green-500 rounded-lg p-2 bg-green-50">
                <img 
                  src={profile.signature} 
                  alt="Kayıtlı İmza" 
                  className="h-32 w-full object-contain"
                />
              </div>
              <p className="text-xs text-green-600">
                ✓ İmza kayıtlı - Güncellenme: {profile.signature_updated_at ? new Date(profile.signature_updated_at).toLocaleDateString('tr-TR') : 'N/A'}
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Yeni İmza</Label>
            <SignaturePad 
              label="" 
              onSignature={setSignature}
              required={false}
            />
          </div>
          
          <Button 
            onClick={handleSignatureUpdate} 
            disabled={!signature || signatureSaving}
            data-testid="save-signature-button"
          >
            {signatureSaving ? 'Kaydediliyor...' : 'İmzayı Kaydet'}
          </Button>
        </CardContent>
      </Card>

      {/* Google Authenticator (OTP) */}
      <Card className="border-2 border-purple-200">
        <CardHeader className="bg-purple-50">
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5 text-purple-600" />
            <span>Google Authenticator</span>
            {otpSetup?.is_verified && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Aktif
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Bilgi Kutusu */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-purple-900">Onay Kodu Sistemi</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Google Authenticator veya benzeri bir uygulama ile 6 haneli onay kodu oluşturabilirsiniz. 
                  Bu kod, hasta kartı erişimi ve vaka onayları için kullanılacaktır.
                </p>
              </div>
            </div>
          </div>

          {otpSetup ? (
            <div className="space-y-6">
              {/* QR Kod */}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <Label className="mb-2 block">QR Kodu Tarayın</Label>
                  {otpSetup.qr_code ? (
                    <div className="border-2 border-gray-200 rounded-lg p-2 bg-white inline-block">
                      <img 
                        src={otpSetup.qr_code} 
                        alt="OTP QR Code" 
                        className="w-48 h-48"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">
                      QR kod yüklenemedi
                    </div>
                  )}
                </div>
                
                <div className="flex-1 space-y-4">
                  {/* Kurulum Adımları */}
                  <div>
                    <Label className="mb-2 block">Kurulum Adımları</Label>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                      {otpSetup.instructions?.map((step, idx) => (
                        <li key={idx}>{step.replace(/^\d+\.\s*/, '')}</li>
                      ))}
                    </ol>
                  </div>
                  
                  {/* Manuel Giriş için Secret */}
                  <div>
                    <Label className="mb-2 block">Manuel Giriş (QR taranamıyorsa)</Label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 relative">
                        <Input 
                          type={showSecret ? "text" : "password"}
                          value={otpSetup.secret || ''}
                          readOnly
                          className="pr-20 font-mono text-sm"
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex space-x-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowSecret(!showSecret)}
                            className="h-7 w-7 p-0"
                          >
                            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={copySecret}
                            className="h-7 w-7 p-0"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doğrulama */}
              {!otpSetup.is_verified ? (
                <div className="border-t pt-6">
                  <Label className="mb-2 block">Kurulumu Doğrulayın</Label>
                  <p className="text-sm text-gray-500 mb-3">
                    QR kodu taradıktan sonra, uygulamada görünen 6 haneli kodu girin.
                  </p>
                  <div className="flex items-center space-x-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="6 haneli kod"
                      value={otpVerifyCode}
                      onChange={(e) => setOtpVerifyCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      maxLength={6}
                      className="w-40 text-center text-lg tracking-widest font-mono"
                    />
                    <Button 
                      onClick={handleVerifyOtp}
                      disabled={otpLoading || otpVerifyCode.length !== 6}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {otpLoading ? 'Doğrulanıyor...' : 'Doğrula'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-800">Google Authenticator Aktif</p>
                        <p className="text-sm text-green-600">Onay kodları bu uygulama üzerinden oluşturulacak</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      onClick={handleRegenerateOtp}
                      disabled={otpLoading}
                      className="text-gray-600"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${otpLoading ? 'animate-spin' : ''}`} />
                      QR Kodu Yenile
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Smartphone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>OTP bilgileri yüklenemedi</p>
              <Button 
                variant="outline" 
                className="mt-3"
                onClick={() => loadData()}
              >
                Tekrar Dene
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>Sistem Bilgisi</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><span className="font-medium">Versiyon:</span> {systemInfo?.version}</p>
          <p><span className="font-medium">Ortam:</span> {systemInfo?.environment}</p>
          <p><span className="font-medium">Son Güncelleme:</span> {systemInfo?.last_update}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
