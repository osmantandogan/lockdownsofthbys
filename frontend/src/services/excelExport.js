/**
 * HEALMEDY AMBULANS VAKA FORMU - EXCEL EXPORT
 * ============================================
 * Orijinal Excel şablonunun birebir aynısını oluşturur
 */

import * as XLSX from 'xlsx';

/**
 * Hücre stili oluştur
 */
const createStyle = (options = {}) => {
  return {
    font: {
      bold: options.bold || false,
      sz: options.fontSize || 10,
      name: options.fontName || 'Arial'
    },
    alignment: {
      horizontal: options.align || 'left',
      vertical: 'center',
      wrapText: options.wrap || false
    },
    border: options.border ? {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    } : {},
    fill: options.fill ? {
      fgColor: { rgb: options.fill }
    } : {}
  };
};

/**
 * Checkbox işareti
 */
const checkbox = (checked) => checked ? '☑' : '☐';

/**
 * Vaka formunu orijinal Excel formatında dışa aktar
 */
export const downloadCaseExcel = (caseData, medicalForm, medications = []) => {
  const wb = XLSX.utils.book_new();
  
  // Kısaltmalar
  const patient = caseData?.patient || {};
  const caller = caseData?.caller || {};
  const location = caseData?.location || {};
  const team = caseData?.assigned_team || {};
  const timeInfo = medicalForm?.time_info || {};
  const vehicleInfo = medicalForm?.vehicle_info || {};
  const clinicalObs = medicalForm?.clinical_obs || {};
  const cprData = medicalForm?.cpr_data || {};
  const extForm = medicalForm?.extended_form || {};
  const vitalSigns = medicalForm?.vital_signs || [{}, {}, {}];
  const procedures = medicalForm?.procedures || [];
  
  // Triyaj renk kodu
  const priority = caseData?.priority || '';
  const priorityChecks = {
    kirmizi: priority === 'yuksek',
    sari: priority === 'orta',
    yesil: priority === 'dusuk',
    siyah: priority === 'ex'
  };
  
  // Cinsiyet
  const gender = patient.gender || '';
  const genderChecks = {
    erkek: gender === 'erkek',
    kadin: gender === 'kadin'
  };
  
  // Çağrı tipi
  const callType = extForm.callType || '';
  const callTypeChecks = {
    telsiz: callType === 'telsiz',
    telefon: callType === 'telefon',
    diger: callType === 'diger'
  };
  
  // Çağrı nedeni
  const callReason = extForm.callReason || '';
  const reasonChecks = {
    medikal: callReason === 'medikal',
    trafik: callReason === 'trafik_kazasi',
    diger_kaza: callReason === 'diger_kaza',
    is_kazasi: callReason === 'is_kazasi',
    yangin: callReason === 'yangin',
    intihar: callReason === 'intihar',
    kimyasal: callReason === 'kimyasal',
    kesici: callReason === 'kesici_delici',
    elektrik: callReason === 'elektrik',
    silah: callReason === 'atesli_silah',
    bogulma: callReason === 'bogulma',
    allerji: callReason === 'allerji',
    dusme: callReason === 'dusme',
    alkol: callReason === 'alkol_ilac',
    kunt: callReason === 'kunt_travma',
    yanik: callReason === 'yanik',
    lpg: callReason === 'lpg',
    tedbir: callReason === 'tedbir',
    protokol: callReason === 'protokol'
  };
  
  // Olay yeri
  const sceneType = extForm.sceneType || '';
  const sceneChecks = {
    ev: sceneType === 'ev',
    yaya: sceneType === 'yaya',
    suda: sceneType === 'suda',
    arazi: sceneType === 'arazi',
    aracta: sceneType === 'aracta',
    buro: sceneType === 'buro',
    fabrika: sceneType === 'fabrika',
    sokak: sceneType === 'sokak',
    stadyum: sceneType === 'stadyum',
    huzurevi: sceneType === 'huzurevi',
    cami: sceneType === 'cami',
    yurt: sceneType === 'yurt',
    saglik: sceneType === 'saglik_kurumu',
    resmi: sceneType === 'resmi_daire',
    egitim: sceneType === 'egitim_kurumu',
    spor: sceneType === 'spor_salonu'
  };
  
  // Sonuç
  const outcome = extForm.outcome || '';
  const outcomeChecks = {
    yerinde: outcome === 'yerinde_mudahale',
    hastaneye: outcome === 'hastaneye_nakil',
    hastaneler_arasi: outcome === 'hastaneler_arasi',
    tibbi_tetkik: outcome === 'tibbi_tetkik',
    eve: outcome === 'eve_nakil',
    ex_terinde: outcome === 'ex_terinde',
    ex_morga: outcome === 'ex_morga',
    nakil_reddi: outcome === 'nakil_reddi',
    diger: outcome === 'diger_ulasilan',
    gorev_iptali: outcome === 'gorev_iptali',
    baska_aracla: outcome === 'baska_aracla_nakil',
    asilsiz: outcome === 'asilsiz_ihbar',
    yaralanan_yok: outcome === 'yaralanan_yok',
    bekleme: outcome === 'olay_yerinde_bekleme'
  };
  
  // Transfer tipi
  const transferType = extForm.transferType || '';
  const transferChecks = {
    ilce_ici: transferType === 'ilce_ici',
    ilce_disi: transferType === 'ilce_disi',
    il_disi: transferType === 'il_disi'
  };
  
  // Klinik gözlemler
  const pupils = clinicalObs.pupils || '';
  const pupilChecks = {
    normal: pupils === 'normal',
    miyotik: pupils === 'miyotik',
    midriatik: pupils === 'midriatik',
    anizokorik: pupils === 'anizokorik',
    reaksiyonyok: pupils === 'reaksiyon_yok',
    fiks: pupils === 'fiks_dilate'
  };
  
  const skin = clinicalObs.skin || '';
  const skinChecks = {
    normal: skin === 'normal',
    soluk: skin === 'soluk',
    siyanotik: skin === 'siyanotik',
    hiperemik: skin === 'hiperemik',
    ikterik: skin === 'ikterik',
    terli: skin === 'terli'
  };
  
  // GKS hesapla
  const motorScore = parseInt(clinicalObs.motorResponse) || 0;
  const verbalScore = parseInt(clinicalObs.verbalResponse) || 0;
  const eyeScore = parseInt(clinicalObs.eyeOpening) || 0;
  const gcsTotal = motorScore + verbalScore + eyeScore;
  
  // Adli vaka
  const isForensic = extForm.isForensic || false;
  
  // Excel satırlarını oluştur
  const data = [];
  
  // Satır 1: Logo alanı ve başlık
  data.push(['', '', '', '', '', 'HEALMEDY AMBULANS VAKA FORMU', '', '', '', '', '', '', '', '', '', 'ATN NO:', '', '', 'BAŞLANGIÇ KM:', vehicleInfo.start_km || '', 'BİTİŞ KM:', vehicleInfo.end_km || '']);
  data.push(['', '', '', '', '', '(MhaCare Sağlık Tur. İnş. Tic. A.Ş.)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  
  // Satır 6: Bölüm başlıkları
  data.push(['İSTASYON', '', '', '', 'SAATLER', '', '', '', '', 'HASTA BİLGİLERİ', '', '', '', '', '', '', 'CİNSİYET', '', 'DURUMU', '', '', 'KRONİK HASTALIKLAR']);
  
  // Satır 7: Protokol No, Çağrı Saati, Ad Soyad
  data.push([
    'PROTOKOL NO:', caseData?.case_number || '', '', '',
    'ÇAĞRI SAATİ:', timeInfo.callTime || '', '', '',
    '', 'ADI SOYADI:', `${patient.name || ''} ${patient.surname || ''}`, '', '', '', '', '',
    checkbox(genderChecks.erkek), 'ERKEK', checkbox(priorityChecks.kirmizi), 'KIRMIZI KOD', '',
    extForm.chronicDiseases || ''
  ]);
  
  // Satır 8: Olay yerine varış, Adres
  data.push([
    '', '', '', '',
    'OLAY YERİNE VARIŞ:', timeInfo.arrivalTime || '', '', '',
    '', 'ADRESİ:', location.address || '', '', '', '', '', '',
    '', '', checkbox(priorityChecks.sari), 'SARI KOD', '', ''
  ]);
  
  // Satır 9: Tarih, Hastaya varış, Kadın, Yeşil kod
  data.push([
    'TARİH:', new Date(caseData?.created_at).toLocaleDateString('tr-TR'), '', '',
    'HASTAYA VARIŞ:', timeInfo.patientArrivalTime || '', '', '',
    '', '', '', '', '', '', '', '',
    checkbox(genderChecks.kadin), 'KADIN', checkbox(priorityChecks.yesil), 'YEŞİL KOD', '',
    'HASTANIN ŞİKAYETİ:'
  ]);
  
  // Satır 10: Kodu, Ayrılış
  data.push([
    'KODU:', '', '', '',
    'OLAY YERİNDEN AYRILIŞ:', timeInfo.departureTime || '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', checkbox(priorityChecks.siyah), 'SİYAH KOD', '', patient.complaint || ''
  ]);
  
  // Satır 11: Plaka, Hastaneye varış, Yaş
  data.push([
    'PLAKA:', team.vehicle_plate || '', '', '',
    'HASTANEYE VARIŞ:', timeInfo.hospitalArrivalTime || '', '', '',
    '', '', '', '', '', '', '', 'YAŞ:', patient.age || '',
    '', checkbox(false), 'SOSYAL ENDİKASYON', '', ''
  ]);
  
  // Satır 12: İstasyona dönüş, Telefon
  data.push([
    '', '', '', '',
    'İSTASYONA DÖNÜŞ:', timeInfo.stationReturnTime || '', '', '',
    '', 'TELEFON:', caller.phone || '', '', '', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Satır 13: Hastanın alındığı adres, TC
  data.push([
    'HASTANIN ALINDIĞI ADRES:', location.address || '', '', '', '', '', '', '', '', '', '', '', '',
    'T.C. KİMLİK NO:', patient.tc_no || '', '', '', '', '', '', '', ''
  ]);
  
  // Satır 14: Çağrı tipi başlık
  data.push([
    'ÇAĞRI TİPİ', '', '', '',
    'ÇAĞRI NEDENİ', '', '', '', '', '', '', '', 'OLAY YERİ', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Satır 15: Telsiz, Medikal, vs
  data.push([
    checkbox(callTypeChecks.telsiz), 'TELSİZ', '', '',
    checkbox(reasonChecks.medikal), 'MEDİKAL', checkbox(reasonChecks.yangin), 'YANGIN',
    checkbox(reasonChecks.elektrik), 'ELEKTRİK ÇARP.', checkbox(reasonChecks.dusme), 'DÜŞME',
    checkbox(false), 'LPG', checkbox(sceneChecks.ev), 'EV', checkbox(sceneChecks.aracta), 'ARAÇTA',
    checkbox(sceneChecks.stadyum), 'STADYUM', checkbox(sceneChecks.saglik), 'SAĞLIK KURUMU', '', ''
  ]);
  
  // Satır 16: Telefon, Trafik kaz
  data.push([
    checkbox(callTypeChecks.telefon), 'TELEFON', '', '',
    checkbox(reasonChecks.trafik), 'TRAFİK KAZ', checkbox(reasonChecks.intihar), 'İNTİHAR',
    checkbox(reasonChecks.silah), 'ATEŞLİ SİLAH', checkbox(reasonChecks.alkol), 'ALKOL İLAÇ',
    checkbox(reasonChecks.tedbir), 'TEDBİR', checkbox(sceneChecks.yaya), 'YAYA', checkbox(sceneChecks.buro), 'BÜRO',
    checkbox(sceneChecks.huzurevi), 'HUZUREVİ', checkbox(sceneChecks.resmi), 'RESMİ DAİRE', '', ''
  ]);
  
  // Satır 17: Diğer
  data.push([
    checkbox(callTypeChecks.diger), 'DİĞER', '', '',
    checkbox(reasonChecks.diger_kaza), 'DİĞER KAZA', checkbox(reasonChecks.kimyasal), 'KİMYASAL',
    checkbox(reasonChecks.bogulma), 'BOĞULMA', checkbox(reasonChecks.kunt), 'KÜNT TRAV',
    checkbox(reasonChecks.protokol), 'PROTOKOL', checkbox(sceneChecks.suda), 'SUDA', checkbox(sceneChecks.fabrika), 'FABRİKA',
    checkbox(sceneChecks.cami), 'CAMİ', checkbox(sceneChecks.egitim), 'EĞİTİM KURUMU', '', ''
  ]);
  
  // Satır 18: İş kazası
  data.push([
    '', '', '', '',
    checkbox(reasonChecks.is_kazasi), 'İŞ KAZASI', checkbox(reasonChecks.kesici), 'KESİCİ-DELİCİ',
    checkbox(reasonChecks.allerji), 'ALLERJİ', checkbox(reasonChecks.yanik), 'YANIK',
    '', '', checkbox(sceneChecks.arazi), 'ARAZİ', checkbox(sceneChecks.sokak), 'SOKAK',
    checkbox(sceneChecks.yurt), 'YURT', checkbox(sceneChecks.spor), 'SPOR SALONU', '', ''
  ]);
  
  // Satır 19: İlk Muayene Bulguları başlık
  data.push([
    'İLK MUAYENE BULGULARI', '', '', '', '', '', '', '', '', '', '', 'GLASGOW SKALASI', '', '', '', '', '', '', '', '', 'KAN ŞEKERİ', ''
  ]);
  
  // Satır 20: Pupiller, Deri, Vital başlıkları
  data.push([
    'PUPİLLER', '', 'DERİ', '', 'SAATLER', '', 'KAN BASINCI', '', 'NABIZ', '', 'SOLUNUM', '',
    'MOTOR', '', 'VERBAL', '', 'GÖZ AÇMA', '', '', '', extForm.bloodSugar || '', 'Mg/dL'
  ]);
  
  // Satır 21-23: Vital değerler ve GKS (3 ölçüm)
  for (let i = 0; i < 3; i++) {
    const vital = vitalSigns[i] || {};
    data.push([
      checkbox(i === 0 && pupilChecks.normal), i === 0 ? 'NORMAL' : (i === 1 ? 'MİYOTİK' : 'MİDRİATİK'),
      checkbox(i === 0 && skinChecks.normal), i === 0 ? 'NORMAL' : (i === 1 ? 'SOLUK' : 'SİYANOTİK'),
      vital.time || '', '',
      vital.bp || '', 'mmHg',
      vital.pulse || '', 'dk',
      vital.respiration || '', 'dk',
      i === 0 ? '6' : (i === 1 ? '5' : '4'), i === 0 ? 'EMRE İTAAT' : (i === 1 ? 'AĞRIYI LOKALİZE' : 'FLEKSÖR'),
      i === 0 ? '5' : (i === 1 ? '4' : '3'), i === 0 ? 'ORİENTE' : (i === 1 ? 'KONFÜZE' : 'UYGUNSUZ'),
      i === 0 ? '4' : (i === 1 ? '3' : '2'), i === 0 ? 'SPONTAN' : (i === 1 ? 'SESLE' : 'AĞRIYLA'),
      '', '', extForm.bodyTemp || '', '°C'
    ]);
  }
  
  // Satır 24-26: Kalan pupil/deri seçenekleri ve SPO2
  data.push([
    checkbox(pupilChecks.anizokorik), 'ANİZOKORİK',
    checkbox(skinChecks.hiperemik), 'HİPEREMİK',
    'SPO2:', '', vitalSigns[0]?.spo2 || '', '%', '', '', '', '',
    '3', 'EXTENSÖR', '2', 'ANLAMSIZ', '1', 'YANIT YOK', '', '', '', ''
  ]);
  
  data.push([
    checkbox(pupilChecks.reaksiyonyok), 'REAK. YOK',
    checkbox(skinChecks.ikterik), 'İKTERİK',
    '', '', vitalSigns[1]?.spo2 || '', '%', '', '', '', '',
    '2', 'YANIT YOK', '1', 'YANIT YOK', '', '', '', '', '', ''
  ]);
  
  data.push([
    checkbox(pupilChecks.fiks), 'FİKS DİLATE',
    checkbox(skinChecks.terli), 'TERLİ',
    '', '', vitalSigns[2]?.spo2 || '', '%', '', '', '', '',
    '1', '', 'GKS PUANI:', gcsTotal || '', '', '', '', '', '', ''
  ]);
  
  // Satır 27: Ön tanı
  data.push([
    'ÖN TANI:', medicalForm?.preliminary_diagnosis?.map(d => d.name).join(', ') || '', '', '', '',
    'AÇIKLAMALAR:', medicalForm?.notes || '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Satır 28: Vakayı veren kurum
  data.push([
    'VAKAYI VEREN KURUM:', extForm.referralSource || patient.company || '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Satır 29: Sonuç başlık
  data.push([
    'SONUÇ', '', '', '', '', '', '', 'NAKLEDİLEN HASTANE:', medicalForm?.transfer_hospital?.name || '', '', '',
    'KAZAYA KARIŞAN ARAÇ PLAKA NO', '', '', '', 'CPR YAPILDI İSE', '', '', '', '', '', ''
  ]);
  
  // Satır 30-35: Sonuç seçenekleri
  data.push([
    checkbox(outcomeChecks.yerinde), 'YERİNDE MÜDAHALE', '', checkbox(outcomeChecks.ex_terinde), 'EX TERİNDE BIRAKILDI', '',
    checkbox(outcomeChecks.baska_aracla), 'BAŞKA ARAÇLA NAKİL', '', '', '', '',
    '1:', extForm.accidentVehicles?.[0] || '', '', '', 'BAŞLAMA ZAMANI:', cprData.cprStart || '', '', '', '', '', ''
  ]);
  
  data.push([
    checkbox(outcomeChecks.hastaneye), 'HASTANEYE NAKİL', '', checkbox(outcomeChecks.ex_morga), 'EX MORGA NAKİL', '',
    checkbox(false), 'TLF.LA BAŞKA ARAÇLA', '', '', '',
    '2:', extForm.accidentVehicles?.[1] || '', '', '', 'BIRAKMA ZAMANI:', cprData.cprEnd || '', '', '', '', '', ''
  ]);
  
  data.push([
    checkbox(outcomeChecks.hastaneler_arasi), 'HASTANELER ARASI NAKİL', '', checkbox(outcomeChecks.nakil_reddi), 'NAKİL REDDİ', '',
    checkbox(outcomeChecks.asilsiz), 'ASILSIZ İHBAR', '', checkbox(transferChecks.ilce_ici), 'İLÇE İÇİ', '',
    '3:', extForm.accidentVehicles?.[2] || '', '', '', 'BIRAKMA NEDENİ:', cprData.cprEndReason || '', '', '', '', '', ''
  ]);
  
  data.push([
    checkbox(outcomeChecks.tibbi_tetkik), 'TIBBİ TETKİK İÇİN NAKİL', '', checkbox(outcomeChecks.diger), 'DİĞER ULAŞILAN', '',
    checkbox(outcomeChecks.yaralanan_yok), 'YARALANAN YOK', '', checkbox(transferChecks.ilce_disi), 'İLÇE DIŞI', '',
    '4:', extForm.accidentVehicles?.[3] || '', '', '', '', '', '', '', '', '', ''
  ]);
  
  data.push([
    checkbox(outcomeChecks.eve), 'EVE NAKİL', '', checkbox(outcomeChecks.gorev_iptali), 'GÖREV İPTALİ', '',
    checkbox(outcomeChecks.bekleme), 'OLAY YERİNDE BEKLEME', '', checkbox(transferChecks.il_disi), 'İL DIŞI', '',
    'ADLİ VAKA:', '', checkbox(isForensic), 'EVET', checkbox(!isForensic), 'HAYIR', '', '', '', '', '', ''
  ]);
  
  // Satır 36: İşlem başlıkları
  data.push([
    'İŞLEM', '', '', '', '', 'ADET', 'İŞLEM', '', '', '', '', 'ADET',
    'KULLANILAN İLAÇLAR', '', '', '', 'UYGULANMA TÜRÜ', 'ADET',
    'KULLANILAN MALZEMELER', '', '', 'ADET'
  ]);
  
  // Satır 37: Alt başlıklar
  data.push([
    '', 'Muayene (Acil)', '', '', '', '',
    'HAVA YOLU', '', '', '', '', '',
    medications[0]?.name || '', '', '', '', medications[0]?.route || '', medications[0]?.quantity || '',
    'Enjektör 1-2 cc', '', '', ''
  ]);
  
  // İşlemler ve ilaçlar listesi
  const genelMudahale = [
    'Enjeksiyon IM', 'Enjeksiyon IV', 'Enjeksiyon SC', 'I.V. İlaç uygulaması',
    'Damar yolu açılması', 'Sütür (küçük)', 'Mesane sondası takılması', 'Mide yıkanması',
    'Pansuman (küçük)', 'Apse açmak', 'Yabancı cisim çıkartılması', 'Yanık pansum. (küçük)'
  ];
  
  const havaYolu = [
    'Balon Valf Maske', 'Aspirasyon uygulaması', 'Orofaringeal tüp', 'Endotrakeal entübasyon',
    'Mekanik ventilasyon', 'Oksijen inhalasyon'
  ];
  
  const ilaclar = [
    'Arveles amp.', 'Dikloron amp.', 'Spazmolitik amp.', 'Adrenalin 0,5 mg',
    'Adrenalin 1 mg', 'Atropin 0,5 mg', 'Flumazenil amp.', 'Dopamin amp.',
    'Citanest flk.', 'NaHCO3 amp.', 'Dizem amp.', 'Aminocordial amp.'
  ];
  
  const malzemeler = [
    'Enjektör 5 cc', 'Enjektör 10-20 cc', 'Monitör pedi', 'I.V. katater 14-22',
    'I.V. katater 24', 'Serum seti', 'Steril eldiven', 'Cerrahi eldiven',
    'Sponç', 'Sargı bezi', 'İdrar torbası', 'Bistüri ucu'
  ];
  
  // İşlem satırları
  for (let i = 0; i < 12; i++) {
    const proc = procedures[i] || {};
    const med = medications[i + 1] || {};
    
    data.push([
      checkbox(proc.name === genelMudahale[i]), genelMudahale[i] || '', '', '', '', proc.count || '',
      checkbox(i < havaYolu.length && proc.name === havaYolu[i]), havaYolu[i] || '', '', '', '', '',
      ilaclar[i] || '', '', '', '', med.route || '', med.quantity || '',
      malzemeler[i] || '', '', '', ''
    ]);
  }
  
  // Dolaşım desteği
  data.push([
    'DOLAŞIM DESTEĞİ', '', '', '', '', '', '', '', '', '', '', '',
    '', '', '', '', '', '',
    '', '', '', ''
  ]);
  
  const dolasim = ['CPR (Resüsitasyon)', 'EKG Uygulaması', 'Defibrilasyon (CPR)', 'Kardiyoversiyon', 'Monitörizasyon', 'Kanama kontrolü'];
  const siviler = ['%0.9 NaCl 250 cc', '%0.9 NaCl 500 cc', '%5 Dextroz 500 cc', '%20 Mannitol 500 cc', 'İsolyte P 500 cc', 'Laktatlı Ringer 500 cc'];
  
  for (let i = 0; i < 6; i++) {
    data.push([
      checkbox(false), dolasim[i] || '', '', '', '', '',
      'SIVI TEDAVİSİ', siviler[i] || '', '', '', '', '',
      '', '', '', '', '', '',
      '', '', '', ''
    ]);
  }
  
  // Hastane reddi ve hizmet reddi
  data.push([
    'HASTANENİN HASTA REDDİ', '', '', '', '', '', '', '', '', '', '', '',
    'HASTANIN HİZMET REDDİ', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Red açıklamaları
  data.push([
    '... nedenlerle hastayı hastanemize kabul edemiyorum.', '', '', '', '', '', '', '', '', '', '', '',
    'Tedaviyi/nakli kabul etmiyorum.', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Boş satırlar
  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  data.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  
  // Teslim alan ve personel
  data.push([
    'HASTAYI TESLİM ALANIN', '', '', 'UNVANI', '', '',
    'AMBULANS PERSONELİNİN ADI SOYADI', '', '', '', '', 'İMZA',
    'Hasta/Hasta Yakını Adı Soyadı İMZASI', '', '', '', '', '', '', '', '', ''
  ]);
  
  data.push([
    'ADI SOYADI:', '', '', '', '', '',
    'HEKİM/PRM:', medicalForm?.team?.doctor || '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', ''
  ]);
  
  data.push([
    '', '', '', '', '', '',
    'SAĞLIK PER./ATT:', medicalForm?.team?.paramedic || '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', ''
  ]);
  
  data.push([
    'İMZA:', '', '', 'KAŞE:', '', '',
    'SÜR./TEKN.:', medicalForm?.team?.driver || '', '', '', '', '',
    '', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Onam metni
  data.push([
    'ONAM METNİ:', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ]);
  
  data.push([
    'Hastamın nakli sırasında ambulansta bulunmamın ambulans ekibinin görevini zorlaştırdığı, meydana gelebilecek kazadan ve hukuki sorunlardan etkilenebileceğim konusunda bilgilendirildim. Tedavimin/transportumun yapılmasını onaylıyorum.',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ]);
  
  // Worksheet oluştur
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Hücre birleştirmeleri
  ws['!merges'] = [
    // Başlık
    { s: { r: 0, c: 5 }, e: { r: 0, c: 14 } },
    { s: { r: 1, c: 5 }, e: { r: 1, c: 14 } },
    // Bölüm başlıkları
    { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } },
    { s: { r: 5, c: 4 }, e: { r: 5, c: 8 } },
    { s: { r: 5, c: 9 }, e: { r: 5, c: 15 } },
    // Adres
    { s: { r: 7, c: 10 }, e: { r: 7, c: 15 } },
    // Hasta şikayeti
    { s: { r: 9, c: 21 }, e: { r: 11, c: 21 } },
    // Kronik hastalıklar
    { s: { r: 6, c: 21 }, e: { r: 8, c: 21 } },
    // Ön tanı ve açıklamalar
    { s: { r: 26, c: 1 }, e: { r: 26, c: 4 } },
    { s: { r: 26, c: 6 }, e: { r: 26, c: 21 } },
    // Onam metni
    { s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 21 } }
  ];
  
  // Sütun genişlikleri
  ws['!cols'] = [];
  for (let i = 0; i < 22; i++) {
    ws['!cols'].push({ wch: i === 0 ? 3 : (i < 6 ? 12 : 10) });
  }
  
  // Satır yükseklikleri
  ws['!rows'] = [];
  for (let i = 0; i < data.length; i++) {
    ws['!rows'].push({ hpt: 18 });
  }
  
  // Sayfayı ekle
  XLSX.utils.book_append_sheet(wb, ws, 'Vaka Formu');
  
  // Dosya adı
  const caseNumber = caseData?.case_number || 'vaka';
  const date = new Date().toISOString().split('T')[0];
  const filename = `VAKA_FORMU_${caseNumber}_${date}.xlsx`;
  
  // Excel dosyasını binary olarak oluştur
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
  // Blob oluştur
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Download link oluştur ve tıkla
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Temizlik
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
  
  return filename;
};

export default { downloadCaseExcel };
