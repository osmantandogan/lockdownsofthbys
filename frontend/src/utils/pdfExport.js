/**
 * HealMedy HBYS - PDF Export Servisi
 * Tüm formlar için profesyonel PDF çıktısı
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Türkçe karakterleri ASCII eşdeğerlerine çevir
 * jspdf varsayılan fontu Türkçe karakterleri desteklemediği için gerekli
 */
const turkishToAscii = (text) => {
  if (!text) return text;
  const charMap = {
    'ş': 's', 'Ş': 'S',
    'ğ': 'g', 'Ğ': 'G',
    'ü': 'u', 'Ü': 'U',
    'ö': 'o', 'Ö': 'O',
    'ç': 'c', 'Ç': 'C',
    'ı': 'i', 'İ': 'I'
  };
  return String(text).replace(/[şŞğĞüÜöÖçÇıİ]/g, char => charMap[char] || char);
};

/**
 * Metin ve nesne içindeki tüm stringleri Türkçe karakterlerden arındır
 */
const sanitizeText = (input) => {
  if (typeof input === 'string') {
    return turkishToAscii(input);
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeText(item));
  }
  if (typeof input === 'object' && input !== null) {
    const result = {};
    for (const key in input) {
      result[key] = sanitizeText(input[key]);
    }
    return result;
  }
  return input;
};

// HealMedy Renk Paleti
const COLORS = {
  primary: [220, 38, 38], // Kırmızı
  secondary: [37, 99, 235], // Mavi
  dark: [31, 41, 55], // Koyu Gri
  light: [249, 250, 251], // Açık Gri
  white: [255, 255, 255],
  black: [0, 0, 0],
  success: [34, 197, 94],
  warning: [234, 179, 8],
  danger: [239, 68, 68]
};

// Font boyutları
const FONT = {
  title: 18,
  subtitle: 14,
  header: 12,
  body: 10,
  small: 8
};

/**
 * HealMedy branded header oluştur
 */
const addHeader = (doc, title, subtitle = '', pageNum = 1, totalPages = 1) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const safeTitle = sanitizeText(title);
  const safeSubtitle = sanitizeText(subtitle);
  
  // Kırmızı üst banner
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // Logo metni (sol üst)
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('HealMedy', 15, 15);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('HBYS', 15, 21);
  
  // Form başlığı (orta)
  doc.setFontSize(FONT.title);
  doc.setFont('helvetica', 'bold');
  const titleWidth = doc.getTextWidth(safeTitle);
  doc.text(safeTitle, (pageWidth - titleWidth) / 2, 15);
  
  // Sayfa numarası (sağ üst)
  doc.setFontSize(FONT.small);
  doc.setFont('helvetica', 'normal');
  const pageText = `Sayfa ${pageNum}/${totalPages}`;
  doc.text(pageText, pageWidth - 15 - doc.getTextWidth(pageText), 15);
  
  // Alt çizgi
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.5);
  doc.line(10, 28, pageWidth - 10, 28);
  
  // Subtitle varsa ekle
  if (safeSubtitle) {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(FONT.subtitle);
    doc.text(safeSubtitle, 15, 35);
    return 42;
  }
  
  return 35;
};

/**
 * Footer oluştur
 */
const addFooter = (doc, pageNum = 1) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Alt çizgi
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.3);
  doc.line(10, pageHeight - 20, pageWidth - 10, pageHeight - 20);
  
  // Footer metni
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(FONT.small);
  doc.setFont('helvetica', 'normal');
  
  const date = new Date().toLocaleDateString('tr-TR');
  const time = new Date().toLocaleTimeString('tr-TR');
  
  doc.text(sanitizeText(`Olusturulma: ${date} ${time}`), 15, pageHeight - 12);
  doc.text(sanitizeText('HealMedy HBYS - Tum haklari saklidir'), pageWidth / 2 - 30, pageHeight - 12);
  doc.text(`${pageNum}`, pageWidth - 15, pageHeight - 12);
};

/**
 * Bölüm başlığı ekle
 */
const addSectionTitle = (doc, title, y, icon = '') => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const safeTitle = sanitizeText(title);
  
  doc.setFillColor(...COLORS.secondary);
  doc.rect(10, y - 5, pageWidth - 20, 10, 'F');
  
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(FONT.header);
  doc.setFont('helvetica', 'bold');
  doc.text(`${icon} ${safeTitle}`.trim(), 15, y + 2);
  
  return y + 12;
};

