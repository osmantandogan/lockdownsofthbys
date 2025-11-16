import React, { useEffect, useState } from 'react';
import { vehiclesAPI } from '../api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [vehiclesRes, statsRes] = await Promise.all([
        vehiclesAPI.getAll(),
        vehiclesAPI.getStats()
      ]);
      setVehicles(vehiclesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast.error('Araçlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    musait: 'bg-green-100 text-green-800',
    gorevde: 'bg-blue-100 text-blue-800',
    bakimda: 'bg-yellow-100 text-yellow-800',
    arizali: 'bg-red-100 text-red-800',
    kullanim_disi: 'bg-gray-100 text-gray-800'
  };

  const statusLabels = {
    musait: 'Müsait',
    gorevde: 'Görevde',
    bakimda: 'Bakımda',
    arizali: 'Arızalı',
    kullanim_disi: 'Kullanım Dışı'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="vehicles-page">
      <div>
        <h1 className="text-3xl font-bold">Araçlar</h1>
        <p className="text-gray-500">Araç filosu yönetimi</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total || 0}</p>
              <p className="text-sm text-gray-500">Toplam</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.available || 0}</p>
              <p className="text-sm text-gray-500">Müsait</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.on_duty || 0}</p>
              <p className="text-sm text-gray-500">Görevde</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.maintenance || 0}</p>
              <p className="text-sm text-gray-500">Bakımda</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.faulty || 0}</p>
              <p className="text-sm text-gray-500">Arızalı</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicles List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id} data-testid={`vehicle-${vehicle.plate}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Truck className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="font-bold text-lg">{vehicle.plate}</p>
                    <p className="text-sm text-gray-500 capitalize">{vehicle.type}</p>
                  </div>
                </div>
                <Badge className={statusColors[vehicle.status]}>
                  {statusLabels[vehicle.status]}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">KM:</span> {vehicle.km}</p>
                {vehicle.fuel_level !== null && (
                  <p><span className="font-medium">Yakıt:</span> %{vehicle.fuel_level}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Vehicles;
