import React, { useEffect, useState } from 'react';
import { usersAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Users, AlertTriangle, CheckSquare, Square, Loader2, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

import { API_URL } from '../config/api';

const UserManagement = ({ embedded = false }) => {
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
  
  // Silme işlemi için state'ler
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Toplu işlemler için state'ler
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Toplu yükleme için state'ler
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [bulkUploadData, setBulkUploadData] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);

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
    const userId = selectedUser?.id || selectedUser?._id;
    if (!userId) {
      toast.error('Kullanıcı ID bulunamadı');
      return;
    }
    
    try {
      await usersAPI.update(userId, {
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
      console.error('Güncelleme hatası:', error);
      toast.error(error.response?.data?.detail || 'Kullanıcı güncellenemedi');
    }
  };

  const openEditDialog = (userData) => {
    // ID'yi normalize et
    const normalizedUser = {
      ...userData,
      id: userData.id || userData._id
    };
    setSelectedUser(normalizedUser);
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

  // Silme işlemleri
  const openDeleteDialog = (userData) => {
    setUserToDelete(userData);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    const userId = userToDelete.id || userToDelete._id;
    if (!userId) {
      toast.error('Kullanıcı ID bulunamadı');
      return;
    }
    
    setDeleting(true);
    try {
      await usersAPI.delete(userId);
      toast.success(`${userToDelete.name} başarıyla silindi`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error(error.response?.data?.detail || 'Kullanıcı silinemedi');
    } finally {
      setDeleting(false);
    }
  };

  // Korumalı roller (silinemez)
  const protectedRoles = ['operasyon_muduru', 'merkez_ofis'];
  const canDeleteUser = (userData) => {
    // Korumalı roller silinemez
    if (protectedRoles.includes(userData.role)) return false;
    // Kendini silemezsin
    const currentUserId = user?.id || user?._id;
    const targetUserId = userData.id || userData._id;
    if (currentUserId === targetUserId) return false;
    // Test kullanıcıları silinemez
    if (String(targetUserId).startsWith('test-')) return false;
    return true;
  };

  // Toplu seçim fonksiyonları
  const toggleUserSelection = (userId) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const selectAllDeletable = () => {
    const deletableIds = users
      .filter(u => canDeleteUser(u))
      .map(u => u.id || u._id);
    setSelectedUsers(new Set(deletableIds));
  };

  const deselectAll = () => {
    setSelectedUsers(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return;
    
    setBulkDeleting(true);
    try {
      const response = await axios.post(`${API_URL}/users/bulk-delete`, 
        { user_ids: Array.from(selectedUsers) },
        { withCredentials: true }
      );
      
      const result = response.data;
      toast.success(`${result.deleted} kullanıcı silindi`);
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} kullanıcı atlandı (korumalı)`);
      }
      
      setBulkDeleteDialogOpen(false);
      setSelectedUsers(new Set());
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Toplu silme başarısız');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Toplu yükleme - CSV formatı: email,şifre,ad soyad,rol
  const handleBulkUpload = async () => {
    if (!bulkUploadData.trim()) {
      toast.error('Veri girmediniz');
      return;
    }
    
    setBulkUploading(true);
    setBulkUploadResults(null);
    
    try {
      const lines = bulkUploadData.trim().split('\n');
      const usersToCreate = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        return {
          email: parts[0] || '',
          password: parts[1] || '',
          name: parts[2] || '',
          role: parts[3] || 'personel',
          phone: parts[4] || null
        };
      }).filter(u => u.email && u.name);
      
      if (usersToCreate.length === 0) {
        toast.error('Geçerli kullanıcı bulunamadı');
        setBulkUploading(false);
        return;
      }
      
      const response = await axios.post(`${API_URL}/users/bulk-create`, 
        usersToCreate,
        { withCredentials: true }
      );
      
      const result = response.data;
      setBulkUploadResults(result);
      
      if (result.created > 0) {
        toast.success(`${result.created} kullanıcı oluşturuldu`);
        loadUsers();
      }
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} kullanıcı atlandı (mevcut)`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Toplu yükleme başarısız');
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `email,sifre,ad_soyad,rol,telefon
ornek@healmedy.tech,1234,Örnek Kullanıcı,paramedik,05551234567
doktor@healmedy.tech,5678,Dr. Ahmet Yılmaz,doktor,
hemsire@healmedy.tech,9012,Ayşe Kaya,hemsire,05559876543`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kullanici_sablonu.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
        {!embedded && (
          <div>
            <h1 className="text-3xl font-bold">Kullanıcı Yönetimi</h1>
            <p className="text-gray-500">Kullanıcı ekle, düzenle veya sil</p>
          </div>
        )}
        <div className="flex gap-2">
          {selectedUsers.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Seçimi Temizle ({selectedUsers.size})
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Seçilenleri Sil ({selectedUsers.size})
              </Button>
            </>
          )}
          {selectedUsers.size === 0 && (
            <Button variant="outline" size="sm" onClick={selectAllDeletable}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Tümünü Seç
            </Button>
          )}
          <Button variant="outline" onClick={() => { setBulkUploadDialogOpen(true); setBulkUploadData(''); setBulkUploadResults(null); }}>
            <Upload className="h-4 w-4 mr-2" />
            Toplu Yükle
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Kullanıcı Listesi ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((userData) => {
              const userId = userData.id || userData._id;
              const isSelected = selectedUsers.has(userId);
              const isDeletable = canDeleteUser(userData);
              return (
              <Card key={userId} className={`bg-gray-50 ${isSelected ? 'ring-2 ring-red-400' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {isDeletable && (
                        <button 
                          onClick={() => toggleUserSelection(userId)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-5 w-5 text-red-500" />
                          ) : (
                            <Square className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center space-x-3">
                          <p className="font-medium">{userData.name}</p>
                        <Badge>{roles.find(r => r.value === userData.role)?.label}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{userData.email}</p>
                      {userData.phone && <p className="text-xs text-gray-500">Tel: {userData.phone}</p>}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(userData)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canDeleteUser(userData) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openDeleteDialog(userData)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})}
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

      {/* Silme Onay Dialogu */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Kullanıcı Silme Onayı
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700">
              <strong>{userToDelete?.name}</strong> adlı kullanıcıyı silmek istediğinizden emin misiniz?
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Email: {userToDelete?.email}
            </p>
            <p className="text-sm text-gray-500">
              Rol: {roles.find(r => r.value === userToDelete?.role)?.label}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-red-700">
                ⚠️ Bu işlem geri alınamaz. Kullanıcının tüm verileri silinecektir.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              İptal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Siliniyor...' : 'Evet, Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toplu Silme Dialogu */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Toplu Kullanıcı Silme ({selectedUsers.size} kişi)
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 mb-4">
              Seçili <strong>{selectedUsers.size}</strong> kullanıcıyı silmek istediğinizden emin misiniz?
            </p>
            <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-3 space-y-1">
              {users
                .filter(u => selectedUsers.has(u.id || u._id))
                .map(u => (
                  <div key={u.id || u._id} className="flex items-center justify-between text-sm">
                    <span>{u.name}</span>
                    <Badge variant="outline">{roles.find(r => r.value === u.role)?.label}</Badge>
                  </div>
                ))
              }
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-red-700">
                ⚠️ Bu işlem geri alınamaz!
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={bulkDeleting}
            >
              İptal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Siliniyor...</> : `${selectedUsers.size} Kişiyi Sil`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toplu Yükleme Dialogu */}
      <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Toplu Kullanıcı Yükleme
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 mb-2">
                <strong>Format:</strong> email,şifre,ad soyad,rol,telefon (virgülle ayrılmış)
              </p>
              <p className="text-xs text-blue-600">
                Roller: doktor, hemsire, paramedik, att, sofor, bas_sofor, cagri_merkezi, personel, temizlik
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Şablon İndir
              </Button>
            </div>
            
            <div>
              <Label>Kullanıcı Verileri (her satır bir kullanıcı)</Label>
              <textarea
                className="w-full h-48 mt-2 p-3 border rounded-lg font-mono text-sm"
                placeholder={`ornek@healmedy.tech,1234,Örnek Kullanıcı,paramedik,05551234567
doktor@healmedy.tech,5678,Dr. Ahmet Yılmaz,doktor,
hemsire@healmedy.tech,9012,Ayşe Kaya,hemsire,05559876543`}
                value={bulkUploadData}
                onChange={(e) => setBulkUploadData(e.target.value)}
              />
            </div>

            {bulkUploadResults && (
              <div className={`rounded-lg p-4 ${bulkUploadResults.created > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
                <p className="font-medium">Sonuç:</p>
                <p className="text-sm">✅ Oluşturulan: {bulkUploadResults.created}</p>
                <p className="text-sm">⏭️ Atlanan (mevcut): {bulkUploadResults.skipped}</p>
                {bulkUploadResults.errors?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-red-600">Hatalar:</p>
                    <ul className="text-xs text-red-500 list-disc pl-4">
                      {bulkUploadResults.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUploadDialogOpen(false)}>
              Kapat
            </Button>
            <Button onClick={handleBulkUpload} disabled={bulkUploading || !bulkUploadData.trim()}>
              {bulkUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Yükleniyor...</> : <><Upload className="h-4 w-4 mr-2" />Yükle</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