/**
 * Bilgi satırı ekle
 */
const addInfoRow = (doc, label, value, y, x = 15, width = 80) => {
  const safeLabel = sanitizeText(label);
  const safeValue = sanitizeText(value);
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'bold');
  doc.text(`${safeLabel}:`, x, y);
  
  doc.setFont('helvetica', 'normal');
  const valueX = x + width;
  doc.text(safeValue || '-', valueX, y);
  
  return y + 7;
};

/**
 * İki sütunlu bilgi satırı
 */
const addTwoColumnRow = (doc, label1, value1, label2, value2, y) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const midPoint = pageWidth / 2;
  
  const safeLabel1 = sanitizeText(label1);
  const safeValue1 = sanitizeText(value1);
  const safeLabel2 = sanitizeText(label2);
  const safeValue2 = sanitizeText(value2);
  
  // Sol sütun
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'bold');
  doc.text(`${safeLabel1}:`, 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(safeValue1 || '-', 60, y);
  
  // Sağ sütun
  doc.setFont('helvetica', 'bold');
  doc.text(`${safeLabel2}:`, midPoint + 5, y);
  doc.setFont('helvetica', 'normal');
  doc.text(safeValue2 || '-', midPoint + 50, y);
  
  return y + 7;
};

/**
 * Checkbox satırı ekle
 */
const addCheckboxRow = (doc, label, checked, y, x = 15) => {
  const safeLabel = sanitizeText(label);
  
  // Checkbox kutusu
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.3);
  doc.rect(x, y - 4, 5, 5);
  
  if (checked) {
    doc.setFillColor(...COLORS.success);
    doc.rect(x + 0.5, y - 3.5, 4, 4, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(8);
    doc.text('X', x + 1, y);
  }
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');
  doc.text(safeLabel, x + 8, y);
  
  return y + 7;
};

/**
 * İmza alanı ekle
 */
const addSignatureBox = (doc, title, signatureData, name, y, x = 15) => {
  const boxWidth = 80;
  const boxHeight = 35;
  const safeTitle = sanitizeText(title);
  const safeName = sanitizeText(name);
  
  // Başlık
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(FONT.small);
  doc.setFont('helvetica', 'bold');
  doc.text(safeTitle, x, y);
  
  // İmza kutusu
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.5);
  doc.rect(x, y + 3, boxWidth, boxHeight);
  
  // İmza varsa ekle
  if (signatureData && signatureData.startsWith('data:image')) {
    try {
      doc.addImage(signatureData, 'PNG', x + 2, y + 5, boxWidth - 4, boxHeight - 10);
    } catch (e) {
      console.error('Imza eklenemedi:', e);
    }
  }
  
  // İsim
  if (safeName) {
    doc.setFontSize(FONT.small);
    doc.setFont('helvetica', 'normal');
    doc.text(safeName, x, y + boxHeight + 8);
  }
  
  return y + boxHeight + 15;
};

/**
 * Tablo ekle (jspdf-autotable kullanarak)
 */
const addTable = (doc, headers, rows, y, options = {}) => {
  doc.autoTable({
    startY: y,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.secondary,
      textColor: COLORS.white,
      fontSize: FONT.small,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: FONT.small,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.light
    },
    margin: { left: 10, right: 10 },
    ...options
  });
  
  return doc.lastAutoTable.finalY + 10;
};

/**
 * Yeni sayfa ekle
 */
const addNewPage = (doc) => {
  doc.addPage();
  return 15;
};

// ==================== FORM SPESİFİK EXPORT FONKSİYONLARI ====================

/**
 * Genel Form Export (Tek Sayfa)
 * Tüm onam ve istek formları için kullanılır
 */
