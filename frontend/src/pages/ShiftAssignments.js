import React, { useEffect, useState } from 'react';
import { shiftsAPI, usersAPI, vehiclesAPI, locationsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, User, Truck, Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Play, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Building } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ShiftAssignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [ganttDate, setGanttDate] = useState(new Date());
  const [formData, setFormData] = useState({
    user_id: '',
    vehicle_id: '',
    location_type: 'arac',
    health_center_name: '',
    shift_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    end_date: new Date().toISOString().split('T')[0],
    is_driver_duty: false,  // Şoför görevi var mı? (ATT/Paramedik için)
    healmedy_location_id: ''  // YENİ: Healmedy lokasyonu
  });
  
  // Healmedy lokasyonları
  const [healmedyLocations, setHealmedyLocations] = useState([]);
  
  // Excel toplu yükleme state'leri
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResults, setExcelResults] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsRes, usersRes, vehiclesRes, locationsRes] = await Promise.all([
        shiftsAPI.getAllAssignments(),
        usersAPI.getAll(),
        vehiclesAPI.getAll(),
        locationsAPI.getHealmedy().catch(() => ({ data: [] }))  // Healmedy lokasyonları
      ]);
      
      // Healmedy lokasyonlarını ayarla
      if (Array.isArray(locationsRes.data)) {
        setHealmedyLocations(locationsRes.data);
      }
      
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      const allVehicles = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];
      const assignmentsData = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
      
      // Enrich assignments
      const enrichedAssignments = assignmentsData.map(assignment => {
        // Ensure assignment is an object
        if (!assignment || typeof assignment !== 'object') {
          console.warn('Invalid assignment data:', assignment);
          return null;
        }
        
        const assignedUser = allUsers.find(u => (u.id || u._id) === assignment.user_id);
        const assignedVehicle = assignment.vehicle_id ? allVehicles.find(v => (v.id || v._id) === assignment.vehicle_id) : null;
        
        return {
          ...assignment,
          user_name: assignedUser?.name || 'Bilinmiyor',
          user_role: assignedUser?.role || '-',
          vehicle_plate: assignedVehicle?.plate || null
        };
      }).filter(Boolean); // Remove null entries
      
      setAssignments(enrichedAssignments);
      
      const fieldUsers = allUsers.filter(u => 
        ['sofor', 'bas_sofor', 'paramedik', 'att', 'hemsire', 'doktor'].includes(u.role)
      );
      setUsers(fieldUsers);
      setVehicles(allVehicles);
    } catch (error) {
      console.error('Error loading data:', error);
      
      // Safe error message extraction
      let errorMsg = 'Veriler yüklenemedi';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map(err => typeof err === 'string' ? err : (err.msg || JSON.stringify(err))).join(', ');
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || detail.message || JSON.stringify(detail);
        }
      } else if (error.message && typeof error.message === 'string') {
        errorMsg = error.message;
      }
      
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Excel şablon indirme
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/shifts/bulk-upload/template`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Şablon indirilemedi');
      }
      
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
      console.error('Template download error:', error);
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
      const formData = new FormData();
      formData.append('file', excelFile);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/shifts/bulk-upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const results = await response.json();
      
      if (response.ok) {
        setExcelResults(results);
        if (results.successful_count > 0) {
          toast.success(`${results.successful_count} atama başarıyla oluşturuldu`);
          loadData();
        }
        if (results.error_count > 0) {
          toast.warning(`${results.error_count} satırda hata oluştu`);
        }
      } else {
        toast.error(results.detail || 'Yükleme başarısız');
      }
    } catch (error) {
      console.error('Excel upload error:', error);
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
      // If end_date is same as shift_date, don't send it (or send null)
      const endDate = formData.end_date && formData.end_date !== formData.shift_date 
        ? formData.end_date 
        : undefined;
      
      // Validate required fields
      if (!formData.user_id || formData.user_id.trim() === '') {
        toast.error('Lütfen kullanıcı seçin');
        return;
      }
      
      if (!formData.shift_date || formData.shift_date.trim() === '') {
        toast.error('Lütfen vardiya tarihi seçin');
        return;
      }
      
      // Build assignment data - only include fields that have values
      const assignmentData = {
        user_id: formData.user_id.trim(),
        shift_date: formData.shift_date.trim(),
        location_type: (formData.location_type || 'arac').trim()
      };
      
      // Only add optional fields if they have values
      if (formData.location_type === 'arac' && formData.vehicle_id && formData.vehicle_id.trim() !== '') {
        assignmentData.vehicle_id = formData.vehicle_id.trim();
      }
      
      if (formData.location_type === 'saglik_merkezi') {
        assignmentData.health_center_name = 'Sağlık Merkezi';
      }
      
      if (formData.start_time && formData.start_time.trim() !== '') {
        assignmentData.start_time = formData.start_time.trim();
      }
      
      if (formData.end_time && formData.end_time.trim() !== '') {
        assignmentData.end_time = formData.end_time.trim();
      }
      
      if (endDate && endDate.trim() !== '') {
        assignmentData.end_date = endDate.trim();
      }
      
      // Şoför görevi (ATT/Paramedik/Hemşire için)
      if (formData.is_driver_duty) {
        assignmentData.is_driver_duty = true;
      }
      
      // Healmedy lokasyonu
      if (formData.healmedy_location_id && formData.healmedy_location_id.trim() !== '') {
        assignmentData.healmedy_location_id = formData.healmedy_location_id.trim();
      }
      
      // Remove undefined values to avoid sending them
      Object.keys(assignmentData).forEach(key => {
        if (assignmentData[key] === undefined || assignmentData[key] === null) {
          delete assignmentData[key];
        }
      });
      
      console.log('Gönderilen atama verisi:', JSON.stringify(assignmentData, null, 2));
      await shiftsAPI.createAssignment(assignmentData);
      toast.success('Vardiya ataması oluşturuldu');
      setDialogOpen(false);
      setFormData({
        user_id: '',
        vehicle_id: '',
        location_type: 'arac',
        health_center_name: '',
        shift_date: new Date().toISOString().split('T')[0],
        start_time: '08:00',
        end_time: '16:00',
        end_date: new Date().toISOString().split('T')[0],
        is_driver_duty: false,
        healmedy_location_id: ''
      });
      loadData();
    } catch (error) {
      console.error('Atama hatası - Tam detay:', error);
      console.error('Atama hatası - Response:', error.response);
      console.error('Atama hatası - Data:', error.response?.data);
      console.error('Atama hatası - Tam hata:', error);
      console.error('Atama hatası - Detail:', JSON.stringify(error.response?.data?.detail, null, 2));
      console.error('Atama hatası - Detail Array:', error.response?.data?.detail);
      console.error('Atama hatası - Status:', error.response?.status);
      
      let errorMessage = 'Atama oluşturulamadı';
      
      // Handle Pydantic validation errors (can be array of objects)
      const detail = error.response?.data?.detail;
      console.log('Detail type:', typeof detail, 'Is array?', Array.isArray(detail));
      if (detail) {
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Pydantic validation errors come as array of objects
          console.log('Validation errors detail:', detail);
          errorMessage = detail.map(err => {
            if (typeof err === 'string') return err;
            // Format: {type, loc, msg, input}
            const field = err.loc && err.loc.length > 0 ? err.loc.join('.') : 'unknown';
            const msg = err.msg || err.message || 'Field error';
            return `${field}: ${msg}`;
          }).join('; ');
        } else if (typeof detail === 'object') {
          // Single validation error object
          if (detail.msg) {
            errorMessage = detail.msg;
          } else if (detail.message) {
            errorMessage = detail.message;
          } else {
            errorMessage = JSON.stringify(detail);
          }
        }
      } else if (error.response?.data?.message) {
        errorMessage = typeof error.response.data.message === 'string' 
          ? error.response.data.message 
          : JSON.stringify(error.response.data.message);
      } else if (error.message) {
        errorMessage = typeof error.message === 'string' 
          ? error.message 
          : JSON.stringify(error.message);
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu atamayı silmek istediğinizden emin misiniz?')) return;
    
    try {
      await shiftsAPI.deleteAssignment(id);
      toast.success('Atama silindi');
      loadData();
    } catch (error) {
      toast.error('Atama silinemedi');
    }
  };

  const handleStartShift = async (id, userName) => {
    if (!confirm(`${userName || 'Bu kişi'} için vardiyayı başlatmak istediğinizden emin misiniz?`)) return;
    
    try {
      const response = await shiftsAPI.startAssignmentByAdmin(id);
      toast.success(response.data.message || 'Vardiya başarıyla başlatıldı');
      loadData();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Vardiya başlatılamadı';
      toast.error(errorMessage);
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    started: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    pending: 'Bekliyor',
    started: 'Başladı',
    completed: 'Tamamlandı',
    cancelled: 'İptal'
  };

  // Rol isimlerini Türkçeleştirme
  const roleLabels = {
    sofor: 'Şoför',
    bas_sofor: 'Baş Şoför',
    hemsire: 'Hemşire',
    doktor: 'Doktor',
    paramedik: 'Paramedik',
    att: 'ATT',
    merkez_ofis: 'Merkez Ofis',
    operasyon_muduru: 'Operasyon Müdürü',
    cagri_merkezi: 'Çağrı Merkezi'
  };

  // Rol ismini Türkçe olarak döndür
  const getRoleLabel = (role) => {
    return roleLabels[role] || role;
  };

  // Gün farkını hesapla
  const calculateDayDiff = (startDate, endDate) => {
    if (!endDate || endDate === startDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  };

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

  const getUserName = (userId) => {
    const u = users.find(user => user.id === userId);
    return u ? u.name : userId;
  };

  const getVehiclePlate = (vehicleId) => {
    const v = vehicles.find(vehicle => vehicle.id === vehicleId);
    return v ? v.plate : vehicleId;
  };

  return (
    <div className="space-y-6" data-testid="shift-assignments-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vardiya Yönetimi</h1>
          <p className="text-gray-500">Vardiya atamaları ve aylık planlama</p>
        </div>
        <div className="flex gap-2">
          {/* Excel Toplu Yükleme */}
          <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel ile Toplu Atama
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
                  <p className="text-sm text-blue-800 mb-2">
                    Önce şablon dosyasını indirin ve doldurun.
                  </p>
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
          
          {/* Tek Tek Atama */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-assignment-button">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Atama
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vardiya Ataması Oluştur</DialogTitle>
              <DialogDescription>
                Yeni bir vardiya ataması oluşturun. Tüm zorunlu alanları doldurun.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kullanıcı *</Label>
                <Select value={formData.user_id} onValueChange={(v) => setFormData(prev => ({...prev, user_id: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kullanıcı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => {
                      const userId = u.id || u._id;
                      return (
                        <SelectItem key={userId} value={userId}>
                          {u.name} ({u.role})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lokasyon Tipi *</Label>
                <Select value={formData.location_type} onValueChange={(v) => {
                  setFormData(prev => ({
                    ...prev, 
                    location_type: v,
                    health_center_name: v === 'saglik_merkezi' ? 'Sağlık Merkezi' : prev.health_center_name,
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
                      {vehicles.map(v => {
                        const vehicleId = v.id || v._id;
                        return (
                          <SelectItem key={vehicleId} value={vehicleId}>
                            {v.plate}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* YENİ: Healmedy Lokasyonu Seçimi */}
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
                <p className="text-xs text-gray-500">
                  Aracın görev yapacağı saha lokasyonu (örn: Green Zone, Osman Gazi/FPU)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Vardiya Tarihi *</Label>
                <Input
                  type="date"
                  value={formData.shift_date}
                  onChange={(e) => setFormData(prev => ({...prev, shift_date: e.target.value}))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Başlangıç Saati *</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({...prev, start_time: e.target.value}))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş Saati *</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({...prev, end_time: e.target.value}))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bitiş Günü</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({...prev, end_date: e.target.value}))}
                />
                <p className="text-xs text-gray-500">Gece vardiyaları için ertesi gün seçin</p>
              </div>

              {/* Şoför Görevi - Sadece ATT/Paramedik/Hemşire için */}
              {(() => {
                const selectedUser = users.find(u => (u.id || u._id) === formData.user_id);
                if (selectedUser && ['att', 'paramedik', 'hemsire'].includes(selectedUser.role?.toLowerCase())) {
                  return (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is_driver_duty"
                          checked={formData.is_driver_duty}
                          onChange={(e) => setFormData(prev => ({...prev, is_driver_duty: e.target.checked}))}
                          className="h-4 w-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                        />
                        <Label htmlFor="is_driver_duty" className="font-medium text-yellow-800">
                          🚗 Bu vardiyada şoför görevi de var mı?
                        </Label>
                      </div>
                      <p className="text-xs text-yellow-700 pl-6">
                        İşaretlenirse: Araç Devir Formu + Günlük Kontrol Formu doldurulacak
                      </p>
                      <p className="text-xs text-yellow-700 pl-6">
                        İşaretlenmezse: Sadece Günlük Kontrol Formu doldurulacak
                      </p>
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

      <Tabs defaultValue="atamalar" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="atamalar">Vardiya Atama</TabsTrigger>
          <TabsTrigger value="aylik">Aylık Vardiya</TabsTrigger>
        </TabsList>

        <TabsContent value="atamalar" className="space-y-6 mt-6">
          <div className="grid gap-4">
            {assignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">Henüz atama yapılmamış</p>
                </CardContent>
              </Card>
            ) : (
              assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={statusColors[assignment.status]}>
                        {statusLabels[assignment.status]}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(assignment.shift_date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{assignment.user_name || getUserName(assignment.user_id)}</span>
                        <Badge variant="outline" className="text-xs bg-gray-50">
                          {getRoleLabel(assignment.user_role || users.find(u => (u.id || u._id) === assignment.user_id)?.role || '-')}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {assignment.location_type === 'arac' ? (
                          <>
                            <Truck className="h-4 w-4 text-gray-400" />
                            <span>{assignment.vehicle_plate || getVehiclePlate(assignment.vehicle_id)}</span>
                          </>
                        ) : (
                          <>
                            <span className="h-4 w-4 text-gray-400">🏥</span>
                            <span>{assignment.health_center_name || 'Sağlık Merkezi'}</span>
                          </>
                        )}
                      </div>
                      {(assignment.start_time || assignment.end_time) && (
                        <div className="flex items-center space-x-2">
                          <span className="h-4 w-4 text-gray-400">🕐</span>
                          <span>
                            {assignment.start_time || '08:00'} - {assignment.end_time || '16:00'}
                            {(() => {
                              const dayDiff = calculateDayDiff(assignment.shift_date, assignment.end_date);
                              return dayDiff ? (
                                <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-700">
                                  +{dayDiff} gün
                                </Badge>
                              ) : null;
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {assignment.status === 'pending' && (
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartShift(assignment.id, assignment.user_name)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Vardiya Başlat"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(assignment.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {assignment.status === 'started' && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      Aktif
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="aylik" className="mt-6 space-y-6">
          {/* Günlük Gantt Chart - Modern Tasarım */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xl font-bold">Günlük Vardiya Planı</span>
                    <p className="text-blue-100 text-sm font-normal mt-1">
                      {ganttDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </CardTitle>
                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => {
                      const prevDay = new Date(ganttDate);
                      prevDay.setDate(prevDay.getDate() - 1);
                      setGanttDate(prevDay);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0 px-4"
                    onClick={() => setGanttDate(new Date())}
                  >
                    Bugün
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => {
                      const nextDay = new Date(ganttDate);
                      nextDay.setDate(nextDay.getDate() + 1);
                      setGanttDate(nextDay);
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {(() => {
                const ganttDateOnly = new Date(ganttDate.getFullYear(), ganttDate.getMonth(), ganttDate.getDate());
                
                // Get assignments for this day (including multi-day assignments)
                const dayAssignments = assignments.filter(a => {
                  const assignDate = new Date(a.shift_date);
                  const assignDateOnly = new Date(assignDate.getFullYear(), assignDate.getMonth(), assignDate.getDate());
                  
                  if (assignDateOnly.getTime() === ganttDateOnly.getTime()) return true;
                  
                  if (a.end_date) {
                    const endDate = new Date(a.end_date);
                    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                    if (ganttDateOnly >= assignDateOnly && ganttDateOnly <= endDateOnly) return true;
                  }
                  return false;
                });
                
                if (dayAssignments.length === 0) {
                  return (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <Calendar className="h-10 w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-lg">Bu gün için atama yok</p>
                      <p className="text-gray-400 text-sm mt-1">Yeni atama eklemek için "Yeni Atama" butonunu kullanın</p>
                    </div>
                  );
                }
                
                const timeToMinutes = (timeStr) => {
                  if (!timeStr) return 0;
                  const [hours, minutes] = timeStr.split(':').map(Number);
                  return hours * 60 + minutes;
                };
                
                // Fixed 24-hour range for consistent display
                const minTime = 0; // 00:00
                const maxTime = 24 * 60; // 24:00
                const timeRange = maxTime - minTime;
                
                // Hour markers every 2 hours
                const hourMarkers = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map(h => h * 60);
                
                // Color palette for different users
                const colors = [
                  'bg-gradient-to-r from-blue-500 to-blue-600',
                  'bg-gradient-to-r from-emerald-500 to-emerald-600',
                  'bg-gradient-to-r from-violet-500 to-violet-600',
                  'bg-gradient-to-r from-amber-500 to-amber-600',
                  'bg-gradient-to-r from-rose-500 to-rose-600',
                  'bg-gradient-to-r from-cyan-500 to-cyan-600',
                ];
                
                return (
                  <div className="space-y-4">
                    {/* Time header */}
                    <div className="flex items-center">
                      <div className="w-44 flex-shrink-0"></div>
                      <div className="flex-1 relative h-8 border-b border-gray-200">
                        {hourMarkers.map((hourMinutes, i) => {
                          const position = (hourMinutes / timeRange) * 100;
                          const hour = hourMinutes / 60;
                          return (
                            <div 
                              key={hourMinutes}
                              className="absolute flex flex-col items-center"
                              style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                            >
                              <span className="text-xs font-medium text-gray-500">
                                {String(hour).padStart(2, '0')}:00
                              </span>
                              <div className="w-px h-2 bg-gray-300 mt-1"></div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Gantt bars */}
                    <div className="space-y-3">
                      {dayAssignments
                        .sort((a, b) => (a.start_time || '08:00').localeCompare(b.start_time || '08:00'))
                        .map((assignment, idx) => {
                          const startMinutes = timeToMinutes(assignment.start_time || '08:00');
                          const endMinutes = timeToMinutes(assignment.end_time || '16:00');
                          const duration = endMinutes - startMinutes;
                          const left = (startMinutes / timeRange) * 100;
                          const width = (duration / timeRange) * 100;
                          
                          const userName = assignment.user_name || users.find(u => (u.id || u._id) === assignment.user_id)?.name || 'Kullanıcı';
                          const userRole = assignment.user_role || users.find(u => (u.id || u._id) === assignment.user_id)?.role || '-';
                          const location = assignment.location_type === 'arac' 
                            ? (assignment.vehicle_plate || vehicles.find(v => (v.id || v._id) === assignment.vehicle_id)?.plate || 'Araç')
                            : '🏥 Sağlık Merkezi';
                          
                          return (
                            <div key={idx} className="flex items-center group">
                              {/* User info */}
                              <div className="w-44 flex-shrink-0 pr-4">
                                <div className="flex items-center space-x-3">
                                  {assignment.profile_photo ? (
                                    <img src={assignment.profile_photo} alt={userName} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-md" />
                                  ) : (
                                    <div className={`w-10 h-10 rounded-full ${colors[idx % colors.length]} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                                      {userName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 truncate text-sm">{userName}</p>
                                    <p className="text-xs text-gray-500">{getRoleLabel(userRole)}</p>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Timeline bar */}
                              <div className="flex-1 relative h-12 bg-gray-50 rounded-lg overflow-hidden border border-gray-100">
                                {/* Grid lines */}
                                {hourMarkers.map(hourMinutes => (
                                  <div 
                                    key={hourMinutes}
                                    className="absolute top-0 bottom-0 w-px bg-gray-100"
                                    style={{ left: `${(hourMinutes / timeRange) * 100}%` }}
                                  />
                                ))}
                                
                                {/* Assignment bar */}
                                <div
                                  className={`absolute top-1 bottom-1 ${colors[idx % colors.length]} rounded-md shadow-sm flex items-center justify-center text-white transition-all duration-200 group-hover:shadow-lg group-hover:scale-[1.02]`}
                                  style={{
                                    left: `${left}%`,
                                    width: `${Math.max(width, 5)}%`,
                                  }}
                                >
                                  <div className="text-center px-2 truncate">
                                    <div className="text-xs font-semibold">
                                      {assignment.start_time || '08:00'} - {assignment.end_time || '16:00'}
                                    </div>
                                    <div className="text-xs opacity-90 truncate">{location}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-1.5"></div>
                          Toplam {dayAssignments.length} atama
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Aylık Takvim - Modern Tasarım */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xl font-bold">Aylık Vardiya Takvimi</span>
                    <p className="text-emerald-100 text-sm font-normal mt-1">
                      {new Date(currentYear, currentMonth).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </CardTitle>
                <div className="flex space-x-2">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => {
                      if (currentMonth === 0) {
                        setCurrentMonth(11);
                        setCurrentYear(currentYear - 1);
                      } else {
                        setCurrentMonth(currentMonth - 1);
                      }
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0 px-4"
                    onClick={() => {
                      setCurrentMonth(new Date().getMonth());
                      setCurrentYear(new Date().getFullYear());
                    }}
                  >
                    Bu Ay
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => {
                      if (currentMonth === 11) {
                        setCurrentMonth(0);
                        setCurrentYear(currentYear + 1);
                      } else {
                        setCurrentMonth(currentMonth + 1);
                      }
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {[
                  { short: 'Pzt', full: 'Pazartesi' },
                  { short: 'Sal', full: 'Salı' },
                  { short: 'Çar', full: 'Çarşamba' },
                  { short: 'Per', full: 'Perşembe' },
                  { short: 'Cum', full: 'Cuma' },
                  { short: 'Cmt', full: 'Cumartesi' },
                  { short: 'Paz', full: 'Pazar' }
                ].map((day, i) => (
                  <div 
                    key={day.short} 
                    className={`p-3 text-center font-semibold rounded-lg ${
                      i >= 5 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="hidden sm:inline">{day.full}</span>
                    <span className="sm:hidden">{day.short}</span>
                  </div>
                ))}
                {(() => {
                  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
                  const adjustedFirstDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
                  const today = new Date();
                  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
                  
                  // Empty cells
                  const emptyCells = Array.from({ length: adjustedFirstDay }, (_, i) => (
                    <div key={`empty-${i}`} className="p-2 min-h-[100px] bg-gray-25 rounded-lg border border-dashed border-gray-200"></div>
                  ));
                  
                  // Day cells
                  const dayCells = Array.from({length: daysInMonth}, (_, i) => {
                    const day = i + 1;
                    const dayOfWeek = (adjustedFirstDay + i) % 7;
                    const isWeekend = dayOfWeek >= 5;
                    const isToday = isCurrentMonth && today.getDate() === day;
                    
                    const dayAssignments = assignments.filter(a => {
                      const assignDate = new Date(a.shift_date);
                      const assignDateOnly = new Date(assignDate.getFullYear(), assignDate.getMonth(), assignDate.getDate());
                      const currentDateOnly = new Date(currentYear, currentMonth, day);
                      
                      if (assignDateOnly.getTime() === currentDateOnly.getTime()) return true;
                      
                      if (a.end_date) {
                        const endDate = new Date(a.end_date);
                        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
                        if (currentDateOnly >= assignDateOnly && currentDateOnly <= endDateOnly) return true;
                      }
                      return false;
                    });
                    
                    const hasAssignments = dayAssignments.length > 0;
                    
                    return (
                      <div 
                        key={day}
                        onClick={() => {
                          setSelectedDay({ day, month: currentMonth, year: currentYear, assignments: dayAssignments });
                          setDayDetailOpen(true);
                          setGanttDate(new Date(currentYear, currentMonth, day));
                        }}
                        className={`
                          relative p-2 min-h-[100px] rounded-lg border-2 transition-all duration-200 cursor-pointer
                          ${isToday ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-transparent'}
                          ${hasAssignments && !isToday ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' : ''}
                          ${!hasAssignments && !isToday ? 'bg-white hover:bg-gray-50 border-gray-100 hover:border-gray-300' : ''}
                          ${isWeekend && !hasAssignments && !isToday ? 'bg-red-25' : ''}
                        `}
                      >
                        {/* Day number */}
                        <div className={`
                          inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mb-2
                          ${isToday ? 'bg-blue-600 text-white' : ''}
                          ${isWeekend && !isToday ? 'text-red-500' : ''}
                          ${!isWeekend && !isToday ? 'text-gray-700' : ''}
                        `}>
                          {day}
                        </div>
                        
                        {/* Assignments preview */}
                        <div className="space-y-1">
                          {hasAssignments ? (
                            <>
                              {dayAssignments.slice(0, 2).map((a, idx) => {
                                const userName = a.user_name || users.find(u => (u.id || u._id) === a.user_id)?.name || '?';
                                return (
                                  <div 
                                    key={idx}
                                    className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 truncate font-medium"
                                  >
                                    {userName.split(' ')[0]}
                                  </div>
                                );
                              })}
                              {dayAssignments.length > 2 && (
                                <div className="text-xs px-2 py-0.5 text-emerald-600 font-semibold">
                                  +{dayAssignments.length - 2} daha
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-gray-300 text-center py-2">-</div>
                          )}
                        </div>
                        
                        {/* Assignment count badge */}
                        {hasAssignments && (
                          <div className="absolute top-1 right-1">
                            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-emerald-500 text-white rounded-full">
                              {dayAssignments.length}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  });
                  
                  return [...emptyCells, ...dayCells];
                })()}
              </div>
              
              {/* Summary */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5"></div>
                    Atama var
                  </span>
                  <span className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-1.5"></div>
                    Bugün
                  </span>
                </div>
                <span>
                  Toplam {assignments.filter(a => {
                    const date = new Date(a.shift_date);
                    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
                  }).length} atama
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Gün Detay Dialog - Modern Tasarım */}
          <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader className="border-b pb-4">
                <DialogTitle className="flex items-center space-x-3 text-xl">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    {selectedDay && (
                      <>
                        <span className="font-bold">
                          {new Date(selectedDay.year, selectedDay.month, selectedDay.day).toLocaleDateString('tr-TR', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </span>
                        <p className="text-sm text-gray-500 font-normal">
                          {selectedDay.assignments?.length || 0} vardiya ataması
                        </p>
                      </>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {selectedDay && selectedDay.assignments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDay.assignments
                      .sort((a, b) => (a.start_time || '08:00').localeCompare(b.start_time || '08:00'))
                      .map((assignment, idx) => {
                        const userName = assignment.user_name || users.find(u => (u.id || u._id) === assignment.user_id)?.name || 'Kullanıcı';
                        const userRole = assignment.user_role || users.find(u => (u.id || u._id) === assignment.user_id)?.role || '-';
                        const location = assignment.location_type === 'arac'
                          ? (assignment.vehicle_plate || vehicles.find(v => (v.id || v._id) === assignment.vehicle_id)?.plate || 'Araç')
                          : (assignment.health_center_name || 'Sağlık Merkezi');
                        const isHealthCenter = assignment.location_type !== 'arac';
                        const dayDiff = calculateDayDiff(assignment.shift_date, assignment.end_date);
                        
                        // Color based on index
                        const colors = ['blue', 'emerald', 'violet', 'amber', 'rose'];
                        const color = colors[idx % colors.length];
                        
                        return (
                          <div 
                            key={idx} 
                            className={`p-4 rounded-xl border-l-4 border-${color}-500 bg-gradient-to-r from-${color}-50 to-white shadow-sm hover:shadow-md transition-shadow`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-start space-x-3">
                                {assignment.profile_photo ? (
                                  <img src={assignment.profile_photo} alt={userName} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md" />
                                ) : (
                                  <div className={`w-12 h-12 rounded-full bg-${color}-500 flex items-center justify-center text-white font-bold shadow-md`}>
                                    {userName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-gray-900 text-lg">{userName}</p>
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {getRoleLabel(userRole)}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right space-y-1">
                                <div className="flex items-center justify-end space-x-2">
                                  {isHealthCenter ? (
                                    <Badge className="bg-pink-100 text-pink-700">🏥 {location}</Badge>
                                  ) : (
                                    <Badge className="bg-blue-100 text-blue-700">🚑 {location}</Badge>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-gray-700">
                                  🕐 {assignment.start_time || '08:00'} - {assignment.end_time || '16:00'}
                                </p>
                                {dayDiff && (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                                    +{dayDiff} gün ({new Date(assignment.end_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })})
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-lg">Bu gün için atama yok</p>
                    <p className="text-gray-400 text-sm mt-1">Yeni atama eklemek için "Yeni Atama" butonunu kullanın</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShiftAssignments;
