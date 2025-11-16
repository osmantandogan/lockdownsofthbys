import React, { useEffect, useState } from 'react';
import { shiftsAPI, usersAPI, vehiclesAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, User, Truck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const ShiftAssignments = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    vehicle_id: '',
    shift_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [assignmentsRes, usersRes, vehiclesRes] = await Promise.all([
        shiftsAPI.getAllAssignments(),
        usersAPI.getAll(),
        vehiclesAPI.getAll()
      ]);
      setAssignments(assignmentsRes.data);
      
      const fieldUsers = usersRes.data.filter(u => 
        ['sofor', 'bas_sofor', 'paramedik', 'att'].includes(u.role)
      );
      setUsers(fieldUsers);
      setVehicles(vehiclesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.user_id || !formData.vehicle_id) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      await shiftsAPI.createAssignment(formData);
      toast.success('Vardiya ataması oluşturuldu');
      setDialogOpen(false);
      setFormData({
        user_id: '',
        vehicle_id: '',
        shift_date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Atama oluşturulamadı');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu atamayı silmek istediğinizden emin misiniz?')) return;
    
    try {
      await shiftsAPI.deleteAssignment(id);
      toast.success('Atama silindi');
      loadData();
    } catch (error) {
      toast.error('Atama silinemedi');
    }
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    started: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };

  const statusLabels = {
    pending: 'Bekliyor',
    started: 'Başladı',
    completed: 'Tamamlandı',
    cancelled: 'İptal'
  };

  const canManage = ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'].includes(user?.role);

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-red-500">Bu sayfayı görüntüleme yetkiniz yok.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getUserName = (userId) => {
    const u = users.find(user => user.id === userId);
    return u ? u.name : userId;
  };

  const getVehiclePlate = (vehicleId) => {
    const v = vehicles.find(vehicle => vehicle.id === vehicleId);
    return v ? v.plate : vehicleId;
  };

  return (
    <div className="space-y-6" data-testid="shift-assignments-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vardiya Atamaları</h1>
          <p className="text-gray-500">Şoförlere vardiya atayın</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-assignment-button">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Atama
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vardiya Ataması Oluştur</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Kullanıcı</Label>
                <Select value={formData.user_id} onValueChange={(v) => setFormData(prev => ({...prev, user_id: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kullanıcı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Araç</Label>
                <Select value={formData.vehicle_id} onValueChange={(v) => setFormData(prev => ({...prev, vehicle_id: v}))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Araç seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vardiya Tarihi</Label>
                <Input
                  type="date"
                  value={formData.shift_date}
                  onChange={(e) => setFormData(prev => ({...prev, shift_date: e.target.value}))}
                />
              </div>
              <Button onClick={handleCreate} className="w-full">Ata</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Henüz atama yapılmamış</p>
            </CardContent>
          </Card>
        ) : (
          assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={statusColors[assignment.status]}>
                        {statusLabels[assignment.status]}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(assignment.shift_date).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{getUserName(assignment.user_id)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Truck className="h-4 w-4 text-gray-400" />
                        <span>{getVehiclePlate(assignment.vehicle_id)}</span>
                      </div>
                    </div>
                  </div>
                  {assignment.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(assignment.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ShiftAssignments;
