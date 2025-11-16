import React, { useEffect, useState } from 'react';
import { casesAPI, vehiclesAPI, stockAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Activity, Truck, Package, AlertTriangle } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
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