export const exportGenericForm = (formData, formType, formTitle) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let y = addHeader(doc, formTitle);
  
  // Form bilgileri
  y = addSectionTitle(doc, 'Form Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Tarih', formData.date || new Date().toLocaleDateString('tr-TR'), 
                          'Form No', formData.formNo || '-', y);
  y = addTwoColumnRow(doc, 'Hasta Adi', formData.patientName || formData.hastaAdi || '-',
                          'TC No', formData.tcNo || '-', y);
  
  if (formData.vehiclePlate || formData.aracPlakasi) {
    y = addTwoColumnRow(doc, 'Arac Plakasi', formData.vehiclePlate || formData.aracPlakasi || '-',
                            'Personel', formData.staffName || '-', y);
  }
  
  y += 5;
  
  // Form icerigi (dinamik alanlar)
  if (formData.content || formData.description || formData.notes) {
    y = addSectionTitle(doc, 'Form Icerigi', y);
    
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(FONT.body);
    doc.setFont('helvetica', 'normal');
    
    const content = sanitizeText(formData.content || formData.description || formData.notes || '');
    const lines = doc.splitTextToSize(content, pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 10;
  }
  
  // Onay bilgileri
  if (formData.approved !== undefined || formData.consent !== undefined) {
    y = addSectionTitle(doc, 'Onay Durumu', y);
    
    const isApproved = formData.approved || formData.consent;
    y = addCheckboxRow(doc, 'Yukaridaki bilgileri okudum ve onayliyorum', isApproved, y);
    y += 5;
  }
  
  // Imzalar
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 30;
  }
  
  y = addSectionTitle(doc, 'Imzalar', y);
  
  const sigY = y + 5;
  
  // Hasta/Veli Imzasi
  addSignatureBox(doc, 'Hasta/Veli Imzasi', formData.patientSignature || formData.hastaImza, 
                  formData.patientName || formData.hastaAdi, sigY, 15);
  
  // Personel Imzasi
  addSignatureBox(doc, 'Personel Imzasi', formData.staffSignature || formData.personelImza,
                  formData.staffName || formData.personelAdi, sigY, pageWidth / 2 + 5);
  
  addFooter(doc);
  
  return doc;
};

/**
 * AMBULANS VAKA FORMU Export (Çok Sayfalı)
 */
