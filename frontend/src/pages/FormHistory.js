import React, { useEffect, useState } from 'react';
import { formsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import { FileText, Search, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const FormHistory = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    form_type: '',
    patient_name: '',
    vehicle_plate: ''
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      const [formsRes, statsRes] = await Promise.all([
        formsAPI.getAll(filters),
        formsAPI.getStats()
      ]);
      setForms(formsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Formlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu formu silmek istediğinizden emin misiniz?')) return;
    
    try {
      await formsAPI.delete(id);
      toast.success('Form silindi');
      loadData();
    } catch (error) {
      toast.error('Form silinemedi');
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.patch(`${process.env.REACT_APP_BACKEND_URL}/api/forms/${id}`, 
        { status: 'approved' }, 
        { withCredentials: true }
      );
      toast.success('Form onaylandı');
      loadData();
    } catch (error) {
      toast.error('Form onaylanamadı');
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.patch(`${process.env.REACT_APP_BACKEND_URL}/api/forms/${id}`, 
        { status: 'rejected' }, 
        { withCredentials: true }
      );
      toast.success('Form reddedildi');
      loadData();
    } catch (error) {
      toast.error('Form reddedilemedi');
    }
  };

  const viewForm = async (form) => {
    setSelectedForm(form);
    setDialogOpen(true);
  };

  const formTypeLabels = {
    kvkk: 'KVKK',
    injection: 'Enjeksiyon',
    puncture: 'Ponksiyon',
    minor_surgery: 'Minör Cerrahi',
    general_consent: 'Genel Tıbbi',
    medicine_request: 'İlaç Talep',
    material_request: 'Malzeme Talep',
    medical_gas_request: 'Medikal Gaz',
    ambulance_equipment: 'Ambulans Ekipman',
    pre_case_check: 'Vaka Öncesi',
    ambulance_case: 'Ambulans Vaka',
    daily_control: 'Günlük Kontrol',
    handover: 'Devir Teslim'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="form-history-page">
      <div>
        <h1 className="text-3xl font-bold">Form Geçmişi</h1>
        <p className="text-gray-500">Tüm kayıtlı formları görüntüle</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.total || 0}</p>
            <p className="text-sm text-gray-500">Toplam Form</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.consent_forms || 0}</p>
            <p className="text-sm text-gray-500">Onam Formları</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.request_forms || 0}</p>
            <p className="text-sm text-gray-500">İstek Formları</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.ambulance_forms || 0}</p>
            <p className="text-sm text-gray-500">Ambulans Formları</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtreler</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Form Tipi</label>
              <Select value={filters.form_type} onValueChange={(v) => setFilters({...filters, form_type: v === 'all' ? '' : v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Tüm formlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm formlar</SelectItem>
                  {Object.entries(formTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hasta Adı</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Hasta adı ara..."
                  value={filters.patient_name}
                  onChange={(e) => setFilters({...filters, patient_name: e.target.value})}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Araç Plakası</label>
              <Input
                placeholder="Plaka ara..."
                value={filters.vehicle_plate}
                onChange={(e) => setFilters({...filters, vehicle_plate: e.target.value})}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {forms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Form kaydı bulunamadı</p>
            </CardContent>
          </Card>
        ) : (
          forms.map((form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-3">
                      <Badge className="bg-blue-100 text-blue-800">
                        {formTypeLabels[form.form_type]}
                      </Badge>
                      <Badge className={
                        form.status === 'approved' ? 'bg-green-100 text-green-800' :
                        form.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        form.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }>
                        {form.status === 'approved' ? 'Onaylandı' :
                         form.status === 'rejected' ? 'Reddedildi' :
                         form.status === 'draft' ? 'Taslak' : 'Bekliyor'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(form.created_at).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    {form.patient_name && (
                      <p className="text-sm"><span className="font-medium">Hasta:</span> {form.patient_name}</p>
                    )}
                    {form.vehicle_plate && (
                      <p className="text-sm"><span className="font-medium">Araç:</span> {form.vehicle_plate}</p>
                    )}
                    <p className="text-xs text-gray-500">Gönderen: {form.submitted_by}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => viewForm(form)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {form.status === 'submitted' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => handleApprove(form.id)} className="text-green-600">
                          ✓ Onayla
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleReject(form.id)} className="text-red-600">
                          ✗ Reddet
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(form.id)} className="text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedForm && formTypeLabels[selectedForm.form_type]} - Detaylar
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {selectedForm && (
              <div className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Genel Bilgiler</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <p><span className="font-medium">Form Tipi:</span> {formTypeLabels[selectedForm.form_type]}</p>
                    <p><span className="font-medium">Tarih:</span> {new Date(selectedForm.created_at).toLocaleString('tr-TR')}</p>
                    {selectedForm.patient_name && <p><span className="font-medium">Hasta:</span> {selectedForm.patient_name}</p>}
                    {selectedForm.vehicle_plate && <p><span className="font-medium">Araç:</span> {selectedForm.vehicle_plate}</p>}
                    <p><span className="font-medium">Gönderen:</span> {selectedForm.submitted_by}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Form Verileri</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">
                      {JSON.stringify(selectedForm.form_data, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormHistory;
