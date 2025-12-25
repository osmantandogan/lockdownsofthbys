import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { feedbackAPI } from '../api';
import { 
  Bug, Lightbulb, HelpCircle, MessageSquare, Clock, User, 
  Monitor, Trash2, CheckCircle, AlertCircle, Eye, X,
  RefreshCw, Filter
} from 'lucide-react';
import ImageViewer from '../components/ImageViewer';

const FeedbackAdmin = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: ''
  });
  
  const categoryConfig = {
    bug: { label: 'Hata', icon: Bug, color: 'bg-red-100 text-red-700' },
    suggestion: { label: 'Öneri', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-700' },
    question: { label: 'Soru', icon: HelpCircle, color: 'bg-blue-100 text-blue-700' },
    feedback: { label: 'Görüş', icon: MessageSquare, color: 'bg-green-100 text-green-700' }
  };
  
  const statusConfig = {
    pending: { label: 'Bekliyor', color: 'bg-gray-100 text-gray-700' },
    in_progress: { label: 'İşleniyor', color: 'bg-blue-100 text-blue-700' },
    resolved: { label: 'Çözüldü', color: 'bg-green-100 text-green-700' },
    closed: { label: 'Kapatıldı', color: 'bg-gray-200 text-gray-600' }
  };
  
  const priorityConfig = {
    low: { label: 'Düşük', color: 'bg-gray-100 text-gray-600' },
    normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700' },
    high: { label: 'Yüksek', color: 'bg-orange-100 text-orange-700' },
    critical: { label: 'Kritik', color: 'bg-red-100 text-red-700' }
  };
  
  const loadFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.category) params.category = filters.category;
      if (filters.priority) params.priority = filters.priority;
      
      const response = await feedbackAPI.getAll(params);
      setFeedbacks(response.data.items || []);
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      toast.error('Geri bildirimler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);
  
  const handleStatusChange = async (feedbackId, newStatus) => {
    try {
      await feedbackAPI.updateStatus(feedbackId, newStatus);
      toast.success('Durum güncellendi');
      loadFeedbacks();
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(prev => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Durum güncellenemedi');
    }
  };
  
  const handleDelete = async (feedbackId) => {
    if (!window.confirm('Bu geri bildirimi silmek istediğinize emin misiniz?')) return;
    
    try {
      await feedbackAPI.delete(feedbackId);
      toast.success('Geri bildirim silindi');
      loadFeedbacks();
      if (selectedFeedback?.id === feedbackId) {
        setDetailOpen(false);
        setSelectedFeedback(null);
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      toast.error('Silinemedi');
    }
  };
  
  const openDetail = (feedback) => {
    setSelectedFeedback(feedback);
    setDetailOpen(true);
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Geri Bildirim Yönetimi</h1>
          <p className="text-gray-500">Kullanıcılardan gelen geri bildirimleri yönetin</p>
        </div>
        <Button onClick={loadFeedbacks} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 items-center flex-wrap">
            <Filter className="h-4 w-4 text-gray-500" />
            
            <Select value={filters.status || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="pending">Bekliyor</SelectItem>
                <SelectItem value="in_progress">İşleniyor</SelectItem>
                <SelectItem value="resolved">Çözüldü</SelectItem>
                <SelectItem value="closed">Kapatıldı</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.category || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, category: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="bug">Hata</SelectItem>
                <SelectItem value="suggestion">Öneri</SelectItem>
                <SelectItem value="question">Soru</SelectItem>
                <SelectItem value="feedback">Görüş</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filters.priority || 'all'} onValueChange={(v) => setFilters(prev => ({ ...prev, priority: v === 'all' ? '' : v }))}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Öncelik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="low">Düşük</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Yüksek</SelectItem>
                <SelectItem value="critical">Kritik</SelectItem>
              </SelectContent>
            </Select>
            
            {(filters.status || filters.category || filters.priority) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilters({ status: '', category: '', priority: '' })}
              >
                <X className="h-4 w-4 mr-1" />
                Temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{feedbacks.length}</p>
            <p className="text-sm text-gray-500">Toplam</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-orange-600">
              {feedbacks.filter(f => f.status === 'pending').length}
            </p>
            <p className="text-sm text-gray-500">Bekleyen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {feedbacks.filter(f => f.category === 'bug').length}
            </p>
            <p className="text-sm text-gray-500">Hata Bildirimi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {feedbacks.filter(f => f.status === 'resolved').length}
            </p>
            <p className="text-sm text-gray-500">Çözüldü</p>
          </CardContent>
        </Card>
      </div>
      
      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Geri Bildirimler</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Yükleniyor...</p>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Henüz geri bildirim yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((fb) => {
                const catConfig = categoryConfig[fb.category] || categoryConfig.feedback;
                const statConfig = statusConfig[fb.status] || statusConfig.pending;
                const prioConfig = priorityConfig[fb.priority] || priorityConfig.normal;
                const CatIcon = catConfig.icon;
                
                return (
                  <div 
                    key={fb.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openDetail(fb)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-lg ${catConfig.color}`}>
                          <CatIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">{fb.title}</h3>
                          <p className="text-sm text-gray-500 line-clamp-1">{fb.description}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            <User className="h-3 w-3" />
                            <span>{fb.user_info?.name || 'Anonim'}</span>
                            <span>•</span>
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(fb.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statConfig.color}>{statConfig.label}</Badge>
                        <Badge variant="outline" className={prioConfig.color}>{prioConfig.label}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedFeedback && categoryConfig[selectedFeedback.category] && (
                <>
                  {React.createElement(categoryConfig[selectedFeedback.category].icon, { className: "h-5 w-5" })}
                  {selectedFeedback.title}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedFeedback && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 pr-4">
                {/* Status & Actions */}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Durum:</span>
                    <Select 
                      value={selectedFeedback.status} 
                      onValueChange={(v) => handleStatusChange(selectedFeedback.id, v)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Bekliyor</SelectItem>
                        <SelectItem value="in_progress">İşleniyor</SelectItem>
                        <SelectItem value="resolved">Çözüldü</SelectItem>
                        <SelectItem value="closed">Kapatıldı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDelete(selectedFeedback.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Sil
                  </Button>
                </div>
                
                {/* Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Kategori:</span>
                    <Badge className={`ml-2 ${categoryConfig[selectedFeedback.category]?.color}`}>
                      {categoryConfig[selectedFeedback.category]?.label}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">Öncelik:</span>
                    <Badge className={`ml-2 ${priorityConfig[selectedFeedback.priority]?.color}`}>
                      {priorityConfig[selectedFeedback.priority]?.label}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-gray-500">Gönderen:</span>
                    <span className="ml-2 font-medium">{selectedFeedback.user_info?.name || 'Anonim'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rol:</span>
                    <span className="ml-2">{selectedFeedback.user_info?.role || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tarih:</span>
                    <span className="ml-2">{formatDate(selectedFeedback.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Ekran:</span>
                    <span className="ml-2">{selectedFeedback.screen_size || '-'}</span>
                  </div>
                </div>
                
                {/* Description */}
                <div>
                  <h4 className="font-medium mb-2">Açıklama</h4>
                  <p className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-lg">
                    {selectedFeedback.description}
                  </p>
                </div>
                
                {/* Screenshots */}
                {selectedFeedback.screenshots?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Ekran Görüntüleri ({selectedFeedback.screenshots.length})</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedFeedback.screenshots.map((ss, idx) => (
                        <div key={idx} className="space-y-1">
                          <ImageViewer 
                            src={ss.data} 
                            alt={ss.name}
                            className="w-full h-40 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                          />
                          <p className="text-xs text-gray-500 truncate">{ss.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* User Agent */}
                {selectedFeedback.user_agent && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Cihaz Bilgisi
                    </h4>
                    <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded font-mono break-all">
                      {selectedFeedback.user_agent}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeedbackAdmin;

