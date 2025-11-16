import React, { useEffect, useState } from 'react';
import { settingsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { User, Info } from 'lucide-react';

const Settings = () => {
  const [profile, setProfile] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    tc_no: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, systemRes] = await Promise.all([
        settingsAPI.getProfile(),
        settingsAPI.getSystemInfo()
      ]);
      setProfile(profileRes.data);
      setSystemInfo(systemRes.data);
      setFormData({
        name: profileRes.data.name || '',
        phone: profileRes.data.phone || '',
        tc_no: profileRes.data.tc_no || ''
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Ayarlar y\u00fcklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await settingsAPI.updateProfile(formData);
      toast.success('Profil g\u00fcncellendi');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Profil g\u00fcncellenemedi');
    }
  };

  const roleLabels = {
    'merkez_ofis': 'Merkez Ofis',
    'operasyon_muduru': 'Operasyon M\u00fcd\u00fcr\u00fc',
    'doktor': 'Doktor',
    'hemsire': 'Hem\u015fire',
    'paramedik': 'Paramedik',
    'att': 'ATT',
    'bas_sofor': 'Ba\u015f \u015eof\u00f6r',
    'sofor': '\u015eof\u00f6r',
    'cagri_merkezi': '\u00c7a\u011fr\u0131 Merkezi'
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
        <p className="text-gray-500">Profil ve sistem ayarlar\u0131</p>
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
          <p><span className="font-medium">Son G\u00fcncelleme:</span> {systemInfo?.last_update}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
