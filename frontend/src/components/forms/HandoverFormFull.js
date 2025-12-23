import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { shiftsAPI, vehiclesAPI, approvalsAPI } from '../../api';
import PDFExportButton from '../PDFExportButton';
import { exportHandoverForm } from '../../utils/pdfExport';
import { CheckCircle, XCircle, Clock, Phone, Mail, User, Send, Shield, Loader2 } from 'lucide-react';
import { getTurkeyDate, getTurkeyTimeString } from '../../utils/timezone';

const HandoverFormFull = ({ formData: externalFormData, onChange, vehiclePlate, vehicleKm }) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receiverInfo, setReceiverInfo] = useState(null);
  const [handoverInfo, setHandoverInfo] = useState(null);
  
  // Onay durumları
  const [receiverApprovalCode, setReceiverApprovalCode] = useState('');
  const [receiverApproved, setReceiverApproved] = useState(false);
  const [managerApprovalCode, setManagerApprovalCode] = useState('');
  const [managerApproved, setManagerApproved] = useState(false);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [approvalSent, setApprovalSent] = useState({ receiver: false, manager: false });
  
  // Dialog durumları
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalDialogType, setApprovalDialogType] = useState('receiver'); // 'receiver' veya 'manager'

  const [localFormData, setLocalFormData] = useState({
    aracPlakasi: vehiclePlate || '',
    kayitTarihi: getTurkeyDate(),
    kayitSaati: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    teslimAlinanKm: vehicleKm || '',
    servisYapilacakKm: '',
    fosforluYelek: '',
    takviyeKablosu: '',
    cekmeKablosu: '',
    ucgen: '',
    teslimEdenNotlar: '',
    hasarBildirimi: '',
    teslimEden: '',
    teslimEdenTelefon: '',
    teslimAlan: '',
    teslimAlanTelefon: '',
    birimYoneticisi: '',
    onayTarihi: getTurkeyDate(),
    teslimEdenSignature: null,
    teslimAlanSignature: null,
    vehicleId: ''
  });

  const formData = externalFormData || localFormData;
  const setFormData = onChange || setLocalFormData;

  // External formData'dan form field'larını yükle (FormHistory'den görüntüleme için)
  useEffect(() => {
    if (externalFormData && Object.keys(externalFormData).length > 0) {
      setLocalFormData(prev => ({
        ...prev,
        ...externalFormData
      }));
    }
  }, [externalFormData]);

  // Otomatik vardiya ve araç bilgisi yükleme
  useEffect(() => {
    const loadShiftData = async () => {
      try {
        console.log('Vardiya bilgileri yükleniyor...');
        
        // Aktif vardiya bilgisini çek
        const activeShiftResponse = await shiftsAPI.getActive();
        console.log('Aktif vardiya yanıtı:', activeShiftResponse);
        
        // Aktif vardiya yoksa
        if (!activeShiftResponse || !activeShiftResponse.data) {
          console.log('Aktif vardiya bulunamadı');
          toast.warning('Aktif vardiya bulunamadı. Form bilgilerini manuel doldurun.');
          
          // Mevcut kullanıcı bilgilerini otomatik doldur
          setLocalFormData(prev => ({
            ...prev,
            teslimEden: user?.name || '',
            teslimEdenTelefon: user?.phone || '',
            kayitTarihi: getTurkeyDate(),
            kayitSaati: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          }));
          setLoading(false);
          return;
        }
        
        const shift = activeShiftResponse.data;
        const vehicleId = shift.vehicle_id;
        console.log('Aktif vardiya araç ID:', vehicleId);
        
        if (!vehicleId) {
          toast.warning('Vardiya araç bilgisi bulunamadı');
          setLoading(false);
          return;
        }
        
        // Devir teslim bilgilerini getir (yeni endpoint)
        try {
          console.log('Devir teslim bilgileri çekiliyor...');
          const handoverData = await approvalsAPI.getHandoverInfo(vehicleId);
          console.log('Devir teslim yanıtı:', handoverData);
          
          if (handoverData && handoverData.data) {
            setHandoverInfo(handoverData.data);
            setReceiverInfo(handoverData.data.receiver);
            
            // Form verilerini otomatik doldur
            const vehicle = handoverData.data.vehicle;
            const giver = handoverData.data.giver;
            const receiver = handoverData.data.receiver;
            
            const newData = {
              aracPlakasi: vehicle?.plate || shift.vehicle_plate || '',
              kayitTarihi: handoverData.data.date || getTurkeyDate(),
              kayitSaati: handoverData.data.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
              teslimAlinanKm: vehicle?.km || shift.start_km || '',
              servisYapilacakKm: vehicle?.next_maintenance_km || '',
              teslimEden: giver?.name || user?.name || '',
              teslimEdenTelefon: giver?.phone || user?.phone || '',
              teslimEdenSignature: giver?.signature || user?.signature || null,
              teslimAlan: receiver?.name || '',
              teslimAlanTelefon: receiver?.phone || '',
              vehicleId: vehicleId,
              fosforluYelek: '',
              takviyeKablosu: '',
              cekmeKablosu: '',
              ucgen: '',
              teslimEdenNotlar: '',
              hasarBildirimi: '',
              birimYoneticisi: '',
              onayTarihi: getTurkeyDate(),
              teslimAlanSignature: null
            };
            
            if (onChange) {
              onChange(newData);
            } else {
              setLocalFormData(newData);
            }
            
            toast.success('Devir teslim bilgileri otomatik yüklendi!');
          }
        } catch (err) {
          console.error('Handover info error:', err);
          
          // Fallback: Vardiya bilgisinden araç plakasını kullan
          const newData = {
            aracPlakasi: shift.vehicle_plate || '',
            kayitTarihi: getTurkeyDate(),
            kayitSaati: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            teslimAlinanKm: shift.start_km || '',
            teslimEden: user?.name || '',
            teslimEdenTelefon: user?.phone || '',
            teslimEdenSignature: user?.signature || null,
            vehicleId: vehicleId,
            fosforluYelek: '',
            takviyeKablosu: '',
            cekmeKablosu: '',
            ucgen: '',
            teslimEdenNotlar: '',
            hasarBildirimi: '',
            teslimAlan: '',
            teslimAlanTelefon: '',
            birimYoneticisi: '',
            onayTarihi: getTurkeyDate(),
            teslimAlanSignature: null,
            servisYapilacakKm: ''
          };
          
          if (onChange) {
            onChange(newData);
          } else {
            setLocalFormData(newData);
          }
          
          toast.info('Araç bilgileri yüklendi, teslim alan bilgisi bulunamadı');
        }
      } catch (error) {
        console.error('Vardiya yüklenemedi:', error);
        toast.error('Vardiya bilgileri yüklenemedi');
      } finally {
        setLoading(false);
      }
    };
    
    if (!vehiclePlate && !vehicleKm) {
      loadShiftData();
    } else {
      // Props'tan gelen bilgilerle doldur
      setLocalFormData(prev => ({
        ...prev,
        aracPlakasi: vehiclePlate || '',
        teslimAlinanKm: vehicleKm || '',
        teslimEden: user?.name || ''
      }));
      setLoading(false);
    }
  }, [user, vehiclePlate, vehicleKm]);

  const handleChange = (field, value) => {
    const newData = {...formData, [field]: value};
    setFormData(newData);
  };

  // Teslim alacak kişiye onay kodu gönder
  const sendReceiverApproval = async () => {
    if (!receiverInfo?.id || !formData.vehicleId) {
      toast.error('Teslim alacak kişi bilgisi bulunamadı');
      return;
    }
    
    setSendingApproval(true);
    try {
      await approvalsAPI.createHandover({
        receiver_id: receiverInfo.id,
        vehicle_id: formData.vehicleId
      });
      
      setApprovalSent(prev => ({ ...prev, receiver: true }));
      toast.success(`Onay kodu ${receiverInfo.name} kişisine SMS ve Email ile gönderildi`);
      setShowApprovalDialog(true);
      setApprovalDialogType('receiver');
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('Onay kodu gönderilemedi');
    } finally {
      setSendingApproval(false);
    }
  };

  // Yönetici onayı gönder
  const sendManagerApproval = async () => {
    if (!formData.vehicleId) {
      toast.error('Araç bilgisi bulunamadı');
      return;
    }
    
    setSendingApproval(true);
    try {
      await approvalsAPI.requestManagerApproval({
        vehicle_id: formData.vehicleId,
        action: 'Vardiya Devir Teslim'
      });
      
      setApprovalSent(prev => ({ ...prev, manager: true }));
      toast.success('Onay kodu Baş Şoför ve Operasyon Müdürüne gönderildi');
      setShowApprovalDialog(true);
      setApprovalDialogType('manager');
    } catch (error) {
      console.error('Manager approval error:', error);
      toast.error('Yönetici onayı gönderilemedi');
    } finally {
      setSendingApproval(false);
    }
  };

  // Onay kodunu doğrula
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
          toast.success('Teslim alan onayı doğrulandı!');
        } else {
          setManagerApproved(true);
          toast.success('Yönetici onayı doğrulandı!');
        }
        setShowApprovalDialog(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Onay kodu doğrulanamadı');
    }
  };

  const handleSave = async () => {
    // Onaylar kontrolü
    if (!receiverApproved) {
      toast.error('Teslim alan onayı gerekli');
      return;
    }
    
    if (!managerApproved) {
      toast.error('Yönetici onayı gerekli');
      return;
    }
    
    setSaving(true);
    const saveFunc = handleFormSave('handover', formData, {
      validateFields: ['teslimEden', 'teslimAlan'],
      validateSignature: false,
      onSuccess: () => {
        toast.success('Devir teslim kaydedildi!');
      }
    });
    await saveFunc();
    setSaving(false);
  };

  const servisKalan = formData.servisYapilacakKm && formData.teslimAlinanKm 
    ? parseInt(formData.servisYapilacakKm) - parseInt(formData.teslimAlinanKm)
    : 0;

  const getKmColor = () => {
    if (servisKalan < 500) return 'bg-red-100 text-red-800 border-red-500';
    if (servisKalan < 1000) return 'bg-yellow-100 text-yellow-800 border-yellow-500';
    return 'bg-green-100 text-green-800 border-green-500';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center space-y-2 border-b pb-4">
        <h1 className="text-2xl font-bold">AMBULANS DEVİR TESLİM FORMU</h1>
      </div>

      <div className="bg-blue-50 p-3 rounded-lg">
        <p className="text-sm">ℹ️ Bu form, ambulans nöbet değişimlerinde araç ve ekipman teslim işlemleri için kullanılır.</p>
        {formData.aracPlakasi && (
          <p className="text-sm font-medium mt-2">✓ Vardiya bilgileri otomatik yüklendi</p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>🚑 Araç Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Araç Plakası</Label>
              <Input 
                value={formData.aracPlakasi}
                onChange={(e) => handleChange('aracPlakasi', e.target.value.toUpperCase())}
                placeholder="34 ABC 123"
                disabled={!!handoverInfo}
                className="font-bold text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Kayıt Tarihi</Label>
              <Input 
                type="date"
                value={formData.kayitTarihi}
                onChange={(e) => handleChange('kayitTarihi', e.target.value)}
                disabled={!!handoverInfo}
              />
            </div>
            <div className="space-y-2">
              <Label>Saat</Label>
              <Input 
                type="time"
                value={formData.kayitSaati}
                onChange={(e) => handleChange('kayitSaati', e.target.value)}
                disabled={!!handoverInfo}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Teslim Alınan KM</Label>
              <Input 
                type="number"
                value={formData.teslimAlinanKm}
                onChange={(e) => handleChange('teslimAlinanKm', e.target.value)}
                placeholder="125000"
              />
            </div>
            <div className="space-y-2">
              <Label>Servis Yapılacak KM</Label>
              <Input 
                type="number"
                value={formData.servisYapilacakKm}
                onChange={(e) => handleChange('servisYapilacakKm', e.target.value)}
                placeholder="140000"
              />
            </div>
          </div>
          {servisKalan > 0 && (
            <div className={`p-4 rounded-lg border-2 ${getKmColor()}`}>
              <div className="text-center">
                <p className="text-3xl font-bold">{servisKalan.toLocaleString()} KM</p>
                <p className="text-sm font-medium mt-1">Servise Kalan Mesafe</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📋 Ekipman Kontrol Listesi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center py-2 border-b">
            <Label className="text-sm">Fosforlu Yelek (3 Adet)</Label>
            <RadioGroup value={formData.fosforluYelek} onValueChange={(v) => handleChange('fosforluYelek', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="yelek-var" />
                  <Label htmlFor="yelek-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="yelek-yok" />
                  <Label htmlFor="yelek-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <Label className="text-sm">Takviye Kablosu</Label>
            <RadioGroup value={formData.takviyeKablosu} onValueChange={(v) => handleChange('takviyeKablosu', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="takviye-var" />
                  <Label htmlFor="takviye-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="takviye-yok" />
                  <Label htmlFor="takviye-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <Label className="text-sm">Çekme Kablosu</Label>
            <RadioGroup value={formData.cekmeKablosu} onValueChange={(v) => handleChange('cekmeKablosu', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="cekme-var" />
                  <Label htmlFor="cekme-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="cekme-yok" />
                  <Label htmlFor="cekme-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
          <div className="flex justify-between items-center py-2">
            <Label className="text-sm">Üçgen (1 Adet)</Label>
            <RadioGroup value={formData.ucgen} onValueChange={(v) => handleChange('ucgen', v)}>
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="var" id="ucgen-var" />
                  <Label htmlFor="ucgen-var" className="text-xs font-normal">Var</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yok" id="ucgen-yok" />
                  <Label htmlFor="ucgen-yok" className="text-xs font-normal">Yok</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>📝 Notlar ve Hasar Bildirimi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teslim Edenin Notları</Label>
            <Textarea 
              value={formData.teslimEdenNotlar}
              onChange={(e) => handleChange('teslimEdenNotlar', e.target.value)}
              placeholder="Vardiya sırasında yaşanan durumlar, önemli notlar..."
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Hasar Tespit Bildirimi</Label>
            <Textarea 
              value={formData.hasarBildirimi}
              onChange={(e) => handleChange('hasarBildirimi', e.target.value)}
              placeholder="Tespit edilen hasarlar, arızalar, eksiklikler..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Teslim Eden */}
      <Card className="border-green-200 bg-green-50/30">
        <CardHeader><CardTitle className="text-green-700">✍️ Teslim Eden Bilgileri (Siz)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profile_photo} />
              <AvatarFallback className="bg-green-100 text-green-700 text-xl">
                {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-lg">{formData.teslimEden || user?.name}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
              {formData.teslimEdenTelefon && (
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" /> {formData.teslimEdenTelefon}
                </p>
              )}
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          
          {formData.teslimEdenSignature ? (
            <div className="space-y-2">
              <Label>İmza (Otomatik)</Label>
              <div className="border-2 border-green-500 rounded-lg p-2 bg-white">
                <img 
                  src={formData.teslimEdenSignature} 
                  alt="İmza" 
                  className="h-24 w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <SignaturePad 
              label="İmza" 
              required
              onSignature={(sig) => handleChange('teslimEdenSignature', sig)}
            />
          )}
        </CardContent>
      </Card>

      {/* Teslim Alan */}
      <Card className={`border-blue-200 ${receiverApproved ? 'bg-green-50/30 border-green-200' : 'bg-blue-50/30'}`}>
        <CardHeader>
          <CardTitle className={receiverApproved ? 'text-green-700' : 'text-blue-700'}>
            ✍️ Teslim Alan Bilgileri (Sonraki Vardiya)
            {receiverApproved && <span className="ml-2 text-green-600">✓ Onaylandı</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {receiverInfo ? (
            <>
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={receiverInfo.profile_photo} />
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xl">
                    {receiverInfo.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-bold text-lg">{receiverInfo.name}</p>
                  <p className="text-sm text-gray-500">{receiverInfo.role}</p>
                  {receiverInfo.phone && (
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" /> {receiverInfo.phone}
                    </p>
                  )}
                  {receiverInfo.email && (
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {receiverInfo.email}
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
              <p className="text-sm text-gray-500 mt-1">Manuel olarak girebilirsiniz</p>
              <div className="mt-4 space-y-2">
                <Input 
                  value={formData.teslimAlan}
                  onChange={(e) => handleChange('teslimAlan', e.target.value)}
                  placeholder="Teslim Alan Adı Soyadı"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yönetici Onayı */}
      <Card className={`border-purple-200 ${managerApproved ? 'bg-green-50/30 border-green-200' : 'bg-purple-50/30'}`}>
        <CardHeader>
          <CardTitle className={managerApproved ? 'text-green-700' : 'text-purple-700'}>
            <Shield className="h-5 w-5 inline mr-2" />
            Yönetici Onayı (Baş Şoför / Operasyon Müdürü)
            {managerApproved && <span className="ml-2 text-green-600">✓ Onaylandı</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!managerApproved && (
            <>
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                <p className="text-sm text-purple-800">
                  ⚠️ Devir teslim için yönetici onayı gerekli. Baş Şoför ve Operasyon Müdürüne SMS, Email ve Push bildirim gönderilecek.
                </p>
              </div>
              
              {!approvalSent.manager ? (
                <Button 
                  onClick={sendManagerApproval} 
                  disabled={sendingApproval || !receiverApproved}
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
              
              {!receiverApproved && (
                <p className="text-xs text-gray-500">* Önce teslim alan onayı gerekli</p>
              )}
            </>
          )}
          
          {managerApproved && (
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-green-200">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="font-medium text-green-700">Yönetici Onayı Alındı</p>
                <p className="text-sm text-gray-500">Devir teslim kaydedilebilir</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Onay Durumu Özet */}
      <Card>
        <CardHeader><CardTitle>📋 Onay Durumu</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
              <span>Teslim Alan Onayı</span>
              {receiverApproved ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Onaylandı
                </span>
              ) : (
                <span className="text-yellow-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Bekliyor
                </span>
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
              <span>Yönetici Onayı</span>
              {managerApproved ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Onaylandı
                </span>
              ) : (
                <span className="text-yellow-600 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Bekliyor
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={() => {
          const initialData = {
            aracPlakasi: vehiclePlate || '',
            kayitTarihi: getTurkeyDate(),
            kayitSaati: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            teslimAlinanKm: vehicleKm || '',
            servisYapilacakKm: '',
            fosforluYelek: '',
            takviyeKablosu: '',
            cekmeKablosu: '',
            ucgen: '',
            teslimEdenNotlar: '',
            hasarBildirimi: '',
            teslimEden: '',
            teslimAlan: '',
            birimYoneticisi: '',
            onayTarihi: getTurkeyDate(),
            teslimEdenSignature: null,
            teslimAlanSignature: null
          };
          if (onChange) onChange(initialData);
          else setLocalFormData(initialData);
          setReceiverApproved(false);
          setManagerApproved(false);
          setApprovalSent({ receiver: false, manager: false });
          toast.success('Form temizlendi');
        }}>🗑 Temizle</Button>
        <PDFExportButton 
          formType="handover"
          formData={formData}
          filename={`devir_teslim_${formData.aracPlakasi || 'form'}`}
          variant="outline"
        >
          📄 PDF İndir
        </PDFExportButton>
        <Button variant="outline" onClick={() => {
          const doc = exportHandoverForm(formData);
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        }}>🔍 PDF Önizleme</Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || !receiverApproved || !managerApproved}
          className="bg-green-600 hover:bg-green-700"
        >
          {saving ? "Kaydediliyor..." : "💾 Kaydet ve Tamamla"}
        </Button>
      </div>

      {/* Onay Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalDialogType === 'receiver' ? '📱 Teslim Alan Onayı' : '🔐 Yönetici Onayı'}
            </DialogTitle>
            <DialogDescription>
              {approvalDialogType === 'receiver' 
                ? 'Teslim alacak kişinin telefonuna ve email adresine onay kodu gönderildi.'
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

export default HandoverFormFull;
