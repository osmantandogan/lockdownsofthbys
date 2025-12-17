import React, { useEffect, useState, useCallback } from 'react';
import { shiftsAPI, usersAPI, vehiclesAPI, locationsAPI } from '../api';
import { API_URL, BACKEND_URL } from '../config/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, User, Truck, Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Play, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Building, Square, RefreshCw, Check, X, History, Stethoscope, Car, Image } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ShiftAssignments = () => {
  const { user } = useAuth();
  
  // Ana sekme
  const [activeMainTab, setActiveMainTab] = useState('atamalar');
  
  // Seçili tarih - varsayılan bugün
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [healmedyLocations, setHealmedyLocations] = useState([]);
  
  // Excel toplu yükleme
  const [excelDialogOpen, setExcelDialogOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [excelResults, setExcelResults] = useState(null);
  
  // Toplu silme
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);
  
  // Onaylar için state'ler
  const [startApprovals, setStartApprovals] = useState([]);
  const [endApprovals, setEndApprovals] = useState([]);
  const [pendingHandovers, setPendingHandovers] = useState([]);
  const [approvalLogs, setApprovalLogs] = useState([]);
  const [approvalLogsLoading, setApprovalLogsLoading] = useState(false);
  const [approvalsTab, setApprovalsTab] = useState('start-approvals');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showPhotosDialog, setShowPhotosDialog] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(null);
  
  // Form state
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
    shift_type: 'saha_24',
    assigned_role: '' // Boş = kullanıcının kendi rolü
  });

  // Rol etiketleri
  const roleOptions = [
    { value: 'default', label: 'Varsayılan (Kendi Rolü)' },
    { value: 'doktor', label: 'Doktor' },
    { value: 'hemsire', label: 'Hemşire' },
    { value: 'paramedik', label: 'Paramedik' },
    { value: 'att', label: 'ATT' },
    { value: 'sofor', label: 'Şoför' },
    { value: 'bas_sofor', label: 'Baş Şoför' },
    { value: 'cagri_merkezi', label: 'Çağrı Merkezi' },
  ];

  // İlk yükleme
  useEffect(() => {
    loadBaseData();
  }, []);
  
  // Tarih değiştiğinde atamaları yükle
  useEffect(() => {
    if (users.length > 0) {
      loadAssignments(selectedDate);
    }
  }, [selectedDate, users]);
  
  // Onaylar sekmesi aktifse onayları yükle
  useEffect(() => {
    if (activeMainTab === 'onaylar') {
      loadApprovals();
    }
  }, [activeMainTab]);

  const loadBaseData = async () => {
    try {
      const [usersRes, vehiclesRes, locationsRes] = await Promise.all([
        usersAPI.getAll(),
        vehiclesAPI.getAll(),
        locationsAPI.getHealmedy().catch(() => ({ data: [] }))
      ]);
      
      if (Array.isArray(locationsRes.data)) setHealmedyLocations(locationsRes.data);
      
      const allUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
      const allVehicles = Array.isArray(vehiclesRes.data) ? vehiclesRes.data : [];
      const ambulances = allVehicles.filter(v => v.type === 'ambulans');
      
      const fieldUsers = allUsers.filter(u => 
        ['sofor', 'bas_sofor', 'paramedik', 'att', 'hemsire', 'doktor'].includes(u.role)
      );
      setUsers(fieldUsers);
      setVehicles(ambulances);
      
      await loadAssignments(selectedDate);
    } catch (error) {
      console.error('Error loading base data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = useCallback(async (date) => {
    setAssignmentsLoading(true);
    try {
      const response = await shiftsAPI.getAssignmentsByDate(date);
      setAssignments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading assignments:', error);
      toast.error('Atamalar yüklenemedi');
    } finally {
      setAssignmentsLoading(false);
    }
  }, []);
  
  // Onayları yükle
  const loadApprovals = async () => {
    try {
      const [startRes, endRes, handoverRes] = await Promise.all([
        shiftsAPI.getPendingStartApprovals().catch(() => ({ data: [] })),
        shiftsAPI.getPendingShiftApprovals().catch(() => ({ data: [] })),
        fetch(`${API_URL}/shifts/handover/pending-approvals`, { credentials: 'include' }).then(r => r.json()).catch(() => [])
      ]);
      
      setStartApprovals(startRes.data || []);
      setEndApprovals((endRes.data || []).filter(a => a.type === 'end'));
      setPendingHandovers(Array.isArray(handoverRes) ? handoverRes : []);
    } catch (error) {
      console.error('Error loading approvals:', error);
    }
  };
  
  const loadApprovalLogs = async () => {
    setApprovalLogsLoading(true);
    try {
      const [logsRes, handoverLogsRes] = await Promise.all([
        shiftsAPI.getShiftApprovalLogs({ date: selectedDate, limit: 100 }),
        fetch(`${API_URL}/shifts/handover/logs?date=${selectedDate}`, { credentials: 'include' }).then(r => r.json()).catch(() => [])
      ]);
      setApprovalLogs({ shiftLogs: logsRes.data || [], handoverLogs: handoverLogsRes || [] });
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setApprovalLogsLoading(false);
    }
  };

  const changeDate = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => setSelectedDate(new Date().toISOString().split('T')[0]);

  // Excel
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/shifts/bulk-upload/template`, { credentials: 'include' });
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

  const handleExcelUpload = async () => {
    if (!excelFile) { toast.error('Lütfen bir Excel dosyası seçin'); return; }
    setExcelUploading(true);
    setExcelResults(null);
    try {
      const uploadData = new FormData();
      uploadData.append('file', excelFile);
      const response = await fetch(`${BACKEND_URL}/api/shifts/bulk-upload`, { method: 'POST', credentials: 'include', body: uploadData });
      const results = await response.json();
      if (response.ok) {
        setExcelResults(results);
        if (results.successful_count > 0) { toast.success(`${results.successful_count} atama oluşturuldu`); loadAssignments(selectedDate); }
        if (results.error_count > 0) toast.warning(`${results.error_count} satırda hata`);
      } else toast.error(results.detail || 'Yükleme başarısız');
    } catch (error) { toast.error('Dosya yüklenirken hata'); } 
    finally { setExcelUploading(false); }
  };

  // Toplu silme
  const handleDeleteAll = async () => {
    setDeleteAllLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/shifts/assignments/delete-all`, { 
        method: 'DELETE', 
        credentials: 'include' 
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(`${result.deleted} vardiya silindi`);
        setAssignments([]);
        setDeleteAllDialogOpen(false);
      } else {
        toast.error(result.detail || 'Silme işlemi başarısız');
      }
    } catch (error) {
      toast.error('Silme işlemi sırasında hata oluştu');
    } finally {
      setDeleteAllLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.user_id) { toast.error('Kullanıcı seçin'); return; }
    if (formData.location_type === 'arac' && !formData.vehicle_id) { toast.error('Araç seçin'); return; }
    try {
      const assignmentData = { user_id: formData.user_id.trim(), shift_date: formData.shift_date.trim(), location_type: formData.location_type || 'arac' };
      if (formData.location_type === 'arac' && formData.vehicle_id) assignmentData.vehicle_id = formData.vehicle_id.trim();
      if (formData.location_type === 'saglik_merkezi') assignmentData.health_center_name = 'Sağlık Merkezi';
      if (formData.start_time) assignmentData.start_time = formData.start_time.trim();
      if (formData.end_time) assignmentData.end_time = formData.end_time.trim();
      if (formData.end_date && formData.end_date !== formData.shift_date) assignmentData.end_date = formData.end_date.trim();
      if (formData.is_driver_duty) assignmentData.is_driver_duty = true;
      if (formData.healmedy_location_id) assignmentData.healmedy_location_id = formData.healmedy_location_id.trim();
      if (formData.assigned_role) assignmentData.assigned_role = formData.assigned_role; // Geçici görev rolü
      
      await shiftsAPI.createAssignment(assignmentData);
      toast.success('Vardiya ataması oluşturuldu');
      setDialogOpen(false);
      setFormData({ user_id: '', vehicle_id: '', location_type: 'arac', health_center_name: '', shift_date: new Date().toISOString().split('T')[0], start_time: '08:00', end_time: '08:00', end_date: getDefaultEndDate(), is_driver_duty: false, healmedy_location_id: '', shift_type: 'saha_24', assigned_role: '' });
      loadAssignments(selectedDate);
    } catch (error) {
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Atama oluşturulamadı');
    }
  };

  const handleDelete = async (id) => { if (!confirm('Atamayı silmek istiyor musunuz?')) return; try { await shiftsAPI.deleteAssignment(id); toast.success('Atama silindi'); loadAssignments(selectedDate); } catch { toast.error('Silinemedi'); } };
  const handleStartShift = async (id, userName) => { if (!confirm(`${userName} için vardiyayı başlatmak istiyor musunuz?`)) return; try { await shiftsAPI.startAssignmentByAdmin(id); toast.success('Vardiya başlatıldı'); loadAssignments(selectedDate); } catch (e) { toast.error(e.response?.data?.detail || 'Başlatılamadı'); } };
  const handleEndShift = async (id, userName) => { if (!confirm(`${userName} için vardiyayı bitirmek istiyor musunuz?`)) return; try { await shiftsAPI.endAssignmentByAdmin(id); toast.success('Vardiya bitirildi'); loadAssignments(selectedDate); } catch (e) { toast.error(e.response?.data?.detail || 'Bitirilemedi'); } };

  // Onay işlemleri
  const handleApproveStart = async (id) => { try { await shiftsAPI.approveStartApproval(id); toast.success('Onaylandı'); loadApprovals(); } catch { toast.error('Onay başarısız'); } };
  const handleRejectStart = async (id, reason) => { try { await shiftsAPI.rejectStartApproval(id, reason || 'Belirtilmedi'); toast.success('Reddedildi'); loadApprovals(); } catch { toast.error('Red başarısız'); } };
  const handleApproveEnd = async (id) => { try { await shiftsAPI.approveShiftApproval(id); toast.success('Onaylandı'); loadApprovals(); } catch { toast.error('Onay başarısız'); } };
  const handleRejectEnd = async (id, reason) => { try { await shiftsAPI.rejectShiftApproval(id, reason || 'Belirtilmedi'); toast.success('Reddedildi'); loadApprovals(); } catch { toast.error('Red başarısız'); } };
  const handleApproveHandover = async (sessionId) => {
    try {
      await fetch(`${API_URL}/shifts/handover/${sessionId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ approve: true }) });
      toast.success('Devir teslim onaylandı'); loadApprovals();
    } catch { toast.error('Onay başarısız'); }
  };
  const handleRejectHandover = async () => {
    if (!selectedSession) return;
    try {
      await fetch(`${API_URL}/shifts/handover/${selectedSession.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ approve: false, rejection_reason: rejectReason }) });
      toast.success('Devir teslim reddedildi'); setShowRejectDialog(false); setRejectReason(''); setSelectedSession(null); loadApprovals();
    } catch { toast.error('Red başarısız'); }
  };
  const fetchShiftPhotos = async (shiftId) => {
    try {
      const response = await fetch(`${API_URL}/shifts/photos/${shiftId}`, { credentials: 'include' });
      if (response.ok) { const data = await response.json(); setSelectedPhotos(data); setShowPhotosDialog(true); }
    } catch { toast.error('Fotoğraflar yüklenemedi'); }
  };

  const statusColors = { pending: 'bg-yellow-100 text-yellow-800', started: 'bg-green-100 text-green-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-red-100 text-red-800' };
  const statusLabels = { pending: 'Bekliyor', started: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' };
  const roleLabels = { sofor: 'Şoför', bas_sofor: 'Baş Şoför', hemsire: 'Hemşire', doktor: 'Doktor', paramedik: 'Paramedik', att: 'ATT', merkez_ofis: 'Merkez Ofis', operasyon_muduru: 'Op. Müdürü', cagri_merkezi: 'Çağrı Merkezi' };
  const getRoleLabel = (role) => roleLabels[role] || role;
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const canManage = ['merkez_ofis', 'operasyon_muduru', 'bas_sofor', 'mesul_mudur'].includes(user?.role);
  if (!canManage) return <Card><CardContent className="py-12 text-center"><p className="text-red-500">Bu sayfayı görüntüleme yetkiniz yok.</p></CardContent></Card>;
  if (loading) return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const dateFormatted = new Date(selectedDate).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const groupedAssignments = assignments.reduce((acc, a) => { const key = a.vehicle_plate || a.vehicle_id || a.health_center_name || 'Diğer'; if (!acc[key]) acc[key] = []; acc[key].push(a); return acc; }, {});
  const totalApprovals = startApprovals.length + endApprovals.length + pendingHandovers.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vardiya Yönetimi</h1>
          <p className="text-gray-500 text-sm">Atamalar ve onaylar</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
            <DialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" />Tümünü Sil</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>⚠️ Tüm Vardiyaları Sil</DialogTitle></DialogHeader>
              <div className="py-4">
                <p className="text-red-600 font-medium mb-4">Bu işlem geri alınamaz!</p>
                <p className="text-gray-600">Sistemdeki TÜM vardiya atamalarını silmek istediğinizden emin misiniz?</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)}>İptal</Button>
                <Button variant="destructive" onClick={handleDeleteAll} disabled={deleteAllLoading}>
                  {deleteAllLoading ? 'Siliniyor...' : 'Evet, Tümünü Sil'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Excel ile Toplu Atama</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate}><Download className="h-4 w-4 mr-2" />Şablon İndir</Button>
                </div>
                <Input type="file" accept=".xlsx,.xls" onChange={(e) => { setExcelFile(e.target.files[0]); setExcelResults(null); }} />
                {excelFile && <Button onClick={handleExcelUpload} disabled={excelUploading} className="w-full">{excelUploading ? 'Yükleniyor...' : <><Upload className="h-4 w-4 mr-2" />Yükle</>}</Button>}
                {excelResults && <div className="flex gap-4"><div className="text-green-600"><CheckCircle className="h-5 w-5 inline" /> {excelResults.successful_count}</div><div className="text-red-600"><AlertCircle className="h-5 w-5 inline" /> {excelResults.error_count}</div></div>}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Yeni Atama</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Vardiya Ataması</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Kullanıcı *</Label><Select value={formData.user_id} onValueChange={(v) => setFormData(p => ({...p, user_id: v}))}><SelectTrigger><SelectValue placeholder="Kullanıcı seçin" /></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u.id || u._id} value={u.id || u._id}>{u.name} ({getRoleLabel(u.role)})</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Lokasyon</Label><Select value={formData.location_type} onValueChange={(v) => setFormData(p => ({...p, location_type: v, vehicle_id: v === 'arac' ? p.vehicle_id : ''}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="arac">Araç</SelectItem><SelectItem value="saglik_merkezi">Sağlık Merkezi</SelectItem></SelectContent></Select></div>
                  {formData.location_type === 'arac' && <div className="space-y-2"><Label>Araç *</Label><Select value={formData.vehicle_id} onValueChange={(v) => setFormData(p => ({...p, vehicle_id: v}))}><SelectTrigger><SelectValue placeholder="Araç" /></SelectTrigger><SelectContent>{vehicles.map(v => <SelectItem key={v.id || v._id} value={v.id || v._id}>{v.plate}</SelectItem>)}</SelectContent></Select></div>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Başlangıç</Label><Input type="date" value={formData.shift_date} onChange={(e) => { const d = e.target.value; const n = new Date(d); n.setDate(n.getDate() + 1); setFormData(p => ({...p, shift_date: d, end_date: n.toISOString().split('T')[0]})); }} /></div>
                  <div className="space-y-2"><Label>Bitiş Günü</Label><Input type="date" value={formData.end_date} onChange={(e) => setFormData(p => ({...p, end_date: e.target.value}))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Saat Başlangıç</Label><Input type="time" value={formData.start_time} onChange={(e) => setFormData(p => ({...p, start_time: e.target.value}))} /></div>
                  <div className="space-y-2"><Label>Saat Bitiş</Label><Input type="time" value={formData.end_time} onChange={(e) => setFormData(p => ({...p, end_time: e.target.value}))} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Görevlendirme Rolü</Label>
                  <Select value={formData.assigned_role} onValueChange={(v) => setFormData(p => ({...p, assigned_role: v}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Varsayılan (Kendi Rolü)" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">Personeli farklı bir rol ile görevlendirmek için seçin (örn: paramedik → şoför)</p>
                </div>
                <Button onClick={handleCreate} className="w-full">Ata</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Ana Sekmeler */}
      <div className="flex gap-1 border-b">
        <button className={`px-4 py-2 font-medium ${activeMainTab === 'atamalar' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setActiveMainTab('atamalar')}>📋 Atamalar</button>
        <button className={`px-4 py-2 font-medium ${activeMainTab === 'onaylar' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`} onClick={() => setActiveMainTab('onaylar')}>✅ Onaylar {totalApprovals > 0 && <Badge className="ml-1 bg-red-500">{totalApprovals}</Badge>}</button>
      </div>

      {/* ATAMALAR SEKMESİ */}
      {activeMainTab === 'atamalar' && (
        <div className="space-y-4">
          {/* Tarih Seçici */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-40" />
                  <Button variant="outline" size="icon" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
                  {!isToday && <Button variant="ghost" size="sm" onClick={goToToday}>Bugün</Button>}
                  <span className={`hidden sm:inline font-medium ${isToday ? 'text-green-600' : ''}`}>{isToday ? '📍 ' : ''}{dateFormatted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isToday ? 'default' : 'secondary'}>{assignments.length} atama</Badge>
                  <Button variant="ghost" size="icon" onClick={() => loadAssignments(selectedDate)} disabled={assignmentsLoading}><RefreshCw className={`h-4 w-4 ${assignmentsLoading ? 'animate-spin' : ''}`} /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tablo */}
          <Card className="border-0 shadow-lg">
            <CardContent className="p-0">
              {assignmentsLoading ? (
                <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12"><Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" /><p className="text-gray-500">Bu gün için atama yok</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b"><tr>
                      <th className="text-left p-3 text-sm font-semibold text-gray-600">Araç</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-600">Personel</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-600">Saat</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-600">Durum</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-600">İşlem</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {Object.entries(groupedAssignments).map(([vehicle, vas]) => vas.map((a, idx) => (
                        <tr key={a.id || a._id} className={`hover:bg-gray-50 ${idx === 0 ? 'border-t-2 border-t-blue-100' : ''}`}>
                          {idx === 0 && <td className="p-3 align-top" rowSpan={vas.length}><div className="flex items-center gap-2"><Truck className="h-5 w-5 text-blue-600" /><div><p className="font-bold">{vehicle}</p><p className="text-xs text-gray-500">{vas.length} kişi</p></div></div></td>}
                          <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{(a.user_name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}</div><div><p className="font-medium text-sm">{a.user_name || 'Bilinmiyor'}</p><p className="text-xs text-gray-500">{a.assigned_role ? <><span className="line-through text-gray-400">{getRoleLabel(a.user_role)}</span> → <span className="text-orange-600 font-medium">{getRoleLabel(a.assigned_role)}</span></> : getRoleLabel(a.user_role)}</p></div></div></td>
                          <td className="p-3"><div className="flex items-center gap-1 text-sm"><Clock className="h-3 w-3 text-gray-400" /><span>{a.start_time || '08:00'} - {a.end_time || '08:00'}</span>{a.end_date && a.end_date !== a.shift_date && <Badge variant="secondary" className="text-xs ml-1">+1g</Badge>}</div></td>
                          <td className="p-3"><Badge className={statusColors[a.status]}>{statusLabels[a.status]}</Badge></td>
                          <td className="p-3 text-right"><div className="flex items-center justify-end gap-1">
                            {a.status === 'pending' && <><Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleStartShift(a.id || a._id, a.user_name)}><Play className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(a.id || a._id)}><Trash2 className="h-4 w-4" /></Button></>}
                            {a.status === 'started' && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleEndShift(a.id || a._id, a.user_name)}><Square className="h-4 w-4" /></Button>}
                          </div></td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ONAYLAR SEKMESİ */}
      {activeMainTab === 'onaylar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 border-b overflow-x-auto">
              <button className={`px-4 py-2 font-medium whitespace-nowrap ${approvalsTab === 'start-approvals' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`} onClick={() => setApprovalsTab('start-approvals')}>🚀 Başlatma ({startApprovals.length})</button>
              <button className={`px-4 py-2 font-medium whitespace-nowrap ${approvalsTab === 'end-approvals' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500'}`} onClick={() => setApprovalsTab('end-approvals')}>🏁 Bitirme ({endApprovals.length})</button>
              <button className={`px-4 py-2 font-medium whitespace-nowrap ${approvalsTab === 'handover' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`} onClick={() => setApprovalsTab('handover')}>🔄 Devir Teslim ({pendingHandovers.length})</button>
              <button className={`px-4 py-2 font-medium whitespace-nowrap ${approvalsTab === 'logs' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500'}`} onClick={() => { setApprovalsTab('logs'); loadApprovalLogs(); }}><History className="h-4 w-4 inline mr-1" />Loglar</button>
            </div>
            <Button variant="outline" size="sm" onClick={loadApprovals}><RefreshCw className="h-4 w-4 mr-1" />Yenile</Button>
          </div>

          {/* Vardiya Başlatma Onayları */}
          {approvalsTab === 'start-approvals' && (
            <div className="space-y-3">
              {startApprovals.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-gray-500"><Check className="h-12 w-12 mx-auto mb-4 text-green-500" /><p>Bekleyen onay yok</p></CardContent></Card>
              ) : startApprovals.map(a => (
                <Card key={a.id} className={`border-l-4 ${a.role_type === 'medical' ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {a.role_type === 'medical' ? <Badge className="bg-blue-100 text-blue-800"><Stethoscope className="h-3 w-3 mr-1" />ATT/Paramedik</Badge> : <Badge className="bg-amber-100 text-amber-800"><Car className="h-3 w-3 mr-1" />Şoför</Badge>}
                          <span className="font-bold">{a.vehicle_plate}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-gray-400" /><span className="font-medium">{a.user_name}</span>{a.assigned_role ? <><Badge variant="outline" className="line-through text-gray-400">{getRoleLabel(a.user_role)}</Badge><span>→</span><Badge className="bg-orange-100 text-orange-700">{getRoleLabel(a.assigned_role)}</Badge></> : <Badge variant="outline">{getRoleLabel(a.user_role)}</Badge>}</div>
                        <div className="text-xs text-gray-500"><Clock className="h-3 w-3 inline mr-1" />{formatDateTime(a.created_at)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={() => { const r = prompt('Red sebebi:'); handleRejectStart(a.id, r); }}><X className="h-4 w-4" /></Button>
                        <Button size="sm" className="bg-green-600" onClick={() => handleApproveStart(a.id)}><Check className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Vardiya Bitirme Onayları */}
          {approvalsTab === 'end-approvals' && (
            <div className="space-y-3">
              {endApprovals.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-gray-500"><Check className="h-12 w-12 mx-auto mb-4 text-green-500" /><p>Bekleyen onay yok</p></CardContent></Card>
              ) : endApprovals.map(a => (
                <Card key={a.id} className={`border-l-4 ${a.role_type === 'medical' ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Bitirme</Badge>
                          <span className="font-bold">{a.vehicle_plate}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-gray-400" /><span className="font-medium">{a.user_name}</span></div>
                        <div className="text-xs text-gray-500"><Clock className="h-3 w-3 inline mr-1" />{formatDateTime(a.created_at)}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="destructive" size="sm" onClick={() => { const r = prompt('Red sebebi:'); handleRejectEnd(a.id, r); }}><X className="h-4 w-4" /></Button>
                        <Button size="sm" className="bg-green-600" onClick={() => handleApproveEnd(a.id)}><Check className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Devir Teslim */}
          {approvalsTab === 'handover' && (
            <div className="space-y-3">
              {pendingHandovers.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-gray-500"><Check className="h-12 w-12 mx-auto mb-4 text-green-500" /><p>Bekleyen devir teslim yok</p></CardContent></Card>
              ) : pendingHandovers.map(s => (
                <Card key={s.id} className="border-l-4 border-l-yellow-500">
                  <CardContent className="py-4">
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2"><Truck className="h-5 w-5 text-blue-600" /><span className="font-bold">{s.vehicle_plate}</span></div>
                        <div className="text-sm"><span className="text-gray-500">Devreden:</span> <span className="font-medium">{s.giver_name}</span> → <span className="font-medium">{s.receiver_name}</span></div>
                      </div>
                      <div className="flex gap-2">
                        {s.giver_shift_id && <Button variant="outline" size="sm" onClick={() => fetchShiftPhotos(s.giver_shift_id)}><Image className="h-4 w-4" /></Button>}
                        <Button variant="destructive" size="sm" onClick={() => { setSelectedSession(s); setShowRejectDialog(true); }}><X className="h-4 w-4" /></Button>
                        <Button size="sm" onClick={() => handleApproveHandover(s.id)}><Check className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Loglar */}
          {approvalsTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 justify-center">
                <Button variant="outline" size="icon" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); loadApprovalLogs(); }} className="w-48" />
                <Button variant="outline" size="icon" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              {approvalLogsLoading ? (
                <div className="text-center py-8"><RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
              ) : (
                <div className="space-y-3">
                  {approvalLogs?.shiftLogs?.length > 0 && approvalLogs.shiftLogs.map(log => (
                    <Card key={log.id} className={`border-l-4 ${log.type === 'start' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <Badge className={log.type === 'start' ? 'bg-green-600' : 'bg-red-600'}>{log.type_label}</Badge>
                          <span className="font-bold">{log.vehicle_plate}</span>
                          <span className="text-sm">{log.user_name}</span>
                          <span className="text-xs text-gray-500 ml-auto">{formatDateTime(log.created_at)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {(!approvalLogs?.shiftLogs?.length && !approvalLogs?.handoverLogs?.length) && (
                    <Card><CardContent className="py-8 text-center text-gray-500"><Calendar className="h-12 w-12 mx-auto mb-4" /><p>Bu tarihte kayıt yok</p></CardContent></Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Red Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Devir Teslimi Reddet</DialogTitle></DialogHeader>
          <div className="py-4"><Label>Red Nedeni</Label><Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Neden..." rows={3} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowRejectDialog(false)}>İptal</Button><Button variant="destructive" onClick={handleRejectHandover}>Reddet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fotoğraf Dialog */}
      <Dialog open={showPhotosDialog} onOpenChange={setShowPhotosDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vardiya Fotoğrafları</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {selectedPhotos?.photos && Object.entries(selectedPhotos.photos).map(([key, value]) => value && (
              <div key={key} className="space-y-2"><p className="text-sm font-medium">{key}</p><img src={value} alt={key} className="w-full h-40 object-cover rounded border" /></div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftAssignments;
