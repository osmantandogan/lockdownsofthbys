import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ticketsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  Bell, 
  Package, 
  Pill, 
  Check, 
  X, 
  Clock, 
  User, 
  Truck, 
  RefreshCw,
  Eye,
  AlertTriangle,
  MessageSquare,
  Filter
} from 'lucide-react';
import ImageViewer from '../components/ImageViewer';

const TicketsApprovals = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('pending'); // pending, all, bildirim, malzeme_talep, ilac_talep
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  useEffect(() => {
    fetchTickets();
  }, [activeFilter]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeFilter === 'pending') {
        params.status = 'pending';
      } else if (activeFilter === 'archived') {
        // Arşivlenmiş ticketlar için özel filtre - tamamlanan ve reddedilenleri getir
        params.limit = 100;
      } else if (['bildirim', 'malzeme_talep', 'ilac_talep', 'ekipman_hasar'].includes(activeFilter)) {
        params.type = activeFilter;
      }
      
      const response = await ticketsAPI.getTickets(params);
      let ticketData = response.data || [];
      
      // Arşivlenmiş filtresi için manuel filtreleme
      if (activeFilter === 'archived') {
        ticketData = ticketData.filter(t => t.status === 'completed' || t.status === 'rejected');
      }
      
      setTickets(ticketData);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Ticketlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (ticketId) => {
    try {
      await ticketsAPI.updateTicket(ticketId, {
        status: 'completed',
        resolution_notes: resolutionNotes || 'Onaylandı'
      });
      toast.success('Talep onaylandı');
      setShowDetailDialog(false);
      setResolutionNotes('');
      fetchTickets();
    } catch (error) {
      toast.error('Onay başarısız');
    }
  };

  const handleReject = async (ticketId) => {
    try {
      await ticketsAPI.updateTicket(ticketId, {
        status: 'rejected',
        resolution_notes: resolutionNotes || 'Reddedildi'
      });
      toast.success('Talep reddedildi');
      setShowDetailDialog(false);
      setResolutionNotes('');
      fetchTickets();
    } catch (error) {
      toast.error('Red işlemi başarısız');
    }
  };

  const handleInProgress = async (ticketId) => {
    try {
      await ticketsAPI.updateTicket(ticketId, {
        status: 'in_progress'
      });
      toast.success('İşleme alındı');
      fetchTickets();
    } catch (error) {
      toast.error('İşlem başarısız');
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'bildirim': return <Bell className="h-4 w-4" />;
      case 'malzeme_talep': return <Package className="h-4 w-4" />;
      case 'ilac_talep': return <Pill className="h-4 w-4" />;
      case 'ekipman_hasar': return <AlertTriangle className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'bildirim': return 'Olay Bildirimi';
      case 'malzeme_talep': return 'Malzeme Talebi';
      case 'ilac_talep': return 'İlaç Talebi';
      case 'ekipman_hasar': return 'Ekipman Hasarı';
      default: return type;
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case 'bildirim': return 'bg-orange-100 text-orange-800';
      case 'malzeme_talep': return 'bg-blue-100 text-blue-800';
      case 'ilac_talep': return 'bg-purple-100 text-purple-800';
      case 'ekipman_hasar': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-100 text-yellow-800">Beklemede</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-800">İşlemde</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-800">Tamamlandı</Badge>;
      case 'rejected': return <Badge className="bg-red-100 text-red-800">Reddedildi</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'urgent') {
      return <Badge className="bg-red-600 text-white animate-pulse">🚨 ACİL</Badge>;
    }
    return null;
  };

  const pendingCount = tickets.filter(t => t.status === 'pending').length;
  const archivedCount = tickets.filter(t => t.status === 'completed' || t.status === 'rejected').length;
  const bildirimCount = tickets.filter(t => t.type === 'bildirim').length;
  const malzemeCount = tickets.filter(t => t.type === 'malzeme_talep').length;
  const ilacCount = tickets.filter(t => t.type === 'ilac_talep').length;
  const hasarCount = tickets.filter(t => t.type === 'ekipman_hasar').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Bildirim ve Talep Onayları</h1>
          <p className="text-gray-500">Gelen tüm bildirimleri ve talepleri buradan yönetin</p>
        </div>
        <Button variant="outline" onClick={fetchTickets}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={activeFilter === 'pending' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('pending')}
          className="bg-yellow-600 hover:bg-yellow-700"
        >
          <Clock className="h-4 w-4 mr-1" />
          Bekleyenler ({pendingCount})
        </Button>
        <Button 
          variant={activeFilter === 'all' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('all')}
        >
          Tümü ({tickets.length})
        </Button>
        <Button 
          variant={activeFilter === 'bildirim' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('bildirim')}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Bell className="h-4 w-4 mr-1" />
          Bildirimler ({bildirimCount})
        </Button>
        <Button 
          variant={activeFilter === 'malzeme_talep' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('malzeme_talep')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Package className="h-4 w-4 mr-1" />
          Malzeme ({malzemeCount})
        </Button>
        <Button 
          variant={activeFilter === 'ilac_talep' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('ilac_talep')}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Pill className="h-4 w-4 mr-1" />
          İlaç ({ilacCount})
        </Button>
        <Button 
          variant={activeFilter === 'ekipman_hasar' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('ekipman_hasar')}
          className="bg-red-600 hover:bg-red-700"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Hasar ({hasarCount})
        </Button>
        <Button 
          variant={activeFilter === 'archived' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => setActiveFilter('archived')}
          className="bg-gray-600 hover:bg-gray-700"
        >
          <Check className="h-4 w-4 mr-1" />
          Eskiler ({archivedCount})
        </Button>
      </div>

      {/* Ticket Listesi */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            Yükleniyor...
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p>Bekleyen talep bulunmuyor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className={`border-l-4 ${
                ticket.status === 'pending' ? 'border-l-yellow-500' :
                ticket.status === 'in_progress' ? 'border-l-blue-500' :
                ticket.status === 'completed' ? 'border-l-green-500' :
                'border-l-red-500'
              }`}
            >
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className={getTypeBadgeColor(ticket.type)}>
                        {getTypeIcon(ticket.type)}
                        <span className="ml-1">{getTypeLabel(ticket.type)}</span>
                      </Badge>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                      {getPriorityBadge(ticket.urgency)}
                    </div>
                    
                    {ticket.title && (
                      <h3 className="font-semibold text-lg">{ticket.title}</h3>
                    )}
                    
                    {ticket.description && (
                      <p className="text-gray-600 text-sm line-clamp-2">{ticket.description}</p>
                    )}
                    
                    {/* Malzeme/İlaç Listesi */}
                    {ticket.items && ticket.items.length > 0 && (
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        <p className="font-medium mb-1">Talep Edilen:</p>
                        <ul className="list-disc list-inside">
                          {ticket.items.slice(0, 3).map((item, idx) => (
                            <li key={idx}>{item.name} - {item.quantity} {item.unit}</li>
                          ))}
                          {ticket.items.length > 3 && (
                            <li className="text-gray-500">+{ticket.items.length - 3} daha...</li>
                          )}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.created_by_name}
                      </div>
                      {ticket.vehicle_id && (
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          Araç İlişkili
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(ticket.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => { setSelectedTicket(ticket); setShowDetailDialog(true); }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Detay
                    </Button>
                    
                    {ticket.status === 'pending' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleInProgress(ticket.id)}
                        >
                          İşleme Al
                        </Button>
                        <Button 
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => { setSelectedTicket(ticket); setShowDetailDialog(true); }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detay Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTicket && getTypeIcon(selectedTicket.type)}
              {selectedTicket && getTypeLabel(selectedTicket.type)}
            </DialogTitle>
            <DialogDescription>
              Bildirim veya talep detaylarını görüntüleyin ve işlem yapın
            </DialogDescription>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {getStatusBadge(selectedTicket.status)}
                {getPriorityBadge(selectedTicket.priority)}
              </div>
              
              {selectedTicket.title && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Başlık</label>
                  <p className="font-semibold">{selectedTicket.title}</p>
                </div>
              )}
              
              {selectedTicket.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Açıklama</label>
                  <p className="text-gray-700">{selectedTicket.description}</p>
                </div>
              )}
              
              {selectedTicket.items && selectedTicket.items.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Talep Listesi</label>
                  <div className="bg-gray-50 p-3 rounded mt-1">
                    {selectedTicket.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-1 border-b last:border-0">
                        <span>{item.name}</span>
                        <span className="font-medium">{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedTicket.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notlar</label>
                  <p className="text-gray-700">{selectedTicket.notes}</p>
                </div>
              )}
              
              {selectedTicket.photos && selectedTicket.photos.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Fotoğraflar</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {selectedTicket.photos.map((photo, idx) => (
                      <ImageViewer
                        key={idx} 
                        src={photo.data || photo} 
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-500">Oluşturan</label>
                  <p className="font-medium">{selectedTicket.created_by_name}</p>
                </div>
                <div>
                  <label className="text-gray-500">Oluşturulma</label>
                  <p>{formatDateTime(selectedTicket.created_at)}</p>
                </div>
              </div>
              
              {selectedTicket.status === 'pending' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Çözüm Notu</label>
                    <Textarea 
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Onay/red sebebi veya not ekleyin..."
                      className="mt-1"
                    />
                  </div>
                  
                  <DialogFooter className="gap-2">
                    <Button 
                      variant="destructive"
                      onClick={() => handleReject(selectedTicket.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reddet
                    </Button>
                    <Button 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleApprove(selectedTicket.id)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Onayla
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketsApprovals;