export const exportAmbulanceCaseForm = (formData, vitalSigns = [], procedures = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentPage = 1;
  const totalPages = 3; // Tahmini sayfa sayısı
  
  // ==================== SAYFA 1 ====================
  let y = addHeader(doc, 'AMBULANS VAKA FORMU', '', currentPage, totalPages);
  
  // Vaka Bilgileri
  y = addSectionTitle(doc, 'Vaka Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Tarih', formData.date || '-', 'ATN No', formData.atnNo || '-', y);
  y = addTwoColumnRow(doc, 'HealMedy Protokol', formData.healmedyProtocol || '-', 
                          '112 Protokol', formData.protocol112 || '-', y);
  y = addTwoColumnRow(doc, 'Hastane Protokol', formData.hospitalProtocol || '-',
                          'Gidis-Donus', formData.roundTrip || '-', y);
  
  y += 5;
  
  // Hasta Bilgileri
  y = addSectionTitle(doc, 'Hasta Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Ad Soyad', formData.patientName || '-', 'TC No', formData.tcNo || '-', y);
  y = addTwoColumnRow(doc, 'Cinsiyet', formData.gender || '-', 'Yas', formData.age || '-', y);
  y = addTwoColumnRow(doc, 'Telefon', formData.phone || '-', 'Bilinc', formData.consciousStatus ? 'Acik' : 'Kapali', y);
  
  y = addInfoRow(doc, 'Adres', formData.address || '-', y, 15, 30);
  y = addInfoRow(doc, 'Sikayet', formData.complaint || '-', y, 15, 30);
  y = addInfoRow(doc, 'On Tani', formData.diagnosis || '-', y, 15, 30);
  y = addInfoRow(doc, 'Kronik Hastaliklar', formData.chronicDiseases || '-', y, 15, 45);
  
  y += 5;
  
  // Zaman Bilgileri
  y = addSectionTitle(doc, 'Zaman Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Cagri Saati', formData.callTime || '-', 
                          'Ulasim Saati', formData.arrivalTime || '-', y);
  y = addTwoColumnRow(doc, 'Cikis Saati', formData.departureTime || '-',
                          'Hastane Varis', formData.hospitalArrivalTime || '-', y);
  
  y += 5;
  
  // Lokasyon Bilgileri
  y = addSectionTitle(doc, 'Lokasyon Bilgileri', y);
  
  y = addInfoRow(doc, 'Alindigi Yer', formData.pickupLocation || '-', y, 15, 40);
  y = addInfoRow(doc, 'Transfer 1', formData.transfer1 || '-', y, 15, 40);
  y = addInfoRow(doc, 'Transfer 2', formData.transfer2 || '-', y, 15, 40);
  
  addFooter(doc, currentPage);
  
  // ==================== SAYFA 2 ====================
  doc.addPage();
  currentPage = 2;
  y = addHeader(doc, 'AMBULANS VAKA FORMU', 'Vital Bulgular & Uygulanan İşlemler', currentPage, totalPages);
  
  // Vital Bulgular Tablosu
  y = addSectionTitle(doc, 'Vital Bulgular', y);
  
  const vitalHeaders = ['Saat', 'Tansiyon', 'Nabiz', 'SpO2', 'Solunum', 'Ates'];
  const vitalRows = (vitalSigns || []).map(v => [
    v.time || '-',
    v.bp || '-',
    v.pulse || '-',
    v.spo2 || '-',
    v.respiration || '-',
    v.temp || '-'
  ]);
  
  if (vitalRows.length > 0) {
    y = addTable(doc, vitalHeaders, vitalRows, y);
  } else {
    y += 10;
  }
  
  // Durum Degerlendirmesi
  y = addSectionTitle(doc, 'Durum Degerlendirmesi', y);
  
  y = addTwoColumnRow(doc, 'Duygusal Durum', formData.emotionalState || '-',
                          'Pupiller', formData.pupils || '-', y);
  y = addTwoColumnRow(doc, 'Cilt', formData.skin || '-',
                          'Solunum', formData.respiration || '-', y);
  y = addTwoColumnRow(doc, 'Nabiz', formData.pulse || '-',
                          'Motor Yanit', formData.motorResponse || '-', y);
  y = addTwoColumnRow(doc, 'Sozel Yanit', formData.verbalResponse || '-',
                          'Goz Acma', formData.eyeOpening || '-', y);
  
  y += 5;
  
  // Uygulanan Islemler
  y = addSectionTitle(doc, 'Uygulanan Islemler', y);
  
  const procedureEntries = Object.entries(procedures || {}).filter(([_, v]) => v);
  if (procedureEntries.length > 0) {
    procedureEntries.forEach(([key, _]) => {
      if (y > 270) {
        addFooter(doc, currentPage);
        doc.addPage();
        currentPage++;
        y = addHeader(doc, 'AMBULANS VAKA FORMU', 'Uygulanan Islemler (devam)', currentPage, totalPages);
      }
      y = addCheckboxRow(doc, sanitizeText(key), true, y);
    });
  } else {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(FONT.body);
    doc.text('Islem kaydi yok', 15, y);
    y += 10;
  }
  
  addFooter(doc, currentPage);
  
  // ==================== SAYFA 3 ====================
  doc.addPage();
  currentPage = 3;
  y = addHeader(doc, 'AMBULANS VAKA FORMU', 'Araç Bilgileri & İmzalar', currentPage, totalPages);
  
  // CPR Bilgileri
  if (formData.cprBy || formData.cprStart || formData.cprEnd) {
    y = addSectionTitle(doc, 'CPR Bilgileri', y);
    
    y = addTwoColumnRow(doc, 'CPR Yapan', formData.cprBy || '-',
                            'Baslangic', formData.cprStart || '-', y);
    y = addTwoColumnRow(doc, 'Bitis', formData.cprEnd || '-',
                            'Sebep', formData.cprReason || '-', y);
    y += 5;
  }
  
  // Arac Bilgileri
  y = addSectionTitle(doc, 'Arac Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Arac Tipi', formData.vehicleType || '-',
                          'Kurum', formData.institution || '-', y);
  y = addTwoColumnRow(doc, 'Baslangic KM', formData.startKm || '-',
                          'Bitis KM', formData.endKm || '-', y);
  
  if (formData.startKm && formData.endKm) {
    const totalKm = parseInt(formData.endKm) - parseInt(formData.startKm);
    y = addInfoRow(doc, 'Toplam KM', totalKm.toString(), y, 15, 40);
  }
  
  y += 5;
  
  // Refakatci Bilgileri
  if (formData.companions) {
    y = addSectionTitle(doc, 'Refakatci Bilgileri', y);
    y = addInfoRow(doc, 'Refakatciler', formData.companions || '-', y, 15, 35);
    y += 5;
  }
  
  // Imzalar
  y = addSectionTitle(doc, 'Onay ve Imzalar', y);
  
  const sigY = y + 5;
  
  // ATT/Paramedik Imzasi
  addSignatureBox(doc, 'ATT/Paramedik', formData.attSignature, formData.attName, sigY, 15);
  
  // Sofor Imzasi
  addSignatureBox(doc, 'Sofor', formData.driverSignature, formData.driverName, sigY, pageWidth / 2 + 5);
  
  addFooter(doc, currentPage);
  
  return doc;
};

