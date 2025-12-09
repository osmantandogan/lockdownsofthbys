import React, { useEffect, useState, useRef } from 'react';
import { settingsAPI, usersAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { User, Info, PenTool, Camera, Trash2, Upload } from 'lucide-react';
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, systemRes, photoRes] = await Promise.all([
        settingsAPI.getProfile(),
        settingsAPI.getSystemInfo(),
        usersAPI.getMyPhoto().catch(() => ({ data: { photo: null } }))
      ]);
      setProfile(profileRes.data);
      setSystemInfo(systemRes.data);
      setProfilePhoto(photoRes.data.photo);
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
