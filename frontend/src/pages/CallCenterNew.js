import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { toast } from 'sonner';
import { Phone, User, MapPin, AlertCircle, Truck, Bell, Clock, Activity, FileText } from 'lucide-react';

const CallCenterNew = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [createdCaseId, setCreatedCaseId] = useState(null);
  const [sendingNotification, setSendingNotification] = useState(false);
  
  const [formData, setFormData] = useState({
    // Çağrıyı Yapan
    kurumAdi: '',
    cagriYapanAdiSoyadi: '',
    yakinligi: '',
    cagriYapanTelefon: '',
    
    // Hasta
    hastaAdiSoyadi: '',
    yas: '',
    cinsiyet: '',
    hastaTelefon: '',
    adres: '',
    adresTarifi: '',
    
    // Vaka Bilgileri
    vakaNo: '',
    tarih: '',
    tasitBilgisi: '',
    cagriAlisSaati: '',
    alarmSaati: '',
    randevu: '',
    randevuSaati: '',
    randevuTarihi: '',
    
    // Klinik Bilgiler
    hastaSikayeti: '',
    hastaKlinigi: '',
    onTani: '',
    onayAlinanKisi: '',
    triajKodu: '',
    cikisSekli: '',
    
    // Zaman Bilgileri
    cikisSaati: '',
    ulasimSaati: '',
    vakadanCikisSaati: '',
    hastaneyeVarisSaati: '',
    hastanedenCikisSaati: '',
    noktayaDonusSaati: '',
    
    // Lokasyon Bilgileri
    hastaninAlindigiYer: '',
    hastaninIlkBirakildigiYer: '',
    hastaninSonBirakildigiYer: '',
    ambulansTipi: '',
    
    // Hastanın Güvencesi
    anlasmalıKurum: '',
    kkOnayKodu: '',
    
    // Çağrı Bilgileri
    cagriyiAlanAdiSoyadi: '',
    protokolNo: '',
    mudahale: '',
    aciklama: ''
  });

  useEffect(() => {
    loadVehicles();
    initializeForm();
  }, []);

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll({ status: 'musait' });
      setVehicles(response.data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const initializeForm = () => {
    const now = new Date();
    const caseNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    
    setFormData(prev => ({
      ...prev,
      vakaNo: caseNumber,
      tarih: now.toISOString().split('T')[0],
      cagriAlisSaati: now.toTimeString().slice(0, 5)
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Map form data to API structure
      const caseData = {
        caller: {
          name: formData.cagriYapanAdiSoyadi,
          phone: formData.cagriYapanTelefon,
          relationship: formData.yakinligi,
          organization: formData.kurumAdi
        },
        patient: {
          name: formData.hastaAdiSoyadi.split(' ')[0] || formData.hastaAdiSoyadi,
          surname: formData.hastaAdiSoyadi.split(' ').slice(1).join(' ') || '',
          age: parseInt(formData.yas) || 0,
          gender: formData.cinsiyet,
          phone: formData.hastaTelefon,
          complaint: formData.hastaSikayeti,
          clinic: formData.hastaKlinigi,
          preliminary_diagnosis: formData.onTani
        },
        location: {
          address: formData.adres,
          address_description: formData.adresTarifi,
          pickup_location: formData.hastaninAlindigiYer,
          first_dropoff: formData.hastaninIlkBirakildigiYer,
          final_dropoff: formData.hastaninSonBirakildigiYer
        },
        priority: formData.triajKodu === '1' ? 'yuksek' : formData.triajKodu === '2' ? 'orta' : 'dusuk',
        case_details: {
          case_number: formData.vakaNo,
          date: formData.tarih,
          call_received_time: formData.cagriAlisSaati,
          alarm_time: formData.alarmSaati,
          has_appointment: formData.randevu === 'evet',
          appointment_time: formData.randevuSaati,
          appointment_date: formData.randevuTarihi,
          exit_type: formData.cikisSekli,
          ambulance_type: formData.ambulansTipi,
          departure_time: formData.cikisSaati,
          arrival_time: formData.ulasimSaati,
          scene_departure_time: formData.vakadanCikisSaati,
          hospital_arrival_time: formData.hastaneyeVarisSaati,
          hospital_departure_time: formData.hastanedenCikisSaati,
          base_return_time: formData.noktayaDonusSaati,
          contracted_institution: formData.anlasmalıKurum === 'evet',
          approval_code: formData.kkOnayKodu,
          received_by: formData.cagriyiAlanAdiSoyadi,
          protocol_number: formData.protokolNo,
          intervention: formData.mudahale,
          notes: formData.aciklama,
          vehicle_id: formData.tasitBilgisi !== 'none' ? formData.tasitBilgisi : null,
          approved_by: formData.onayAlinanKisi
        }
      };

      const response = await casesAPI.create(caseData);
      setCreatedCaseId(response.data.id);
      toast.success(`Vaka oluşturuldu: ${response.data.case_number}`);
    } catch (error) {
      console.error('Error creating case:', error);
      toast.error(error.response?.data?.detail || 'Vaka oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotification = async () => {
    if (!createdCaseId) {
      toast.error('Önce vaka oluşturulmalı');
      return;
    }

    setSendingNotification(true);
    try {
      const vehicleId = formData.tasitBilgisi !== 'none' ? formData.tasitBilgisi : null;
      await casesAPI.sendNotification(createdCaseId, vehicleId);
      toast.success('Bildirimler gönderildi!');
      
      setTimeout(() => {
        navigate(`/dashboard/cases/${createdCaseId}`);
      }, 1500);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error(error.response?.data?.detail || 'Bildirim gönderilemedi');
    } finally {
      setSendingNotification(false);
    }
  };

  const isRandevuEnabled = formData.randevu === 'evet';
  const isGuvenceEnabled = formData.anlasmalıKurum === 'evet';

  return (
    <div className="space-y-6" data-testid="call-center-page">
      <div>
        <h1 className="text-3xl font-bold">Çağrı Merkezi</h1>
        <p className="text-gray-500">Yeni vaka formu</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Çağrıyı Yapan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Phone className="h-5 w-5" />
              <span>Çağrıyı Yapan</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kurumAdi">Kurum Adı</Label>
              <Input
                id="kurumAdi"
                value={formData.kurumAdi}
                onChange={(e) => handleChange('kurumAdi', e.target.value)}
                data-testid="kurum-adi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cagriYapanAdiSoyadi">Adı Soyadı</Label>
              <Input
                id="cagriYapanAdiSoyadi"
                value={formData.cagriYapanAdiSoyadi}
                onChange={(e) => handleChange('cagriYapanAdiSoyadi', e.target.value)}
                data-testid="cagri-yapan-adi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yakinligi">Yakınlığı</Label>
              <Input
                id="yakinligi"
                value={formData.yakinligi}
                onChange={(e) => handleChange('yakinligi', e.target.value)}
                data-testid="yakinligi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cagriYapanTelefon">Telefon Numarası</Label>
              <Input
                id="cagriYapanTelefon"
                type="tel"
                placeholder="(5XX) XXX-XXXX"
                value={formData.cagriYapanTelefon}
                onChange={(e) => handleChange('cagriYapanTelefon', e.target.value)}
                data-testid="cagri-yapan-telefon"
              />
            </div>
          </CardContent>
        </Card>

        {/* Hasta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Hasta</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hastaAdiSoyadi">Adı Soyadı</Label>
                <Input
                  id="hastaAdiSoyadi"
                  value={formData.hastaAdiSoyadi}
                  onChange={(e) => handleChange('hastaAdiSoyadi', e.target.value)}
                  data-testid="hasta-adi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="yas">Yaş</Label>
                <Input
                  id="yas"
                  type="number"
                  min="0"
                  max="150"
                  value={formData.yas}
                  onChange={(e) => handleChange('yas', e.target.value)}
                  data-testid="hasta-yas"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hastaTelefon">Telefon Numarası</Label>
                <Input
                  id="hastaTelefon"
                  type="tel"
                  placeholder="(5XX) XXX-XXXX"
                  value={formData.hastaTelefon}
                  onChange={(e) => handleChange('hastaTelefon', e.target.value)}
                  data-testid="hasta-telefon"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cinsiyet *</Label>
              <RadioGroup value={formData.cinsiyet} onValueChange={(value) => handleChange('cinsiyet', value)} required>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="erkek" id="erkek" data-testid="cinsiyet-erkek" />
                    <Label htmlFor="erkek" className="font-normal">Erkek</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="kadin" id="kadin" data-testid="cinsiyet-kadin" />
                    <Label htmlFor="kadin" className="font-normal">Kadın</Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="text-xs text-red-500">*Bu Alanın Girilmesi Zorunludur</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adres">Adres</Label>
              <Textarea
                id="adres"
                value={formData.adres}
                onChange={(e) => handleChange('adres', e.target.value)}
                rows={3}
                data-testid="hasta-adres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adresTarifi">Adres Tarifi</Label>
              <Textarea
                id="adresTarifi"
                value={formData.adresTarifi}
                onChange={(e) => handleChange('adresTarifi', e.target.value)}
                rows={3}
                data-testid="adres-tarifi"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vaka Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Vaka Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="vakaNo">Vaka No</Label>
                <Input
                  id="vakaNo"
                  value={formData.vakaNo}
                  disabled
                  className="bg-gray-100"
                  data-testid="vaka-no"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarih">Tarih</Label>
                <Input
                  id="tarih"
                  type="date"
                  value={formData.tarih}
                  onChange={(e) => handleChange('tarih', e.target.value)}
                  data-testid="tarih"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cagriAlisSaati">Çağrı Alış Saati</Label>
                <Input
                  id="cagriAlisSaati"
                  type="time"
                  value={formData.cagriAlisSaati}
                  onChange={(e) => handleChange('cagriAlisSaati', e.target.value)}
                  data-testid="cagri-alis-saati"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tasitBilgisi">Taşıt Bilgisi</Label>
                <Select value={formData.tasitBilgisi} onValueChange={(value) => handleChange('tasitBilgisi', value)}>
                  <SelectTrigger data-testid="tasit-bilgisi">
                    <SelectValue placeholder="Lütfen Araç Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seçilmedi</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} - {vehicle.type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alarmSaati">Alarm Saati</Label>
                <Input
                  id="alarmSaati"
                  type="time"
                  value={formData.alarmSaati}
                  onChange={(e) => handleChange('alarmSaati', e.target.value)}
                  data-testid="alarm-saati"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Randevu *</Label>
              <RadioGroup value={formData.randevu} onValueChange={(value) => handleChange('randevu', value)} required>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="evet" id="randevu-evet" data-testid="randevu-evet" />
                    <Label htmlFor="randevu-evet" className="font-normal">Evet</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hayir" id="randevu-hayir" data-testid="randevu-hayir" />
                    <Label htmlFor="randevu-hayir" className="font-normal">Hayır</Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="text-xs text-red-500">*Bu Alanın Girilmesi Zorunludur</p>
            </div>
            {isRandevuEnabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="randevuSaati">Randevu Saati</Label>
                  <Input
                    id="randevuSaati"
                    type="time"
                    value={formData.randevuSaati}
                    onChange={(e) => handleChange('randevuSaati', e.target.value)}
                    data-testid="randevu-saati"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="randevuTarihi">Randevu Tarihi</Label>
                  <Input
                    id="randevuTarihi"
                    type="date"
                    value={formData.randevuTarihi}
                    onChange={(e) => handleChange('randevuTarihi', e.target.value)}
                    data-testid="randevu-tarihi"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Klinik Bilgiler */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Klinik Bilgiler</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hastaSikayeti">Hastanın Şikayeti</Label>
              <Textarea
                id="hastaSikayeti"
                value={formData.hastaSikayeti}
                onChange={(e) => handleChange('hastaSikayeti', e.target.value)}
                rows={3}
                data-testid="hasta-sikayeti"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hastaKlinigi">Hastanın Kliniği</Label>
                <Input
                  id="hastaKlinigi"
                  value={formData.hastaKlinigi}
                  onChange={(e) => handleChange('hastaKlinigi', e.target.value)}
                  data-testid="hasta-klinigi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onTani">Ön Tanı</Label>
                <Input
                  id="onTani"
                  value={formData.onTani}
                  onChange={(e) => handleChange('onTani', e.target.value)}
                  data-testid="on-tani"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onayAlinanKisi">Onay Alınan Kişi</Label>
              <Input
                id="onayAlinanKisi"
                value={formData.onayAlinanKisi}
                onChange={(e) => handleChange('onayAlinanKisi', e.target.value)}
                data-testid="onay-alinan-kisi"
              />
            </div>
            <div className="space-y-2">
              <Label>Triaj Kodu *</Label>
              <RadioGroup value={formData.triajKodu} onValueChange={(value) => handleChange('triajKodu', value)} required>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="1" id="triaj-1" data-testid="triaj-1" />
                    <Label htmlFor="triaj-1" className="font-normal">
                      <span className="inline-flex items-center space-x-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        <span>1 (Kırmızı - Acil)</span>
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="2" id="triaj-2" data-testid="triaj-2" />
                    <Label htmlFor="triaj-2" className="font-normal">
                      <span className="inline-flex items-center space-x-2">
                        <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                        <span>2 (Sarı - Öncelikli)</span>
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="3" id="triaj-3" data-testid="triaj-3" />
                    <Label htmlFor="triaj-3" className="font-normal">
                      <span className="inline-flex items-center space-x-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        <span>3 (Yeşil - Acil Değil)</span>
                      </span>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="text-xs text-red-500">*Bu Alanın Girilmesi Zorunludur</p>
            </div>
            <div className="space-y-2">
              <Label>Çıkış Şekli *</Label>
              <RadioGroup value={formData.cikisSekli} onValueChange={(value) => handleChange('cikisSekli', value)} required>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="acil" id="cikis-acil" data-testid="cikis-acil" />
                    <Label htmlFor="cikis-acil" className="font-normal">Acil</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="kontrollu" id="cikis-kontrollu" data-testid="cikis-kontrollu" />
                    <Label htmlFor="cikis-kontrollu" className="font-normal">Kontrollü</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="randevulu" id="cikis-randevulu" data-testid="cikis-randevulu" />
                    <Label htmlFor="cikis-randevulu" className="font-normal">Randevulu</Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="text-xs text-red-500">*Bu Alanın Girilmesi Zorunludur</p>
            </div>
          </CardContent>
        </Card>

        {/* Zaman Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Zaman Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cikisSaati">Çıkış Saati</Label>
              <Input
                id="cikisSaati"
                type="time"
                value={formData.cikisSaati}
                onChange={(e) => handleChange('cikisSaati', e.target.value)}
                data-testid="cikis-saati"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ulasimSaati">Ulaşım Saati</Label>
              <Input
                id="ulasimSaati"
                type="time"
                value={formData.ulasimSaati}
                onChange={(e) => handleChange('ulasimSaati', e.target.value)}
                data-testid="ulasim-saati"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vakadanCikisSaati">Vakadan Çıkış Saati</Label>
              <Input
                id="vakadanCikisSaati"
                type="time"
                value={formData.vakadanCikisSaati}
                onChange={(e) => handleChange('vakadanCikisSaati', e.target.value)}
                data-testid="vakadan-cikis-saati"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hastaneyeVarisSaati">Hastaneye Varış Saati</Label>
              <Input
                id="hastaneyeVarisSaati"
                type="time"
                value={formData.hastaneyeVarisSaati}
                onChange={(e) => handleChange('hastaneyeVarisSaati', e.target.value)}
                data-testid="hastaneye-varis-saati"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hastanedenCikisSaati">Hastaneden Çıkış Saati</Label>
              <Input
                id="hastanedenCikisSaati"
                type="time"
                value={formData.hastanedenCikisSaati}
                onChange={(e) => handleChange('hastanedenCikisSaati', e.target.value)}
                data-testid="hastaneden-cikis-saati"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="noktayaDonusSaati">Noktaya Dönüş Saati</Label>
              <Input
                id="noktayaDonusSaati"
                type="time"
                value={formData.noktayaDonusSaati}
                onChange={(e) => handleChange('noktayaDonusSaati', e.target.value)}
                data-testid="noktaya-donus-saati"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lokasyon Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Lokasyon Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hastaninAlindigiYer">Hastanın Alındığı Yer</Label>
              <Input
                id="hastaninAlindigiYer"
                value={formData.hastaninAlindigiYer}
                onChange={(e) => handleChange('hastaninAlindigiYer', e.target.value)}
                data-testid="hastanin-alindigi-yer"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hastaninIlkBirakildigiYer">Hastanın İlk Bırakıldığı Yer</Label>
                <Input
                  id="hastaninIlkBirakildigiYer"
                  value={formData.hastaninIlkBirakildigiYer}
                  onChange={(e) => handleChange('hastaninIlkBirakildigiYer', e.target.value)}
                  data-testid="ilk-birakildi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hastaninSonBirakildigiYer">Hastanın Son Bırakıldığı Yer</Label>
                <Input
                  id="hastaninSonBirakildigiYer"
                  value={formData.hastaninSonBirakildigiYer}
                  onChange={(e) => handleChange('hastaninSonBirakildigiYer', e.target.value)}
                  data-testid="son-birakildi"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ambulans Tipi *</Label>
              <RadioGroup value={formData.ambulansTipi} onValueChange={(value) => handleChange('ambulansTipi', value)} required>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="kara" id="ambulans-kara" data-testid="ambulans-kara" />
                    <Label htmlFor="ambulans-kara" className="font-normal">Kara Ambulansı</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hava" id="ambulans-hava" data-testid="ambulans-hava" />
                    <Label htmlFor="ambulans-hava" className="font-normal">Hava Ambulansı</Label>
                  </div>
                </div>
              </RadioGroup>
              <p className="text-xs text-red-500">*Bu Alanın Girilmesi Zorunludur</p>
            </div>
          </CardContent>
        </Card>

        {/* Hastanın Güvencesi */}
        <Card>
          <CardHeader>
            <CardTitle>Hastanın Güvencesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Anlaşmalı Kurum</Label>
              <RadioGroup value={formData.anlasmalıKurum} onValueChange={(value) => handleChange('anlasmalıKurum', value)}>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="evet" id="guvence-evet" data-testid="guvence-evet" />
                    <Label htmlFor="guvence-evet" className="font-normal">Evet</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hayir" id="guvence-hayir" data-testid="guvence-hayir" />
                    <Label htmlFor="guvence-hayir" className="font-normal">Hayır</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
            {isGuvenceEnabled && (
              <div className="space-y-2">
                <Label htmlFor="kkOnayKodu">K.K Onay Kodu</Label>
                <Input
                  id="kkOnayKodu"
                  value={formData.kkOnayKodu}
                  onChange={(e) => handleChange('kkOnayKodu', e.target.value)}
                  data-testid="kk-onay-kodu"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Çağrı Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Phone className="h-5 w-5" />
              <span>Çağrı Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cagriyiAlanAdiSoyadi">Çağrıyı Alan Adı Soyadı</Label>
                <Input
                  id="cagriyiAlanAdiSoyadi"
                  value={formData.cagriyiAlanAdiSoyadi}
                  onChange={(e) => handleChange('cagriyiAlanAdiSoyadi', e.target.value)}
                  data-testid="cagrıyı-alan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protokolNo">112 Protokol Numarası</Label>
                <Input
                  id="protokolNo"
                  value={formData.protokolNo}
                  onChange={(e) => handleChange('protokolNo', e.target.value)}
                  data-testid="protokol-no"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mudahale">Müdahale</Label>
              <Textarea
                id="mudahale"
                value={formData.mudahale}
                onChange={(e) => handleChange('mudahale', e.target.value)}
                rows={4}
                data-testid="mudahale"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aciklama">Açıklama</Label>
              <Textarea
                id="aciklama"
                value={formData.aciklama}
                onChange={(e) => handleChange('aciklama', e.target.value)}
                rows={4}
                data-testid="aciklama"
              />
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        {!createdCaseId ? (
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              data-testid="cancel-button"
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-testid="create-case-button"
            >
              {loading ? 'Oluşturuluyor...' : 'Vaka Oluştur'}
            </Button>
          </div>
        ) : (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-green-800 mb-2">✅ Vaka Başarıyla Oluşturuldu!</h3>
                  <p className="text-sm text-green-700 mb-2">
                    Vaka No: <span className="font-bold">{formData.vakaNo}</span>
                  </p>
                  <p className="text-sm text-green-700 mb-4">
                    Şimdi ilgili ekiplere bildirim gönderebilirsiniz.
                  </p>
                  <p className="text-xs text-gray-600">
                    📧 Bildirim gönderilecek: Merkez Ofis, Operasyon Müdürü, Doktor, Hemşire
                    {formData.tasitBilgisi && formData.tasitBilgisi !== 'none' && ' + Seçilen Araç Ekibi'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/dashboard/cases/${createdCaseId}`)}
                  >
                    Vakaya Git
                  </Button>
                  <Button
                    onClick={handleSendNotification}
                    disabled={sendingNotification}
                    data-testid="send-notification-button"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    {sendingNotification ? 'Gönderiliyor...' : 'Bildirim Gönder'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
};

export default CallCenterNew;
