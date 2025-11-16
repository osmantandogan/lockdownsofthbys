import React, { useEffect, useState } from 'react';
import { shiftsAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Clock, QrCode } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

const Shifts = () => {
  const [activeShift, setActiveShift] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [scanner, setScanner] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        shiftsAPI.getActive(),
        shiftsAPI.getHistory({ limit: 10 })
      ]);
      setActiveShift(activeRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Error loading shifts:', error);
      toast.error('Vardiya bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const startQRScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      setScanner(html5QrCode);

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          await html5QrCode.stop();
          setQrDialogOpen(false);
          handleStartShift(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      );
    } catch (err) {
      console.error('Error starting scanner:', err);
      toast.error('Kamera açılamadı');
    }
  };

  const stopQRScanner = async () => {
    if (scanner) {
      try {
        await scanner.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const handleStartShift = async (vehicleQr) => {
    try {
      await shiftsAPI.start({ vehicle_qr: vehicleQr });
      toast.success('Vardiya başlatıldı');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Vardiya başlatılamadı');
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="shifts-page">
      <div>
        <h1 className="text-3xl font-bold">Vardiya Yönetimi</h1>
        <p className="text-gray-500">Vardiya başlat ve bitir</p>
      </div>

      {/* Active Shift */}
      {activeShift ? (
        <Card>
          <CardHeader>
            <CardTitle>Aktif Vardiya</CardTitle>
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
            <Button onClick={handleEndShift} variant="destructive" data-testid="end-shift-button">
              Vardiyayı Bitir
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Clock className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="text-gray-500">Aktif vardiya yok</p>
            <Button onClick={() => setQrDialogOpen(true)} data-testid="start-shift-button">
              <QrCode className="h-4 w-4 mr-2" />
              Vardiya Başlat (QR)
            </Button>
          </CardContent>
        </Card>
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

      {/* QR Scanner Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={(open) => {
        setQrDialogOpen(open);
        if (!open) stopQRScanner();
        else startQRScanner();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Araç QR Kodunu Okutun</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div id="qr-reader" className="w-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shifts;
