import React, { useEffect, useState, useCallback } from 'react';
import { shiftsAPI, usersAPI, vehiclesAPI, locationsAPI } from '../api';
import { BACKEND_URL } from '../config/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, User, Truck, Calendar, Clock, ChevronLeft, ChevronRight, Play, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Building, Square, MapPin, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ShiftAssignments = () => {
  const { user } = useAuth();
  
  // Seçili tarih - varsayılan bugün
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [healmedyLocations, setHealmedyLocations] = useState([]);
  
  // Excel toplu yükleme state'leri
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResults, setExcelResults] = useState(null);
  
  // Form state - 24 saat vardiya varsayılan
  const getDefaultEndDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };
  
  const [formData, setFormData] = useState({
    user_id: '',
    vehicle_id: '',
    location_type: 'arac',
    health_center_name: '',
    shift_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '08:00',
    end_date: getDefaultEndDate(),
    is_driver_duty: false,
    healmedy_location_id: '',
    shift_type: 'saha_24'
  });

  // İlk yükleme - sadece kullanıcılar, araçlar ve lokasyonlar
  useEffect(() => {
    loadBaseData();
  }, []);
  
  // Tarih değiştiğinde atamaları yükle
  useEffect(() => {
    if (users.length > 0) {
      loadAssignments(selectedDate);
    }
  }, [selectedDate, users]);

  // Temel verileri yükle (kullanıcılar, araçlar, lokasyonlar)
  const loadBaseData = async () => {
    try {
      const [usersRes, vehiclesRes, locationsRes] = await Promise.all([
        usersAPI.getAll(),
        vehiclesAPI.getAll(),
        locationsAPI.getHealmedy().catch(() => ({ data: [] }))
      ]);
      
      if (Array.isArray(locationsRes.data)) {
        setHealmedyLocations(locationsRes.data);
      }
      
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      const allVehicles = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];
      const ambulances = allVehicles.filter(v => v.type === 'ambulans');
      
      const fieldUsers = allUsers.filter(u => 
        ['sofor', 'bas_sofor', 'paramedik', 'att', 'hemsire', 'doktor'].includes(u.role)
      );
      setUsers(fieldUsers);
      setVehicles(ambulances);
      
      // İlk yüklemede bugünkü atamaları getir
      await loadAssignments(selectedDate);
    } catch (error) {
      console.error('Error loading base data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Belirli bir tarihin atamalarını yükle
  const loadAssignments = useCallback(async (date) => {
    setAssignmentsLoading(true);
    try {
      const response = await shiftsAPI.getAssignmentsByDate(date);
      const assignmentsData = Array.isArray(response.data) ? response.data : [];
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast.error('Atamalar yüklenemedi');
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);

  // Tarih değiştirme
  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Excel şablon indirme
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/shifts/bulk-upload/template`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Şablon indirilemedi');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vardiya_atama_sablonu.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Şablon indirildi');
    } catch (error) {
      toast.error('Şablon indirilemedi');
    }
  };

  // Excel dosyası yükleme
  const handleExcelUpload = async () => {
    if (!excelFile) {
      toast.error('Lütfen bir Excel dosyası seçin');
      return;
    }

    setExcelUploading(true);
    setExcelResults(null);

    try {
      const uploadData = new FormData();
      uploadData.append('file', excelFile);

      const response = await fetch(`${BACKEND_URL}/api/shifts/bulk-upload`, {
        method: 'POST',
        credentials: 'include',
        body: uploadData
      });

      const results = await response.json();
      
      if (response.ok) {
        setExcelResults(results);
        if (results.successful_count > 0) {
          toast.success(`${results.successful_count} atama başarıyla oluşturuldu`);
          loadAssignments(selectedDate);
        }
        if (results.error_count > 0) {
          toast.warning(`${results.error_count} satırda hata oluştu`);
        }
      } else {
        toast.error(results.detail || 'Yükleme başarısız');
      }
    } catch (error) {
      toast.error('Dosya yüklenirken hata oluştu');
    } finally {
      setExcelUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.user_id) {
      toast.error('Lütfen kullanıcı seçin');
      return;
    }
    if (formData.location_type === 'arac' && !formData.vehicle_id) {
      toast.error('Lütfen araç seçin');
      return;
    }

    try {
      const assignmentData = {
        user_id: formData.user_id.trim(),
        shift_date: formData.shift_date.trim(),
        location_type: (formData.location_type || 'arac').trim()
      };
      
      if (formData.location_type === 'arac' && formData.vehicle_id) {
        assignmentData.vehicle_id = formData.vehicle_id.trim();
      }
      
      if (formData.location_type === 'saglik_merkezi') {
        assignmentData.health_center_name = 'Sağlık Merkezi';
      }
      
      if (formData.start_time) assignmentData.start_time = formData.start_time.trim();
      if (formData.end_time) assignmentData.end_time = formData.end_time.trim();
      if (formData.end_date && formData.end_date !== formData.shift_date) {
        assignmentData.end_date = formData.end_date.trim();
      }
      if (formData.is_driver_duty) assignmentData.is_driver_duty = true;
      if (formData.healmedy_location_id) {
        assignmentData.healmedy_location_id = formData.healmedy_location_id.trim();
      }
      
      await shiftsAPI.createAssignment(assignmentData);
      toast.success('Vardiya ataması oluşturuldu');
      setDialogOpen(false);
      
      // Formu sıfırla
      setFormData({
        user_id: '',
        vehicle_id: '',
        location_type: 'arac',
        health_center_name: '',
        shift_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '08:00',
        end_date: getDefaultEndDate(),
        is_driver_duty: false,
        healmedy_location_id: '',
        shift_type: 'saha_24'
      });
      
      loadAssignments(selectedDate);
    } catch (error) {
      const detail = error.response?.data?.detail;
      let errorMessage = 'Atama oluşturulamadı';
      if (typeof detail === 'string') errorMessage = detail;
      else if (Array.isArray(detail)) {
        errorMessage = detail.map(err => err.msg || JSON.stringify(err)).join('; ');
      }
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu atamayı silmek istediğinizden emin misiniz?')) return;
    
    try {
      await shiftsAPI.deleteAssignment(id);
      toast.success('Atama silindi');
      loadAssignments(selectedDate);
    } catch (error) {
      toast.error('Atama silinemedi');
    }
  };

  const handleStartShift = async (id, userName) => {
    if (!confirm(`${userName || 'Bu kişi'} için vardiyayı başlatmak istediğinizden emin misiniz?`)) return;
    
    try {
      const response = await shiftsAPI.startAssignmentByAdmin(id);
      toast.success(response.data.message || 'Vardiya başarıyla başlatıldı');
      loadAssignments(selectedDate);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Vardiya başlatılamadı');
    }
  };

  const handleEndShift = async (id, userName) => {
    if (!confirm(`${userName || 'Bu kişi'} için vardiyayı bitirmek istediğinizden emin misiniz?`)) return;
    
    try {
      const response = await shiftsAPI.endAssignmentByAdmin(id);
      toast.success(response.data.message || 'Vardiya başarıyla bitirildi');
      loadAssignments(selectedDate);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Vardiya bitirilemedi');
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    started: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    pending: 'Bekliyor',
    started: 'Aktif',
    completed: 'Tamamlandı',
    cancelled: 'İptal'
  };

  const roleLabels = {
    sofor: 'Şoför',
    bas_sofor: 'Baş Şoför',
    hemsire: 'Hemşire',
    doktor: 'Doktor',
    paramedik: 'Paramedik',
    att: 'ATT',
    merkez_ofis: 'Merkez Ofis',
    operasyon_muduru: 'Op. Müdürü',
    cagri_merkezi: 'Çağrı Merkezi'
  };

  const getRoleLabel = (role) => roleLabels[role] || role;

  const canManage = ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'].includes(user?.role);

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-red-500">Bu sayfayı görüntüleme yetkiniz yok.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Seçili tarihin bilgileri
  const selectedDateObj = new Date(selectedDate);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const dayName = selectedDateObj.toLocaleDateString('tr-TR', { weekday: 'long' });
  const dateFormatted = selectedDateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Atamaları araca göre grupla
  const groupedAssignments = assignments.reduce((acc, a) => {
    const key = a.vehicle_plate || a.vehicle_id || a.health_center_name || 'Diğer';
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4" data-testid="shift-assignments-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vardiya Yönetimi</h1>
          <p className="text-gray-500 text-sm">Günlük vardiya atamaları</p>
        </div>
        <div className="flex gap-2">
          {/* Excel Toplu Yükleme */}
          <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Excel ile Toplu Vardiya Atama</DialogTitle>
                <DialogDescription>
                  Excel dosyası yükleyerek birden fazla vardiya ataması yapabilirsiniz.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 mb-2">Önce şablon dosyasını indirin ve doldurun.</p>
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Şablon İndir
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Excel Dosyası Seçin</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      setExcelFile(e.target.files[0]);
                      setExcelResults(null);
                    }}
                  />
                </div>
                {excelFile && (
                  <Button onClick={handleExcelUpload} disabled={excelUploading} className="w-full">
                    {excelUploading ? 'Yükleniyor...' : <><Upload className="h-4 w-4 mr-2" />Dosyayı Yükle</>}
                  </Button>
                )}
                {excelResults && (
                  <div className="space-y-3 mt-4">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span>{excelResults.successful_count} Başarılı</span>
                      </div>
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span>{excelResults.error_count} Hatalı</span>
                      </div>
                    </div>
                    {excelResults.errors?.length > 0 && (
                      <div className="bg-red-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                        <p className="text-sm font-medium text-red-800 mb-1">Hatalar:</p>
                        {excelResults.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-700">Satır {e.row}: {e.error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Yeni Atama */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Yeni Atama
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Vardiya Ataması Oluştur</DialogTitle>
                <DialogDescription>24 saat vardiya: 08:00 - ertesi gün 08:00</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Kullanıcı *</Label>
                  <Select value={formData.user_id} onValueChange={(v) => setFormData(prev => ({...prev, user_id: v}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kullanıcı seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id || u._id} value={u.id || u._id}>
                          {u.name} ({getRoleLabel(u.role)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lokasyon Tipi *</Label>
                    <Select value={formData.location_type} onValueChange={(v) => {
                      setFormData(prev => ({
                        ...prev, 
                        location_type: v,
                        vehicle_id: v === 'arac' ? prev.vehicle_id : ''
                      }));
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arac">Araç</SelectItem>
                        <SelectItem value="saglik_merkezi">Sağlık Merkezi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.location_type === 'arac' && (
                    <div className="space-y-2">
                      <Label>Araç *</Label>
                      <Select value={formData.vehicle_id} onValueChange={(v) => setFormData(prev => ({...prev, vehicle_id: v}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Araç seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id || v._id} value={v.id || v._id}>
                              {v.plate}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {healmedyLocations.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Building className="h-4 w-4" />
                      Görev Lokasyonu
                    </Label>
                    <Select 
                      value={formData.healmedy_location_id || 'none'} 
                      onValueChange={(v) => setFormData(prev => ({...prev, healmedy_location_id: v === 'none' ? '' : v}))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Lokasyon seçin (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Belirtilmemiş</SelectItem>
                        {healmedyLocations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3" />
                              {loc.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vardiya Tarihi *</Label>
                    <Input
                      type="date"
                      value={formData.shift_date}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        const nextDay = new Date(newDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        setFormData(prev => ({
                          ...prev, 
                          shift_date: newDate,
                          end_date: nextDay.toISOString().split('T')[0]
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitiş Günü</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Başlangıç</Label>
                    <Input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({...prev, start_time: e.target.value}))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitiş</Label>
                    <Input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({...prev, end_time: e.target.value}))}
                    />
                  </div>
                </div>

                {/* Şoför Görevi */}
                {(() => {
                  const selectedUser = users.find(u => (u.id || u._id) === formData.user_id);
                  if (selectedUser && ['att', 'paramedik', 'hemsire'].includes(selectedUser.role?.toLowerCase())) {
                    return (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="is_driver_duty"
                            checked={formData.is_driver_duty}
                            onChange={(e) => setFormData(prev => ({...prev, is_driver_duty: e.target.checked}))}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="is_driver_duty" className="text-sm text-yellow-800">
                            🚗 Bu vardiyada şoför görevi de var
                          </Label>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <Button onClick={handleCreate} className="w-full">Vardiya Ata</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tarih Seçici */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
                <div className="hidden sm:block">
                  <span className={`font-semibold ${isToday ? 'text-green-600' : 'text-gray-900'}`}>
                    {isToday ? '📍 Bugün - ' : ''}{dayName}, {dateFormatted}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={goToToday}>
                  Bugün
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isToday ? 'default' : 'secondary'} className="text-sm">
                {assignments.length} atama
              </Badge>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => loadAssignments(selectedDate)}
                disabled={assignmentsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${assignmentsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tablo Görünümü */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          {assignmentsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Bu gün için atama yok</p>
              <p className="text-gray-400 text-sm">Yeni atama eklemek için "Yeni Atama" butonunu kullanın</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-sm font-semibold text-gray-600">Araç</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-600">Personel</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-600">Görev</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-600">Saat</th>
                    <th className="text-left p-3 text-sm font-semibold text-gray-600">Durum</th>
                    <th className="text-right p-3 text-sm font-semibold text-gray-600">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(groupedAssignments).map(([vehicle, vehicleAssignments]) => (
                    vehicleAssignments.map((a, idx) => (
                      <tr 
                        key={a.id || a._id} 
                        className={`hover:bg-gray-50 ${idx === 0 ? 'border-t-2 border-t-blue-100' : ''}`}
                      >
                        {/* Araç - sadece ilk satırda göster */}
                        {idx === 0 ? (
                          <td className="p-3 align-top" rowSpan={vehicleAssignments.length}>
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Truck className="h-5 w-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-bold text-gray-900">{vehicle}</p>
                                <p className="text-xs text-gray-500">{vehicleAssignments.length} kişi</p>
                              </div>
                            </div>
                          </td>
                        ) : null}
                        
                        {/* Personel */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                              {(a.user_name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{a.user_name || 'Bilinmiyor'}</p>
                              <p className="text-xs text-gray-500">{getRoleLabel(a.user_role)}</p>
                            </div>
                          </div>
                        </td>
                        
                        {/* Görev Lokasyonu */}
                        <td className="p-3">
                          {a.healmedy_location_name ? (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {a.healmedy_location_name}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                        
                        {/* Saat */}
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span>{a.start_time || '08:00'} - {a.end_time || '08:00'}</span>
                            {a.end_date && a.end_date !== a.shift_date && (
                              <Badge variant="secondary" className="text-xs ml-1">+1g</Badge>
                            )}
                          </div>
                        </td>
                        
                        {/* Durum */}
                        <td className="p-3">
                          <Badge className={statusColors[a.status]}>
                            {statusLabels[a.status]}
                          </Badge>
                        </td>
                        
                        {/* İşlemler */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {a.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:bg-green-50"
                                  onClick={() => handleStartShift(a.id || a._id, a.user_name)}
                                  title="Başlat"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:bg-red-50"
                                  onClick={() => handleDelete(a.id || a._id)}
                                  title="Sil"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {a.status === 'started' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() => handleEndShift(a.id || a._id, a.user_name)}
                                title="Bitir"
                              >
                                <Square className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftAssignments;
