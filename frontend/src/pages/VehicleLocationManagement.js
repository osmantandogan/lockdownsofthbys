import React, { useState, useEffect } from 'react';
import { vehiclesAPI, locationsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Truck, MapPin, RefreshCw, Save, AlertCircle } from 'lucide-react';

const VehicleLocationManagement = () => {
  const [vehicles, setVehicles] = useState([]);
  const [healmedyLocations, setHealmedyLocations] = useState([]);
  const [vehicleLocations, setVehicleLocations] = useState({}); // {vehicleId: locationId}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Araçları getir
      const vehiclesRes = await vehiclesAPI.getAll({});
      setVehicles(vehiclesRes.data);
      
      // Healmedy lokasyonlarını getir
      const locationsRes = await locationsAPI.getHealmedy();
      setHealmedyLocations(locationsRes.data);
      
      // Mevcut lokasyon atamalarını oluştur
      const locationMap = {};
      for (const v of vehiclesRes.data) {
        if (v.healmedy_location_id || v.current_location_id) {
          locationMap[v.id] = v.healmedy_location_id || v.current_location_id;
        }
      }
      setVehicleLocations(locationMap);
      
    } catch (error) {
      console.error('Veri yüklenirken hata:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationChange = (vehicleId, locationId) => {
    setVehicleLocations(prev => ({
      ...prev,
      [vehicleId]: locationId
    }));
  };

  const saveVehicleLocation = async (vehicleId) => {
    const locationId = vehicleLocations[vehicleId];
    if (!locationId) {
      toast.error('Lütfen bir lokasyon seçin');
      return;
    }

    setSaving(prev => ({ ...prev, [vehicleId]: true }));
    try {
      await locationsAPI.setVehicleLocation(vehicleId, { location_id: locationId });
      toast.success('Araç lokasyonu güncellendi');
      loadData(); // Yeniden yükle
    } catch (error) {
      console.error('Lokasyon güncellenirken hata:', error);
      toast.error(error.response?.data?.detail || 'Lokasyon güncellenemedi');
    } finally {
      setSaving(prev => ({ ...prev, [vehicleId]: false }));
    }
  };

  const getLocationName = (locationId) => {
    const loc = healmedyLocations.find(l => l.id === locationId);
    return loc ? loc.name : 'Belirtilmemiş';
  };

  const getLocationColor = (locationId) => {
    const colorMap = {
      'osman_gazi_fpu': 'bg-blue-100 text-blue-800 border-blue-300',
      'green_zone_ronesans': 'bg-green-100 text-green-800 border-green-300',
      'bati_kuzey_isg': 'bg-purple-100 text-purple-800 border-purple-300',
      'red_zone_kara': 'bg-red-100 text-red-800 border-red-300',
      'dogu_rihtimi': 'bg-orange-100 text-orange-800 border-orange-300'
    };
    return colorMap[locationId] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Lokasyonlara göre araçları grupla
  const vehiclesByLocation = {};
  healmedyLocations.forEach(loc => {
    vehiclesByLocation[loc.id] = vehicles.filter(v => 
      (v.healmedy_location_id === loc.id) || (v.current_location_id === loc.id)
    );
  });
  
  // Lokasyonu olmayan araçlar
  const unassignedVehicles = vehicles.filter(v => 
    !v.healmedy_location_id && !v.current_location_id
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Araç Lokasyon Yönetimi</h1>
          <p className="text-gray-500">Araçların hangi bekleme noktasında olduğunu yönetin</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Yenile
        </Button>
      </div>

      {/* Lokasyonlara göre araçlar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {healmedyLocations.map(location => (
          <Card key={location.id} className="overflow-hidden">
            <CardHeader className={`${getLocationColor(location.id)} border-b`}>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{location.name}</span>
                </div>
                <Badge variant="secondary" className="bg-white/50">
                  {vehiclesByLocation[location.id]?.length || 0} araç
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {vehiclesByLocation[location.id]?.length > 0 ? (
                vehiclesByLocation[location.id].map(vehicle => (
                  <div 
                    key={vehicle.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-semibold">{vehicle.plate}</p>
                        <p className="text-xs text-gray-500">{vehicle.type}</p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline"
                      className={vehicle.status === 'musait' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}
                    >
                      {vehicle.status === 'musait' ? 'Müsait' : vehicle.status === 'gorevde' ? 'Görevde' : 'Bakımda'}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400 py-4">Bu lokasyonda araç yok</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lokasyonu olmayan veya değiştirilecek araçlar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Tüm Araçlar - Lokasyon Atama/Değiştirme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Araç</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Tip</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Mevcut Lokasyon</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Yeni Lokasyon</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Durum</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vehicles.map(vehicle => {
                  const currentLocationId = vehicle.healmedy_location_id || vehicle.current_location_id;
                  const hasChanged = vehicleLocations[vehicle.id] !== currentLocationId;
                  
                  return (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{vehicle.plate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {vehicle.type === 'ambulans' ? 'Ambulans' : 'Araç'}
                      </td>
                      <td className="px-4 py-3">
                        {currentLocationId ? (
                          <Badge className={getLocationColor(currentLocationId)}>
                            {getLocationName(currentLocationId)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Atanmamış</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Select 
                          value={vehicleLocations[vehicle.id] || ''} 
                          onValueChange={(v) => handleLocationChange(vehicle.id, v)}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Lokasyon seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            {healmedyLocations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  {loc.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant="outline"
                          className={vehicle.status === 'musait' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}
                        >
                          {vehicle.status === 'musait' ? 'Müsait' : vehicle.status === 'gorevde' ? 'Görevde' : 'Bakımda'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          size="sm"
                          onClick={() => saveVehicleLocation(vehicle.id)}
                          disabled={saving[vehicle.id] || !vehicleLocations[vehicle.id]}
                          className={hasChanged ? 'bg-blue-600 hover:bg-blue-700' : ''}
                        >
                          {saving[vehicle.id] ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Kaydet
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleLocationManagement;

