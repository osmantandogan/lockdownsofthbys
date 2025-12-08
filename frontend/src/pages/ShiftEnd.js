import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI, vehiclesAPI, approvalsAPI } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Clock, 
  CheckCircle, 
  Truck, 
  User, 
  Phone, 
  Mail, 
  Send, 
  Shield, 
  Loader2,
  AlertTriangle,
  FileText
} from 'lucide-react';

const ShiftEnd = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Sonraki vardiya görevlisi
  const [nextShiftUser, setNextShiftUser] = useState(null);
  
  // Devir teslim form verileri
  const [formData, setFormData] = useState({
    teslimAlinanKm: '',
    servisYapilacakKm: '',
    fosforluYelek: '',
    takviyeKablosu: '',
    cekmeKablosu: '',
    ucgen: '',
    teslimEdenNotlar: '',
    hasarBildirimi: ''
  });
  
  // Onay durumları
  const [receiverApprovalCode, setReceiverApprovalCode] = useState('');
  const [receiverApproved, setReceiverApproved] = useState(false);
  const [managerApprovalCode, setManagerApprovalCode] = useState('');
  const [managerApproved, setManagerApproved] = useState(false);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [approvalSent, setApprovalSent] = useState({ receiver: false, manager: false });
  
  // Dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalDialogType, setApprovalDialogType] = useState('receiver');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Aktif vardiya bilgisi
      const shiftRes = await shiftsAPI.getActive();
      
      if (!shiftRes.data) {
        toast.error('Aktif vardiya bulunamadı');
        navigate('/dashboard/shifts');
        return;
      }

      setActiveShift(shiftRes.data);

      // Araç bilgisi
      const vehicleRes = await vehiclesAPI.getById(shiftRes.data.vehicle_id);
      setVehicle(vehicleRes.data);
      
      // Form verilerini otomatik doldur
      setFormData(prev => ({
        ...prev,
        teslimAlinanKm: vehicleRes.data?.km || shiftRes.data.start_km || '',
        servisYapilacakKm: vehicleRes.data?.next_maintenance_km || ''
      }));

      // Sonraki vardiya görevlisini bul
      try {
        const nextUserRes = await approvalsAPI.getNextShiftUser(shiftRes.data.vehicle_id);
        if (nextUserRes.data?.found) {
          setNextShiftUser(nextUserRes.data.user);
        }
      } catch (err) {
        console.log('Sonraki vardiya görevlisi bulunamadı:', err);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Vardiya bilgileri yüklenemedi');
      navigate('/dashboard/shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Teslim alan onay kodu gönder
  const sendReceiverApproval = async () => {
    if (!nextShiftUser?.id || !activeShift?.vehicle_id) {
      toast.error('Teslim alacak kişi bilgisi bulunamadı');
      return;
    }
    
    setSendingApproval(true);
    try {
      await approvalsAPI.createHandover({
        receiver_id: nextShiftUser.id,
        vehicle_id: activeShift.vehicle_id
      });
      
      setApprovalSent(prev => ({ ...prev, receiver: true }));
      toast.success(`Onay kodu ${nextShiftUser.name} kişisine SMS ve Email ile gönderildi`);
      setShowApprovalDialog(true);
      setApprovalDialogType('receiver');
    } catch (error) {
      console.error('Approval error:', error);
      toast.error(error.response?.data?.detail || 'Onay kodu gönderilemedi');
    } finally {
      setSendingApproval(false);
    }
  };

  // Yönetici onayı gönder
  const sendManagerApproval = async () => {
    if (!activeShift?.vehicle_id) {
      toast.error('Araç bilgisi bulunamadı');
      return;
    }
    
    setSendingApproval(true);
    try {
      await approvalsAPI.createManagerApproval({
        vehicle_id: activeShift.vehicle_id,
        action: 'Vardiya Devir Teslim'
      });
      
      setApprovalSent(prev => ({ ...prev, manager: true }));
      toast.success('Onay kodu Baş Şoför ve Operasyon Müdürüne gönderildi');
      setShowApprovalDialog(true);
      setApprovalDialogType('manager');
    } catch (error) {
      console.error('Manager approval error:', error);
      toast.error(error.response?.data?.detail || 'Yönetici onayı gönderilemedi');
    } finally {
      setSendingApproval(false);
    }
  };

  // Onay kodu doğrula
  const verifyApprovalCode = async (type) => {
    const code = type === 'receiver' ? receiverApprovalCode : managerApprovalCode;
    
    if (!code || code.length !== 6) {
      toast.error('Geçerli bir 6 haneli kod girin');
      return;
    }
    
    try {
      const result = await approvalsAPI.verify({
        code: code,
        approval_type: type === 'receiver' ? 'shift_handover' : 'shift_start_approval'
      });
      
      if (result.data?.valid) {
        if (type === 'receiver') {
          setReceiverApproved(true);
          toast.success('✅ Teslim alan onayı doğrulandı!');
        } else {
          setManagerApproved(true);
          toast.success('✅ Yönetici onayı doğrulandı!');
        }
        setShowApprovalDialog(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Onay kodu doğrulanamadı');
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    // Onay kontrolleri
    if (nextShiftUser && !receiverApproved) {
      toast.error('Önce teslim alan onayı alınmalı');
      return;
    }
    
    if (!managerApproved) {
      toast.error('Yönetici onayı gerekli');
      return;
    }

    if (!confirm('Vardiyayı bitirmek istediğinizden emin misiniz?')) return;

    setSubmitting(true);
    try {
      await shiftsAPI.end({
        shift_id: activeShift.id,
        handover_form: {
          ...formData,
          aracPlakasi: vehicle?.plate,
          kayitTarihi: new Date().toISOString().split('T')[0],
          kayitSaati: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          teslimEden: user?.name,
          teslimAlan: nextShiftUser?.name || 'Bilinmiyor',
          receiverApproved,
          managerApproved
        },
        notes: formData.teslimEdenNotlar
      });

      toast.success('🎉 Vardiya başarıyla sonlandırıldı!');
      navigate('/dashboard/shifts');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Vardiya sonlandırılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const duration = activeShift ? Math.floor((new Date() - new Date(activeShift.start_time)) / 1000 / 60) : 0;
  const servisKalan = formData.servisYapilacakKm && formData.teslimAlinanKm 
    ? parseInt(formData.servisYapilacakKm) - parseInt(formData.teslimAlinanKm)
    : 0;

  return (
    <div className="space-y-6" data-testid="shift-end-page">
      <div>
        <h1 className="text-3xl font-bold">Vardiya Bitir</h1>
        <p className="text-gray-500">Devir teslim işlemini tamamlayın</p>
      </div>

      {/* Aktif Vardiya Bilgileri */}
      <Card className="border-blue-500 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Aktif Vardiya</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-500">Araç</p>
              <p className="font-bold text-lg">{vehicle?.plate}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Başlangıç</p>
              <p className="font-medium">{new Date(activeShift.start_time).toLocaleString('tr-TR')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Süre</p>
              <p className="font-medium">{Math.floor(duration / 60)} saat {duration % 60} dk</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">KM</p>
              <p className="font-medium">{vehicle?.km?.toLocaleString()} km</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Araç Bilgileri ve KM */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Araç Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Teslim Alınan KM</Label>
              <Input 
                type="number"
                value={formData.teslimAlinanKm}
                onChange={(e) => handleFormChange('teslimAlinanKm', e.target.value)}
                placeholder="125000"
              />
            </div>
            <div className="space-y-2">
              <Label>Servis Yapılacak KM</Label>
              <Input 
                type="number"
                value={formData.servisYapilacakKm}
                onChange={(e) => handleFormChange('servisYapilacakKm', e.target.value)}
                placeholder="140000"
              />
            </div>
          </div>
          {servisKalan > 0 && (
            <div className={`p-4 rounded-lg border-2 text-center ${
              servisKalan < 500 ? 'bg-red-100 text-red-800 border-red-500' :
              servisKalan < 1000 ? 'bg-yellow-100 text-yellow-800 border-yellow-500' :
              'bg-green-100 text-green-800 border-green-500'
            }`}>
              <p className="text-3xl font-bold">{servisKalan.toLocaleString()} KM</p>
              <p className="text-sm font-medium">Servise Kalan</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ekipman Kontrol */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ekipman Kontrolü
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: 'fosforluYelek', label: 'Fosforlu Yelek (3 Adet)' },
            { key: 'takviyeKablosu', label: 'Takviye Kablosu' },
            { key: 'cekmeKablosu', label: 'Çekme Kablosu' },
            { key: 'ucgen', label: 'Üçgen (1 Adet)' }
          ].map(item => (
            <div key={item.key} className="flex justify-between items-center py-2 border-b">
              <Label className="text-sm">{item.label}</Label>
              <RadioGroup 
                value={formData[item.key]} 
                onValueChange={(v) => handleFormChange(item.key, v)}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id={`${item.key}-var`} />
                  <Label htmlFor={`${item.key}-var`} className="text-xs">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id={`${item.key}-yok`} />
                  <Label htmlFor={`${item.key}-yok`} className="text-xs">Yok</Label>
                </div>
              </RadioGroup>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notlar */}
      <Card>
        <CardHeader>
          <CardTitle>Notlar ve Hasar Bildirimi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vardiya Notları</Label>
            <Textarea 
              value={formData.teslimEdenNotlar}
              onChange={(e) => handleFormChange('teslimEdenNotlar', e.target.value)}
              placeholder="Vardiya sırasında yaşanan durumlar..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Hasar Bildirimi</Label>
            <Textarea 
              value={formData.hasarBildirimi}
              onChange={(e) => handleFormChange('hasarBildirimi', e.target.value)}
              placeholder="Tespit edilen hasarlar, arızalar..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Teslim Eden (Mevcut Kullanıcı) */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="text-green-700">✍️ Teslim Eden (Siz)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profile_photo} />
              <AvatarFallback className="bg-green-100 text-green-700 text-xl">
                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-lg">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      {/* Teslim Alan (Sonraki Vardiya) */}
      <Card className={`border-blue-200 ${receiverApproved ? 'bg-green-50/50 border-green-200' : 'bg-blue-50/50'}`}>
        <CardHeader>
          <CardTitle className={receiverApproved ? 'text-green-700' : 'text-blue-700'}>
            ✍️ Teslim Alan (Sonraki Vardiya)
            {receiverApproved && <span className="ml-2 text-green-600">✓ Onaylandı</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextShiftUser ? (
            <>
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={nextShiftUser.profile_photo} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl">
                    {nextShiftUser.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-bold text-lg">{nextShiftUser.name}</p>
                  <p className="text-sm text-gray-500">{nextShiftUser.role}</p>
                  {nextShiftUser.phone && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" /> {nextShiftUser.phone}
                    </p>
                  )}
                </div>
                {receiverApproved ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <Clock className="h-8 w-8 text-yellow-600" />
                )}
              </div>
              
              {!receiverApproved && (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Teslim alan kişinin onayı gerekli. SMS ve Email ile onay kodu gönderilecek.
                    </p>
                  </div>
                  
                  {!approvalSent.receiver ? (
                    <Button 
                      onClick={sendReceiverApproval} 
                      disabled={sendingApproval}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {sendingApproval ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gönderiliyor...</>
                      ) : (
                        <><Send className="h-4 w-4 mr-2" /> Onay Kodu Gönder</>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✓ Onay kodu gönderildi</p>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="6 haneli kod"
                          value={receiverApprovalCode}
                          onChange={(e) => setReceiverApprovalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-center font-mono text-lg tracking-widest"
                          maxLength={6}
                        />
                        <Button onClick={() => verifyApprovalCode('receiver')}>
                          Doğrula
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="p-4 bg-gray-100 rounded-lg text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Sonraki vardiya görevlisi bulunamadı</p>
              <p className="text-sm text-gray-500 mt-1">Bu durumda teslim alan onayı atlanacak</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yönetici Onayı */}
      <Card className={`border-purple-200 ${managerApproved ? 'bg-green-50/50 border-green-200' : 'bg-purple-50/50'}`}>
        <CardHeader>
          <CardTitle className={managerApproved ? 'text-green-700' : 'text-purple-700'}>
            <Shield className="h-5 w-5 inline mr-2" />
            Yönetici Onayı
            {managerApproved && <span className="ml-2 text-green-600">✓ Onaylandı</span>}
          </CardTitle>
          <CardDescription>
            Baş Şoför veya Operasyon Müdürü onayı gerekli
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!managerApproved ? (
            <>
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                <p className="text-sm text-purple-800">
                  ⚠️ Devir teslim için yönetici onayı gerekli. SMS, Email ve Push bildirim gönderilecek.
                </p>
              </div>
              
              {!approvalSent.manager ? (
                <Button 
                  onClick={sendManagerApproval} 
                  disabled={sendingApproval || (nextShiftUser && !receiverApproved)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {sendingApproval ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gönderiliyor...</>
                  ) : (
                    <><Shield className="h-4 w-4 mr-2" /> Yönetici Onayı İste</>
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-green-600">✓ Onay talebi yöneticilere gönderildi</p>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="6 haneli kod"
                      value={managerApprovalCode}
                      onChange={(e) => setManagerApprovalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="text-center font-mono text-lg tracking-widest"
                      maxLength={6}
                    />
                    <Button onClick={() => verifyApprovalCode('manager')}>
                      Doğrula
                    </Button>
                  </div>
                </div>
              )}
              
              {nextShiftUser && !receiverApproved && (
                <p className="text-xs text-gray-500">* Önce teslim alan onayı gerekli</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-green-200">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Yönetici Onayı Alındı</p>
                <p className="text-sm text-gray-500">Vardiya sonlandırılabilir</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onay Özeti ve Bitiş */}
      <Card className={`${managerApproved ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  {nextShiftUser ? (
                    receiverApproved ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    )
                  ) : (
                    <CheckCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <span className={nextShiftUser && !receiverApproved ? 'text-yellow-700' : ''}>
                    Teslim Alan Onayı: {nextShiftUser ? (receiverApproved ? '✓' : 'Bekliyor') : 'Atlandı'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {managerApproved ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-600" />
                  )}
                  <span className={!managerApproved ? 'text-yellow-700' : ''}>
                    Yönetici Onayı: {managerApproved ? '✓' : 'Bekliyor'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Toplam süre: {Math.floor(duration / 60)} saat {duration % 60} dakika
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard/shifts')}
              >
                İptal
              </Button>
              <Button
                onClick={handleEndShift}
                disabled={submitting || !managerApproved || (nextShiftUser && !receiverApproved)}
                className="bg-green-600 hover:bg-green-700"
                data-testid="end-shift-button"
              >
                {submitting ? 'Bitiriliyor...' : 'Vardiyayı Bitir'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onay Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialogType === 'receiver' ? '📱 Teslim Alan Onayı' : '🔐 Yönetici Onayı'}
            </DialogTitle>
            <DialogDescription>
              {approvalDialogType === 'receiver' 
                ? `${nextShiftUser?.name} kişisine SMS ve Email ile onay kodu gönderildi.`
                : 'Baş Şoför ve Operasyon Müdürüne onay kodu gönderildi.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-center text-gray-600">
              Gelen 6 haneli kodu aşağıya girin:
            </p>
            <Input 
              placeholder="000000"
              value={approvalDialogType === 'receiver' ? receiverApprovalCode : managerApprovalCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                if (approvalDialogType === 'receiver') {
                  setReceiverApprovalCode(val);
                } else {
                  setManagerApprovalCode(val);
                }
              }}
              className="text-center font-mono text-2xl tracking-[0.5em] h-14"
              maxLength={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              İptal
            </Button>
            <Button onClick={() => verifyApprovalCode(approvalDialogType)}>
              Doğrula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftEnd;
