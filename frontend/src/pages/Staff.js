import React, { useState, useEffect } from 'react';
import { usersAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { Users, TrendingUp, Clock, MapPin, Search, Settings, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from './UserManagement';
import FirmManagement from './FirmManagement';

const Staff = () => {
  const { user } = useAuth();
  const canManageUsers = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);
  const [staffData, setStaffData] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStaffPerformance();
  }, []);

  useEffect(() => {
    // Filter staff by search term
    if (searchTerm) {
      const filtered = staffData.filter(staff => 
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.role.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStaff(filtered);
    } else {
      setFilteredStaff(staffData);
    }
  }, [searchTerm, staffData]);

  const fetchStaffPerformance = async () => {
    try {
      const response = await usersAPI.getStaffPerformance();
      setStaffData(response.data);
      setFilteredStaff(response.data);
    } catch (error) {
      console.error('Error fetching staff performance:', error);
      toast.error('Personel verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      'merkez_ofis': 'Merkez Ofis',
      'operasyon_muduru': 'Operasyon Müdürü',
      'doktor': 'Doktor',
      'hemsire': 'Hemşire',
      'paramedik': 'Paramedik',
      'att': 'ATT',
      'bas_sofor': 'Baş Şoför',
      'sofor': 'Şoför',
      'cagri_merkezi': 'Çağrı Merkezi',
      'personel': 'Personel'
    };
    return labels[role] || role;
  };

  const getEfficiencyBadge = (rate) => {
    if (rate >= 70) return { variant: 'default', label: 'Yüksek', color: 'bg-green-100 text-green-800' };
    if (rate >= 50) return { variant: 'secondary', label: 'Orta', color: 'bg-yellow-100 text-yellow-800' };
    return { variant: 'destructive', label: 'Düşük', color: 'bg-red-100 text-red-800' };
  };

  // Calculate totals
  const totals = filteredStaff.reduce((acc, staff) => ({
    shifts: acc.shifts + staff.total_shifts,
    hours: acc.hours + staff.total_hours,
    cases: acc.cases + staff.total_cases,
    shiftKm: acc.shiftKm + staff.total_shift_km,
    caseKm: acc.caseKm + staff.case_km
  }), { shifts: 0, hours: 0, cases: 0, shiftKm: 0, caseKm: 0 });

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
          <h1 className="text-3xl font-bold">Personel</h1>
          <p className="text-gray-500">Personel performansı ve yönetimi</p>
        </div>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className={`grid w-full max-w-lg ${canManageUsers ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Performans
          </TabsTrigger>
          {canManageUsers && (
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Kullanıcı Yönetimi
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="firms" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Firma Yönetimi
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="performance" className="mt-6 space-y-6">
          {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{filteredStaff.length}</p>
              <p className="text-sm text-gray-500">Toplam Personel</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.shifts}</p>
              <p className="text-sm text-gray-500">Toplam Vardiya</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{Math.round(totals.hours)}</p>
              <p className="text-sm text-gray-500">Toplam Saat</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl mx-auto mb-2">🚑</div>
              <p className="text-2xl font-bold">{totals.cases}</p>
              <p className="text-sm text-gray-500">Toplam Vaka</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <MapPin className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{totals.shiftKm.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Toplam KM</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-gray-400" />
        <Input
          placeholder="Personel ara (isim, email, rol)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Personel Listesi ve Performans Metrikleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="text-center">Vardiya</TableHead>
                  <TableHead className="text-center">Çalışma Saati</TableHead>
                  <TableHead className="text-center">Vaka Sayısı</TableHead>
                  <TableHead className="text-right">Vardiya KM</TableHead>
                  <TableHead className="text-right">Vaka KM</TableHead>
                  <TableHead className="text-right">Diğer KM</TableHead>
                  <TableHead className="text-center">Verimlilik</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz personel verisi yok'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStaff.map((staff) => {
                    const efficiency = getEfficiencyBadge(staff.efficiency_rate);
                    return (
                      <TableRow key={staff.user_id} className={!staff.is_active ? 'opacity-50' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{staff.name}</p>
                            <p className="text-xs text-gray-500">{staff.email}</p>
                            {!staff.is_active && (
                              <Badge variant="outline" className="text-xs mt-1">Pasif</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getRoleLabel(staff.role)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div>
                            <p className="font-semibold">{staff.completed_shifts}</p>
                            <p className="text-xs text-gray-500">/ {staff.total_shifts}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div>
                            <p className="font-semibold">{staff.total_hours}</p>
                            <p className="text-xs text-gray-500">saat</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div>
                            <p className="font-semibold">{staff.completed_cases}</p>
                            <p className="text-xs text-gray-500">/ {staff.total_cases}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-blue-600 font-medium">
                            {staff.total_shift_km.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">km</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-green-600 font-medium">
                            {staff.case_km.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">km</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-orange-600 font-medium">
                            {staff.non_case_km.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">km</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={efficiency.color}>
                            {staff.efficiency_rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card className="bg-blue-50">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">📊 Metrik Açıklamaları:</p>
            <ul className="space-y-1 ml-4 text-gray-700">
              <li>• <strong>Vardiya KM:</strong> Personelin vardiyası süresince aracın aldığı toplam yol</li>
              <li>• <strong>Vaka KM:</strong> Vakalardan kaynaklanan KM (hasta alış-verişi)</li>
              <li>• <strong>Diğer KM:</strong> Vaka dışı kullanım (yakıt, yemek, vs.)</li>
              <li>• <strong>Verimlilik:</strong> (Vaka KM / Vardiya KM) × 100</li>
              <li>• <strong>Yüksek Verimlilik:</strong> ≥70% (Yeşil)</li>
              <li>• <strong>Orta Verimlilik:</strong> 50-69% (Sarı)</li>
              <li>• <strong>Düşük Verimlilik:</strong> &lt;50% (Kırmızı - İnceleme gerekebilir)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        {canManageUsers && (
          <TabsContent value="management" className="mt-6">
            <UserManagement embedded={true} />
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="firms" className="mt-6">
            <FirmManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Staff;

