import React, { useState, useEffect } from 'react';
import { stockV2API } from '../api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { 
  Package, Clock, CheckCircle, XCircle, Truck, RefreshCw, 
  AlertTriangle, FileText, User, MapPin, Calendar, Loader2,
  ChevronRight, Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const statusConfig = {
  pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Onaylandı', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-800', icon: XCircle },
  delivered: { label: 'Teslim Edildi', color: 'bg-green-100 text-green-800', icon: Truck }
};

const StockRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const canManageRequests = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);

  useEffect(() => {
    loadRequests();
  }, [selectedTab]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await stockV2API.getRequests({ status: selectedTab === 'all' ? undefined : selectedTab });
      setRequests(response.data?.requests || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Talepler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await stockV2API.approveRequest(selectedRequest.id, actionNote);
      toast.success('Talep onaylandı');
      setDetailDialogOpen(false);
      setActionNote('');
      loadRequests();
    } catch (error) {
      toast.error('Talep onaylanamadı');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await stockV2API.rejectRequest(selectedRequest.id, actionNote);
      toast.success('Talep reddedildi');
      setDetailDialogOpen(false);
      setActionNote('');
      loadRequests();
    } catch (error) {
      toast.error('Talep reddedilemedi');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeliver = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await stockV2API.deliverRequest(selectedRequest.id);
      toast.success('Talep teslim edildi olarak işaretlendi');
      setDetailDialogOpen(false);
      loadRequests();
    } catch (error) {
      toast.error('İşlem başarısız');
    } finally {
      setProcessing(false);
    }
  };

  const openDetail = (request) => {
    setSelectedRequest(request);
    setActionNote('');
    setDetailDialogOpen(true);
  };

  const RequestCard = ({ request }) => {
    const status = statusConfig[request.status] || statusConfig.pending;
    const StatusIcon = status.icon;

    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => openDetail(request)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={status.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
                {request.related_case_no && (
                  <Badge variant="outline" className="text-purple-600 border-purple-300">
                    <FileText className="h-3 w-3 mr-1" />
                    Vaka #{request.related_case_no}
                  </Badge>
                )}
              </div>
              
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-500" />
                {request.target_location_name}
              </h3>
              
              <p className="text-sm text-gray-600 mt-1">
                {request.items?.length || 0} ürün talep edildi
              </p>
              
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {request.requester_name}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(request.created_at).toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7" />
            Stok Talepleri
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Vakalardan gelen stok taleplerini yönetin
          </p>
        </div>
        <Button variant="outline" onClick={loadRequests} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Beklemede
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Onaylanan
          </TabsTrigger>
          <TabsTrigger value="delivered" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Teslim Edilen
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Reddedilen
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Bu kategoride talep bulunmuyor</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {requests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Talep Detayı
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.target_location_name} için stok talebi
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Status & Info */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusConfig[selectedRequest.status]?.color}>
                  {statusConfig[selectedRequest.status]?.label}
                </Badge>
                {selectedRequest.related_case_no && (
                  <Badge variant="outline">Vaka #{selectedRequest.related_case_no}</Badge>
                )}
              </div>

              {/* Requester Info */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Talep Eden:</span> {selectedRequest.requester_name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Tarih:</span> {new Date(selectedRequest.created_at).toLocaleString('tr-TR')}
                </p>
                {selectedRequest.requester_note && (
                  <p className="text-sm mt-1">
                    <span className="font-medium">Not:</span> {selectedRequest.requester_note}
                  </p>
                )}
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-medium mb-2">Talep Edilen Malzemeler</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-2">Malzeme</th>
                        <th className="text-center p-2">Miktar</th>
                        <th className="text-left p-2">Nereden Kullanıldı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRequest.items?.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-center">{item.quantity} {item.unit}</td>
                          <td className="p-2">
                            {item.used_from === 'vehicle' ? (
                              <Badge variant="outline" className="text-blue-600">
                                🚑 {item.used_from_name || 'Araç'}
                              </Badge>
                            ) : item.used_from === 'carter' || item.used_from === 'waiting_point' ? (
                              <Badge variant="outline" className="text-amber-600">
                                🏥 {item.used_from_name || 'Lokasyon'}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Note */}
              {canManageRequests && selectedRequest.status === 'pending' && (
                <div>
                  <label className="text-sm font-medium">Not (opsiyonel)</label>
                  <Textarea
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Onay veya red notu..."
                    className="mt-1"
                  />
                </div>
              )}

              {/* Approval Info */}
              {selectedRequest.approved_at && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p><span className="font-medium">Onaylayan:</span> {selectedRequest.approved_by_name}</p>
                  <p><span className="font-medium">Onay Tarihi:</span> {new Date(selectedRequest.approved_at).toLocaleString('tr-TR')}</p>
                  {selectedRequest.approver_note && (
                    <p><span className="font-medium">Not:</span> {selectedRequest.approver_note}</p>
                  )}
                </div>
              )}

              {/* Delivery Info */}
              {selectedRequest.delivered_at && (
                <div className="bg-green-50 p-3 rounded-lg text-sm">
                  <p><span className="font-medium">Teslim Eden:</span> {selectedRequest.delivered_by_name}</p>
                  <p><span className="font-medium">Teslim Tarihi:</span> {new Date(selectedRequest.delivered_at).toLocaleString('tr-TR')}</p>
                </div>
              )}

              {/* Rejection Info */}
              {selectedRequest.rejected_at && (
                <div className="bg-red-50 p-3 rounded-lg text-sm">
                  <p><span className="font-medium">Reddeden:</span> {selectedRequest.rejected_by_name}</p>
                  <p><span className="font-medium">Red Tarihi:</span> {new Date(selectedRequest.rejected_at).toLocaleString('tr-TR')}</p>
                  {selectedRequest.approver_note && (
                    <p><span className="font-medium">Sebep:</span> {selectedRequest.approver_note}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {canManageRequests && selectedRequest?.status === 'pending' && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={handleReject}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Reddet
                </Button>
                <Button 
                  onClick={handleApprove}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Onayla
                </Button>
              </>
            )}
            
            {canManageRequests && selectedRequest?.status === 'approved' && (
              <Button 
                onClick={handleDeliver}
                disabled={processing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                Teslim Edildi
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockRequests;

