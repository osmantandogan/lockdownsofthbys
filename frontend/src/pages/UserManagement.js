import React, { useEffect, useState } from 'react';
import { usersAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: '',
    phone: '',
    tc_no: ''
  });

  const roles = [
    { value: 'merkez_ofis', label: 'Merkez Ofis' },
    { value: 'operasyon_muduru', label: 'Operasyon Müdürü' },
    { value: 'doktor', label: 'Doktor' },
    { value: 'hemsire', label: 'Hemşire' },
    { value: 'paramedik', label: 'Paramedik' },
    { value: 'att', label: 'ATT' },
    { value: 'bas_sofor', label: 'Baş Şoför' },
    { value: 'sofor', label: 'Şoför' },
    { value: 'cagri_merkezi', label: 'Çağrı Merkezi' },
    { value: 'personel', label: 'Personel' }
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await axios.post(`${API_URL}/auth/register`, formData, { withCredentials: true });
      toast.success('Kullanıcı oluşturuldu');
      setDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kullanıcı oluşturulamadı');
    }
  };

  const handleUpdate = async () => {
    try {
      await usersAPI.update(selectedUser.id, {
        name: formData.name,
        role: formData.role,
        phone: formData.phone,
        tc_no: formData.tc_no
      });
      toast.success('Kullanıcı güncellendi');
      setDialogOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      toast.error('Kullanıcı güncellenemedi');
    }
  };

  const openEditDialog = (userData) => {
    setSelectedUser(userData);
    setFormData({
      name: userData.name,
      role: userData.role,
      phone: userData.phone || '',
      tc_no: userData.tc_no || '',
      email: userData.email,
      password: ''
    });
    setEditMode(true);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setEditMode(false);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: '',
      phone: '',
      tc_no: ''
    });
    setSelectedUser(null);
    setEditMode(false);
  };

  const canManage = ['merkez_ofis', 'operasyon_muduru'].includes(user?.role);

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-red-500">Bu sayfayı görüntüleme yetkiniz yok.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Kullanıcı Yönetimi</h1>
          <p className="text-gray-500">Kullanıcı ekle, düzenle veya sil</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Kullanıcı Listesi ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((userData) => (
              <Card key={userData.id} className="bg-gray-50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3">
                        <p className="font-medium">{userData.name}</p>
                        <Badge>{roles.find(r => r.value === userData.role)?.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{userData.email}</p>
                      {userData.phone && <p className="text-xs text-gray-500">Tel: {userData.phone}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(userData)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ad Soyad</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            {!editMode && (
              <>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Şifre</Label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input value={formData.tc_no} onChange={(e) => setFormData({...formData, tc_no: e.target.value})} maxLength={11} />
            </div>
            <Button onClick={editMode ? handleUpdate : handleCreate} className="w-full">
              {editMode ? 'Güncelle' : 'Oluştur'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
