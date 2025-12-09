import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Edit, Plus } from 'lucide-react';

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    form_type: '',
    doc_no: '',
    publish_date: new Date().toISOString().split('T')[0],
    page_count: 1,
    page_no: '1',
    revision_no: 1
  });

  const formTypes = [
    { value: 'kvkk', label: 'KVKK Rıza Formu' },
    { value: 'ambulance_case', label: 'Ambulans Vaka Formu' },
    { value: 'daily_control', label: 'Günlük Kontrol Formu' },
    { value: 'handover', label: 'Devir Teslim Formu' },
    { value: 'medicine_request', label: 'İlaç Talep Formu' },
    { value: 'material_request', label: 'Malzeme Talep Formu' },
    { value: 'zimmet', label: 'Zimmet Formu' },
    { value: 'siparis_talep', label: 'Sipariş Talep Formu' }
  ];

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
      const response = await axios.get(`${API_URL}/documents/metadata`, {
        withCredentials: true
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';
      await axios.post(`${API_URL}/documents/metadata`, formData, {
        withCredentials: true
      });
      toast.success('Döküman kaydı oluşturuldu');
      setDialogOpen(false);
      loadDocuments();
    } catch (error) {
      toast.error('Döküman kaydı oluşturulamadı');
    }
  };

  const getFormTypeLabel = (type) => {
    return formTypes.find(f => f.value === type)?.label || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Döküman Yönetimi</h1>
          <p className="text-gray-500">Form döküman bilgileri ve metadata yönetimi</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Kayıt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Döküman Kaydı</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Form Türü</Label>
                <select 
                  className="w-full border rounded-md p-2"
                  value={formData.form_type}
                  onChange={(e) => setFormData({...formData, form_type: e.target.value})}
                >
                  <option value="">Seçiniz</option>
                  {formTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Döküman No</Label>
                <Input
                  value={formData.doc_no}
                  onChange={(e) => setFormData({...formData, doc_no: e.target.value})}
                  placeholder="DOK-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Yayın Tarihi</Label>
                <Input
                  type="date"
                  value={formData.publish_date}
                  onChange={(e) => setFormData({...formData, publish_date: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Sayfa Sayısı</Label>
                  <Input
                    type="number"
                    value={formData.page_count}
                    onChange={(e) => setFormData({...formData, page_count: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sayfa No</Label>
                  <Input
                    value={formData.page_no}
                    onChange={(e) => setFormData({...formData, page_no: e.target.value})}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Revizyon No</Label>
                  <Input
                    type="number"
                    value={formData.revision_no}
                    onChange={(e) => setFormData({...formData, revision_no: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">Kaydet</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
        <p className="text-sm text-blue-900">
          <strong>Bilgi:</strong> Her form türü için döküman bilgileri tanımlayın. Bu bilgiler, sistemden çıkan tüm PDF dökümanların altına otomatik olarak eklenecektir.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Döküman Kayıtları</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form Türü</TableHead>
                <TableHead>Döküman No</TableHead>
                <TableHead>Yayın Tarihi</TableHead>
                <TableHead>Sayfa Sayısı</TableHead>
                <TableHead>Sayfa No</TableHead>
                <TableHead>Revizyon No</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              ) : documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    Henüz döküman kaydı oluşturulmamış
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{getFormTypeLabel(doc.form_type)}</TableCell>
                    <TableCell>{doc.doc_no}</TableCell>
                    <TableCell>{new Date(doc.publish_date).toLocaleDateString('tr-TR')}</TableCell>
                    <TableCell>{doc.page_count}</TableCell>
                    <TableCell>{doc.page_no}</TableCell>
                    <TableCell>Rev. {doc.revision_no}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentManagement;

