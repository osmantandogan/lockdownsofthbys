import React, { useEffect, useState } from 'react';
import { shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Image, Calendar, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ShiftForms = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadShifts();
  }, [dateFilter]);

  const loadShifts = async () => {
    try {
      const response = await shiftsAPI.getHistory({ limit: 100 });
      let shiftsData = response.data;

      // Filter by date if selected
      if (dateFilter) {
        const filterDate = new Date(dateFilter).toDateString();
        shiftsData = shiftsData.filter(s => 
          new Date(s.start_time).toDateString() === filterDate
        );
      }

      setShifts(shiftsData);
    } catch (error) {
      console.error('Error loading shifts:', error);
      toast.error('Vardiyalar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const viewShiftDetails = (shift) => {
    setSelectedShift(shift);
    setDialogOpen(true);
  };

  const canView = ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'].includes(user?.role);

  if (!canView) {
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

  return (
    <div className="space-y-6" data-testid="shift-forms-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vardiya Formları</h1>
          <p className="text-gray-500">Tamamlanmış vardiya formlarını görüntüle</p>
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-48"
          placeholder="Tarih filtrele"
        />
      </div>

      {/* Shifts List */}
      <div className="grid gap-4">
        {shifts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Vardiya kaydı bulunamadı</p>
            </CardContent>
          </Card>
        ) : (
          shifts.map((shift) => (
            <Card key={shift.id} className="cursor-pointer hover:shadow-md" onClick={() => viewShiftDetails(shift)}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-bold">{new Date(shift.start_time).toLocaleDateString('tr-TR')}</span>
                      {shift.end_time ? (
                        <Badge className="bg-green-100 text-green-800">Tamamlandı</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800">Devam Ediyor</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><span className="font-medium">Araç:</span> {shift.vehicle_id}</p>
                      <p><span className="font-medium">Kullanıcı:</span> {shift.user_id}</p>
                      <p>
                        <span className="font-medium">Süre:</span>{' '}
                        {shift.duration_minutes ? `${Math.floor(shift.duration_minutes / 60)}s ${shift.duration_minutes % 60}d` : 'Devam ediyor'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      {shift.photos && (
                        <div className="flex items-center space-x-1">
                          <Image className="h-3 w-3" />
                          <span>6+ fotoğraf</span>
                        </div>
                      )}
                      {shift.daily_control && (
                        <div className="flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span>Günlük kontrol</span>
                        </div>
                      )}
                      {shift.handover_form && (
                        <div className="flex items-center space-x-1">
                          <FileText className="h-3 w-3" />
                          <span>Devir teslim</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* View Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vardiya Detayları</DialogTitle>
          </DialogHeader>
          
          {selectedShift && (
            <div className="space-y-4 py-4">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Genel Bilgiler</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="font-medium">Tarih:</span> {new Date(selectedShift.start_time).toLocaleString('tr-TR')}</p>
                  <p><span className="font-medium">Araç:</span> {selectedShift.vehicle_id}</p>
                  <p><span className="font-medium">Kullanıcı:</span> {selectedShift.user_id}</p>
                  {selectedShift.end_time && (
                    <p><span className="font-medium">Bitiş:</span> {new Date(selectedShift.end_time).toLocaleString('tr-TR')}</p>
                  )}
                  {selectedShift.duration_minutes && (
                    <p><span className="font-medium">Toplam Süre:</span> {Math.floor(selectedShift.duration_minutes / 60)}s {selectedShift.duration_minutes % 60}d</p>
                  )}
                </CardContent>
              </Card>

              {/* Photos */}
              {selectedShift.photos && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Araç Fotoğrafları</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedShift.photos.front && (
                        <div>
                          <p className="text-xs font-medium mb-1">Ön</p>
                          <img src={selectedShift.photos.front} alt="Ön" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                      {selectedShift.photos.back && (
                        <div>
                          <p className="text-xs font-medium mb-1">Arka</p>
                          <img src={selectedShift.photos.back} alt="Arka" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                      {selectedShift.photos.left && (
                        <div>
                          <p className="text-xs font-medium mb-1">Sol</p>
                          <img src={selectedShift.photos.left} alt="Sol" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                      {selectedShift.photos.right && (
                        <div>
                          <p className="text-xs font-medium mb-1">Sağ</p>
                          <img src={selectedShift.photos.right} alt="Sağ" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                      {selectedShift.photos.trunk && (
                        <div>
                          <p className="text-xs font-medium mb-1">Bagaj</p>
                          <img src={selectedShift.photos.trunk} alt="Bagaj" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                      {selectedShift.photos.interior && (
                        <div>
                          <p className="text-xs font-medium mb-1">İç Kabin</p>
                          <img src={selectedShift.photos.interior} alt="İç" className="w-full h-32 object-cover rounded border" />
                        </div>
                      )}
                    </div>
                    {selectedShift.photos.damages && selectedShift.photos.damages.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Hasar Fotoğrafları:</p>
                        <div className="grid grid-cols-3 gap-4">
                          {selectedShift.photos.damages.map((photo, index) => (
                            <img key={index} src={photo} alt={`Hasar ${index + 1}`} className="w-full h-32 object-cover rounded border" />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Daily Control Form */}
              {selectedShift.daily_control && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Günlük Kontrol Formu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {Object.entries(selectedShift.daily_control).map(([key, value]) => (
                        <div key={key} className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="font-medium">{key}:</span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Handover Form */}
              {selectedShift.handover_form && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Devir Teslim Formu</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedShift.handover_form.teslimAlinanKm && (
                      <p><span className="font-medium">Teslim Alınan KM:</span> {selectedShift.handover_form.teslimAlinanKm}</p>
                    )}
                    {selectedShift.handover_form.servisYapilacakKm && (
                      <p><span className="font-medium">Servis Yapılacak KM:</span> {selectedShift.handover_form.servisYapilacakKm}</p>
                    )}
                    {selectedShift.handover_form.teslimEden && (
                      <p><span className="font-medium">Teslim Eden:</span> {selectedShift.handover_form.teslimEden}</p>
                    )}
                    {selectedShift.handover_form.teslimAlan && (
                      <p><span className="font-medium">Teslim Alan:</span> {selectedShift.handover_form.teslimAlan}</p>
                    )}
                    {selectedShift.handover_form.teslimEdenNotlar && (
                      <div>
                        <p className="font-medium mb-1">Teslim Edenin Notları:</p>
                        <p className="bg-gray-50 p-3 rounded">{selectedShift.handover_form.teslimEdenNotlar}</p>
                      </div>
                    )}
                    {selectedShift.handover_form.hasarBildirimi && (
                      <div>
                        <p className="font-medium mb-1">Hasar Bildirimi:</p>
                        <p className="bg-red-50 p-3 rounded text-red-800">{selectedShift.handover_form.hasarBildirimi}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftForms;
