import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import SignaturePad from '../SignaturePad';
import { handleFormSave } from '../../utils/formHelpers';
import { toast } from 'sonner';

const LeaveForm = () => {
  const [formData, setFormData] = useState({
    employeeName: '',
    department: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    totalDays: 0,
    reason: '',
    contactPhone: '',
    substitute: ''
  });
  const [saving, setSaving] = useState(false);

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      setFormData({...formData, totalDays: days});
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const saveFunc = handleFormSave('leave_form', formData, {
      validateFields: ['employeeName', 'leaveType', 'startDate', 'endDate'],
      onSuccess: () => {
        setFormData({employeeName: '', department: '', leaveType: '', startDate: '', endDate: '', totalDays: 0, reason: '', contactPhone: '', substitute: ''});
      }
    });
    await saveFunc();
    setSaving(false);
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="text-center border-b pb-4"><h1 className="text-2xl font-bold">İZİN TALEP FORMU</h1></div>
      <Card><CardHeader><CardTitle className="text-sm">Personel Bilgileri</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Adı Soyadı</Label><Input value={formData.employeeName} onChange={(e) => setFormData({...formData, employeeName: e.target.value})} /></div>
        <div className="space-y-2"><Label>Bölüm</Label><Input value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} /></div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">İzin Detayları</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="space-y-2"><Label>İzin Tipi</Label>
          <RadioGroup value={formData.leaveType} onValueChange={(v) => setFormData({...formData, leaveType: v})}>
            <div className="grid grid-cols-2 gap-2">
              {['Yıllık İzin', 'Mazeret İzni', 'Hastalık İzni', 'Ücretsiz İzin', 'Doğum İzni', 'Babalık İzni'].map(type => (
                <div key={type} className="flex items-center space-x-2"><RadioGroupItem value={type} id={type} /><Label htmlFor={type} className="font-normal text-sm">{type}</Label></div>
              ))}
            </div>
          </RadioGroup>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2"><Label>Başlangıç</Label><Input type="date" value={formData.startDate} onChange={(e) => {setFormData({...formData, startDate: e.target.value}); calculateDays();}} /></div>
          <div className="space-y-2"><Label>Bitiş</Label><Input type="date" value={formData.endDate} onChange={(e) => {setFormData({...formData, endDate: e.target.value}); calculateDays();}} /></div>
          <div className="space-y-2"><Label>Toplam Gün</Label><Input value={formData.totalDays} disabled className="bg-gray-100" /></div>
        </div>
        <div className="space-y-2"><Label>İzin Sebebi</Label><Textarea value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})} rows={3} /></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>İletişim Tel</Label><Input value={formData.contactPhone} onChange={(e) => setFormData({...formData, contactPhone: e.target.value})} /></div>
          <div className="space-y-2"><Label>Vekil Personel</Label><Input value={formData.substitute} onChange={(e) => setFormData({...formData, substitute: e.target.value})} /></div>
        </div>
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">İmzalar</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3"><Label>Personel İmzası</Label><SignaturePad label="" /></div>
        <div className="space-y-3"><Label>Yönetici Onayı</Label><SignaturePad label="" /></div>
      </CardContent></Card>
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline">🗑 Temizle</Button>
        <Button variant="outline">🖨 Yazdır</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Kaydediliyor...' : '💾 Kaydet'}</Button>
      </div>
    </div>
  );
};

export default LeaveForm;
