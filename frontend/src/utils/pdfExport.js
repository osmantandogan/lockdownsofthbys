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

/**
 * TC Kimlik Numarasını maskele
 * Örnek: 12345678901 -> 123****8901 (ilk 3 ve son 4 hane görünür)
 * PDF'lerde hasta gizliliği için kullanılır
 */
const maskTcNo = (tcNo) => {
  if (!tcNo || typeof tcNo !== 'string') return tcNo || '-';
  // Zaten maskeli ise olduğu gibi döndür
  if (tcNo.includes('*')) return tcNo;
  // 11 haneli değilse olduğu gibi döndür
  if (tcNo.length !== 11) return tcNo;
  // İlk 3 + **** + son 4 hane
  return tcNo.slice(0, 3) + '****' + tcNo.slice(-4);
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
                          'TC No', maskTcNo(formData.tcNo), y);
  
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
 * AMBULANS VAKA FORMU Export (Tek Sayfa - Landscape)
 */
export const exportAmbulanceCaseForm = (formData, vitalSigns = [], procedures = {}) => {
  // Landscape mod kullan (daha geniş alan)
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Kompakt header (daha az yer kaplar)
  let y = 10;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('AMBULANS VAKA FORMU', pageWidth / 2, 12, { align: 'center' });
  doc.setDrawColor(...COLORS.dark);
  doc.line(5, 22, pageWidth - 5, 22);
  y = 25;
  
  // Küçük font boyutları
  const compactFont = {
    title: 8,
    body: 7,
    small: 6
  };
  
  // Sol sütun başlangıcı
  let leftX = 5;
  let rightX = pageWidth / 2 + 2;
  let currentY = y;
  const lineHeight = 5;
  
  // ========== SOL SÜTUN ==========
  
  // Vaka Bilgileri
  doc.setFillColor(...COLORS.secondary);
  doc.rect(leftX, currentY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Vaka Bilgileri', leftX + 2, currentY + 1);
  currentY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.body);
  doc.setFont('helvetica', 'normal');
  
  const addCompactRow = (label, value, x, yPos) => {
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizeText(label) + ':', x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeText(value || '-'), x + 35, yPos);
    return yPos + lineHeight;
  };
  
  currentY = addCompactRow('Tarih', formData.date, leftX, currentY);
  currentY = addCompactRow('ATN No', formData.atnNo, leftX, currentY);
  currentY = addCompactRow('HealMedy Protokol', formData.healmedyProtocol, leftX, currentY);
  currentY = addCompactRow('112 Protokol', formData.protocol112, leftX, currentY);
  currentY = addCompactRow('Hastane Protokol', formData.hospitalProtocol, leftX, currentY);
  currentY = addCompactRow('Gidis-Donus', formData.roundTrip, leftX, currentY);
  
  currentY += 3;
  
  // Hasta Bilgileri
  doc.setFillColor(...COLORS.secondary);
  doc.rect(leftX, currentY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Hasta Bilgileri', leftX + 2, currentY + 1);
  currentY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.body);
  
  currentY = addCompactRow('Ad Soyad', formData.patientName, leftX, currentY);
  currentY = addCompactRow('TC No', maskTcNo(formData.tcNo), leftX, currentY);
  currentY = addCompactRow('Cinsiyet', formData.gender, leftX, currentY);
  currentY = addCompactRow('Yas', formData.age, leftX, currentY);
  currentY = addCompactRow('Telefon', formData.phone, leftX, currentY);
  currentY = addCompactRow('Bilinc', formData.consciousStatus ? 'Acik' : 'Kapali', leftX, currentY);
  
  // Uzun metinler için özel işleme
  if (formData.address) {
    doc.setFont('helvetica', 'bold');
    doc.text('Adres:', leftX, currentY);
    doc.setFont('helvetica', 'normal');
    const addrLines = doc.splitTextToSize(sanitizeText(formData.address), (pageWidth / 2) - 45);
    doc.text(addrLines, leftX + 35, currentY);
    currentY += addrLines.length * lineHeight;
  }
  
  if (formData.complaint) {
    doc.setFont('helvetica', 'bold');
    doc.text('Sikayet:', leftX, currentY);
    doc.setFont('helvetica', 'normal');
    const complaintLines = doc.splitTextToSize(sanitizeText(formData.complaint), (pageWidth / 2) - 45);
    doc.text(complaintLines, leftX + 35, currentY);
    currentY += complaintLines.length * lineHeight;
  }
  
  currentY = addCompactRow('On Tani', formData.diagnosis, leftX, currentY);
  currentY = addCompactRow('Kronik Hastaliklar', formData.chronicDiseases, leftX, currentY);
  
  currentY += 3;
  
  // Zaman Bilgileri
  doc.setFillColor(...COLORS.secondary);
  doc.rect(leftX, currentY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Zaman Bilgileri', leftX + 2, currentY + 1);
  currentY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.body);
  
  currentY = addCompactRow('Cagri Saati', formData.callTime, leftX, currentY);
  currentY = addCompactRow('Ulasim Saati', formData.arrivalTime, leftX, currentY);
  currentY = addCompactRow('Cikis Saati', formData.departureTime, leftX, currentY);
  currentY = addCompactRow('Hastane Varis', formData.hospitalArrivalTime, leftX, currentY);
  
  currentY += 3;
  
  // Lokasyon Bilgileri
  doc.setFillColor(...COLORS.secondary);
  doc.rect(leftX, currentY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Lokasyon Bilgileri', leftX + 2, currentY + 1);
  currentY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.body);
  
  currentY = addCompactRow('Alindigi Yer', formData.pickupLocation, leftX, currentY);
  currentY = addCompactRow('Transfer 1', formData.transfer1, leftX, currentY);
  currentY = addCompactRow('Transfer 2', formData.transfer2, leftX, currentY);
  
  // ========== SAĞ SÜTUN ==========
  
  let rightY = y;
  
  // Vital Bulgular
  doc.setFillColor(...COLORS.secondary);
  doc.rect(rightX, rightY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Vital Bulgular', rightX + 2, rightY + 1);
  rightY += 8;
  
  const vitalHeaders = ['Saat', 'Tansiyon', 'Nabiz', 'SpO2', 'Solunum', 'Ates'];
  const vitalRows = (vitalSigns || []).filter(v => v.time || v.bp || v.pulse || v.spo2 || v.respiration || v.temp).map(v => [
    (v.time || '-').substring(0, 5),
    (v.bp || '-').substring(0, 8),
    (v.pulse || '-').substring(0, 5),
    (v.spo2 || '-').substring(0, 5),
    (v.respiration || '-').substring(0, 5),
    (v.temp || '-').substring(0, 5)
  ]);
  
  if (vitalRows.length > 0) {
    doc.autoTable({
      startY: rightY,
      head: [vitalHeaders],
      body: vitalRows,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.secondary,
        textColor: COLORS.white,
        fontSize: compactFont.small,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: compactFont.small,
        textColor: COLORS.dark
      },
      margin: { left: rightX, right: 5 },
      tableWidth: (pageWidth / 2) - 7,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 }
      }
    });
    rightY = doc.lastAutoTable.finalY + 5;
  } else {
    rightY += 10;
  }
  
  // Durum Degerlendirmesi
  doc.setFillColor(...COLORS.secondary);
  doc.rect(rightX, rightY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Durum Degerlendirmesi', rightX + 2, rightY + 1);
  rightY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.body);
  
  rightY = addCompactRow('Duygusal Durum', formData.emotionalState, rightX, rightY);
  rightY = addCompactRow('Pupiller', formData.pupils, rightX, rightY);
  rightY = addCompactRow('Cilt', formData.skin, rightX, rightY);
  rightY = addCompactRow('Solunum', formData.respiration, rightX, rightY);
  rightY = addCompactRow('Nabiz', formData.pulse, rightX, rightY);
  rightY = addCompactRow('Motor Yanit', formData.motorResponse, rightX, rightY);
  rightY = addCompactRow('Sozel Yanit', formData.verbalResponse, rightX, rightY);
  rightY = addCompactRow('Goz Acma', formData.eyeOpening, rightX, rightY);
  
  rightY += 3;
  
  // Uygulanan Islemler (kompakt)
  doc.setFillColor(...COLORS.secondary);
  doc.rect(rightX, rightY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Uygulanan Islemler', rightX + 2, rightY + 1);
  rightY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.small);
  
  const procedureEntries = Object.entries(procedures || {}).filter(([_, v]) => v);
  if (procedureEntries.length > 0) {
    const procText = procedureEntries.map(([key, _]) => sanitizeText(key)).join(', ');
    const procLines = doc.splitTextToSize(procText, (pageWidth / 2) - 10);
    doc.text(procLines, rightX, rightY);
    rightY += procLines.length * 4;
  } else {
    doc.text('Islem kaydi yok', rightX, rightY);
    rightY += 5;
  }
  
  rightY += 3;
  
  // CPR Bilgileri
  if (formData.cprBy || formData.cprStart || formData.cprEnd) {
    doc.setFillColor(...COLORS.secondary);
    doc.rect(rightX, rightY - 3, (pageWidth / 2) - 7, 6, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(compactFont.title);
    doc.setFont('helvetica', 'bold');
    doc.text('CPR Bilgileri', rightX + 2, rightY + 1);
    rightY += 8;
    
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(compactFont.body);
    
    rightY = addCompactRow('CPR Yapan', formData.cprBy, rightX, rightY);
    rightY = addCompactRow('Baslangic', formData.cprStart, rightX, rightY);
    rightY = addCompactRow('Bitis', formData.cprEnd, rightX, rightY);
    rightY = addCompactRow('Sebep', formData.cprReason, rightX, rightY);
    rightY += 3;
  }
  
  // Arac Bilgileri
  doc.setFillColor(...COLORS.secondary);
  doc.rect(rightX, rightY - 3, (pageWidth / 2) - 7, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Arac Bilgileri', rightX + 2, rightY + 1);
  rightY += 8;
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.body);
  
  rightY = addCompactRow('Arac Tipi', formData.vehicleType, rightX, rightY);
  rightY = addCompactRow('Kurum', formData.institution, rightX, rightY);
  rightY = addCompactRow('Baslangic KM', formData.startKm, rightX, rightY);
  rightY = addCompactRow('Bitis KM', formData.endKm, rightX, rightY);
  
  if (formData.startKm && formData.endKm) {
    const totalKm = parseInt(formData.endKm) - parseInt(formData.startKm);
    rightY = addCompactRow('Toplam KM', totalKm.toString(), rightX, rightY);
  }
  
  if (formData.companions) {
    rightY = addCompactRow('Refakatciler', formData.companions, rightX, rightY);
  }
  
  // ========== ALT KISIM - İMZALAR ==========
  
  const bottomY = Math.max(currentY, rightY) + 10;
  
  // İmza alanları (kompakt)
  doc.setFillColor(...COLORS.secondary);
  doc.rect(leftX, bottomY - 3, pageWidth - 10, 6, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(compactFont.title);
  doc.setFont('helvetica', 'bold');
  doc.text('Onay ve Imzalar', leftX + 2, bottomY + 1);
  
  const sigY = bottomY + 10;
  const sigBoxHeight = 25;
  const sigBoxWidth = (pageWidth - 20) / 4;
  
  // 4 imza kutusu yan yana
  const staffSigs = formData.staffSignatures || {};
  const sigBoxes = [
    { title: 'Hastayi Teslim Alan', sig: formData.receiverSignature || staffSigs.receiver, name: formData.receiverName || '' },
    { title: 'Doktor/Paramedik', sig: formData.doctorParamedicSignature || staffSigs.doctorParamedic, name: formData.doctorParamedicName || '' },
    { title: 'ATT/Hemsire', sig: formData.healthStaffSignature || staffSigs.healthStaff, name: formData.healthStaffName || '' },
    { title: 'Sofor', sig: formData.driverSignature || staffSigs.driver, name: formData.driverName || '' }
  ];
  
  sigBoxes.forEach((box, index) => {
    const boxX = leftX + (index * (sigBoxWidth + 2));
    
    doc.setDrawColor(...COLORS.dark);
    doc.setLineWidth(0.3);
    doc.rect(boxX, sigY, sigBoxWidth, sigBoxHeight);
    
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(compactFont.small);
    doc.setFont('helvetica', 'bold');
    doc.text(box.title, boxX + 2, sigY + 4);
    
    if (box.sig && box.sig.startsWith('data:image')) {
      try {
        doc.addImage(box.sig, 'PNG', boxX + 2, sigY + 6, sigBoxWidth - 4, sigBoxHeight - 10);
      } catch (e) {
        console.error('Imza eklenemedi:', e);
      }
    }
    
    if (box.name) {
      doc.setFontSize(compactFont.small - 1);
      doc.setFont('helvetica', 'normal');
      doc.text(sanitizeText(box.name), boxX + 2, sigY + sigBoxHeight + 3);
    }
  });
  
  // Footer
  doc.setDrawColor(...COLORS.dark);
  doc.setLineWidth(0.3);
  doc.line(5, pageHeight - 15, pageWidth - 5, pageHeight - 15);
  
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(compactFont.small);
  doc.setFont('helvetica', 'normal');
  
  const date = new Date().toLocaleDateString('tr-TR');
  const time = new Date().toLocaleTimeString('tr-TR');
  doc.text(sanitizeText(`Olusturulma: ${date} ${time}`), 10, pageHeight - 10);
  doc.text(sanitizeText('HealMedy HBYS'), pageWidth / 2, pageHeight - 10, { align: 'center' });
  doc.text('Sayfa 1/1', pageWidth - 10, pageHeight - 10, { align: 'right' });
  
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
                          'TC No', maskTcNo(formData.tcNo), y);
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

