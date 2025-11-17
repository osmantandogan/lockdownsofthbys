import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { shiftsAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import HandoverForm from '../components/HandoverForm';
import { Clock, CheckCircle } from 'lucide-react';

const ShiftEnd = () => {
  const navigate = useNavigate();
  const [activeShift, setActiveShift] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [handoverForm, setHandoverForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const shiftRes = await shiftsAPI.getActive();
      
      if (!shiftRes.data) {
        toast.error('Aktif vardiya bulunamadı');
        navigate('/dashboard/shifts');
        return;
      }

      setActiveShift(shiftRes.data);

      // Get vehicle info
      const vehicleRes = await vehiclesAPI.getById(shiftRes.data.vehicle_id);
      setVehicle(vehicleRes.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Vardiya bilgileri yüklenemedi');
      navigate('/dashboard/shifts');
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeShift) return;

    if (!confirm('Vardiyayı bitirmek istediğinizden emin misiniz?')) return;

    setSubmitting(true);
    try {
      await shiftsAPI.end({
        shift_id: activeShift.id,
        handover_form: handoverForm,
        notes: handoverForm.teslimEdenNotlar
      });

      toast.success('Vardiya başarıyla sonlandırıldı!');
      navigate('/dashboard/shifts');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Vardiya sonlandırılamadı');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const duration = activeShift ? Math.floor((new Date() - new Date(activeShift.start_time)) / 1000 / 60) : 0;

  return (
    <div className="space-y-6" data-testid="shift-end-page">
      <div>
        <h1 className="text-3xl font-bold">Vardiya Bitir</h1>
        <p className="text-gray-500">Devir teslim formunu doldurun</p>
      </div>

      {/* Active Shift Info */}
      <Card className="border-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Aktif Vardiya Bilgileri</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><span className="font-medium">Araç:</span> {vehicle?.plate}</p>
          <p><span className="font-medium">Başlangıç:</span> {new Date(activeShift.start_time).toLocaleString('tr-TR')}</p>
          <p><span className="font-medium">Süre:</span> {Math.floor(duration / 60)} saat {duration % 60} dakika</p>
          <p><span className="font-medium">KM:</span> {vehicle?.km?.toLocaleString()} km</p>
        </CardContent>
      </Card>

      {/* Handover Form */}
      <HandoverForm
        formData={handoverForm}
        onChange={setHandoverForm}
        vehiclePlate={vehicle?.plate}
        vehicleKm={vehicle?.km}
      />

      {/* Summary */}
      <Card className="border-green-500 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Vardiyayı Bitirmeye Hazır</h3>
              </div>
              <p className="text-sm text-green-700">
                Toplam süre: {Math.floor(duration / 60)} saat {duration % 60} dakika
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard/shifts')}
              >
                İptal
              </Button>
              <Button
                onClick={handleEndShift}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
                data-testid="end-shift-button"
              >
                {submitting ? 'Bitiriliyor...' : 'Vardiyayı Bitir'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftEnd;