/**
 * DEVİR TESLİM FORMU Export
 */
export const exportHandoverForm = (formData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let y = addHeader(doc, 'AMBULANS DEVIR TESLIM FORMU');
  
  // Arac Bilgileri
  y = addSectionTitle(doc, 'Arac Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Arac Plakasi', formData.aracPlakasi || '-',
                          'Kayit Tarihi', formData.kayitTarihi || '-', y);
  y = addTwoColumnRow(doc, 'Teslim Alinan KM', formData.teslimAlinanKm || '-',
                          'Servis KM', formData.servisYapilacakKm || '-', y);
  
  // Servis kalan KM hesapla
  if (formData.servisYapilacakKm && formData.teslimAlinanKm) {
    const kalan = parseInt(formData.servisYapilacakKm) - parseInt(formData.teslimAlinanKm);
    y = addInfoRow(doc, 'Servise Kalan KM', kalan.toString(), y, 15, 45);
  }
  
  y += 5;
  
  // Ekipman Kontrolu
  y = addSectionTitle(doc, 'Ekipman Kontrolu', y);
  
  y = addTwoColumnRow(doc, 'Fosforlu Yelek', formData.fosforluYelek || '-',
                          'Takviye Kablosu', formData.takviyeKablosu || '-', y);
  y = addTwoColumnRow(doc, 'Cekme Kablosu', formData.cekmeKablosu || '-',
                          'Ucgen', formData.ucgen || '-', y);
  
  y += 5;
  
  // Notlar
  if (formData.teslimEdenNotlar || formData.hasarBildirimi) {
    y = addSectionTitle(doc, 'Notlar ve Bildirimler', y);
    
    if (formData.teslimEdenNotlar) {
      y = addInfoRow(doc, 'Teslim Eden Notlari', '', y, 15, 50);
      doc.setFontSize(FONT.small);
      const lines = doc.splitTextToSize(sanitizeText(formData.teslimEdenNotlar), pageWidth - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4 + 5;
    }
    
    if (formData.hasarBildirimi) {
      y = addInfoRow(doc, 'Hasar Bildirimi', '', y, 15, 50);
      doc.setFontSize(FONT.small);
      const lines = doc.splitTextToSize(sanitizeText(formData.hasarBildirimi), pageWidth - 30);
      doc.text(lines, 15, y);
      y += lines.length * 4 + 5;
    }
  }
  
  y += 5;
  
  // Imzalar
  y = addSectionTitle(doc, 'Onay ve Imzalar', y);
  
  const sigY = y + 5;
  
  // Teslim Eden Imzasi
  addSignatureBox(doc, 'Teslim Eden', formData.teslimEdenSignature, formData.teslimEden, sigY, 15);
  
  // Teslim Alan Imzasi
  addSignatureBox(doc, 'Teslim Alan', formData.teslimAlanSignature, formData.teslimAlan, sigY, pageWidth / 2 + 5);
  
  // Birim Yoneticisi
  if (formData.birimYoneticisi) {
    const yoneticY = sigY + 55;
    addSignatureBox(doc, 'Birim Yoneticisi', null, formData.birimYoneticisi, yoneticY, pageWidth / 2 - 40);
  }
  
  addFooter(doc);
  
  return doc;
};

/**
 * GÜNLÜK KONTROL FORMU Export
 */
export const exportDailyControlForm = (formData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let y = addHeader(doc, 'AMBULANS GUNLUK KONTROL FORMU');
  
  // Arac Bilgileri
  y = addSectionTitle(doc, 'Arac Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Arac Plakasi', formData.aracPlakasi || '-',
                          'Tarih', formData.tarih || new Date().toLocaleDateString('tr-TR'), y);
  y = addTwoColumnRow(doc, 'Kilometre', formData.km || '-',
                          'Yakit Seviyesi', formData.yakitSeviyesi || '-', y);
  
  y += 5;
  
  // Genel Durum
  y = addSectionTitle(doc, 'Genel Durum', y);
  
  y = addTwoColumnRow(doc, 'Ruhsat', formData.ruhsat || '-',
                          'Dis Gorunus', formData.disGorunus || '-', y);
  y = addTwoColumnRow(doc, 'Kaporta', formData.kaporta || '-',
                          'Lastikler', formData.lastikler || '-', y);
  
  y += 5;
  
  // Sistem Kontrolleri
  y = addSectionTitle(doc, 'Sistem Kontrolleri', y);
  
  y = addTwoColumnRow(doc, 'Motor', formData.motor || '-',
                          'Fren', formData.fren || '-', y);
  y = addTwoColumnRow(doc, 'GPS', formData.gps || '-',
                          'Siren', formData.siren || '-', y);
  y = addTwoColumnRow(doc, 'Farlar', formData.farlar || '-',
                          'Stepne', formData.stepne || '-', y);
  y = addTwoColumnRow(doc, 'Yangin Tupu', formData.yanginTupu || '-',
                          'Kriko', formData.kriko || '-', y);
  
  y += 5;
  
  // Kabin Kontrolu
  y = addSectionTitle(doc, 'Kabin Kontrolu', y);
  
  y = addTwoColumnRow(doc, 'Temizlik', formData.kabinTemizlik || '-',
                          'Sedye', formData.sedye || '-', y);
  
  y += 5;
  
  // Notlar
  if (formData.notlar) {
    y = addSectionTitle(doc, 'Notlar', y);
    doc.setFontSize(FONT.body);
    const lines = doc.splitTextToSize(sanitizeText(formData.notlar), pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 10;
  }
  
  // Imza
  y = addSectionTitle(doc, 'Kontrol Eden', y);
  addSignatureBox(doc, 'Sofor Imzasi', formData.soforImza, formData.soforAdi, y + 5, 15);
  
  addFooter(doc);
  
  return doc;
};

/**
 * ONAM FORMU Export (KVKK, Enjeksiyon, vb.)
 */
export const exportConsentForm = (formData, formTitle, consentText) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let y = addHeader(doc, formTitle);
  
  // Hasta Bilgileri
  y = addSectionTitle(doc, 'Hasta Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Ad Soyad', formData.patientName || formData.hastaAdi || '-',
                          'TC No', formData.tcNo || '-', y);
  y = addTwoColumnRow(doc, 'Tarih', formData.date || new Date().toLocaleDateString('tr-TR'),
                          'Telefon', formData.phone || formData.telefon || '-', y);
  
  y += 5;
  
  // Onam Metni
  y = addSectionTitle(doc, 'Bilgilendirme ve Onam', y);
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(FONT.body);
  doc.setFont('helvetica', 'normal');
  
  const safeConsentText = sanitizeText(consentText || formData.consentText || '');
  const lines = doc.splitTextToSize(safeConsentText, pageWidth - 30);
  
  // Metin çok uzunsa sayfa ekle
  let lineY = y;
  lines.forEach((line, index) => {
    if (lineY > 250) {
      addFooter(doc);
      doc.addPage();
      lineY = addHeader(doc, formTitle, '(devam)');
    }
    doc.text(line, 15, lineY);
    lineY += 5;
  });
  
  y = lineY + 10;
  
  // Onay kutusu
  y = addCheckboxRow(doc, 'Yukaridaki bilgilendirmeyi okudum, anladim ve kabul ediyorum.', 
                     formData.consent || formData.onay, y);
  
  y += 10;
  
  // Imzalar
  y = addSectionTitle(doc, 'Imzalar', y);
  
  const sigY = y + 5;
  
  // Hasta/Veli Imzasi
  addSignatureBox(doc, 'Hasta/Veli Imzasi', formData.patientSignature || formData.hastaImza,
                  formData.patientName || formData.hastaAdi, sigY, 15);
  
  // Personel Imzasi
  addSignatureBox(doc, 'Saglik Personeli', formData.staffSignature || formData.personelImza,
                  formData.staffName || formData.personelAdi, sigY, pageWidth / 2 + 5);
  
  addFooter(doc);
  
  return doc;
};

/**
 * ISTEK FORMU Export (Ilac, Malzeme, Gaz)
 */
export const exportRequestForm = (formData, formTitle, items = []) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  let y = addHeader(doc, formTitle);
  
  // Form Bilgileri
  y = addSectionTitle(doc, 'Form Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Tarih', formData.date || new Date().toLocaleDateString('tr-TR'),
                          'Talep No', formData.requestNo || '-', y);
  y = addTwoColumnRow(doc, 'Talep Eden', formData.requestedBy || formData.talepEden || '-',
                          'Birim', formData.unit || formData.birim || '-', y);
  
  y += 5;
  
  // Istek Listesi Tablosu
  y = addSectionTitle(doc, 'Istek Listesi', y);
  
  const headers = ['Sira', 'Urun Adi', 'Miktar', 'Birim', 'Aciklama'];
  const rows = (items || []).map((item, index) => [
    (index + 1).toString(),
    sanitizeText(item.name || item.urunAdi || '-'),
    item.quantity || item.miktar || '-',
    item.unit || item.birim || '-',
    sanitizeText(item.note || item.aciklama || '-')
  ]);
  
  if (rows.length > 0) {
    y = addTable(doc, headers, rows, y);
  } else {
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(FONT.body);
    doc.text('Henuz urun eklenmemis', 15, y);
    y += 10;
  }
  
  // Notlar
  if (formData.notes || formData.notlar) {
    y = addSectionTitle(doc, 'Notlar', y);
    doc.setFontSize(FONT.body);
    const lines = doc.splitTextToSize(sanitizeText(formData.notes || formData.notlar), pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 10;
  }
  
  // Imzalar
  y = addSectionTitle(doc, 'Onay', y);
  
  const sigY = y + 5;
  
  // Talep Eden
  addSignatureBox(doc, 'Talep Eden', formData.requesterSignature, 
                  formData.requestedBy || formData.talepEden, sigY, 15);
  
  // Onaylayan
  addSignatureBox(doc, 'Onaylayan', formData.approverSignature,
                  formData.approvedBy || formData.onaylayan, sigY, pageWidth / 2 + 5);
  
  addFooter(doc);
  
  return doc;
};

/**
 * EKİPMAN KONTROL FORMU Export
 */
export const exportEquipmentCheckForm = (formData, checkItems = []) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentPage = 1;
  
  let y = addHeader(doc, 'AMBULANS CIHAZ/MALZEME/ILAC KONTROL FORMU');
  
  // Form Bilgileri
  y = addSectionTitle(doc, 'Form Bilgileri', y);
  
  y = addTwoColumnRow(doc, 'Tarih', formData.date || new Date().toLocaleDateString('tr-TR'),
                          'Arac Plakasi', formData.vehiclePlate || '-', y);
  y = addTwoColumnRow(doc, 'Kontrol Eden', formData.checkedBy || '-',
                          'Vardiya', formData.shift || '-', y);
  
  y += 5;
  
  // Kontrol Listesi
  y = addSectionTitle(doc, 'Kontrol Listesi', y);
  
  const headers = ['Malzeme', 'Durum', 'Miktar', 'Not'];
  const rows = (checkItems || []).map(item => [
    item.name || '-',
    item.status || '-',
    item.quantity || '-',
    item.note || '-'
  ]);
  
  if (rows.length > 0) {
    // Tablo çok uzunsa sayfalara böl
    doc.autoTable({
      startY: y,
      head: [headers],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: FONT.small,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: FONT.small,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.light
      },
      margin: { left: 10, right: 10 },
      didDrawPage: function(data) {
        // Her sayfada footer ekle
        addFooter(doc, currentPage);
        currentPage++;
      }
    });
    
    y = doc.lastAutoTable.finalY + 10;
  }
  
  // Sayfa sonuna yakınsa yeni sayfa
  if (y > 230) {
    doc.addPage();
    y = 30;
  }
  
  // Imza
  y = addSectionTitle(doc, 'Kontrol Eden', y);
  addSignatureBox(doc, 'ATT/Paramedik Imzasi', formData.signature, formData.checkedBy, y + 5, 15);
  
  addFooter(doc, currentPage);
  
  return doc;
};

