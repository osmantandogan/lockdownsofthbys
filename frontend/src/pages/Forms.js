import React, { useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { FileText, Shield, Syringe, Scissors, FileSignature, Pill, Package, Wind, Ambulance, Truck, ClipboardCheck } from 'lucide-react';
import KVKKConsentForm from '../components/forms/KVKKConsentForm';
import InjectionConsentForm from '../components/forms/InjectionConsentForm';
import PunctureConsentForm from '../components/forms/PunctureConsentForm';
import MinorSurgeryConsentForm from '../components/forms/MinorSurgeryConsentForm';
import GeneralConsentForm from '../components/forms/GeneralConsentForm';
import MedicineRequestForm from '../components/forms/MedicineRequestForm';
import MaterialRequestForm from '../components/forms/MaterialRequestForm';
import MedicalGasRequestForm from '../components/forms/MedicalGasRequestForm';
import AmbulanceEquipmentCheckForm from '../components/forms/AmbulanceEquipmentCheckForm';
import PreCaseCheckForm from '../components/forms/PreCaseCheckForm';
import AmbulanceCaseFormFull from '../components/forms/AmbulanceCaseFormFull';
import DailyControlFormFull from '../components/forms/DailyControlFormFull';
import HandoverFormFull from '../components/forms/HandoverFormFull';

const Forms = () => {
  const [selectedForm, setSelectedForm] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const consentForms = [
    {
      id: 'kvkk',
      title: 'KVKK - Kişisel Verilerin Korunması Onam Formu',
      icon: Shield,
      color: 'text-blue-600',
      description: 'Kişisel verilerin korunması hakkında bilgilendirme ve onam formu'
    },
    {
      id: 'injection',
      title: 'Enjeksiyon Uygulama Onam Formu',
      icon: Syringe,
      color: 'text-green-600',
      description: 'İlaç ve enjeksiyon uygulaması için hasta/veli onamı'
    },
    {
      id: 'puncture',
      title: 'Ponksiyon/İğne Uygulaması Onam Formu',
      icon: Syringe,
      color: 'text-orange-600',
      description: 'Ponksiyon, kan alma ve damar yolu açma işlemleri onamı'
    },
    {
      id: 'minor-surgery',
      title: 'Minör Cerrahi İşlem Onam Formu',
      icon: Scissors,
      color: 'text-red-600',
      description: 'Küçük cerrahi müdahaleler için rıza formu'
    },
    {
      id: 'general-consent',
      title: 'Genel Tıbbi Müdahale Onam Formu',
      icon: FileSignature,
      color: 'text-purple-600',
      description: 'Genel tıbbi işlemler için hasta rıza formu'
    }
  ];

  const requestForms = [
    {
      id: 'medicine-request',
      title: 'İlaç Talep Formu',
      icon: Pill,
      color: 'text-blue-600',
      description: 'İlaç sipariş ve talep formu (20 satır)'
    },
    {
      id: 'material-request',
      title: 'Malzeme Talep Formu',
      icon: Package,
      color: 'text-green-600',
      description: 'Tıbbi malzeme talep ve teslim formu (18 satır)'
    },
    {
      id: 'medical-gas-request',
      title: 'Medikal Gaz İstek Formu',
      icon: Wind,
      color: 'text-cyan-600',
      description: 'Medikal gaz (oksijen, hava vb.) talep formu'
    }
  ];

  const ambulanceForms = [
    {
      id: 'ambulance-equipment-check',
      title: 'Ambulans Cihaz/Malzeme/İlaç Kontrol',
      icon: ClipboardCheck,
      color: 'text-blue-600',
      description: 'Günlük ekipman kontrolü (60+ item) - ATT/Paramedik',
      note: 'ATT ve Paramedik için'
    },
    {
      id: 'pre-case-check',
      title: 'Vaka Öncesi Kontrol Formu',
      icon: ClipboardCheck,
      color: 'text-purple-600',
      description: 'Vaka öncesi ekipman hazırlık kontrolü - ATT/Paramedik',
      note: 'ATT ve Paramedik için'
    },
    {
      id: 'ambulance-case',
      title: 'Ambulans Vaka Formu',
      icon: Ambulance,
      color: 'text-red-600',
      description: 'Vaka detay ve müdahale formu - ATT/Paramedik',
      note: 'ATT ve Paramedik için'
    },
    {
      id: 'daily-control',
      title: 'Ambulans Günlük Kontrol Formu',
      icon: Truck,
      color: 'text-green-600',
      description: 'Araç genel kontrol formu - Şoför',
      note: 'Şoför için - Vardiya başlatmada kullanılıyor'
    },
    {
      id: 'handover',
      title: 'Ambulans Devir Teslim Formu',
      icon: ClipboardCheck,
      color: 'text-orange-600',
      description: 'Araç devir teslim formu - Şoför',
      note: 'Şoför için - Vardiya bitirmede kullanılıyor'
    }
  ];

  const openForm = (formId) => {
    setSelectedForm(formId);
    setDialogOpen(true);
  };

  const renderFormContent = (formId) => {
    switch(formId) {
      case 'kvkk':
        return <KVKKConsentForm />;
      case 'injection':
        return <InjectionConsentForm />;
      case 'puncture':
        return <PunctureConsentForm />;
      case 'minor-surgery':
        return <MinorSurgeryConsentForm />;
      case 'general-consent':
        return <GeneralConsentForm />;
      case 'medicine-request':
        return <MedicineRequestForm />;
      case 'material-request':
        return <MaterialRequestForm />;
      case 'medical-gas-request':
        return <MedicalGasRequestForm />;
      case 'ambulance-equipment-check':
        return <AmbulanceEquipmentCheckForm />;
      case 'pre-case-check':
        return <PreCaseCheckForm />;
      case 'ambulance-case':
        return <AmbulanceCaseForm />;
      case 'daily-control':
        return <DailyControlForm formData={{}} onChange={() => {}} />;
      case 'handover':
        return <HandoverForm formData={{}} onChange={() => {}} vehiclePlate="" vehicleKm={0} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" data-testid="forms-page">
      <div>
        <h1 className="text-3xl font-bold">Formlar</h1>
        <p className="text-gray-500">Tıbbi formlar ve onay belgeleri</p>
      </div>

      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-2xl font-semibold">Onam Formları</h2>
          <p className="text-sm text-gray-500">Hasta ve veli rıza formları</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {consentForms.map((form) => {
            const Icon = form.icon;
            return (
              <Card key={form.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openForm(form.id)}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${form.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight">{form.title}</h3>
                    <p className="text-xs text-gray-600">{form.description}</p>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <FileText className="h-4 w-4 mr-2" />
                      Formu Aç
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* İstek Formları Section */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-2xl font-semibold">İstek Formları</h2>
          <p className="text-sm text-gray-500">İlaç, malzeme ve gaz talep formları</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {requestForms.map((form) => {
            const Icon = form.icon;
            return (
              <Card key={form.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openForm(form.id)}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${form.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight">{form.title}</h3>
                    <p className="text-xs text-gray-600">{form.description}</p>
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <FileText className="h-4 w-4 mr-2" />
                      Formu Aç
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Ambulans Formları Section */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-2xl font-semibold">Ambulans Formları</h2>
          <p className="text-sm text-gray-500">Araç ve vaka kontrol formları</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ambulanceForms.map((form) => {
            const Icon = form.icon;
            return (
              <Card key={form.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => openForm(form.id)}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${form.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight">{form.title}</h3>
                    <p className="text-xs text-gray-600">{form.description}</p>
                    {form.note && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                        <p className="text-xs text-yellow-800">📌 {form.note}</p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full mt-2">
                      <FileText className="h-4 w-4 mr-2" />
                      Formu Aç
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {[...consentForms, ...requestForms, ...ambulanceForms].find(f => f.id === selectedForm)?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[80vh] pr-4">
            {selectedForm && renderFormContent(selectedForm)}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Forms;
