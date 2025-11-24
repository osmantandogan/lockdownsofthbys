import React, { useEffect, useState } from 'react';
import { reportsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Truck, Package, Clock, AlertTriangle } from 'lucide-react';

const Reports = () => {
  const [caseStats, setCaseStats] = useState(null);
  const [personnel, setPersonnel] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [stockMovement, setStockMovement] = useState([]);
  const [interventionTime, setInterventionTime] = useState(null);
  const [criticalStock, setCriticalStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadReports();
  }, [dateRange]);

  const loadReports = async () => {
    try {
      const [caseRes, personnelRes, vehicleRes, stockRes, timeRes, alertRes] = await Promise.all([
        reportsAPI.caseStatistics(dateRange),
        reportsAPI.personnelPerformance(dateRange),
        reportsAPI.vehicleUsage(dateRange),
        reportsAPI.stockMovement(),
        reportsAPI.interventionTime(),
        reportsAPI.criticalStockAlert()
      ]);
      
      setCaseStats(caseRes.data);
      setPersonnel(personnelRes.data.personnel);
      setVehicles(vehicleRes.data.vehicles);
      setStockMovement(stockRes.data.stock_items);
      setInterventionTime(timeRes.data);
      setCriticalStock(alertRes.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Raporlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Raporlar</h1>
          <p className="text-gray-500">İstatistikler ve analizler</p>
        </div>
        <div className="flex space-x-2">
          <div className="space-y-1">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Vaka İstatistikleri</TabsTrigger>
          <TabsTrigger value="personnel">Personel</TabsTrigger>
          <TabsTrigger value="vehicles">Araçlar</TabsTrigger>
          <TabsTrigger value="stock">Stok</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-4">
          {caseStats && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card><CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold">{caseStats.total_cases}</p>
                  <p className="text-sm text-gray-500">Toplam Vaka</p>
                </CardContent></Card>
                <Card><CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">{caseStats.by_priority.high}</p>
                  <p className="text-sm text-gray-500">Yüksek Öncelik</p>
                </CardContent></Card>
                <Card><CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{caseStats.by_priority.medium}</p>
                  <p className="text-sm text-gray-500">Orta Öncelik</p>
                </CardContent></Card>
                <Card><CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-green-600">{caseStats.by_priority.low}</p>
                  <p className="text-sm text-gray-500">Düşük Öncelik</p>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader><CardTitle>Günlük Vaka Trendi (Son 30 Gün)</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={caseStats.daily_breakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Vaka Sayısı" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Durum Dağılımı</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(caseStats.by_status).map(([k,v]) => ({name: k, value: v}))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="personnel" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Personel Performans</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {personnel.slice(0, 10).map((p, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{p.user_name}</p>
                      <p className="text-xs text-gray-500">{p.role}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p>Vakalar: <strong>{p.cases_created}</strong></p>
                      <p>Vardiya: <strong>{p.shifts_completed}</strong></p>
                      <p>Saat: <strong>{p.total_hours}s</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Araç Kullanım</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={vehicles}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plate" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="cases_count" fill="#3b82f6" name="Vaka" />
                  <Bar dataKey="shifts_count" fill="#10b981" name="Vardiya" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock" className="space-y-4">
          {criticalStock && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-red-500"><CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{criticalStock.critical_stock.length}</p>
                  <p className="text-sm">Kritik Stok</p>
                </CardContent></Card>
                <Card className="border-orange-500"><CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-600">{criticalStock.expired_items.length}</p>
                  <p className="text-sm">Süresi Dolmuş</p>
                </CardContent></Card>
                <Card className="border-yellow-500"><CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">{criticalStock.expiring_soon.length}</p>
                  <p className="text-sm">Dolacak (30 gün)</p>
                </CardContent></Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
