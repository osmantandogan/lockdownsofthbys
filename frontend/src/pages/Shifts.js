import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Clock, QrCode, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Shifts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeShift, setActiveShift] = useState(null);
  const [myAssignments, setMyAssignments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [activeRes, assignmentsRes, historyRes] = await Promise.all([
        shiftsAPI.getActive(),
        shiftsAPI.getMyAssignments(),
        shiftsAPI.getHistory({ limit: 10 })
      ]);
      setActiveShift(activeRes.data);
      setMyAssignments(assignmentsRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error loading shifts:', error);
      toast.error('Vardiya bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    if (!confirm('Vardiyayı bitirmek istediğinizden emin misiniz?')) return;

    try {
      await shiftsAPI.end({ shift_id: activeShift.id });
      toast.success('Vardiya sonlandırıldı');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Vardiya sonlandırılamadı');
    }
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}s ${mins}d`;
  };

  const canManageAssignments = ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'].includes(user?.role);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="shifts-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vardiya Yönetimi</h1>
          <p className="text-gray-500">Vardiya başlat ve bitir</p>
        </div>
        {canManageAssignments && (
          <Button onClick={() => navigate('/dashboard/shift-assignments')} variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Atama Yönetimi
          </Button>
        )}
      </div>

      {/* Active Shift */}
      {activeShift ? (
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span>Aktif Vardiya</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p><span className="font-medium">Araç:</span> {activeShift.vehicle_id}</p>
              <p><span className="font-medium">Başlangıç:</span> {new Date(activeShift.start_time).toLocaleString('tr-TR')}</p>
              <p>
                <span className="font-medium">Süre:</span> 
                {Math.floor((new Date() - new Date(activeShift.start_time)) / 1000 / 60)} dakika
              </p>
            </div>
            
            {/* Photos preview */}
            {activeShift.photos && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-2">Çekilen Fotoğraflar:</p>
                <div className="grid grid-cols-3 gap-2">
                  {activeShift.photos.front && <img src={activeShift.photos.front} alt="Ön" className="w-full h-20 object-cover rounded" />}
                  {activeShift.photos.back && <img src={activeShift.photos.back} alt="Arka" className="w-full h-20 object-cover rounded" />}
                  {activeShift.photos.left && <img src={activeShift.photos.left} alt="Sol" className="w-full h-20 object-cover rounded" />}
                  {activeShift.photos.right && <img src={activeShift.photos.right} alt="Sağ" className="w-full h-20 object-cover rounded" />}
                  {activeShift.photos.trunk && <img src={activeShift.photos.trunk} alt="Bagaj" className="w-full h-20 object-cover rounded" />}
                  {activeShift.photos.interior && <img src={activeShift.photos.interior} alt="İç" className="w-full h-20 object-cover rounded" />}
                </div>
              </div>
            )}
            
            <Button onClick={handleEndShift} variant="destructive" className="w-full" data-testid="end-shift-button">
              Vardiyayı Bitir
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* My Assignments */}
          {myAssignments.length > 0 ? (
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="text-green-700">Bekleyen Vardiyalarınız</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myAssignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 bg-green-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {new Date(assignment.shift_date).toLocaleDateString('tr-TR')}
                        </p>
                        <p className="text-sm text-gray-600">Araç: {assignment.vehicle_id}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        {assignment.status === 'pending' ? 'Bekliyor' : 'Başladı'}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button onClick={() => navigate('/dashboard/shift-start')} className="w-full" data-testid="start-shift-button">
                  <QrCode className="h-4 w-4 mr-2" />
                  Vardiya Başlat (QR)
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Clock className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="text-gray-500">Aktif vardiya yok</p>
                <p className="text-sm text-gray-400">Size atanmış bir vardiya bulunmuyor.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Vardiya Geçmişi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Geçmiş vardiya bulunamadı</p>
            ) : (
              history.map((shift) => (
                <div key={shift.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{new Date(shift.start_time).toLocaleDateString('tr-TR')}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(shift.start_time).toLocaleTimeString('tr-TR')} - 
                      {shift.end_time ? new Date(shift.end_time).toLocaleTimeString('tr-TR') : 'Devam ediyor'}
                    </p>
                  </div>
                  {shift.duration_minutes && (
                    <div className="text-right">
                      <p className="font-medium">{formatDuration(shift.duration_minutes)}</p>
                      <p className="text-sm text-gray-500">Araç: {shift.vehicle_id}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Shifts;


export default Shifts;
