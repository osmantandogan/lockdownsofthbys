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
      toast.error('Veri y\u00fcklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTeam = async () => {
    try {
      await casesAPI.assignTeam(id, assignForm);
      toast.success('Ekip atand\u0131');
      setAssignDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ekip atanamad\u0131');
    }
  };

  const handleUpdateStatus = async () => {
    try {
      await casesAPI.updateStatus(id, statusForm);
      toast.success('Durum g\u00fcncellendi');
      setStatusDialogOpen(false);
      setStatusForm({ status: '', note: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Durum g\u00fcncellenemedi');
    }
  };

  const statusLabels = {
    acildi: 'A\u00e7\u0131ld\u0131',
    ekip_bilgilendirildi: 'Ekip Bilgilendirildi',
    ekip_yola_cikti: 'Ekip Yola \u00c7\u0131kt\u0131',
    sahada: 'Sahada',
    hasta_alindi: 'Hasta Al\u0131nd\u0131',
    doktor_konsultasyonu: 'Doktor Kons\u00fcltasyonu',
    merkeze_donus: 'Merkeze D\u00f6n\u00fc\u015f',
    hastane_sevki: 'Hastane Sevki',
    tamamlandi: 'Tamamland\u0131',
    iptal: '\u0130ptal'
  };

  const priorityColors = {
    yuksek: 'bg-red-100 text-red-800',
    orta: 'bg-yellow-100 text-yellow-800',
    dusuk: 'bg-green-100 text-green-800'
  };

  const priorityLabels = {
    yuksek: 'Y\u00fcksek',
    orta: 'Orta',
    dusuk: 'D\u00fc\u015f\u00fck'
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
                      <Label>Ara\u00e7 *</Label>
                      <Select value={assignForm.vehicle_id} onValueChange={(v) => setAssignForm(prev => ({...prev, vehicle_id: v}))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ara\u00e7 se\u00e7in" />
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
                <Button variant="outline" data-testid="update-status-button">Durum G\u00fcncelle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Durum G\u00fcncelle</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label>Yeni Durum *</Label>
                    <Select value={statusForm.status} onValueChange={(v) => setStatusForm(prev => ({...prev, status: v}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Durum se\u00e7in" />
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
                  <Button onClick={handleUpdateStatus} className="w-full">G\u00fcncelle</Button>
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
            <p><span className="font-medium">Ya\u015f:</span> {caseData.patient.age}</p>
            <p><span className="font-medium">Cinsiyet:</span> {caseData.patient.gender}</p>
            {caseData.patient.tc_no && <p><span className="font-medium">TC:</span> {caseData.patient.tc_no}</p>}
            <p><span className="font-medium">\u015eikayet:</span> {caseData.patient.complaint}</p>
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
            <p><span className="font-medium">Yak\u0131nl\u0131k:</span> {caseData.caller.relationship}</p>
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
            {caseData.location.district && <p><span className="font-medium">\u0130l\u00e7e:</span> {caseData.location.district}</p>}
            {caseData.location.village_or_neighborhood && <p><span className="font-medium">K\u00f6y/Mahalle:</span> {caseData.location.village_or_neighborhood}</p>}
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
              <p><span className="font-medium">Ara\u00e7:</span> {caseData.assigned_team.vehicle_id}</p>
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
            <span>Durum Ge\u00e7mi\u015fi</span>
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
