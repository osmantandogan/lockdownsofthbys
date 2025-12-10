import React, { useState, useEffect, useRef } from 'react';
import { documentsAPI, casesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Archive as ArchiveIcon, Filter, Download, FileText, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

const HeatmapLayer = ({ cases }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!cases || cases.length === 0) return;
    
    // GPS koordinatlarını topla
    const heatData = cases
      .filter(c => c.location?.coordinates?.lat && c.location?.coordinates?.lng)
      .map(c => [c.location.coordinates.lat, c.location.coordinates.lng, 1]); // [lat, lng, intensity]
    
    if (heatData.length === 0) return;
    
    // Heatmap layer oluştur
    const heat = L.heatLayer(heatData, {
      radius: 25,
      blur: 35,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: 'blue',
        0.5: 'lime',
        0.7: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);
    
    // Cleanup
    return () => {
      map.removeLayer(heat);
    };
  }, [cases, map]);
  
  return null;
};

const Archive = () => {
  const [forms, setForms] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    form_type: '',
    start_date: '',
    end_date: '',
    case_id: '',
    submitted_by: ''
  });

  const formTypes = [
    { value: '', label: 'Tüm Formlar' },
    { value: 'kvkk', label: 'KVKK Rıza' },
    { value: 'ambulance_case', label: 'Vaka Formu' },
    { value: 'daily_control', label: 'Günlük Kontrol' },
    { value: 'handover', label: 'Devir Teslim' },
    { value: 'medicine_request', label: 'İlaç Talep' },
    { value: 'material_request', label: 'Malzeme Talep' },
    { value: 'zimmet', label: 'Zimmet' },
    { value: 'siparis_talep', label: 'Sipariş Talep' }
  ];

  const loadArchive = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.form_type) params.form_type = filters.form_type;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.case_id) params.case_id = filters.case_id;
      if (filters.submitted_by) params.submitted_by = filters.submitted_by;
      
      const casesParams = {};
      if (filters.start_date) casesParams.start_date = filters.start_date;
      if (filters.end_date) casesParams.end_date = filters.end_date;
      
      const [archiveRes, casesRes] = await Promise.all([
        documentsAPI.getArchive(params),
        casesAPI.getAll(casesParams)
      ]);
      
      setForms(archiveRes.data);
      setCases(casesRes.data);
    } catch (error) {
      console.error('Error loading archive:', error);
      toast.error('Arşiv yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const getFormTypeLabel = (type) => {
    return formTypes.find(f => f.value === type)?.label || type;
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
      'cagri_merkezi': 'Çağrı Merkezi'
    };
    return labels[role] || role;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Form Arşivi</h1>
        <p className="text-gray-500">Tüm form kayıtlarının merkezi arşivi</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtreler</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            <div className="space-y-2">
              <Label>Form Türü</Label>
              <select 
                className="w-full border rounded-md p-2"
                value={filters.form_type}
                onChange={(e) => setFilters({...filters, form_type: e.target.value})}
              >
                {formTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Başlangıç Tarihi</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Bitiş Tarihi</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setFilters({ form_type: '', start_date: '', end_date: '', case_id: '', submitted_by: '' })}>
              Temizle
            </Button>
            <Button onClick={loadArchive}>
              <Filter className="h-4 w-4 mr-2" />
              Filtrele
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold">{forms.length}</p>
              <p className="text-sm text-gray-500">Toplam Form</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{forms.filter(f => f.form_type === 'ambulance_case').length}</p>
              <p className="text-sm text-gray-500">Vaka Formu</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{forms.filter(f => f.form_type.includes('request')).length}</p>
              <p className="text-sm text-gray-500">Talep Formları</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{forms.filter(f => f.status === 'submitted').length}</p>
              <p className="text-sm text-gray-500">Onay Bekleyen</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heatmap Section */}
      {cases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Vaka Lokasyon Isı Haritası</span>
            </CardTitle>
            <p className="text-sm text-gray-500 mt-2">
              Seçilen tarih aralığındaki vakaların GPS konumlarına göre yoğunluk analizi
            </p>
          </CardHeader>
          <CardContent>
            <div style={{ height: '400px' }}>
              <MapContainer 
                center={[41.578342, 32.078179]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <HeatmapLayer cases={cases} />
              </MapContainer>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span>Düşük Yoğunluk</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Orta Yoğunluk</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Yüksek Yoğunluk</span>
                </div>
              </div>
              <p className="text-gray-600">
                Toplam {cases.filter(c => c.location?.coordinates).length} vaka GPS kaydı
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archive Table */}
      <Card>
        <CardHeader>
          <CardTitle>Form Kayıtları</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form Türü</TableHead>
                  <TableHead>Vaka No</TableHead>
                  <TableHead>Araç/Hasta</TableHead>
                  <TableHead>Gönderen</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : forms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Arşivde kayıt bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  forms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell className="font-medium">{getFormTypeLabel(form.form_type)}</TableCell>
                      <TableCell>{form.case_number || '-'}</TableCell>
                      <TableCell>{form.vehicle_plate || form.patient_name || '-'}</TableCell>
                      <TableCell>{form.submitter_name || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRoleLabel(form.submitter_role)}</Badge>
                      </TableCell>
                      <TableCell>{new Date(form.created_at).toLocaleString('tr-TR')}</TableCell>
                      <TableCell>
                        <Badge variant={form.status === 'approved' ? 'default' : 'secondary'}>
                          {form.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Archive;

