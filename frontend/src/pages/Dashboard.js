import React, { useEffect, useState } from 'react';
import { casesAPI, vehiclesAPI, stockAPI, shiftsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Activity, Truck, Package, AlertTriangle, Users, Building2, Clock, User } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeCases: 0,
    availableVehicles: 0,
    highPriorityCases: 0,
    criticalStock: 0,
    expired: 0,
    expiringSoon: 0
  });
  const [todayAssignments, setTodayAssignments] = useState({
    vehicle_assignments: [],
    health_center_assignments: [],
    total_count: 0,
    date: ''
  });
  const [loading, setLoading] = useState(true);

  // Rol isimlerini Türkçeleştirme
  const roleLabels = {
    sofor: 'Şoför',
    bas_sofor: 'Baş Şoför',
    hemsire: 'Hemşire',
    doktor: 'Doktor',
    paramedik: 'Paramedik',
    att: 'ATT',
    merkez_ofis: 'Merkez Ofis',
    operasyon_muduru: 'Operasyon Müdürü',
    cagri_merkezi: 'Çağrı Merkezi'
  };

  const getRoleLabel = (role) => roleLabels[role] || role;

  useEffect(() => {
    loadStats();
    loadTodayAssignments();
  }, []);

  const loadStats = async () => {
    try {
      const [casesRes, vehiclesRes, stockRes] = await Promise.all([
        casesAPI.getStats(),
        vehiclesAPI.getStats(),
        stockAPI.getAlerts()
      ]);

      setStats({
        activeCases: casesRes.data.active_cases,
        availableVehicles: vehiclesRes.data.available,
        highPriorityCases: casesRes.data.high_priority_cases,
        criticalStock: stockRes.data.critical_stock,
        expired: stockRes.data.expired,
        expiringSoon: stockRes.data.expiring_soon
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('İstatistikler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const loadTodayAssignments = async () => {
    try {
      const response = await shiftsAPI.getTodayAssignments();
      setTodayAssignments(response.data);
    } catch (error) {
      console.error('Error loading today assignments:', error);
    }
  };

  // Araç atamalarını araç plakasına göre grupla
  const groupByVehicle = (assignments) => {
    const grouped = {};
    assignments.forEach(a => {
      const plate = a.vehicle_plate || 'Bilinmeyen Araç';
      if (!grouped[plate]) {
        grouped[plate] = {
          plate,
          vehicle_type: a.vehicle_type || '',
          staff: []
        };
      }
      grouped[plate].staff.push(a);
    });
    return Object.values(grouped);
  };

  const StatCard = ({ title, value, icon: Icon, color, testId }) => (
    <Card data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? '...' : value}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500">Sistem durumuna genel bakış</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Aktif Vakalar"
          value={stats.activeCases}
          icon={Activity}
          color="text-blue-600"
          testId="stat-active-cases"
        />
        <StatCard
          title="Müsait Araçlar"
          value={stats.availableVehicles}
          icon={Truck}
          color="text-green-600"
          testId="stat-available-vehicles"
        />
        <StatCard
          title="Yüksek Öncelikli"
          value={stats.highPriorityCases}
          icon={AlertTriangle}
          color="text-red-600"
          testId="stat-high-priority"
        />
        <StatCard
          title="Kritik Stok"
          value={stats.criticalStock}
          icon={Package}
          color="text-orange-600"
          testId="stat-critical-stock"
        />
      </div>

      {/* Stok Uyarıları */}
      {(stats.criticalStock > 0 || stats.expired > 0 || stats.expiringSoon > 0) && (
        <Card data-testid="stock-alerts">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span>Stok Uyarıları</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.criticalStock > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-red-900">
                  Kritik Seviyede Stok
                </span>
                <span className="text-sm font-bold text-red-600">{stats.criticalStock}</span>
              </div>
            )}
            {stats.expired > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium text-orange-900">
                  Süresi Dolmuş Ürünler
                </span>
                <span className="text-sm font-bold text-orange-600">{stats.expired}</span>
              </div>
            )}
            {stats.expiringSoon > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <span className="text-sm font-medium text-yellow-900">
                  Süresi Dolacak Ürünler (30 gün)
                </span>
                <span className="text-sm font-bold text-yellow-600">{stats.expiringSoon}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bugünkü Görevli Personel */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xl font-bold">Bugün Sahada</span>
                <p className="text-indigo-100 text-sm font-normal mt-0.5">
                  {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>
            <Badge className="bg-white/20 text-white border-0 text-lg px-3 py-1">
              {todayAssignments.total_count} Personel
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {todayAssignments.total_count === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500">Bugün için atama yok</p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Araçlardaki Personel */}
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Truck className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Araçlarda Görevli</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {todayAssignments.vehicle_assignments?.length || 0}
                  </Badge>
                </div>
                
                {groupByVehicle(todayAssignments.vehicle_assignments || []).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    Araçta görevli personel yok
                  </p>
                ) : (
                  <div className="space-y-3">
                    {groupByVehicle(todayAssignments.vehicle_assignments || []).map((vehicle, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100"
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <span className="text-2xl">🚑</span>
                          <span className="font-bold text-blue-700">{vehicle.plate}</span>
                        </div>
                        <div className="space-y-2">
                          {vehicle.staff.map((person, pIdx) => (
                            <div 
                              key={pIdx}
                              className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm"
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                  {(person.user_name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <span className="font-medium text-sm">{person.user_name}</span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {getRoleLabel(person.user_role)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Sağlık Merkezindeki Personel */}
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  <div className="p-1.5 bg-emerald-100 rounded-lg">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Sağlık Merkezinde</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {todayAssignments.health_center_assignments?.length || 0}
                  </Badge>
                </div>
                
                {(todayAssignments.health_center_assignments || []).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                    Sağlık merkezinde görevli yok
                  </p>
                ) : (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-2xl">🏥</span>
                      <span className="font-bold text-emerald-700">Sağlık Merkezi</span>
                    </div>
                    <div className="space-y-2">
                      {(todayAssignments.health_center_assignments || []).map((person, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 shadow-sm"
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">
                              {(person.user_name || '?').split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div>
                              <span className="font-medium text-sm block">{person.user_name}</span>
                              {person.start_time && person.end_time && (
                                <span className="text-xs text-gray-500 flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {person.start_time} - {person.end_time}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs bg-emerald-50 border-emerald-200 text-emerald-700">
                            {getRoleLabel(person.user_role)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hızlı Aksiyonlar */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı Aksiyonlar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => window.location.href = '/dashboard/call-center'}
            className="p-4 text-left rounded-lg border hover:border-blue-500 hover:bg-blue-50 transition-colors"
            data-testid="quick-action-new-case"
          >
            <Activity className="h-6 w-6 text-blue-600 mb-2" />
            <div className="font-medium">Yeni Vaka</div>
            <div className="text-xs text-gray-500">Vaka oluştur</div>
          </button>
          <button
            onClick={() => window.location.href = '/dashboard/cases'}
            className="p-4 text-left rounded-lg border hover:border-green-500 hover:bg-green-50 transition-colors"
            data-testid="quick-action-cases"
          >
            <Activity className="h-6 w-6 text-green-600 mb-2" />
            <div className="font-medium">Vakalar</div>
            <div className="text-xs text-gray-500">Vaka listesi</div>
          </button>
          <button
            onClick={() => window.location.href = '/dashboard/stock'}
            className="p-4 text-left rounded-lg border hover:border-orange-500 hover:bg-orange-50 transition-colors"
            data-testid="quick-action-stock"
          >
            <Package className="h-6 w-6 text-orange-600 mb-2" />
            <div className="font-medium">Stok</div>
            <div className="text-xs text-gray-500">Stok yönetimi</div>
          </button>
          <button
            onClick={() => window.location.href = '/dashboard/shifts'}
            className="p-4 text-left rounded-lg border hover:border-purple-500 hover:bg-purple-50 transition-colors"
            data-testid="quick-action-shift"
          >
            <Activity className="h-6 w-6 text-purple-600 mb-2" />
            <div className="font-medium">Vardiya</div>
            <div className="text-xs text-gray-500">Vardiya başlat</div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
