import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Package, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Clock,
  AlertCircle,
  RefreshCw,
  Truck,
  User
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const MaterialRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  
  // Yeni talep formu
  const [newRequest, setNewRequest] = useState({
    vehicle_id: '',
    vehicle_plate: '',
    location: '',
    priority: 'normal',
    notes: '',
    items: [{ name: '', quantity: 1, unit: 'adet', notes: '' }]
  });

  const isManager = ['bas_sofor', 'operasyon_muduru', 'merkez_ofis', 'cagri_merkezi'].includes(user?.role);
  const isDriver = user?.role === 'sofor';

  useEffect(() => {
    fetchRequests();
    fetchVehicles();
    if (isManager) {
      fetchStats();
    }
  }, [activeTab]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/material-requests`;
      if (activeTab === 'pending' && isManager) {
        url = `${API_URL}/material-requests/pending`;
      } else if (activeTab !== 'all' && isManager) {
        url = `${API_URL}/material-requests?status=${activeTab}`;
      } else if (isDriver) {
        url = `${API_URL}/material-requests?my_only=true`;
      }
      
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/material-requests/stats`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchVehicles = async () => {
    try {
      const response = await fetch(`${API_URL}/vehicles`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setVehicles(data);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleAddItem = () => {
    setNewRequest({
      ...newRequest,
      items: [...newRequest.items, { name: '', quantity: 1, unit: 'adet', notes: '' }]
    });
  };

  const handleRemoveItem = (index) => {
    if (newRequest.items.length > 1) {
      setNewRequest({
        ...newRequest,
        items: newRequest.items.filter((_, i) => i !== index)
      });
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...newRequest.items];
    updatedItems[index][field] = value;
    setNewRequest({ ...newRequest, items: updatedItems });
  };

  const handleVehicleChange = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    setNewRequest({
      ...newRequest,
      vehicle_id: vehicleId,
      vehicle_plate: vehicle?.plate || '',
      location: vehicle?.plate || ''
    });
  };

  const handleSubmitRequest = async () => {
    // Validasyon
    const validItems = newRequest.items.filter(item => item.name.trim());
    if (validItems.length === 0) {
      toast.error('En az bir malzeme ekleyin');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/material-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newRequest,
          items: validItems
        })
      });

      if (response.ok) {
        toast.success('Malzeme talebi oluşturuldu');
        setShowNewDialog(false);
        setNewRequest({
          vehicle_id: '',
          vehicle_plate: '',
          location: '',
          priority: 'normal',
          notes: '',
          items: [{ name: '', quantity: 1, unit: 'adet', notes: '' }]
        });
        fetchRequests();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Talep oluşturulamadı');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const handleReview = async (approve) => {
    if (!selectedRequest) return;

    try {
      const response = await fetch(`${API_URL}/material-requests/${selectedRequest.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approve, notes: reviewNotes })
      });

      if (response.ok) {
        toast.success(approve ? 'Talep onaylandı' : 'Talep reddedildi');
        setShowReviewDialog(false);
        setReviewNotes('');
        setSelectedRequest(null);
        fetchRequests();
        if (isManager) fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'İşlem başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const handleComplete = async (requestId) => {
    try {
      const response = await fetch(`${API_URL}/material-requests/${requestId}/complete`, {
        method: 'PATCH',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Talep tamamlandı olarak işaretlendi');
        fetchRequests();
        if (isManager) fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'İşlem başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const handleDelete = async (requestId) => {
    if (!window.confirm('Bu talebi silmek istediğinize emin misiniz?')) return;

    try {
      const response = await fetch(`${API_URL}/material-requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Talep silindi');
        fetchRequests();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Silme başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const statusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Beklemede', variant: 'secondary', icon: Clock },
      approved: { label: 'Onaylandı', variant: 'success', icon: Check },
      rejected: { label: 'Reddedildi', variant: 'destructive', icon: X },
      completed: { label: 'Tamamlandı', variant: 'outline', icon: Check }
    };
    const info = statusMap[status] || { label: status, variant: 'secondary', icon: Clock };
    const Icon = info.icon;
    return (
      <Badge variant={info.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {info.label}
      </Badge>
    );
  };

  const priorityBadge = (priority) => {
    const priorityMap = {
      normal: { label: 'Normal', variant: 'outline' },
      urgent: { label: 'Acil', variant: 'warning' },
      critical: { label: 'Kritik', variant: 'destructive' }
    };
    const info = priorityMap[priority] || { label: priority, variant: 'outline' };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const formatDate = (dateStr) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Malzeme Talepleri</h1>
          <p className="text-gray-500">
            {isDriver ? 'Malzeme taleplerinizi oluşturun ve takip edin' : 'Malzeme taleplerini yönetin'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Talep
          </Button>
        </div>
      </div>

      {/* İstatistikler (Yöneticiler için) */}
      {isManager && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
              <p className="text-sm text-gray-500">Beklemede</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.approved || 0}</p>
              <p className="text-sm text-gray-500">Onaylanan</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.rejected || 0}</p>
              <p className="text-sm text-gray-500">Reddedilen</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.completed || 0}</p>
              <p className="text-sm text-gray-500">Tamamlanan</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{stats.today || 0}</p>
              <p className="text-sm text-gray-500">Bugün</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs (Yöneticiler için) */}
      {isManager && (
        <div className="flex gap-2 border-b">
          {['pending', 'approved', 'rejected', 'completed', 'all'].map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 font-medium capitalize ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'pending' ? 'Beklemede' : 
               tab === 'approved' ? 'Onaylanan' : 
               tab === 'rejected' ? 'Reddedilen' : 
               tab === 'completed' ? 'Tamamlanan' : 'Tümü'}
            </button>
          ))}
        </div>
      )}

      {/* Talepler Listesi */}
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4" />
            <p>Henüz malzeme talebi yok</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className={`${req.status === 'pending' && isManager ? 'border-l-4 border-l-yellow-500' : ''}`}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-4">
                      {statusBadge(req.status)}
                      {priorityBadge(req.priority)}
                      {req.vehicle_plate && (
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <Truck className="h-4 w-4" />
                          {req.vehicle_plate}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <User className="h-4 w-4" />
                      <span>{req.requester_name}</span>
                      <span>•</span>
                      <span>{formatDate(req.created_at)}</span>
                    </div>

                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm font-medium mb-2">Talep Edilen Malzemeler:</p>
                      <ul className="space-y-1">
                        {req.items.map((item, idx) => (
                          <li key={idx} className="text-sm flex items-center gap-2">
                            <Package className="h-3 w-3 text-gray-400" />
                            <span>{item.quantity} {item.unit} - {item.name}</span>
                            {item.notes && <span className="text-gray-400">({item.notes})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {req.notes && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Not:</span> {req.notes}
                      </p>
                    )}

                    {req.review_notes && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">İnceleme Notu:</span> {req.review_notes}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 ml-4">
                    {req.status === 'pending' && isManager && (
                      <>
                        <Button size="sm" onClick={() => { setSelectedRequest(req); setShowReviewDialog(true); }}>
                          <Check className="h-4 w-4 mr-1" />
                          İncele
                        </Button>
                      </>
                    )}
                    {req.status === 'approved' && isManager && (
                      <Button size="sm" variant="outline" onClick={() => handleComplete(req.id)}>
                        <Check className="h-4 w-4 mr-1" />
                        Tamamlandı
                      </Button>
                    )}
                    {req.status === 'pending' && req.requester_id === user?.id && (
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(req.id)}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Sil
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Yeni Talep Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni Malzeme Talebi</DialogTitle>
            <DialogDescription>
              İhtiyacınız olan malzemeleri talep edin
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Araç</Label>
                <Select value={newRequest.vehicle_id} onValueChange={handleVehicleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Araç seçin (opsiyonel)" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Öncelik</Label>
                <Select value={newRequest.priority} onValueChange={(v) => setNewRequest({...newRequest, priority: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Acil</SelectItem>
                    <SelectItem value="critical">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Lokasyon / Not</Label>
              <Input
                value={newRequest.location}
                onChange={(e) => setNewRequest({...newRequest, location: e.target.value})}
                placeholder="Lokasyon veya ek bilgi"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Malzemeler</Label>
                <Button variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Malzeme Ekle
                </Button>
              </div>
              
              <div className="space-y-3">
                {newRequest.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <Input
                        placeholder="Malzeme adı"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="w-24">
                      <Select value={item.unit} onValueChange={(v) => handleItemChange(index, 'unit', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="adet">Adet</SelectItem>
                          <SelectItem value="kutu">Kutu</SelectItem>
                          <SelectItem value="paket">Paket</SelectItem>
                          <SelectItem value="litre">Litre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      disabled={newRequest.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Ek Notlar</Label>
              <Textarea
                value={newRequest.notes}
                onChange={(e) => setNewRequest({...newRequest, notes: e.target.value})}
                placeholder="Ek açıklama veya notlar"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>İptal</Button>
            <Button onClick={handleSubmitRequest}>Talep Oluştur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* İnceleme Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Talebi İncele</DialogTitle>
            <DialogDescription>
              {selectedRequest?.requester_name} - {selectedRequest?.vehicle_plate || 'Araç belirtilmemiş'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-gray-50 rounded p-3">
              <p className="text-sm font-medium mb-2">Talep Edilen Malzemeler:</p>
              <ul className="space-y-1">
                {selectedRequest?.items.map((item, idx) => (
                  <li key={idx} className="text-sm">
                    • {item.quantity} {item.unit} - {item.name}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Label>İnceleme Notu (Opsiyonel)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Not ekleyin..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>İptal</Button>
            <Button variant="destructive" onClick={() => handleReview(false)}>
              <X className="h-4 w-4 mr-1" />
              Reddet
            </Button>
            <Button onClick={() => handleReview(true)}>
              <Check className="h-4 w-4 mr-1" />
              Onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialRequests;