// ==================== ANA EXPORT FONKSİYONU ====================

/**
 * Form tipine göre PDF export
 * @param {string} formType - Form tipi
 * @param {object} formData - Form verileri
 * @param {object} extraData - Ek veriler (vital signs, items, vb.)
 */
export const exportFormToPDF = (formType, formData, extraData = {}) => {
  // Tum verileri Turkce karakterlerden arindir
  const safeFormData = sanitizeText(formData);
  const safeExtraData = sanitizeText(extraData);
  
  let doc;
  
  switch (formType) {
    case 'ambulance_case':
      doc = exportAmbulanceCaseForm(safeFormData, safeExtraData.vitalSigns, safeExtraData.procedures);
      break;
      
    case 'handover':
      doc = exportHandoverForm(safeFormData);
      break;
      
    case 'daily_control':
      doc = exportDailyControlForm(safeFormData);
      break;
      
    case 'kvkk':
      doc = exportConsentForm(safeFormData, 'KVKK ONAM FORMU', safeExtraData.consentText);
      break;
      
    case 'injection':
      doc = exportConsentForm(safeFormData, 'ENJEKSIYON ONAM FORMU', safeExtraData.consentText);
      break;
      
    case 'puncture':
      doc = exportConsentForm(safeFormData, 'PONKSIYON ONAM FORMU', safeExtraData.consentText);
      break;
      
    case 'minor_surgery':
      doc = exportConsentForm(safeFormData, 'MINOR CERRAHI ONAM FORMU', safeExtraData.consentText);
      break;
      
    case 'general_consent':
      doc = exportConsentForm(safeFormData, 'GENEL TIBBI MUDAHALE ONAM FORMU', safeExtraData.consentText);
      break;
      
    case 'medicine_request':
      doc = exportRequestForm(safeFormData, 'ILAC TALEP FORMU', safeExtraData.items);
      break;
      
    case 'material_request':
      doc = exportRequestForm(safeFormData, 'MALZEME TALEP FORMU', safeExtraData.items);
      break;
      
    case 'medical_gas_request':
      doc = exportRequestForm(safeFormData, 'MEDIKAL GAZ ISTEK FORMU', safeExtraData.items);
      break;
      
    case 'ambulance_equipment_check':
    case 'pre_case_check':
      doc = exportEquipmentCheckForm(safeFormData, safeExtraData.checkItems);
      break;
      
    default:
      doc = exportGenericForm(safeFormData, formType, safeExtraData.title || 'FORM');
  }
  
  return doc;
};

