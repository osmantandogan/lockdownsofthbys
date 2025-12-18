import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Clock, QrCode, Calendar, CheckCircle, FileText, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Türkiye saati yardımcı fonksiyonu (UTC+3)
const getTurkeyTime = () => {
  const now = new Date();
  const turkeyOffset = 3 * 60; // UTC+3 dakika cinsinden
  return new Date(now.getTime() + (turkeyOffset + now.getTimezoneOffset()) * 60000);
};

// Tarihin bugün olup olmadığını kontrol et
const isToday = (dateStr) => {
  const today = getTurkeyTime();
  const todayStr = today.toISOString().split('T')[0];
  const checkDate = dateStr?.split('T')[0];
  return todayStr === checkDate;
};

// Bu ay içinde mi kontrol et
const isCurrentMonth = (dateStr) => {
  const today = getTurkeyTime();
  const checkDate = new Date(dateStr);
  return today.getFullYear() === checkDate.getFullYear() && 
         today.getMonth() === checkDate.getMonth();
};

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
  
  // Sağlık merkezi çalışanları için otomatik başlatma var, manuel başlatma butonu gösterme
  const healthCenterRoles = ['hemsire', 'cagri_merkezi', 'bas_sofor', 'doktor', 'operasyon_muduru', 'merkez_ofis'];
  const isHealthCenterEmployee = healthCenterRoles.includes(user?.role);

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
        <div className="flex space-x-2">
          {canManageAssignments && (
            <>
              <Button onClick={() => navigate('/dashboard/shift-forms')} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Formları Görüntüle
              </Button>
              <Button onClick={() => navigate('/dashboard/shift-assignments')} variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Atama Yönetimi
              </Button>
            </>
          )}
        </div>
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
              <p><span className="font-medium">Araç:</span> {activeShift.vehicle_plate || activeShift.vehicle?.plate || activeShift.vehicle_id}</p>
              <p><span className="font-medium">Başlangıç:</span> {(() => {
                // Start time'ı UTC+3'e çevir
                const startTime = new Date(activeShift.start_time);
                const turkeyOffset = 3 * 60;
                const turkeyStartTime = new Date(startTime.getTime() + (turkeyOffset + startTime.getTimezoneOffset()) * 60000);
                return turkeyStartTime.toLocaleString('tr-TR');
              })()}</p>
              <p>
                <span className="font-medium">Süre:</span>{' '}
                {(() => {
                  // UTC+3 saatine göre süre hesapla
                  const startTime = new Date(activeShift.start_time);
                  const turkeyNow = getTurkeyTime();
                  const durationMs = turkeyNow - startTime;
                  const durationMinutes = Math.floor(durationMs / 1000 / 60);
                  const hours = Math.floor(durationMinutes / 60);
                  const mins = durationMinutes % 60;
                  return hours > 0 ? `${hours} saat ${mins} dakika` : `${durationMinutes} dakika`;
                })()}
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
            
            <Button onClick={() => navigate('/dashboard/shift-end')} variant="destructive" className="w-full" data-testid="end-shift-button">
              Vardiyayı Bitir
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* My Assignments - Bu aya ait olanlar */}
          {(() => {
            // Sadece bu aya ait atamaları filtrele
            const currentMonthAssignments = myAssignments.filter(a => isCurrentMonth(a.shift_date));
            const todayAssignment = currentMonthAssignments.find(a => isToday(a.shift_date) && a.status === 'pending');
            
            // Sağlık merkezi çalışanı ve sağlık merkezi ataması varsa manuel başlatma butonunu gizle
            const isHealthCenterAssignment = todayAssignment?.location_type === 'saglik_merkezi';
            const shouldHideStartButton = isHealthCenterEmployee && isHealthCenterAssignment;
            
            return currentMonthAssignments.length > 0 ? (
              <Card className="border-green-500">
                <CardHeader>
                  <CardTitle className="text-green-700 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Bu Ayki Vardiyalarınız
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentMonthAssignments.map((assignment) => {
                    const isTodayShift = isToday(assignment.shift_date);
                    const isHealthCenter = assignment.location_type === 'saglik_merkezi';
                    
                    return (
                      <div 
                        key={assignment.id} 
                        className={`p-4 rounded-lg border ${
                          isTodayShift 
                            ? 'bg-green-50 border-green-300' 
                            : 'bg-gray-50 border-gray-200 opacity-70'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className={`font-medium flex items-center gap-2 ${isTodayShift ? 'text-green-800' : 'text-gray-600'}`}>
                              {!isTodayShift && <Lock className="h-3 w-3" />}
                              {new Date(assignment.shift_date).toLocaleDateString('tr-TR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                              })}
                              {isTodayShift && <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">BUGÜN</span>}
                            </p>
                            <p className="text-sm text-gray-600">
                              {isHealthCenter ? (
                                <>Lokasyon: {assignment.health_center_name || 'Sağlık Merkezi'}</>
                              ) : (
                                <>Araç: {assignment.vehicle_plate || assignment.vehicle?.plate || 'Atanmadı'}</>
                              )}
                            </p>
                            {isHealthCenter && isTodayShift && assignment.status === 'pending' && (
                              <p className="text-xs text-blue-600 mt-1">
                                ⏰ Vardiyanız çalışma saati geldiğinde otomatik başlatılacak
                              </p>
                            )}
                          </div>
                          <Badge className={
                            isTodayShift && assignment.status === 'pending'
                              ? 'bg-green-100 text-green-800'
                              : assignment.status === 'started'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-600'
                          }>
                            {assignment.status === 'pending' 
                              ? (isTodayShift ? (isHealthCenter ? 'Otomatik Başlatılacak' : 'Başlatılabilir') : 'Bekliyor') 
                              : assignment.status === 'started' 
                              ? 'Başladı' 
                              : assignment.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Sağlık merkezi çalışanları için vardiya başlat butonunu gizle */}
                  {todayAssignment && !shouldHideStartButton ? (
                    <Button onClick={() => navigate('/dashboard/shift-start')} className="w-full bg-green-600 hover:bg-green-700" data-testid="start-shift-button">
                      <QrCode className="h-4 w-4 mr-2" />
                      Bugünkü Vardiyayı Başlat (QR)
                    </Button>
                  ) : todayAssignment && shouldHideStartButton ? (
                    <div className="text-center py-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700 font-medium">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Vardiyanız çalışma saati geldiğinde otomatik olarak başlatılacaktır
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Manuel başlatma gerekmez
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-3 bg-gray-100 rounded-lg">
                      <p className="text-sm text-gray-500">
                        <Lock className="h-4 w-4 inline mr-1" />
                        Bugün için başlatılabilir vardiya bulunmuyor
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Clock className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="text-gray-500">Aktif vardiya yok</p>
                <p className="text-sm text-gray-400">Bu ay için size atanmış bir vardiya bulunmuyor.</p>
              </CardContent>
            </Card>
            );
          })()}
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
                      <p className="text-sm text-gray-500">Araç: {shift.vehicle_plate || shift.vehicle_id}</p>
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
