import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Clock, 
  Check, 
  X, 
  User, 
  Truck, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Image,
  FileText,
  History
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ShiftApprovals = () => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showPhotosDialog, setShowPhotosDialog] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState(null);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchPendingApprovals();
    fetchLogs();
  }, [selectedDate]);

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`${API_URL}/shifts/handover/pending-approvals`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPendingApprovals(data);
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/shifts/handover/logs?date=${selectedDate}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/shifts/handover/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approve: true })
      });
      
      if (response.ok) {
        toast.success('Devir teslim onaylandı');
        fetchPendingApprovals();
        fetchLogs();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Onay başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const handleReject = async () => {
    if (!selectedSession) return;
    
    try {
      const response = await fetch(`${API_URL}/shifts/handover/${selectedSession.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approve: false, rejection_reason: rejectReason })
      });
      
      if (response.ok) {
        toast.success('Devir teslim reddedildi');
        setShowRejectDialog(false);
        setRejectReason('');
        setSelectedSession(null);
        fetchPendingApprovals();
        fetchLogs();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Red işlemi başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const fetchShiftPhotos = async (shiftId) => {
    try {
      const response = await fetch(`${API_URL}/shifts/photos/${shiftId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedPhotos(data);
        setShowPhotosDialog(true);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast.error('Fotoğraflar yüklenemedi');
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const changeDate = (days) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const statusBadge = (status) => {
    const statusMap = {
      waiting_receiver: { label: 'Devralan Bekliyor', variant: 'secondary' },
      waiting_manager: { label: 'Yönetici Onayı Bekliyor', variant: 'warning' },
      approved: { label: 'Onaylandı', variant: 'success' },
      rejected: { label: 'Reddedildi', variant: 'destructive' },
      expired: { label: 'Süresi Doldu', variant: 'secondary' }
    };
    const info = statusMap[status] || { label: status, variant: 'secondary' };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const photoLabels = {
    front: 'Ön Taraf',
    back: 'Arka Taraf',
    left: 'Sol Taraf',
    right: 'Sağ Taraf',
    rear_cabin_open: 'Arka Kabin (Kapılar Açık)',
    interior: 'İç Kabin',
    engine: 'Kaput İçi Motor',
    left_door_open: 'Sol Kapı Açık',
    right_door_open: 'Sağ Kapı Açık',
    front_cabin: 'Ön Kabin',
    front_cabin_seats_back: 'Ön Kabin Koltuk Arkası',
    trunk: 'Arka Bagaj', // Eski alan uyumluluğu
    damages: 'Hasar Fotoğrafları'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Vardiya Onayları</h1>
          <p className="text-gray-500">Devir teslim onayları ve loglar</p>
        </div>
        <Button variant="outline" onClick={() => { fetchPendingApprovals(); fetchLogs(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('pending')}
        >
          Bekleyen Onaylar ({pendingApprovals.length})
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === 'logs' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('logs')}
        >
          <History className="h-4 w-4 inline mr-1" />
          Günlük Loglar
        </button>
      </div>

      {/* Bekleyen Onaylar */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {pendingApprovals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Bekleyen onay bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            pendingApprovals.map((session) => (
              <Card key={session.id} className="border-l-4 border-l-yellow-500">
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-4">
                        <Truck className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-lg">{session.vehicle_plate}</span>
                        {statusBadge(session.status)}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Devreden:</span>
                          <span className="ml-2 font-medium">{session.giver_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Devralan:</span>
                          <span className="ml-2 font-medium">{session.receiver_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Form Açıldı:</span>
                          <span className="ml-2">{formatTime(session.form_opened_at)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">İmzalandı:</span>
                          <span className="ml-2">{formatTime(session.receiver_signed_at)}</span>
                          {session.receiver_otp_verified && <Badge variant="outline" className="ml-1">OTP</Badge>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {session.giver_shift_id && (
                        <Button variant="outline" size="sm" onClick={() => fetchShiftPhotos(session.giver_shift_id)}>
                          <Image className="h-4 w-4 mr-1" />
                          Fotoğraflar
                        </Button>
                      )}
                      <Button variant="destructive" size="sm" onClick={() => { setSelectedSession(session); setShowRejectDialog(true); }}>
                        <X className="h-4 w-4 mr-1" />
                        Reddet
                      </Button>
                      <Button size="sm" onClick={() => handleApprove(session.id)}>
                        <Check className="h-4 w-4 mr-1" />
                        Onayla
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Günlük Loglar */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Tarih Seçici */}
          <div className="flex items-center gap-4 justify-center">
            <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
            <Button variant="outline" size="icon" onClick={() => changeDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            </div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4" />
                <p>Bu tarihte devir teslim kaydı yok</p>
              </CardContent>
            </Card>
          ) : (
            logs.map((logItem, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-blue-600" />
                      <CardTitle className="text-lg">{logItem.session.vehicle_plate}</CardTitle>
                      {statusBadge(logItem.session.status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {logItem.session.giver_name} → {logItem.session.receiver_name}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {logItem.logs.map((log, logIndex) => (
                      <div key={logIndex} className="flex items-center gap-4 text-sm py-2 border-l-2 border-gray-200 pl-4">
                        <div className="w-16 text-gray-500 font-mono">
                          {formatTime(log.time)}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{log.description}</span>
                          {log.user && <span className="text-gray-500 ml-2">({log.user})</span>}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {log.event}
                        </Badge>
                      </div>
                    ))}
                  </div>
                  
                  {logItem.session.giver_shift_id && (
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => fetchShiftPhotos(logItem.session.giver_shift_id)}>
                        <Image className="h-4 w-4 mr-1" />
                        Fotoğrafları Gör
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Reddet Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devir Teslimi Reddet</DialogTitle>
            <DialogDescription>
              {selectedSession?.vehicle_plate} - {selectedSession?.giver_name} → {selectedSession?.receiver_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium mb-2">Red Nedeni</label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Red nedenini yazın..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleReject}>Reddet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fotoğraflar Dialog */}
      <Dialog open={showPhotosDialog} onOpenChange={setShowPhotosDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vardiya Fotoğrafları</DialogTitle>
            <DialogDescription>
              {selectedPhotos?.vehicle_plate} - {formatDateTime(selectedPhotos?.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {selectedPhotos?.photos && Object.entries(selectedPhotos.photos).map(([key, value]) => {
              if (key === 'damages' && Array.isArray(value)) {
                return value.map((damage, idx) => (
                  <div key={`damage-${idx}`} className="space-y-2">
                    <p className="text-sm font-medium text-red-600">Hasar {idx + 1}</p>
                    <img src={damage} alt={`Hasar ${idx + 1}`} className="w-full h-40 object-cover rounded border" />
                  </div>
                ));
              }
              if (!value) return null;
              return (
                <div key={key} className="space-y-2">
                  <p className="text-sm font-medium">{photoLabels[key] || key}</p>
                  <img src={value} alt={photoLabels[key] || key} className="w-full h-40 object-cover rounded border" />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftApprovals;

