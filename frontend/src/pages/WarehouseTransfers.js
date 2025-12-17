import React, { useState, useEffect } from 'react';
import { warehouseAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Send, Check, X, Clock, PackageCheck, Plus, 
  Trash2, RefreshCw, ArrowRight, Truck, MapPin
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const WarehouseTransfers = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  
  // Transfer talepleri
  const [transfers, setTransfers] = useState([]);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Yeni talep
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    items: [{ name: '', quantity: 1 }],
    reason: ''
  });
  
  // Yetki kontrolü
  const canApprove = ['operasyon_muduru', 'merkez_ofis'].includes(user?.role);

  useEffect(() => {
    loadTransfers();
  }, [activeTab]);

  const loadTransfers = async () => {
    setLoading(true);
    try {
      const response = await warehouseAPI.getTransfers({ status: activeTab });
      setTransfers(response.data?.transfers || []);
    } catch (error) {
      console.error('Transferler yüklenemedi:', error);
      toast.error('Transferler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transferId) => {
    try {
      await warehouseAPI.approveTransfer(transferId);
      toast.success('Transfer onaylandı');
      loadTransfers();
      setShowDetailDialog(false);
    } catch (error) {
      console.error('Onay hatası:', error);
      toast.error(error.response?.data?.detail || 'Transfer onaylanamadı');
    }
  };

  const handleReject = async (transferId) => {
    const reason = prompt('Ret nedeni:');
    if (!reason) return;
    
    try {
      await warehouseAPI.rejectTransfer(transferId, { reason });
      toast.success('Transfer reddedildi');
      loadTransfers();
      setShowDetailDialog(false);
    } catch (error) {
      console.error('Red hatası:', error);
      toast.error(error.response?.data?.detail || 'Transfer reddedilemedi');
    }
  };

  const showDetail = async (transfer) => {
    setSelectedTransfer(transfer);
    setShowDetailDialog(true);
  };

  // Durum badge
  const getStatusBadge = (status) => {
    const badges = {
      pending: <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Bekliyor</Badge>,
      approved: <Badge className="bg-green-600"><Check className="h-3 w-3 mr-1" />Onaylandı</Badge>,
      rejected: <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Reddedildi</Badge>,
      delivered: <Badge className="bg-blue-600"><PackageCheck className="h-3 w-3 mr-1" />Teslim Edildi</Badge>
    };
    return badges[status] || <Badge>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Send className="h-7 w-7" />
            Transfer Talepleri
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Depo → Araç/Bekleme Noktası Transfer Yönetimi
          </p>
        </div>
        
        <Button variant="outline" onClick={loadTransfers}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            Bekleyen
          </TabsTrigger>
          <TabsTrigger value="approved">
            Onaylanan
          </TabsTrigger>
          <TabsTrigger value="delivered">
            Teslim Edilen
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Reddedilen
          </TabsTrigger>
        </TabsList>
        
        {/* Talepler Listesi */}
        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {transfers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {activeTab === 'pending' ? 'Bekleyen talep yok' : 
                   activeTab === 'approved' ? 'Onaylanan talep yok' :
                   activeTab === 'delivered' ? 'Teslim edilen talep yok' : 
                   'Reddedilen talep yok'}
                </div>
              ) : (
                <div className="divide-y">
                  {transfers.map((transfer) => (
                    <div 
                      key={transfer.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => showDetail(transfer)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{transfer.to_name}</span>
                            {getStatusBadge(transfer.status)}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Talep Eden: {transfer.requested_by_name} • 
                            Tarih: {new Date(transfer.requested_at).toLocaleString('tr-TR')}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {transfer.items?.length || 0} ürün
                          </div>
                        </div>
                        
                        {transfer.status === 'pending' && canApprove && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(transfer.id);
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Onayla
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReject(transfer.id);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reddet
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detay Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Detayı</DialogTitle>
          </DialogHeader>
          
          {selectedTransfer && (
            <div className="space-y-4">
              <div>
                <Label className="text-gray-500">Hedef Lokasyon</Label>
                <p className="font-medium">{selectedTransfer.to_name}</p>
              </div>
              
              <div>
                <Label className="text-gray-500">Talep Eden</Label>
                <p className="font-medium">{selectedTransfer.requested_by_name}</p>
                <p className="text-sm text-gray-500">
                  {new Date(selectedTransfer.requested_at).toLocaleString('tr-TR')}
                </p>
              </div>
              
              {selectedTransfer.reason && (
                <div>
                  <Label className="text-gray-500">Sebep</Label>
                  <p className="text-sm">{selectedTransfer.reason}</p>
                </div>
              )}
              
              <div>
                <Label className="text-gray-500 mb-2 block">Talep Edilen Ürünler</Label>
                <div className="bg-gray-50 rounded p-3 space-y-1">
                  {selectedTransfer.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{item.quantity} adet</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedTransfer.approved_by_name && (
                <div className="border-t pt-4">
                  <Label className="text-gray-500">Onaylayan</Label>
                  <p className="font-medium">{selectedTransfer.approved_by_name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedTransfer.approved_at).toLocaleString('tr-TR')}
                  </p>
                </div>
              )}
              
              {selectedTransfer.status === 'rejected' && selectedTransfer.rejected_reason && (
                <div className="border-t pt-4">
                  <Label className="text-gray-500">Red Nedeni</Label>
                  <p className="text-sm text-red-600">{selectedTransfer.rejected_reason}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            {selectedTransfer?.status === 'pending' && canApprove && (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(selectedTransfer.id)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Onayla
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedTransfer.id)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reddet
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehouseTransfers;

