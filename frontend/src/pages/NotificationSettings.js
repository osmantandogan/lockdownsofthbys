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
  Smartphone,
  Globe,
  Send,
  Settings,
  AlertTriangle,
  Ambulance,
  Clock,
  Package,
  RefreshCw,
  Check,
  Loader2,
  BellRing,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
  Phone
} from 'lucide-react';

const NotificationSettings = () => {
  const { user } = useAuth();
  const { 
    pushEnabled, 
    pushSupported,
    fcmEnabled,
    enablePushNotifications, 
    disablePushNotifications,
    sendTestNotification 
  } = useNotifications();
  
  // Localhost kontrolü
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const fcmReady = fcmEnabled || !isLocalhost; // FCM durumu
  
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testType, setTestType] = useState('case_created');
  const [testMessage, setTestMessage] = useState('');
  const [notificationStatus, setNotificationStatus] = useState(null);

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

  useEffect(() => {
    loadPreferences();
    loadNotificationStatus();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await notificationsAPI.getPreferences();
      setPreferences(response.data);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotificationStatus = async () => {
    try {
      const response = await notificationsAPI.getStatus();
      setNotificationStatus(response.data);
    } catch (error) {
      console.error('Error loading notification status:', error);
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
      await sendTestNotification(testType, testMessage || undefined);
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
    // Durumu yenile
    setTimeout(loadNotificationStatus, 1000);
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
        <p className="text-gray-500">Push bildirim tercihlerinizi yönetin (FCM)</p>
      </div>

      {/* FCM Push Ayarları */}
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center space-x-2">
            <BellRing className="h-5 w-5 text-blue-600" />
            <span>Push Bildirimleri</span>
            {fcmReady && (
              <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
                FCM Aktif
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Tarayıcınızdan ve mobil cihazınızdan anlık bildirim alın
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {isLocalhost && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Localhost Geliştirme Modu</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Push bildirimleri sadece production ortamında (<strong>abro.ldserp.com</strong>) çalışır. 
                    Localhost'ta test bildirimleri gönderilemez ancak diğer tüm özellikler çalışır.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-lg font-medium">Push Bildirimleri</Label>
              <p className="text-sm text-gray-500">
                {!pushSupported 
                  ? '❌ Tarayıcınız push bildirimlerini desteklemiyor'
                  : isLocalhost
                  ? '🧪 Localhost modu - Production ortamında aktif olacak'
                  : !fcmReady
                  ? '⏳ Bildirim sistemi yükleniyor...'
                  : pushEnabled
                  ? '✅ Push bildirimleri aktif - Bildirimler bu cihaza gönderilecek'
                  : '🔔 Push bildirimlerini etkinleştirmek için butona tıklayın'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {pushEnabled && !isLocalhost && (
                <Badge className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Aktif
                </Badge>
              )}
              <Button
                onClick={handlePushToggle}
                disabled={!pushSupported || !fcmReady || isLocalhost}
                variant={pushEnabled ? "outline" : "default"}
                className={pushEnabled ? "border-red-300 text-red-600 hover:bg-red-50" : ""}
              >
                {pushEnabled ? (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Bildirimleri Kapat
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    Bildirimleri Aç
                  </>
                )}
              </Button>
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
            Hangi bildirimleri almak istediğinizi seçin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Kanal Başlıkları */}
            <div className="grid grid-cols-5 gap-4 pb-2 border-b">
              <div className="col-span-1"></div>
              <div className="text-center">
                <Globe className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                <span className="text-xs font-medium">Push</span>
              </div>
              <div className="text-center">
                <Mail className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                <span className="text-xs font-medium">Email</span>
              </div>
              <div className="text-center">
                <MessageSquare className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <span className="text-xs font-medium">SMS</span>
              </div>
              <div className="text-center">
                <Smartphone className="h-4 w-4 mx-auto mb-1 text-gray-500" />
                <span className="text-xs font-medium">In-App</span>
              </div>
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
                  <div className="flex justify-center">
                    <Switch
                      checked={preferences[type.id]?.push ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange(type.id, 'push', checked)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={preferences[type.id]?.email ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange(type.id, 'email', checked)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={preferences[type.id]?.sms ?? false}
                      onCheckedChange={(checked) => handlePreferenceChange(type.id, 'sms', checked)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={preferences[type.id]?.in_app ?? true}
                      onCheckedChange={(checked) => handlePreferenceChange(type.id, 'in_app', checked)}
                    />
                  </div>
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

      {/* SMS ve Email Bilgileri */}
      <Card className="border-2 border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            <span>SMS & Email Bildirimleri</span>
            <Badge variant="outline" className="ml-2 text-green-600 border-green-600">
              Aktif
            </Badge>
          </CardTitle>
          <CardDescription>
            Kritik onaylar için SMS ve Email bildirimleri
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* SMS Bilgisi */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">SMS Servisi</p>
                  <p className="text-sm text-gray-500">SMS Gateway</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>✓ Devir teslim onayları</p>
                <p>✓ Yönetici onay kodları</p>
                <p>✓ Acil durum bildirimleri</p>
              </div>
            </div>
            
            {/* Email Bilgisi */}
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Mail className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Email Servisi</p>
                  <p className="text-sm text-gray-500">auth@healmedy.tech</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>✓ Onay kodu emaili</p>
                <p>✓ Vardiya bilgilendirme</p>
                <p>✓ Günlük/haftalık raporlar</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Not:</strong> SMS bildirimleri sadece onay gerektiren işlemler (devir teslim, yönetici onayı) için gönderilir. 
              Diğer bildirimler Push ve Email üzerinden iletilir.
            </p>
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
              Push bildirim sistemini test edin
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
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
                <Label>Özel Mesaj (Opsiyonel)</Label>
                <Input
                  placeholder="Test mesajı..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
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

      {/* FCM Durumu */}
      <Card>
        <CardHeader>
          <CardTitle>Bildirim Sistemi Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className={`p-2 rounded-full ${
                isLocalhost ? 'bg-yellow-100' : 
                fcmReady ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <Bell className={`h-5 w-5 ${
                  isLocalhost ? 'text-yellow-600' :
                  fcmReady ? 'text-green-600' : 'text-yellow-600'
                }`} />
              </div>
              <div>
                <p className="font-medium">Firebase Cloud Messaging</p>
                <p className="text-sm text-gray-500">
                  {isLocalhost 
                    ? 'Localhost modu' 
                    : fcmReady 
                    ? 'Bağlı ve çalışıyor' 
                    : 'Bağlanıyor...'}
                </p>
              </div>
              {isLocalhost ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500 ml-auto" />
              ) : fcmReady ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
              ) : null}
            </div>
            
            <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
              <div className={`p-2 rounded-full ${
                isLocalhost ? 'bg-gray-100' :
                pushEnabled ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <BellRing className={`h-5 w-5 ${
                  isLocalhost ? 'text-gray-400' :
                  pushEnabled ? 'text-green-600' : 'text-gray-400'
                }`} />
              </div>
              <div>
                <p className="font-medium">Push Aboneliği</p>
                <p className="text-sm text-gray-500">
                  {isLocalhost 
                    ? 'Production ortamında aktif olacak' 
                    : pushEnabled 
                    ? 'Bu cihazda aktif' 
                    : 'Bu cihazda kapalı'}
                </p>
              </div>
              {!isLocalhost && (pushEnabled ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
              ) : (
                <XCircle className="h-5 w-5 text-gray-400 ml-auto" />
              ))}
            </div>
          </div>
          
          {notificationStatus?.player_id && !isLocalhost && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600 font-mono">
                Player ID: {notificationStatus.player_id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;

