import React, { useState, useEffect } from 'react';
import { notificationsAPI } from '../api';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';
import {
  Bell,
  MessageSquare,
  Smartphone,
  Mail,
  Globe,
  Send,
  Settings,
  AlertTriangle,
  Ambulance,
  Clock,
  Package,
  Shield,
  RefreshCw,
  Check,
  Loader2
} from 'lucide-react';

const NotificationSettings = () => {
  const { user } = useAuth();
  const { 
    pushEnabled, 
    pushSupported, 
    enablePushNotifications, 
    disablePushNotifications,
    sendTestNotification 
  } = useNotifications();
  
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testType, setTestType] = useState('case_created');
  const [testChannel, setTestChannel] = useState('sms');

  // Bildirim tipleri
  const notificationTypes = [
    { 
      id: 'case_created', 
      label: 'Vaka Oluşturuldu', 
      description: 'Yeni vaka oluşturulduğunda bildirim al',
      icon: Ambulance,
      color: 'text-red-500'
    },
    { 
      id: 'case_assigned', 
      label: 'Vaka Ataması', 
      description: 'Size vaka atandığında bildirim al',
      icon: Ambulance,
      color: 'text-blue-500'
    },
    { 
      id: 'case_doctor_approval', 
      label: 'Doktor Onayı', 
      description: 'Doktor onayı verildiğinde bildirim al',
      icon: Check,
      color: 'text-green-500'
    },
    { 
      id: 'shift_reminder', 
      label: 'Vardiya Hatırlatması', 
      description: 'Vardiya başlamadan önce hatırlatma al',
      icon: Clock,
      color: 'text-purple-500'
    },
    { 
      id: 'shift_start_alert', 
      label: 'Vardiya Başlatma Uyarısı', 
      description: 'Vardiya başlatılamadığında uyarı al',
      icon: AlertTriangle,
      color: 'text-orange-500'
    },
    { 
      id: 'handover_approval', 
      label: 'Devir Teslim Onayı', 
      description: 'Devir teslim onayı beklendiğinde bildirim al',
      icon: RefreshCw,
      color: 'text-cyan-500'
    },
    { 
      id: 'stock_critical', 
      label: 'Kritik Stok Uyarısı', 
      description: 'Stok kritik seviyeye düştüğünde uyarı al',
      icon: Package,
      color: 'text-yellow-500'
    },
    { 
      id: 'emergency', 
      label: 'Acil Durum', 
      description: 'Acil durum bildirimlerini al',
      icon: AlertTriangle,
      color: 'text-red-600'
    }
  ];

  // Kanallar
  const channels = [
    { id: 'sms', label: 'SMS', icon: MessageSquare },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'web_push', label: 'Web Push', icon: Globe },
    { id: 'mobile_push', label: 'Mobil Push', icon: Smartphone }
  ];

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await notificationsAPI.getPreferences();
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Tercihler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (typeId, channelId, value) => {
    setPreferences(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [channelId]: value
      }
    }));
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await notificationsAPI.updatePreferences(preferences);
      toast.success('Bildirim tercihleri kaydedildi');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Tercihler kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTestLoading(true);
    try {
      await sendTestNotification(testType, testChannel, testPhone || undefined);
    } finally {
      setTestLoading(false);
    }
  };

  const handlePushToggle = async () => {
    if (pushEnabled) {
      await disablePushNotifications();
    } else {
      await enablePushNotifications();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bildirim Ayarları</h1>
        <p className="text-gray-500">SMS, WhatsApp ve push bildirim tercihlerinizi yönetin</p>
      </div>

      {/* Web Push Ayarları */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>Web Push Bildirimleri</span>
          </CardTitle>
          <CardDescription>
            Tarayıcınızdan anlık bildirim alın
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Web Push Bildirimleri</Label>
              <p className="text-sm text-gray-500">
                {pushSupported 
                  ? 'Tarayıcınız push bildirimlerini destekliyor'
                  : 'Tarayıcınız push bildirimlerini desteklemiyor'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {pushEnabled && <Badge variant="outline" className="text-green-600">Aktif</Badge>}
              <Switch
                checked={pushEnabled}
                onCheckedChange={handlePushToggle}
                disabled={!pushSupported}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bildirim Tercihleri */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Bildirim Tercihleri</span>
          </CardTitle>
          <CardDescription>
            Hangi bildirimleri hangi kanallardan almak istediğinizi seçin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Kanal Başlıkları */}
            <div className="grid grid-cols-5 gap-4 pb-2 border-b">
              <div className="col-span-1"></div>
              {channels.map(channel => (
                <div key={channel.id} className="text-center">
                  <channel.icon className="h-4 w-4 mx-auto mb-1" />
                  <span className="text-xs font-medium">{channel.label}</span>
                </div>
              ))}
            </div>

            {/* Bildirim Tipleri */}
            {notificationTypes.map((type) => {
              const Icon = type.icon;
              return (
                <div key={type.id} className="grid grid-cols-5 gap-4 items-center">
                  <div className="col-span-1">
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-4 w-4 ${type.color}`} />
                      <div>
                        <p className="text-sm font-medium">{type.label}</p>
                        <p className="text-xs text-gray-500">{type.description}</p>
                      </div>
                    </div>
                  </div>
                  {channels.map(channel => (
                    <div key={channel.id} className="flex justify-center">
                      <Switch
                        checked={preferences[type.id]?.[channel.id] ?? true}
                        onCheckedChange={(checked) => handlePreferenceChange(type.id, channel.id, checked)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <Separator className="my-6" />

          <div className="flex justify-end">
            <Button onClick={savePreferences} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Tercihleri Kaydet
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Bildirimi */}
      {(user?.role === 'merkez_ofis' || user?.role === 'operasyon_muduru') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Send className="h-5 w-5" />
              <span>Test Bildirimi Gönder</span>
            </CardTitle>
            <CardDescription>
              Bildirim sistemini test edin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Bildirim Tipi</Label>
                <Select value={testType} onValueChange={setTestType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {notificationTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kanal</Label>
                <Select value={testChannel} onValueChange={setTestChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="web_push">Web Push</SelectItem>
                    <SelectItem value="in_app">In-App</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Telefon (Opsiyonel)</Label>
                <Input
                  placeholder="5XX XXX XXXX"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button onClick={handleTestNotification} disabled={testLoading} className="w-full">
                  {testLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Test Gönder
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Infobip Durumu */}
      <Card>
        <CardHeader>
          <CardTitle>Servis Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">SMS (Infobip)</p>
                <p className="text-sm text-gray-500">Yapılandırılacak</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <MessageSquare className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium">WhatsApp (Infobip)</p>
                <p className="text-sm text-gray-500">Yapılandırılacak</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <Globe className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium">Web Push</p>
                <p className="text-sm text-gray-500">
                  {pushEnabled ? 'Aktif' : 'Yapılandırılacak'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;

