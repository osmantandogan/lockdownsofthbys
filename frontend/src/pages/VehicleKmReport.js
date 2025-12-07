import React, { useState, useEffect } from 'react';
import { vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { TrendingUp, AlertCircle } from 'lucide-react';

const VehicleKmReport = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    try {
      const response = await vehiclesAPI.getAll();
      const vehiclesList = response.data;
      setVehicles(vehiclesList);
      if (vehiclesList.length > 0) {
        const firstId = vehiclesList[0].id || vehiclesList[0]._id;
        setSelectedVehicle(firstId);
        loadReport(firstId);
      }
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast.error('Araçlar yüklenemedi');
    }
  };

  const loadReport = async (vehicleId) => {
    if (!vehicleId) return;
    
    setLoading(true);
    try {
      const response = await vehiclesAPI.getKmReport(vehicleId);
      setReport(response.data);
    } catch (error) {
      console.error('Error loading report:', error);
      toast.error('Rapor yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleChange = (vehicleId) => {
    setSelectedVehicle(vehicleId);
    loadReport(vehicleId);
  };

  const getEfficiencyColor = (rate) => {
    if (rate >= 70) return 'bg-green-100 text-green-800';
    if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Araç KM Raporu</h2>
          <p className="text-gray-500">Vaka ve vardiya KM kullanım analizi</p>
        </div>
        
        <div className="w-64">
          <Select value={selectedVehicle} onValueChange={handleVehicleChange}>
            <SelectTrigger>
              <SelectValue placeholder="Araç Seçin" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => {
                const vehicleId = vehicle.id || vehicle._id;
                return (
                  <SelectItem key={vehicleId} value={vehicleId}>
                    {vehicle.plate}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Mevcut KM
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{report.vehicle.current_km.toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Vardiya KM
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">{report.summary.total_shift_km.toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Vaka KM
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">{report.summary.total_case_km.toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Diğer KM
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600">{report.summary.non_case_km.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Vaka dışı kullanım</p>
              </CardContent>
            </Card>
          </div>

          {/* Efficiency Badge */}
          <Card className={getEfficiencyColor(report.summary.efficiency_rate)}>
            <CardContent className="pt-6 text-center">
              <div className="flex items-center justify-center space-x-2">
                <TrendingUp className="h-6 w-6" />
                <p className="text-2xl font-bold">Verimlilik: {report.summary.efficiency_rate}%</p>
              </div>
              <p className="text-sm mt-2">
                {report.summary.efficiency_rate >= 70 
                  ? '✓ Yüksek verimlilik' 
                  : report.summary.efficiency_rate >= 50
                  ? '⚠ Orta verimlilik'
                  : '⚠ Düşük verimlilik - İnceleme gerekebilir'}
              </p>
            </CardContent>
          </Card>

          {/* Case KM Details */}
          {report.case_details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vaka KM Detayları</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vaka No</TableHead>
                      <TableHead>Sürücü</TableHead>
                      <TableHead>Başlangıç KM</TableHead>
                      <TableHead>Bitiş KM</TableHead>
                      <TableHead>Kullanılan KM</TableHead>
                      <TableHead>Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.case_details.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.case_number}</TableCell>
                        <TableCell>{item.driver_name}</TableCell>
                        <TableCell>{item.start_km.toLocaleString()}</TableCell>
                        <TableCell>{item.end_km.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-green-600">
                          {item.km_used.toLocaleString()} km
                        </TableCell>
                        <TableCell>{item.date ? new Date(item.date).toLocaleDateString('tr-TR') : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Shift KM Details */}
          {report.shift_details.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vardiya KM Detayları</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sürücü</TableHead>
                      <TableHead>Başlangıç KM</TableHead>
                      <TableHead>Bitiş KM</TableHead>
                      <TableHead>Kullanılan KM</TableHead>
                      <TableHead>Başlangıç</TableHead>
                      <TableHead>Bitiş</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.shift_details.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.driver_name}</TableCell>
                        <TableCell>{item.start_km.toLocaleString()}</TableCell>
                        <TableCell>{item.end_km.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold text-blue-600">
                          {item.km_used.toLocaleString()} km
                        </TableCell>
                        <TableCell>{item.start_time ? new Date(item.start_time).toLocaleString('tr-TR') : 'N/A'}</TableCell>
                        <TableCell>{item.end_time ? new Date(item.end_time).toLocaleString('tr-TR') : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {report.case_details.length === 0 && report.shift_details.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Bu araç için henüz KM kaydı bulunmamaktadır.</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">Rapor yükleniyor...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VehicleKmReport;

