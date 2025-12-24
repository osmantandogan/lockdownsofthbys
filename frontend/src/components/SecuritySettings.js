/**
 * SecuritySettings - Güvenlik Ayarları Bileşeni
 * PIN ve Biyometrik kimlik doğrulama ayarları
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import { 
  Shield, Fingerprint, Key, Lock, Unlock, 
  Smartphone, Check, AlertTriangle, Eye, EyeOff
} from 'lucide-react';
import useBiometricAuth from '../hooks/useBiometricAuth';

const SecuritySettings = () => {
  const {
    isBiometricAvailable,
    isBiometricEnabled,
    isPinEnabled,
    biometricType,
    error,
    enableBiometric,
    disableBiometric,
    setPin,
    removePin
  } = useBiometricAuth();
  
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [showRemovePinDialog, setShowRemovePinDialog] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  
  // PIN kaydet
  const handleSavePin = async () => {
    setPinError('');
    
    if (newPin.length < 4) {
      setPinError('PIN en az 4 karakter olmalıdır');
      return;
    }
    
    if (newPin !== confirmPin) {
      setPinError('PIN\'ler eşleşmiyor');
      return;
    }
    
    const success = await setPin(newPin);
    
    if (success) {
      toast.success('PIN başarıyla ayarlandı');
      setShowPinDialog(false);
      setNewPin('');
      setConfirmPin('');
    } else {
      setPinError('PIN kaydedilemedi');
    }
  };
  
  // PIN kaldır
  const handleRemovePin = async () => {
    await removePin();
    toast.success('PIN kaldırıldı');
    setShowRemovePinDialog(false);
    setCurrentPin('');
  };
  
  // Biyometrik toggle
  const handleBiometricToggle = async (enabled) => {
    if (enabled) {
      const success = await enableBiometric();
      if (success) {
        toast.success('Biyometrik doğrulama etkinleştirildi');
      }
    } else {
      await disableBiometric();
      toast.success('Biyometrik doğrulama devre dışı bırakıldı');
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          Güvenlik Ayarları
        </CardTitle>
        <CardDescription>
          Uygulama güvenliği için PIN veya biyometrik doğrulama ayarlayın
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* PIN Ayarları */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Key className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium">PIN Kilidi</h4>
              <p className="text-sm text-gray-500">4+ haneli PIN ile uygulamayı kilitleyin</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPinEnabled ? (
              <>
                <Badge className="bg-green-100 text-green-700">
                  <Check className="h-3 w-3 mr-1" />Aktif
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowPinDialog(true)}
                >
                  Değiştir
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-red-600"
                  onClick={() => setShowRemovePinDialog(true)}
                >
                  Kaldır
                </Button>
              </>
            ) : (
              <Button onClick={() => setShowPinDialog(true)}>
                <Lock className="h-4 w-4 mr-2" />
                PIN Ayarla
              </Button>
            )}
          </div>
        </div>
        
        {/* Biyometrik Ayarları */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Fingerprint className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-medium">Biyometrik Doğrulama</h4>
              <p className="text-sm text-gray-500">
                {isBiometricAvailable 
                  ? 'Parmak izi veya yüz tanıma ile giriş yapın'
                  : 'Bu cihazda desteklenmiyor'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isBiometricAvailable ? (
              <>
                <Switch 
                  checked={isBiometricEnabled}
                  onCheckedChange={handleBiometricToggle}
                />
                <span className="text-sm text-gray-500">
                  {isBiometricEnabled ? 'Açık' : 'Kapalı'}
                </span>
              </>
            ) : (
              <Badge variant="outline" className="text-gray-500">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Desteklenmiyor
              </Badge>
            )}
          </div>
        </div>
        
        {/* Güvenlik Bilgisi */}
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Güvenlik Önerileri</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Güçlü bir PIN kullanın (en az 4 karakter)</li>
                <li>PIN'inizi kimseyle paylaşmayın</li>
                <li>Biyometrik doğrulama daha güvenlidir</li>
                <li>Düzenli olarak şifrenizi değiştirin</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Hata mesajı */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </CardContent>
      
      {/* PIN Ayarlama Dialog */}
      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {isPinEnabled ? 'PIN Değiştir' : 'PIN Ayarla'}
            </DialogTitle>
            <DialogDescription>
              Uygulamayı kilitlemek için 4+ haneli bir PIN belirleyin
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Yeni PIN</Label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="En az 4 karakter"
                  maxLength={8}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1 h-7 w-7 p-0"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>PIN Tekrar</Label>
              <Input
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="PIN'i tekrar girin"
                maxLength={8}
              />
            </div>
            
            {pinError && (
              <p className="text-sm text-red-600">{pinError}</p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPinDialog(false)}>
              İptal
            </Button>
            <Button onClick={handleSavePin}>
              <Lock className="h-4 w-4 mr-2" />
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* PIN Kaldırma Dialog */}
      <Dialog open={showRemovePinDialog} onOpenChange={setShowRemovePinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Unlock className="h-5 w-5" />
              PIN'i Kaldır
            </DialogTitle>
            <DialogDescription>
              PIN kilidini kaldırmak istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-600">
              PIN kaldırıldığında uygulama kilidi devre dışı kalacaktır.
            </p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemovePinDialog(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleRemovePin}>
              <Unlock className="h-4 w-4 mr-2" />
              PIN'i Kaldır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SecuritySettings;






