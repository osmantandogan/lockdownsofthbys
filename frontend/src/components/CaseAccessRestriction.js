import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertTriangle, Lock, Key, Clock, ShieldCheck, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { casesAPI, usersAPI } from '../api';

/**
 * 36 Saat Vaka Erişim Kısıtı Bileşeni
 * Vaka 36 saatten eski ise düzenleme kısıtlaması uygular
 * Müdür OTP onayı ile erişim açılabilir
 */
const CaseAccessRestriction = ({ accessInfo, caseId, onAccessGranted }) => {
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [managers, setManagers] = useState([]);
  const [selectedManager, setSelectedManager] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Kısıtlama yoksa gösterme
  if (!accessInfo?.is_restricted) {
    return null;
  }

  const loadManagers = async () => {
    try {
      const response = await usersAPI.getAll({ 
        role: 'operasyon_muduru,merkez_ofis',
        is_active: true 
      });
      setManagers(response.data || []);
    } catch (error) {
      console.error('Error loading managers:', error);
      toast.error('Yöneticiler yüklenemedi');
    }
  };

  const handleOpenDialog = () => {
    loadManagers();
    setApprovalDialogOpen(true);
  };

  const handleRequestAccess = async () => {
    if (!selectedManager) {
      toast.error('Lütfen onaylayacak yöneticiyi seçin');
      return;
    }
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Lütfen 6 haneli onay kodunu girin');
      return;
    }

    setLoading(true);
    try {
      await casesAPI.requestAccess(caseId, {
        case_id: caseId,
        otp_code: otpCode,
        approver_id: selectedManager
      });
      
      toast.success('Erişim onaylandı! Sayfa yenileniyor...');
      setApprovalDialogOpen(false);
      
      // Sayfayı yenile veya callback çağır
      if (onAccessGranted) {
        onAccessGranted();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Access request error:', error);
      toast.error(error.response?.data?.detail || 'Erişim onayı başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Kısıtlama Uyarısı */}
      <Card className="border-orange-300 bg-orange-50 mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center space-x-2 text-orange-700">
            <Lock className="h-5 w-5" />
            <span>Düzenleme Kısıtlaması</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-800">
                  Bu vaka {accessInfo.hours_elapsed || '36+'} saatten eski
                </span>
              </div>
              <p className="text-sm text-orange-700">
                {accessInfo.reason || '36 saat geçtiği için düzenleme yetkisi kaldırıldı.'}
              </p>
              <p className="text-xs text-orange-600 mt-2">
                Düzenleme yapmak için operasyon müdürü veya merkez ofisten onay almanız gerekiyor.
              </p>
            </div>
            <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="border-orange-400 text-orange-700 hover:bg-orange-100"
                  onClick={handleOpenDialog}
                >
                  <Unlock className="h-4 w-4 mr-2" />
                  Onay Al
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <ShieldCheck className="h-5 w-5 text-red-600" />
                    <span>Düzenleme Onayı</span>
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Nasıl çalışır?</strong>
                    </p>
                    <ol className="text-xs text-blue-700 mt-2 list-decimal list-inside space-y-1">
                      <li>Onaylayacak yöneticiyi seçin</li>
                      <li>Yöneticiden bildirim panelindeki onay kodunu alın</li>
                      <li>6 haneli kodu girin ve onay isteyin</li>
                    </ol>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Onaylayacak Yönetici</Label>
                    <Select value={selectedManager} onValueChange={setSelectedManager}>
                      <SelectTrigger>
                        <SelectValue placeholder="Yönetici seçin..." />
                      </SelectTrigger>
                      <SelectContent>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name} ({manager.role === 'operasyon_muduru' ? 'Op. Müdürü' : 'Merkez Ofis'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <Key className="h-4 w-4" />
                      <span>Onay Kodu (6 haneli)</span>
                    </Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="text-center text-2xl tracking-widest font-mono"
                    />
                    <p className="text-xs text-gray-500">
                      Yöneticinin bildirim panelinin altındaki kodu girin
                    </p>
                  </div>
                  
                  <Button 
                    onClick={handleRequestAccess}
                    disabled={loading || !selectedManager || otpCode.length !== 6}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {loading ? 'Onaylanıyor...' : 'Onay İste'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Düzenleme alanlarını devre dışı bırakmak için overlay - sadece bilgi amaçlı */}
      {accessInfo.can_edit === false && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Salt Okunur Mod</span>
          </div>
        </div>
      )}
    </>
  );
};

export default CaseAccessRestriction;

