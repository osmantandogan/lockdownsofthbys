import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { 
  AlertTriangle, Package, Pill, MessageSquare, Camera, X, 
  Send, Clock, CheckCircle, XCircle, Truck, Calendar, Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { casesAPI, shiftsAPI, vehiclesAPI, ticketsAPI } from '../api';

const Tickets = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new');
  const [ticketType, setTicketType] = useState(null); // 'bildirim', 'malzeme', 'ilac'
  const [loading, setLoading] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [recentCases, setRecentCases] = useState([]);
  const [currentShift, setCurrentShift] = useState(null);

  // Bildirim formu
  const [bildirimForm, setBildirimForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'normal',
    vehicle_id: '',
    case_id: '',
    shift_id: '',
    photos: []
  });

  // Malzeme talep formu
  const [malzemeForm, setMalzemeForm] = useState({
    items: [{ name: '', quantity: 1, unit: 'adet' }],
    notes: '',
    urgency: 'normal'
  });

  // İlaç talep formu
  const [ilacForm, setIlacForm] = useState({
    items: [{ name: '', quantity: 1, unit: 'adet', barcode: '' }],
    notes: '',
    urgency: 'normal'
  });

  // Ekipman hasar formu
  const [hasarForm, setHasarForm] = useState({
    item_name: '',
    item_type: '', // ilac, ekipman, malzeme
    damage_type: '', // kirildi, bozuldu, tarihi_gecti
    description: '',
    photos: [],
    vehicle_id: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [vehiclesRes] = await Promise.all([
        vehiclesAPI.getAll()
      ]);
      setVehicles(vehiclesRes.data || []);
      
      // Son vakaları yükle
      try {
        const casesRes = await casesAPI.getAll({ limit: 10 });
        setRecentCases(casesRes.data || []);
      } catch (e) {
        console.log('Cases yüklenemedi');
      }
      
      // Mevcut vardiyayı kontrol et
      try {
        const shiftRes = await shiftsAPI.getActive();
        if (shiftRes.data) {
          setCurrentShift(shiftRes.data);
        }
      } catch (e) {
        console.log('Shift yüklenemedi');
      }
    } catch (error) {
      console.error('Veri yüklenemedi:', error);
    }
  };

  const handlePhotoUpload = (e, formType) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (formType === 'bildirim') {
          setBildirimForm(prev => ({
            ...prev,
            photos: [...prev.photos, { name: file.name, data: reader.result }]
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setBildirimForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleBildirimSubmit = async (e) => {
    e.preventDefault();
    if (!bildirimForm.title || !bildirimForm.description || !bildirimForm.category) {
      toast.error('Lütfen gerekli alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      await ticketsAPI.create({
        type: 'bildirim',
        ...bildirimForm,
        created_by: user?.id,
        created_by_name: user?.name
      });

      toast.success('Bildirim başarıyla gönderildi');
      setBildirimForm({
        title: '',
        description: '',
        category: '',
        priority: 'normal',
        vehicle_id: '',
        case_id: '',
        shift_id: '',
        photos: []
      });
      setTicketType(null);
    } catch (error) {
      toast.error('Bildirim gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleMalzemeSubmit = async (e) => {
    e.preventDefault();
    const validItems = malzemeForm.items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      toast.error('En az bir malzeme ekleyin');
      return;
    }

    setLoading(true);
    try {
      await ticketsAPI.create({
        type: 'malzeme_talep',
        items: validItems,
        notes: malzemeForm.notes,
        urgency: malzemeForm.urgency,
        created_by: user?.id,
        created_by_name: user?.name
      });

      toast.success('Malzeme talebi gönderildi');
      setMalzemeForm({ items: [{ name: '', quantity: 1, unit: 'adet' }], notes: '', urgency: 'normal' });
      setTicketType(null);
    } catch (error) {
      toast.error('Malzeme talebi gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleIlacSubmit = async (e) => {
    e.preventDefault();
    const validItems = ilacForm.items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      toast.error('En az bir ilaç ekleyin');
      return;
    }

    setLoading(true);
    try {
      await ticketsAPI.create({
        type: 'ilac_talep',
        items: validItems,
        notes: ilacForm.notes,
        urgency: ilacForm.urgency,
        created_by: user?.id,
        created_by_name: user?.name
      });

      toast.success('İlaç talebi gönderildi');
      setIlacForm({ items: [{ name: '', quantity: 1, unit: 'adet', barcode: '' }], notes: '', urgency: 'normal' });
      setTicketType(null);
    } catch (error) {
      toast.error('İlaç talebi gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleHasarSubmit = async (e) => {
    e.preventDefault();
    if (!hasarForm.item_name || !hasarForm.damage_type) {
      toast.error('Lütfen gerekli alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      await ticketsAPI.create({
        type: 'ekipman_hasar',
        title: `${hasarForm.item_type === 'ilac' ? 'İlaç' : hasarForm.item_type === 'ekipman' ? 'Ekipman' : 'Malzeme'} Hasarı: ${hasarForm.item_name}`,
        description: hasarForm.description,
        category: hasarForm.damage_type,
        photos: hasarForm.photos,
        vehicle_id: hasarForm.vehicle_id,
        created_by: user?.id,
        created_by_name: user?.name,
        priority: 'high'
      });

      toast.success('Hasar bildirimi gönderildi');
      setHasarForm({
        item_name: '',
        item_type: '',
        damage_type: '',
        description: '',
        photos: [],
        vehicle_id: ''
      });
      setTicketType(null);
    } catch (error) {
      toast.error('Hasar bildirimi gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = async (formType) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();
      
      // Wait for video to be ready
      await new Promise(resolve => video.onloadedmetadata = resolve);
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      stream.getTracks().forEach(track => track.stop());
      
      if (formType === 'bildirim') {
        setBildirimForm(prev => ({
          ...prev,
          photos: [...prev.photos, { name: `foto_${Date.now()}.jpg`, data: imageData }]
        }));
      } else if (formType === 'hasar') {
        setHasarForm(prev => ({
          ...prev,
          photos: [...prev.photos, { name: `foto_${Date.now()}.jpg`, data: imageData }]
        }));
      }
      toast.success('Fotoğraf çekildi');
    } catch (error) {
      console.error('Kamera hatası:', error);
      toast.error('Kamera açılamadı. Lütfen izin verin.');
    }
  };

  const removeHasarPhoto = (index) => {
    setHasarForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const addItem = (formType) => {
    if (formType === 'malzeme') {
      setMalzemeForm(prev => ({
        ...prev,
        items: [...prev.items, { name: '', quantity: 1, unit: 'adet' }]
      }));
    } else if (formType === 'ilac') {
      setIlacForm(prev => ({
        ...prev,
        items: [...prev.items, { name: '', quantity: 1, unit: 'adet', barcode: '' }]
      }));
    }
  };

  const removeItem = (formType, index) => {
    if (formType === 'malzeme') {
      setMalzemeForm(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    } else if (formType === 'ilac') {
      setIlacForm(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const updateItem = (formType, index, field, value) => {
    if (formType === 'malzeme') {
      setMalzemeForm(prev => ({
        ...prev,
        items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
      }));
    } else if (formType === 'ilac') {
      setIlacForm(prev => ({
        ...prev,
        items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bildirim ve Talepler</h1>
        <p className="text-gray-500">Bildirim oluşturun veya malzeme/ilaç talep edin</p>
      </div>

      {/* Ticket Tipi Seçimi */}
      {!ticketType && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="cursor-pointer hover:border-orange-500 transition-colors"
            onClick={() => setTicketType('bildirim')}
          >
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-3" />
              <h3 className="font-bold text-lg">Olay Bildirimi</h3>
              <p className="text-sm text-gray-500 mt-2">
                Kaza, arıza, hasar veya önemli bir durum bildirin
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-blue-500 transition-colors"
            onClick={() => setTicketType('malzeme')}
          >
            <CardContent className="pt-6 text-center">
              <Package className="h-12 w-12 text-blue-500 mx-auto mb-3" />
              <h3 className="font-bold text-lg">Malzeme Talebi</h3>
              <p className="text-sm text-gray-500 mt-2">
                Tıbbi malzeme veya ekipman talep edin
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-green-500 transition-colors"
            onClick={() => setTicketType('ilac')}
          >
            <CardContent className="pt-6 text-center">
              <Pill className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-bold text-lg">İlaç Talebi</h3>
              <p className="text-sm text-gray-500 mt-2">
                İlaç ve medikal ürün talep edin
              </p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:border-red-500 transition-colors"
            onClick={() => setTicketType('ekipman_hasar')}
          >
            <CardContent className="pt-6 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
              <h3 className="font-bold text-lg">Ekipman Hasarı</h3>
              <p className="text-sm text-gray-500 mt-2">
                İlaç/ekipman kırıldı, bozuldu veya tarihi geçti
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bildirim Formu */}
      {ticketType === 'bildirim' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Olay Bildirimi
                </CardTitle>
                <CardDescription>Önemli bir durumu bildirin</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTicketType(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBildirimSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Başlık *</Label>
                  <Input 
                    placeholder="Bildirimin kısa başlığı"
                    value={bildirimForm.title}
                    onChange={(e) => setBildirimForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori *</Label>
                  <Select 
                    value={bildirimForm.category}
                    onValueChange={(v) => setBildirimForm(prev => ({ ...prev, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kaza">Kaza / Çarpışma</SelectItem>
                      <SelectItem value="ariza">Araç Arızası</SelectItem>
                      <SelectItem value="hasar">Hasar Bildirimi</SelectItem>
                      <SelectItem value="medikal">Medikal Olay</SelectItem>
                      <SelectItem value="guvenlik">Güvenlik Sorunu</SelectItem>
                      <SelectItem value="diger">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Açıklama *</Label>
                <Textarea 
                  placeholder="Olayı detaylı açıklayın..."
                  rows={4}
                  value={bildirimForm.description}
                  onChange={(e) => setBildirimForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Öncelik</Label>
                  <Select 
                    value={bildirimForm.priority}
                    onValueChange={(v) => setBildirimForm(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Düşük</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Yüksek</SelectItem>
                      <SelectItem value="urgent">Acil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>İlgili Araç</Label>
                  <Select 
                    value={bildirimForm.vehicle_id}
                    onValueChange={(v) => setBildirimForm(prev => ({ ...prev, vehicle_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Araç seçin (opsiyonel)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seçim Yok</SelectItem>
                      {vehicles.filter(v => v.id || v._id).map(v => (
                        <SelectItem key={v.id || v._id} value={v.id || v._id}>
                          {v.plate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>İlgili Vaka</Label>
                  <Select 
                    value={bildirimForm.case_id}
                    onValueChange={(v) => setBildirimForm(prev => ({ ...prev, case_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vaka seçin (opsiyonel)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seçim Yok</SelectItem>
                      {recentCases.filter(c => c.id || c._id).map(c => (
                        <SelectItem key={c.id || c._id} value={c.id || c._id}>
                          {c.case_number} - {c.patient?.name || 'İsimsiz'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Fotoğraf Yükleme */}
              <div className="space-y-2">
                <Label>Fotoğraflar</Label>
                <div className="flex flex-wrap gap-2">
                  {bildirimForm.photos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img 
                        src={photo.data} 
                        alt={photo.name}
                        className="w-20 h-20 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="w-20 h-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-blue-500 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'bildirim')}
                    />
                    <Camera className="h-6 w-6 text-gray-400" />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketType(null)}>
                  İptal
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Gönderiliyor...' : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Bildir
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Malzeme Talep Formu */}
      {ticketType === 'malzeme' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  Malzeme Talebi
                </CardTitle>
                <CardDescription>İhtiyacınız olan malzemeleri talep edin</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTicketType(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleMalzemeSubmit} className="space-y-4">
              {malzemeForm.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Malzeme Adı</Label>
                    <Input 
                      placeholder="Örn: Eldiven, Maske..."
                      value={item.name}
                      onChange={(e) => updateItem('malzeme', index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Miktar</Label>
                    <Input 
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem('malzeme', index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="w-28 space-y-2">
                    <Label>Birim</Label>
                    <Select 
                      value={item.unit}
                      onValueChange={(v) => updateItem('malzeme', index, 'unit', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adet">Adet</SelectItem>
                        <SelectItem value="kutu">Kutu</SelectItem>
                        <SelectItem value="paket">Paket</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {malzemeForm.items.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeItem('malzeme', index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => addItem('malzeme')}>
                <Plus className="h-4 w-4 mr-2" /> Malzeme Ekle
              </Button>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Aciliyet</Label>
                  <Select 
                    value={malzemeForm.urgency}
                    onValueChange={(v) => setMalzemeForm(prev => ({ ...prev, urgency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Acil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notlar</Label>
                  <Input 
                    placeholder="Ek notlar..."
                    value={malzemeForm.notes}
                    onChange={(e) => setMalzemeForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketType(null)}>
                  İptal
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Gönderiliyor...' : 'Talep Gönder'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* İlaç Talep Formu */}
      {ticketType === 'ilac' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-green-500" />
                  İlaç Talebi
                </CardTitle>
                <CardDescription>İhtiyacınız olan ilaçları talep edin</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTicketType(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIlacSubmit} className="space-y-4">
              {ilacForm.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>İlaç Adı</Label>
                    <Input 
                      placeholder="Örn: Parasetamol, Morfin..."
                      value={item.name}
                      onChange={(e) => updateItem('ilac', index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Miktar</Label>
                    <Input 
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem('ilac', index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="w-28 space-y-2">
                    <Label>Birim</Label>
                    <Select 
                      value={item.unit}
                      onValueChange={(v) => updateItem('ilac', index, 'unit', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adet">Adet</SelectItem>
                        <SelectItem value="ampul">Ampul</SelectItem>
                        <SelectItem value="kutu">Kutu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {ilacForm.items.length > 1 && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeItem('ilac', index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => addItem('ilac')}>
                <Plus className="h-4 w-4 mr-2" /> İlaç Ekle
              </Button>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Aciliyet</Label>
                  <Select 
                    value={ilacForm.urgency}
                    onValueChange={(v) => setIlacForm(prev => ({ ...prev, urgency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Acil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notlar</Label>
                  <Input 
                    placeholder="Ek notlar..."
                    value={ilacForm.notes}
                    onChange={(e) => setIlacForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketType(null)}>
                  İptal
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Gönderiliyor...' : 'Talep Gönder'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ekipman Hasar Formu */}
      {ticketType === 'ekipman_hasar' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  Ekipman Hasarı Bildirimi
                </CardTitle>
                <CardDescription>İlaç veya ekipmanınız kırıldı, bozuldu veya tarihi geçti mi?</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTicketType(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleHasarSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ürün Türü *</Label>
                  <Select
                    value={hasarForm.item_type}
                    onValueChange={(v) => setHasarForm(prev => ({ ...prev, item_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ilac">İlaç</SelectItem>
                      <SelectItem value="ekipman">Ekipman</SelectItem>
                      <SelectItem value="malzeme">Malzeme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hasar Türü *</Label>
                  <Select
                    value={hasarForm.damage_type}
                    onValueChange={(v) => setHasarForm(prev => ({ ...prev, damage_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kirildi">Kırıldı</SelectItem>
                      <SelectItem value="bozuldu">Bozuldu</SelectItem>
                      <SelectItem value="tarihi_gecti">Tarihi Geçti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Ürün Adı *</Label>
                <Input
                  placeholder="Hasar gören ürünün adı"
                  value={hasarForm.item_name}
                  onChange={(e) => setHasarForm(prev => ({ ...prev, item_name: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Araç</Label>
                <Select
                  value={hasarForm.vehicle_id}
                  onValueChange={(v) => setHasarForm(prev => ({ ...prev, vehicle_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Araç seçin (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Araç yok</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Açıklama</Label>
                <Textarea
                  placeholder="Hasar hakkında detay verin..."
                  value={hasarForm.description}
                  onChange={(e) => setHasarForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Fotoğraf</Label>
                <div className="flex gap-2 flex-wrap">
                  {hasarForm.photos.map((photo, index) => (
                    <div key={index} className="relative w-20 h-20 border rounded overflow-hidden">
                      <img src={photo.data} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeHasarPhoto(index)}
                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleCameraCapture('hasar')}
                    className="w-20 h-20 border-2 border-dashed rounded flex flex-col items-center justify-center text-gray-400 hover:border-red-500 hover:text-red-500 transition-colors"
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-xs mt-1">Çek</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTicketType(null)}>
                  İptal
                </Button>
                <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
                  {loading ? 'Gönderiliyor...' : 'Hasar Bildir'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mevcut Vardiya Bilgisi */}
      {currentShift && (
        <Card className="bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-medium">Aktif Vardiya</p>
                <p className="text-sm text-gray-600">
                  {currentShift.vehicle_plate} - {currentShift.start_time}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Tickets;

