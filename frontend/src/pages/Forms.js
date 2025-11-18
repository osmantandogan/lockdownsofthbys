import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { FileText, Shield, Syringe, Scissors, FileSignature } from 'lucide-react';

const Forms = () => {
  const [selectedForm, setSelectedForm] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const consentForms = [
    {
      id: 'kvkk',
      title: 'KVKK Kişisel Verilerin Korunması Onay Formu',
      icon: Shield,
      color: 'text-blue-600',
      description: 'Kişisel verilerin korunması hakkında bilgilendirme ve onay formu'
    },
    {
      id: 'injection',
      title: 'Enjeksiyon Uygulama Onay Formu',
      icon: Syringe,
      color: 'text-green-600',
      description: 'İlaç ve enjeksiyon uygulaması için hasta/veli onayı'
    },
    {
      id: 'puncture',
      title: 'Ponksiyon/İğne Uygulaması Onay Formu',
      icon: Syringe,
      color: 'text-orange-600',
      description: 'Ponksiyon, kan alma ve damar yolu açma işlemleri onayı'
    },
    {
      id: 'minor-surgery',
      title: 'Minör Cerrahi İşlem Onay Formu',
      icon: Scissors,
      color: 'text-red-600',
      description: 'Küçük cerrahi müdahaleler için rıza formu'
    },
    {
      id: 'general-consent',
      title: 'Genel Tıbbi Müdahale Onay Formu',
      icon: FileSignature,
      color: 'text-purple-600',
      description: 'Genel tıbbi işlemler için hasta rıza formu'
    }
  ];

  const openForm = (formId) => {
    setSelectedForm(formId);
    setDialogOpen(true);
  };

  const renderFormContent = (formId) => {
    switch(formId) {
      case 'kvkk':
        return <KVKKForm />;
      case 'injection':
        return <InjectionConsentForm />;
      case 'puncture':
        return <PunctureConsentForm />;
      case 'minor-surgery':
        return <MinorSurgeryConsentForm />;
      case 'general-consent':
        return <GeneralConsentForm />;
      default:
        return null;
    }
  };

  return (
    <div className=\"space-y-6\" data-testid=\"forms-page\">
      <div>
        <h1 className=\"text-3xl font-bold\">Formlar</h1>
        <p className=\"text-gray-500\">Tıbbi formlar ve onay belgeleri</p>
      </div>

      {/* Onay Formları Section */}
      <div className=\"space-y-4\">
        <div className=\"border-b pb-2\">
          <h2 className=\"text-2xl font-semibold\">Onay Formları</h2>
          <p className=\"text-sm text-gray-500\">Hasta ve veli onay formları</p>
        </div>

        <div className=\"grid gap-4 md:grid-cols-2 lg:grid-cols-3\">
          {consentForms.map((form) => {
            const Icon = form.icon;
            return (
              <Card key={form.id} className=\"cursor-pointer hover:shadow-md transition-shadow\" onClick={() => openForm(form.id)}>
                <CardContent className=\"p-6\">
                  <div className=\"space-y-3\">
                    <div className=\"flex items-center space-x-3\">
                      <div className={`w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center ${form.color}`}>
                        <Icon className=\"h-6 w-6\" />
                      </div>
                      <div className=\"flex-1\">
                        <h3 className=\"font-semibold text-sm leading-tight\">{form.title}</h3>
                      </div>
                    </div>
                    <p className=\"text-xs text-gray-600\">{form.description}</p>
                    <Button variant=\"outline\" size=\"sm\" className=\"w-full\" onClick={(e) => {
                      e.stopPropagation();
                      openForm(form.id);
                    }}>
                      <FileText className=\"h-4 w-4 mr-2\" />
                      Formu Aç
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className=\"max-w-4xl max-h-[90vh]\">
          <DialogHeader>
            <DialogTitle>
              {consentForms.find(f => f.id === selectedForm)?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className=\"h-[70vh] pr-4\">
            {selectedForm && renderFormContent(selectedForm)}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// KVKK Form Component
const KVKKForm = () => {
  const [formData, setFormData] = useState({
    patientName: '',
    informed: '',
    consent: '',
    approvedRelatives: '',
    approvedEntities: '',
    signatoryName: '',
    signDate: new Date().toISOString().split('T')[0]
  });

  return (
    <div className=\"space-y-6\">
      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">Hasta Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className=\"space-y-2\">
            <Label>Hasta Adı</Label>
            <Input
              value={formData.patientName}
              onChange={(e) => setFormData({...formData, patientName: e.target.value})}
              placeholder=\"Hasta adı soyadı\"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">Bilgilendirme</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"text-sm text-gray-700 space-y-2\">
            <p className=\"font-medium\">KVKK Kapsamında Bilgilendirme:</p>
            <p>Kişisel verileriniz, 6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında işlenecektir.</p>
          </div>
          <div className=\"space-y-2\">
            <Label>Bu bilgiler bana/velime:</Label>
            <RadioGroup value={formData.informed} onValueChange={(v) => setFormData({...formData, informed: v})}>
              <div className=\"flex space-x-4\">
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"informed\" id=\"informed-yes\" />
                  <Label htmlFor=\"informed-yes\" className=\"font-normal\">Anlatıldı</Label>
                </div>
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"not-informed\" id=\"informed-no\" />
                  <Label htmlFor=\"informed-no\" className=\"font-normal\">Anlatılmadı</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">Onay</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"space-y-2\">
            <Label>Kişisel verilerimin işlenmesine ve pazarlama faaliyetlerinde kullanılmasına:</Label>
            <RadioGroup value={formData.consent} onValueChange={(v) => setFormData({...formData, consent: v})}>
              <div className=\"flex space-x-4\">
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"consent\" id=\"consent-yes\" />
                  <Label htmlFor=\"consent-yes\" className=\"font-normal\">Onay veriyorum</Label>
                </div>
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"no-consent\" id=\"consent-no\" />
                  <Label htmlFor=\"consent-no\" className=\"font-normal\">Onay vermiyorum</Label>
                </div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">Onay Verilen Kişiler</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"space-y-2\">
            <Label>Kişisel Verilerimin Aktarılmasına Onay Verdiğim Yakınlarım</Label>
            <Textarea
              value={formData.approvedRelatives}
              onChange={(e) => setFormData({...formData, approvedRelatives: e.target.value})}
              placeholder=\"Onay verdiğiniz yakınlarınızın isimlerini giriniz...\"
              rows={3}
            />
          </div>
          <div className=\"space-y-2\">
            <Label>Diğer Onay Verilen Kişi/Kurumlar</Label>
            <Textarea
              value={formData.approvedEntities}
              onChange={(e) => setFormData({...formData, approvedEntities: e.target.value})}
              placeholder=\"Onay verdiğiniz diğer kişi/kurumları giriniz...\"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">İmza</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"grid gap-4 md:grid-cols-2\">
            <div className=\"space-y-2\">
              <Label>Adı Soyadı</Label>
              <Input
                value={formData.signatoryName}
                onChange={(e) => setFormData({...formData, signatoryName: e.target.value})}
                placeholder=\"Adı Soyadı\"
              />
            </div>
            <div className=\"space-y-2\">
              <Label>Tarih</Label>
              <Input
                type=\"date\"
                value={formData.signDate}
                onChange={(e) => setFormData({...formData, signDate: e.target.value})}
              />
            </div>
          </div>
          <div className=\"border-2 border-dashed border-gray-300 rounded-lg p-8 text-center\">
            <p className=\"text-sm text-gray-500\">İmza Alanı</p>
            <p className=\"text-xs text-gray-400\">(Canvas imza özelliği eklenecek)</p>
          </div>
        </CardContent>
      </Card>

      <div className=\"flex justify-end space-x-2\">
        <Button variant=\"outline\">Temizle</Button>
        <Button>Kaydet</Button>
      </div>
    </div>
  );
};

// Simple consent form templates for others
const InjectionConsentForm = () => (
  <ConsentFormTemplate
    title=\"Enjeksiyon Uygulama Onay Formu\"
    description=\"İlaç ve enjeksiyon uygulaması için rıza formu\"
    procedureText=\"Hastaya/yakınıma uygulanacak enjeksiyon işlemi hakkında bilgilendirildim.\"
  />
);

const PunctureConsentForm = () => (
  <ConsentFormTemplate
    title=\"Ponksiyon/İğne Uygulaması Onay Formu\"
    description=\"Kan alma, damar yolu ve ponksiyon işlemleri için rıza formu\"
    procedureText=\"Hastaya/yakınıma uygulanacak ponksiyon, kan alma ve damar yolu açma işlemleri hakkında bilgilendirildim.\"
  />
);

const MinorSurgeryConsentForm = () => (
  <ConsentFormTemplate
    title=\"Minör Cerrahi İşlem Onay Formu\"
    description=\"Küçük cerrahi müdahaleler için rıza formu\"
    procedureText=\"Hastaya/yakınıma uygulanacak minör cerrahi işlem hakkında bilgilendirildim. Olası riskler ve komplikasyonlar anlatıldı.\"
  />
);

const GeneralConsentForm = () => (
  <ConsentFormTemplate
    title=\"Genel Tıbbi Müdahale Onay Formu\"
    description=\"Genel tıbbi işlemler için hasta rıza formu\"
    procedureText=\"Hastaya/yakınıma uygulanacak tıbbi müdahale hakkında bilgilendirildim. İşlemin amacı, yöntemi ve olası riskleri anlatıldı.\"
  />
);

// Generic consent form template
const ConsentFormTemplate = ({ title, description, procedureText }) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientAge: '',
    informedConsent: '',
    procedureConsent: '',
    signatoryName: '',
    relationship: '',
    signDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  return (
    <div className=\"space-y-6\">
      <div className=\"bg-blue-50 p-4 rounded-lg\">
        <h3 className=\"font-semibold text-blue-900 mb-1\">{title}</h3>
        <p className=\"text-sm text-blue-700\">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">Hasta Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className=\"grid gap-4 md:grid-cols-2\">
          <div className=\"space-y-2\">
            <Label>Hasta Adı Soyadı</Label>
            <Input
              value={formData.patientName}
              onChange={(e) => setFormData({...formData, patientName: e.target.value})}
              placeholder=\"Hasta adı soyadı\"
            />
          </div>
          <div className=\"space-y-2\">
            <Label>Yaş</Label>
            <Input
              type=\"number\"
              value={formData.patientAge}
              onChange={(e) => setFormData({...formData, patientAge: e.target.value})}
              placeholder=\"Yaş\"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">Bilgilendirme ve Onay</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"p-4 bg-gray-50 rounded-lg text-sm\">
            <p>{procedureText}</p>
          </div>
          
          <div className=\"space-y-2\">
            <Label>İşlem hakkında bilgilendirildim:</Label>
            <RadioGroup value={formData.informedConsent} onValueChange={(v) => setFormData({...formData, informedConsent: v})}>
              <div className=\"flex space-x-4\">
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"yes\" id=\"informed-yes\" />
                  <Label htmlFor=\"informed-yes\" className=\"font-normal\">Evet</Label>
                </div>
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"no\" id=\"informed-no\" />
                  <Label htmlFor=\"informed-no\" className=\"font-normal\">Hayır</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className=\"space-y-2\">
            <Label>İşlemin uygulanmasına onay veriyorum:</Label>
            <RadioGroup value={formData.procedureConsent} onValueChange={(v) => setFormData({...formData, procedureConsent: v})}>
              <div className=\"flex space-x-4\">
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"approve\" id=\"approve-yes\" />
                  <Label htmlFor=\"approve-yes\" className=\"font-normal\">Onay Veriyorum</Label>
                </div>
                <div className=\"flex items-center space-x-2\">
                  <RadioGroupItem value=\"reject\" id=\"approve-no\" />
                  <Label htmlFor=\"approve-no\" className=\"font-normal\">Onay Vermiyorum</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className=\"space-y-2\">
            <Label>Notlar/Açıklamalar</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder=\"Varsa ek notlar...\"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className=\"text-sm\">İmza Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          <div className=\"grid gap-4 md:grid-cols-2\">
            <div className=\"space-y-2\">
              <Label>Onay Veren Kişi</Label>
              <Input
                value={formData.signatoryName}
                onChange={(e) => setFormData({...formData, signatoryName: e.target.value})}
                placeholder=\"Adı Soyadı\"
              />
            </div>
            <div className=\"space-y-2\">
              <Label>Yakınlık</Label>
              <Input
                value={formData.relationship}
                onChange={(e) => setFormData({...formData, relationship: e.target.value})}
                placeholder=\"Kendisi / Annesi / Babası vb.\"
              />
            </div>
          </div>
          <div className=\"space-y-2\">
            <Label>Tarih</Label>
            <Input
              type=\"date\"
              value={formData.signDate}
              onChange={(e) => setFormData({...formData, signDate: e.target.value})}
            />
          </div>
          <div className=\"border-2 border-dashed border-gray-300 rounded-lg p-8 text-center\">
            <p className=\"text-sm text-gray-500\">İmza Alanı</p>
            <p className=\"text-xs text-gray-400\">(Canvas imza özelliği gelecek)</p>
          </div>
        </CardContent>
      </Card>

      <div className=\"flex justify-end space-x-2\">
        <Button variant=\"outline\">Yazdır</Button>
        <Button>Kaydet</Button>
      </div>
    </div>
  );
};

export default Forms;
