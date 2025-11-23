import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { casesAPI, vehiclesAPI, usersAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, User, Phone, MapPin, Truck, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [consultationDialogOpen, setConsultationDialogOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    vehicle_id: '',
    driver_id: '',
    paramedic_id: '',
    att_id: ''
  });
  const [statusForm, setStatusForm] = useState({
    status: '',
    note: ''
  });
  const [consultationNote, setConsultationNote] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [caseRes, vehiclesRes, usersRes] = await Promise.all([
        casesAPI.getById(id),
        vehiclesAPI.getAll({ status: 'musait' }),
        usersAPI.getAll()
      ]);
      setCaseData(caseRes.data);
      setVehicles(vehiclesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeam = async () => {
    try {
      await casesAPI.assignTeam(id, assignForm);
      toast.success('Ekip atandı');
      setAssignDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ekip atanamadı');
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await casesAPI.updateStatus(id, statusForm);
      toast.success('Durum güncellendi');
      setStatusDialogOpen(false);
      setStatusForm({ status: '', note: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Durum güncellenemedi');
    }
  };

  const statusLabels = {
    acildi: 'Açıldı',
    ekip_bilgilendirildi: 'Ekip Bilgilendirildi',
    ekip_yola_cikti: 'Ekip Yola Çıktı',
    sahada: 'Sahada',
    hasta_alindi: 'Hasta Alındı',
    doktor_konsultasyonu: 'Doktor Konsültasyonu',
    merkeze_donus: 'Merkeze Dönüş',
    hastane_sevki: 'Hastane Sevki',
    tamamlandi: 'Tamamlandı',
    iptal: 'İptal'
  };

  const priorityColors = {
    yuksek: 'bg-red-100 text-red-800',
    orta: 'bg-yellow-100 text-yellow-800',
    dusuk: 'bg-green-100 text-green-800'
  };

  const priorityLabels = {
    yuksek: 'Yüksek',
    orta: 'Orta',
    dusuk: 'Düşük'
  };

  const canManageCase = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);

  if (loading || !caseData) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="case-detail-page">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/cases')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{caseData.case_number}</h1>
          <div className="flex items-center space-x-2 mt-1">
            <Badge className={priorityColors[caseData.priority]}>
              {priorityLabels[caseData.priority]}
            </Badge>
            <Badge variant="outline">{statusLabels[caseData.status]}</Badge>
          </div>
        </div>
        {canManageCase && (
          <div className="space-x-2">
            {!caseData.assigned_team && (
              <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="assign-team-button">Ekip Ata</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ekip Ata</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Araç *</Label>
                      <Select value={assignForm.vehicle_id} onValueChange={(v) => setAssignForm(prev => ({...prev, vehicle_id: v}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Araç seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAssignTeam} className="w-full">Ata</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="update-status-button">Durum Güncelle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Durum Güncelle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Yeni Durum *</Label>
                    <Select value={statusForm.status} onValueChange={(v) => setStatusForm(prev => ({...prev, status: v}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Durum seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Not</Label>
                    <Textarea
                      value={statusForm.note}
                      onChange={(e) => setStatusForm(prev => ({...prev, note: e.target.value}))}
                      placeholder="Opsiyonel not"
                    />
                  </div>
                  <Button onClick={handleUpdateStatus} className="w-full">Güncelle</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hasta Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Hasta Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="font-medium">Ad Soyad:</span> {caseData.patient.name} {caseData.patient.surname}</p>
            <p><span className="font-medium">Yaş:</span> {caseData.patient.age}</p>
            <p><span className="font-medium">Cinsiyet:</span> {caseData.patient.gender}</p>
            {caseData.patient.tc_no && <p><span className="font-medium">TC:</span> {caseData.patient.tc_no}</p>}
            <p><span className="font-medium">Şikayet:</span> {caseData.patient.complaint}</p>
          </CardContent>
        </Card>

        {/* Arayan Bilgileri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Phone className="h-5 w-5" />
              <span>Arayan Bilgileri</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><span className="font-medium">Ad Soyad:</span> {caseData.caller.name}</p>
            <p><span className="font-medium">Telefon:</span> {caseData.caller.phone}</p>
            <p><span className="font-medium">Yakınlık:</span> {caseData.caller.relationship}</p>
          </CardContent>
        </Card>

        {/* Konum */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Konum</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>{caseData.location.address}</p>
            {caseData.location.district && <p><span className="font-medium">İlçe:</span> {caseData.location.district}</p>}
            {caseData.location.village_or_neighborhood && <p><span className="font-medium">Köy/Mahalle:</span> {caseData.location.village_or_neighborhood}</p>}
          </CardContent>
        </Card>

        {/* Atanan Ekip */}
        {caseData.assigned_team && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Truck className="h-5 w-5" />
                <span>Atanan Ekip</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><span className="font-medium">Araç:</span> {caseData.assigned_team.vehicle_id}</p>
              <p className="text-xs text-gray-500">
                Atanma: {new Date(caseData.assigned_team.assigned_at).toLocaleString('tr-TR')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Durum Geçmişi</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {caseData.status_history.map((item, index) => (
              <div key={index} className="flex space-x-4 items-start">
                <div className="min-w-[120px] text-sm text-gray-500">
                  {new Date(item.updated_at).toLocaleString('tr-TR')}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{statusLabels[item.status]}</p>
                  {item.note && <p className="text-sm text-gray-600">{item.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseDetail;
