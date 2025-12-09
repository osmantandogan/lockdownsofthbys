/**
 * PDF Service - FormHistory ve diğer sayfalar için wrapper
 * pdfExport.js'i kullanarak PDF işlemlerini yapar
 */

import { 
  exportFormToPDF, 
  exportAmbulanceCaseForm, 
  exportConsentForm,
  exportHandoverForm,
  exportDailyControlForm,
  exportRequestForm,
  exportEquipmentCheckForm,
  downloadPDF as downloadPDFUtil,
  getPDFBlob
} from '../utils/pdfExport';

// Onam metinleri
const CONSENT_TEXTS = {
  kvkk: `6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında, kişisel verilerimin işlenmesi hakkında aydınlatıldım. 
  
Sağlık hizmeti sunumu, tedavi planlaması ve takibi amacıyla özel nitelikli kişisel verilerim dahil tüm kişisel verilerimin toplanmasına, işlenmesine, saklanmasına ve gerekli durumlarda yetkili kişi, kurum ve kuruluşlarla paylaşılmasına açık rıza veriyorum.

Bu onam formu kapsamında verilerimin işlenmesine ilişkin haklarım hakkında bilgilendirildim ve bu hakları kullanma yollarını öğrendim.`,

  injection: `Tarafıma yapılacak olan enjeksiyon uygulaması hakkında bilgilendirildim. Uygulama sırasında ortaya çıkabilecek olası komplikasyonlar (ağrı, kızarıklık, şişlik, enfeksiyon, alerjik reaksiyon vb.) hakkında bilgi aldım.

Uygulamanın yararları ve riskleri hakkında sorularım cevaplandı. Kendi özgür iradem ile bu uygulamayı kabul ediyorum.`,

  puncture: `Ponksiyon/iğne uygulaması işlemi hakkında bilgilendirildim. İşlem sırasında ve sonrasında ortaya çıkabilecek olası komplikasyonlar (kanama, enfeksiyon, ağrı, morarma vb.) hakkında bilgi aldım.

İşlemin gerekliliği, alternatif yöntemler ve olası riskler konusunda aydınlatıldım. Bu işlemi kabul ediyorum.`,

  'minor-surgery': `Minör cerrahi işlem hakkında detaylı bilgilendirildim. İşlemin amacı, uygulanacak anestezi yöntemi, işlem süreci ve sonrasında ortaya çıkabilecek olası komplikasyonlar hakkında bilgi aldım.

İşlemin yararları, riskleri ve alternatif tedavi seçenekleri konusunda sorularım cevaplandı. Bu işlemi kabul ediyorum.`,

  'general-consent': `Tarafıma uygulanacak tıbbi müdahale hakkında bilgilendirildim. Müdahalenin amacı, uygulanma şekli, olası yararları ve riskleri hakkında bilgi aldım.

Sorularım cevaplandı ve tüm bilgileri anladığımı beyan ederim. Bu müdahaleyi kabul ediyorum.`
};

/**
 * Genel form için PDF oluştur
 */
export const generateGeneralFormPDF = (formType, formData) => {
  // Form tipine göre onam metni ekle
  const consentText = CONSENT_TEXTS[formType] || '';
  
  // Form tipini normalize et
  const normalizedType = formType.replace(/-/g, '_');
  
  // Eğer istek formu ise
  if (['medicine_request', 'material_request', 'medical_gas_request'].includes(normalizedType)) {
    return exportRequestForm(formData, getFormTitle(normalizedType), formData.items || []);
  }
  
  // Eğer ekipman kontrol formu ise
  if (['ambulance_equipment_check', 'pre_case_check'].includes(normalizedType)) {
    return exportEquipmentCheckForm(formData, formData.checkItems || []);
  }
  
  // Eğer devir teslim formu ise
  if (normalizedType === 'handover') {
    return exportHandoverForm(formData);
  }
  
  // Eğer günlük kontrol formu ise
  if (normalizedType === 'daily_control') {
    return exportDailyControlForm(formData);
  }
  
  // Onam formları
  return exportConsentForm(formData, getFormTitle(normalizedType), consentText);
};

/**
 * Vaka formu için PDF oluştur
 */
export const generateCaseFormPDF = (caseData, formData) => {
  const mergedData = {
    ...formData,
    healmedyProtocol: caseData?.case_number || formData.healmedyProtocol,
  };
  
  return exportAmbulanceCaseForm(
    mergedData, 
    formData.vitalSigns || [], 
    formData.procedures || {}
  );
};

/**
 * PDF'i indir
 */
export const downloadPDF = (doc, filename) => {
  downloadPDFUtil(doc, filename);
};

/**
 * PDF'i yeni sekmede aç
 */
export const openPDFInNewTab = (doc) => {
  const blob = getPDFBlob(doc);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

/**
 * Form başlığı al
 */
const getFormTitle = (formType) => {
  const titles = {
    kvkk: 'KVKK ONAM FORMU',
    injection: 'ENJEKSİYON ONAM FORMU',
    puncture: 'PONKSİYON ONAM FORMU',
    minor_surgery: 'MİNÖR CERRAHİ ONAM FORMU',
    general_consent: 'GENEL TIBBİ MÜDAHALE ONAM FORMU',
    medicine_request: 'İLAÇ TALEP FORMU',
    material_request: 'MALZEME TALEP FORMU',
    medical_gas_request: 'MEDİKAL GAZ İSTEK FORMU',
    ambulance_equipment_check: 'AMBULANS EKİPMAN KONTROL FORMU',
    pre_case_check: 'VAKA ÖNCESİ KONTROL FORMU',
    ambulance_case: 'AMBULANS VAKA FORMU',
    daily_control: 'AMBULANS GÜNLÜK KONTROL FORMU',
    handover: 'AMBULANS DEVİR TESLİM FORMU'
  };
  
  return titles[formType] || 'FORM';
};

export default {
  generateGeneralFormPDF,
  generateCaseFormPDF,
  downloadPDF,
  openPDFInNewTab
};
