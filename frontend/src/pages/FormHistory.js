import React, { useEffect, useState, useRef, useMemo } from 'react';
import { formsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { toast } from 'sonner';
import { FileText, Search, Trash2, Eye, Download, User, Briefcase, FileSignature, FileDown, Printer, FolderOpen, ChevronRight, ChevronDown, Folder, LayoutList, LayoutGrid } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { generateGeneralFormPDF, generateCaseFormPDF, downloadPDF, openPDFInNewTab } from '../services/pdfService';

// Onam Form Bileşenleri
import KVKKConsentForm from '../components/forms/KVKKConsentForm';
import InjectionConsentForm from '../components/forms/InjectionConsentForm';
import PunctureConsentForm from '../components/forms/PunctureConsentForm';
import MinorSurgeryConsentForm from '../components/forms/MinorSurgeryConsentForm';
import GeneralConsentForm from '../components/forms/GeneralConsentForm';

const FormHistory = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('details'); // 'details' or 'form'
  const [viewType, setViewType] = useState('folder'); // 'folder' veya 'list'
  const [openFolders, setOpenFolders] = useState({});
  const printRef = useRef(null);
  const [filters, setFilters] = useState({
    form_type: '',
    patient_name: '',
    vehicle_plate: ''
  });

  // Formları vaka numarasına göre grupla
  const groupedForms = useMemo(() => {
    const groups = {};
    
    forms.forEach(form => {
      const key = form.case_number || 'Vakasız Formlar';
      if (!groups[key]) {
        groups[key] = {
          case_number: form.case_number,
          patient_name: form.patient_name,
          forms: [],
          created_at: form.created_at
        };
      }
      groups[key].forms.push(form);
      // En eski tarihi al
      if (new Date(form.created_at) < new Date(groups[key].created_at)) {
        groups[key].created_at = form.created_at;
      }
    });
    
    // Tarihe göre sırala (en yeni önce)
    return Object.entries(groups)
      .sort(([, a], [, b]) => new Date(b.created_at) - new Date(a.created_at))
      .map(([key, value]) => ({ key, ...value }));
  }, [forms]);

  const toggleFolder = (key) => {
    setOpenFolders(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  const viewForm = async (form) => {
    setSelectedForm(form);
    setViewMode('details');
    setDialogOpen(true);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${formTypeLabels[selectedForm?.form_type]} - ${selectedForm?.patient_name || 'Form'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .info-section { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
            .info-row { display: flex; margin-bottom: 8px; }
            .info-label { font-weight: bold; min-width: 150px; }
            h1 { font-size: 24px; margin: 0; }
            h2 { font-size: 18px; color: #333; margin-top: 20px; }
            .form-data { margin-top: 20px; }
            .field { margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee; }
            .field-label { font-weight: bold; color: #555; }
            .signature-section { margin-top: 30px; }
            .signature-img { max-width: 300px; border: 1px solid #ddd; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>HEALMEDY HBYS</h1>
            <h2>${formTypeLabels[selectedForm?.form_type]}</h2>
          </div>
          <div class="info-section">
            <div class="info-row"><span class="info-label">Form Tipi:</span> ${formTypeLabels[selectedForm?.form_type]}</div>
            <div class="info-row"><span class="info-label">Tarih:</span> ${new Date(selectedForm?.created_at).toLocaleString('tr-TR')}</div>
            ${selectedForm?.case_number ? `<div class="info-row"><span class="info-label">Vaka No:</span> ${selectedForm.case_number}</div>` : ''}
            ${selectedForm?.patient_name ? `<div class="info-row"><span class="info-label">Hasta:</span> ${selectedForm.patient_name}</div>` : ''}
            ${selectedForm?.vehicle_plate ? `<div class="info-row"><span class="info-label">Araç:</span> ${selectedForm.vehicle_plate}</div>` : ''}
            <div class="info-row"><span class="info-label">Gönderen:</span> ${selectedForm?.submitter_name || selectedForm?.submitted_by} ${selectedForm?.submitter_role ? `(${selectedForm.submitter_role})` : ''}</div>
          </div>
          <div class="form-data">
            <h2>Form Verileri</h2>
            ${Object.entries(selectedForm?.form_data || {}).map(([key, value]) => {
              if (key === 'signature' && value) {
                return `<div class="signature-section"><p class="field-label">İmza:</p><img class="signature-img" src="${value}" alt="İmza" /></div>`;
              }
              return `<div class="field"><span class="field-label">${formatFieldLabel(key)}:</span> ${formatFieldValue(value)}</div>`;
            }).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // PDF İndir
  const handlePDFDownload = () => {
    if (!selectedForm) return;
    
    try {
      // Form verilerini hazırla
      const pdfFormData = {
        ...selectedForm.form_data,
        date: selectedForm.created_at ? new Date(selectedForm.created_at).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR'),
        formNo: selectedForm.id?.slice(-8) || '',
        submitterName: selectedForm.submitter_name,
        patientName: selectedForm.patient_name,
        vehiclePlate: selectedForm.vehicle_plate,
      };
      
      let doc;
      
      // Vaka formu için özel şablon
      if (selectedForm.form_type === 'ambulance_case') {
        doc = generateCaseFormPDF(
          { case_number: selectedForm.case_number },
          pdfFormData
        );
      } else {
        // Diğer formlar için genel şablon
        const formTypeMapping = {
          'kvkk': 'kvkk',
          'injection': 'injection',
          'puncture': 'puncture',
          'minor_surgery': 'minor-surgery',
          'general_consent': 'general-consent',
          'medicine_request': 'medicine-request',
          'material_request': 'material-request',
          'medical_gas_request': 'medical-gas-request',
          'ambulance_equipment': 'ambulance-equipment-check',
          'pre_case_check': 'pre-case-check',
          'daily_control': 'daily-control',
          'handover': 'handover',
        };
        
        const pdfFormType = formTypeMapping[selectedForm.form_type] || selectedForm.form_type;
        doc = generateGeneralFormPDF(pdfFormType, pdfFormData);
      }
      
      // Dosya adı oluştur
      const date = new Date().toISOString().split('T')[0];
      const formTypeName = formTypeLabels[selectedForm.form_type] || 'form';
      const patientName = selectedForm.patient_name?.replace(/\s+/g, '-') || '';
      const filename = `healmedy-${formTypeName}${patientName ? '-' + patientName : ''}-${date}.pdf`;
      
      downloadPDF(doc, filename);
      toast.success('PDF başarıyla indirildi');
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulurken hata oluştu');
    }
  };

  // PDF'i yeni sekmede aç
  const handlePDFPreview = () => {
    if (!selectedForm) return;
    
    try {
      const pdfFormData = {
        ...selectedForm.form_data,
        date: selectedForm.created_at ? new Date(selectedForm.created_at).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR'),
        formNo: selectedForm.id?.slice(-8) || '',
        submitterName: selectedForm.submitter_name,
        patientName: selectedForm.patient_name,
        vehiclePlate: selectedForm.vehicle_plate,
      };
      
      let doc;
      
      if (selectedForm.form_type === 'ambulance_case') {
        doc = generateCaseFormPDF(
          { case_number: selectedForm.case_number },
          pdfFormData
        );
      } else {
        const formTypeMapping = {
          'kvkk': 'kvkk',
          'injection': 'injection',
          'puncture': 'puncture',
          'minor_surgery': 'minor-surgery',
          'general_consent': 'general-consent',
          'medicine_request': 'medicine-request',
          'material_request': 'material-request',
          'medical_gas_request': 'medical-gas-request',
          'ambulance_equipment': 'ambulance-equipment-check',
          'pre_case_check': 'pre-case-check',
          'daily_control': 'daily-control',
          'handover': 'handover',
        };
        
        const pdfFormType = formTypeMapping[selectedForm.form_type] || selectedForm.form_type;
        doc = generateGeneralFormPDF(pdfFormType, pdfFormData);
      }
      
      openPDFInNewTab(doc);
      toast.success('PDF yeni sekmede açıldı');
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulurken hata oluştu');
    }
  };

  // Doğrudan form ile PDF indir (liste için)
  const downloadFormPDF = (form) => {
    try {
      const pdfFormData = {
        ...form.form_data,
        date: form.created_at ? new Date(form.created_at).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR'),
        formNo: form.id?.slice(-8) || '',
        submitterName: form.submitter_name,
        patientName: form.patient_name,
        vehiclePlate: form.vehicle_plate,
      };
      
      let doc;
      
      if (form.form_type === 'ambulance_case') {
        doc = generateCaseFormPDF(
          { case_number: form.case_number },
          pdfFormData
        );
      } else {
        const formTypeMapping = {
          'kvkk': 'kvkk',
          'injection': 'injection',
          'puncture': 'puncture',
          'minor_surgery': 'minor-surgery',
          'general_consent': 'general-consent',
          'medicine_request': 'medicine-request',
          'material_request': 'material-request',
          'medical_gas_request': 'medical-gas-request',
          'ambulance_equipment': 'ambulance-equipment-check',
          'pre_case_check': 'pre-case-check',
          'daily_control': 'daily-control',
          'handover': 'handover',
        };
        
        const pdfFormType = formTypeMapping[form.form_type] || form.form_type;
        doc = generateGeneralFormPDF(pdfFormType, pdfFormData);
      }
      
      const date = new Date().toISOString().split('T')[0];
      const formTypeName = formTypeLabels[form.form_type] || 'form';
      const patientName = form.patient_name?.replace(/\s+/g, '-') || '';
      const filename = `healmedy-${formTypeName}${patientName ? '-' + patientName : ''}-${date}.pdf`;
      
      downloadPDF(doc, filename);
      toast.success('PDF başarıyla indirildi');
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulurken hata oluştu');
    }
  };

  const formatFieldLabel = (key) => {
    const labels = {
      patientName: 'Hasta Adı',
      informed: 'Bilgilendirilme',
      consent: 'Onay',
      approvedRelatives: 'Onaylı Yakınlar',
      approvedEntities: 'Onaylı Kurumlar',
      signatoryName: 'İmza Sahibi',
      signDate: 'İmza Tarihi',
      procedure: 'İşlem',
      description: 'Açıklama'
    };
    return labels[key] || key;
  };

  const formatFieldValue = (value) => {
    if (value === 'informed') return 'Bilgilendirildi';
    if (value === 'not-informed') return 'Bilgilendirilmedi';
    if (value === 'consent') return 'Onay Verildi';
    if (value === 'no-consent') return 'Onay Verilmedi';
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
    if (typeof value === 'object') return JSON.stringify(value);
    return value || '-';
  };

  // Form bileşenini render et (readonly)
  const renderFormComponent = (formType) => {
    // Form bileşenlerini okuma modunda göster
    const formProps = {
      readOnly: true,
      initialData: selectedForm?.form_data || {}
    };
    
    switch(formType) {
      case 'kvkk':
        return <KVKKConsentForm {...formProps} />;
      case 'injection':
        return <InjectionConsentForm {...formProps} />;
      case 'puncture':
        return <PunctureConsentForm {...formProps} />;
      case 'minor_surgery':
        return <MinorSurgeryConsentForm {...formProps} />;
      case 'general_consent':
        return <GeneralConsentForm {...formProps} />;
      default:
        return (
          <div className="space-y-4">
            {Object.entries(selectedForm?.form_data || {}).map(([key, value]) => (
              <div key={key} className="border-b pb-2">
                <p className="text-sm font-medium text-gray-500">{formatFieldLabel(key)}</p>
                {key === 'signature' && value ? (
                  <img src={value} alt="İmza" className="max-w-xs border rounded mt-2" />
                ) : (
                  <p className="text-base">{formatFieldValue(value)}</p>
                )}
              </div>
            ))}
          </div>
        );
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Form Geçmişi</h1>
          <p className="text-gray-500">Tüm kayıtlı formları görüntüle</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewType === 'folder' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('folder')}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Klasör
          </Button>
          <Button
            variant={viewType === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('list')}
          >
            <LayoutList className="h-4 w-4 mr-2" />
            Liste
          </Button>
        </div>
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

      <div className="space-y-4">
        {forms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">Form kaydı bulunamadı</p>
            </CardContent>
          </Card>
        ) : viewType === 'folder' ? (
          // KLASÖR GÖRÜNÜMÜ
          <div className="space-y-3">
            {groupedForms.map((group) => (
              <Collapsible 
                key={group.key} 
                open={openFolders[group.key]} 
                onOpenChange={() => toggleFolder(group.key)}
              >
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center space-x-3">
                        {openFolders[group.key] ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Folder className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold">
                            {group.case_number ? `Vaka: ${group.case_number}` : 'Vakasız Formlar'}
                          </p>
                          {group.patient_name && (
                            <p className="text-sm text-gray-500">Hasta: {group.patient_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant="secondary">
                          {group.forms.length} form
                        </Badge>
                        <span className="text-sm text-gray-400">
                          {new Date(group.created_at).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-gray-50/50 divide-y">
                      {group.forms.map((form) => (
                        <div key={form.id} className="p-4 pl-14 hover:bg-white transition-colors">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                                    {formTypeLabels[form.form_type]}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    {new Date(form.created_at).toLocaleString('tr-TR')}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {form.submitter_name || form.submitted_by}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => viewForm(form)} title="Görüntüle">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => downloadFormPDF(form)} 
                                className="text-red-600" 
                                title="PDF İndir"
                              >
                                <FileDown className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(form.id)} className="text-red-600 hover:text-red-700" title="Sil">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        ) : (
          // LİSTE GÖRÜNÜMÜ (eski görünüm)
          <div className="grid gap-4">
            {forms.map((form) => (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-3 flex-wrap gap-2">
                        <Badge className="bg-blue-100 text-blue-800">
                          {formTypeLabels[form.form_type]}
                        </Badge>
                        {form.case_number && (
                          <Badge variant="outline" className="text-purple-700 border-purple-300">
                            Vaka: {form.case_number}
                          </Badge>
                        )}
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
                      <div className="flex items-center space-x-2 text-sm">
                        <User className="h-4 w-4 text-gray-400" />
                        <div>
                          <span className="font-medium">{form.submitter_name || form.submitted_by}</span>
                          {form.submitter_role && (
                            <span className="text-gray-500 ml-2">({form.submitter_role})</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => viewForm(form)} title="Görüntüle">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => downloadFormPDF(form)} 
                        className="text-red-600" 
                        title="PDF İndir"
                      >
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(form.id)} className="text-red-600 hover:text-red-700" title="Sil">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form Detay Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl flex items-center space-x-2">
                <FileSignature className="h-5 w-5" />
                <span>{selectedForm && formTypeLabels[selectedForm.form_type]}</span>
              </DialogTitle>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={handlePDFPreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Önizle
                </Button>
                <Button variant="default" size="sm" onClick={handlePDFDownload} className="bg-red-600 hover:bg-red-700">
                  <FileDown className="h-4 w-4 mr-2" />
                  PDF İndir
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Yazdır
                </Button>
              </div>
            </div>
          </DialogHeader>
          <ScrollArea className="h-[80vh] pr-4">
            {selectedForm && (
              <div className="space-y-4" ref={printRef}>
                {/* Genel Bilgiler Kartı */}
                <Card className="border-2 border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-800">Genel Bilgiler</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Form Tipi</p>
                        <p className="font-medium">{formTypeLabels[selectedForm.form_type]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tarih</p>
                        <p className="font-medium">{new Date(selectedForm.created_at).toLocaleString('tr-TR')}</p>
                      </div>
                      {selectedForm.case_number && (
                        <div>
                          <p className="text-xs text-gray-500">Vaka No</p>
                          <p className="font-medium text-purple-700">{selectedForm.case_number}</p>
                        </div>
                      )}
                      {selectedForm.patient_name && (
                        <div>
                          <p className="text-xs text-gray-500">Hasta</p>
                          <p className="font-medium">{selectedForm.patient_name}</p>
                        </div>
                      )}
                      {selectedForm.vehicle_plate && (
                        <div>
                          <p className="text-xs text-gray-500">Araç</p>
                          <p className="font-medium">{selectedForm.vehicle_plate}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Gönderen Bilgisi */}
                    <div className="pt-3 border-t">
                      <p className="text-xs text-gray-500 mb-1">Gönderen</p>
                      <div className="flex items-center space-x-3">
                        {selectedForm.submitter_photo ? (
                          <img src={selectedForm.submitter_photo} alt={selectedForm.submitter_name} className="w-10 h-10 rounded-full object-cover border-2 border-red-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white font-bold">
                            {(selectedForm.submitter_name || selectedForm.submitted_by || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold">{selectedForm.submitter_name || selectedForm.submitted_by}</p>
                          {selectedForm.submitter_role && (
                            <p className="text-sm text-gray-500">{selectedForm.submitter_role}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Form İçeriği */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Form İçeriği</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {renderFormComponent(selectedForm.form_type)}
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