/**
 * PDF'i indir - Blob yöntemi ile (daha güvenilir)
 */
export const downloadPDF = (doc, filename) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const safeFilename = filename.replace(/[^a-zA-Z0-9-_]/g, '_');
    const finalFilename = `HealMedy_${safeFilename}_${date}.pdf`;
    
    // Blob olarak PDF oluştur
    const pdfBlob = doc.output('blob');
    
    // İndirme linki oluştur
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';
    
    // Linki DOM'a ekle ve tıkla
    document.body.appendChild(link);
    link.click();
    
    // Temizlik
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    console.log('[PDF] Downloaded:', finalFilename);
  } catch (error) {
    console.error('[PDF] Download error:', error);
    // Fallback: doğrudan save kullan
    try {
      doc.save(filename + '.pdf');
    } catch (e) {
      console.error('[PDF] Fallback save error:', e);
    }
  }
};

/**
 * PDF'i blob olarak al (preview için)
 */
export const getPDFBlob = (doc) => {
  return doc.output('blob');
};

/**
 * PDF'i base64 olarak al
 */
export const getPDFBase64 = (doc) => {
  return doc.output('datauristring');
};

export default {
  exportFormToPDF,
  downloadPDF,
  getPDFBlob,
  getPDFBase64,
  exportAmbulanceCaseForm,
  exportHandoverForm,
  exportDailyControlForm,
  exportConsentForm,
  exportRequestForm,
  exportEquipmentCheckForm,
  exportGenericForm
};

