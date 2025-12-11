# 📋 VAKA FORMU EKSİK ALAN ANALİZİ

Bu belge Excel'deki tüm alanları, mevcut mapping'i ve frontend vaka formunu karşılaştırır.

---

## 📊 ÖZET

| Kategori | Excel'de | Mapping'de | Frontend'de | Eksik |
|----------|----------|------------|-------------|-------|
| Temel Bilgiler | 20 | 15 | 12 | 8 |
| Checkboxlar | 75+ | 23 | 15 | 50+ |
| İşlemler | 50+ | 0 | 50+ (liste) | 50+ (mapping) |
| İlaçlar | 35+ | 0 | 0 | 35+ |
| Malzemeler | 35+ | 0 | 0 | 35+ |

---

## ✅ MEVCUT MAPPING'DE OLAN ALANLAR

### Temel Bilgiler (Form Data)
| Alan | Hücre | Frontend'de Var mı? | Açıklama |
|------|-------|---------------------|----------|
| case_number (ATN NO) | U2 | ✅ atnNo | |
| startKm | W2 | ✅ startKm | |
| endKm | Y2 | ✅ endKm | |
| healmedyProtocol | C4 | ✅ healmedyProtocol | |
| date | C5 | ✅ date | |
| stationCode | C6 | ❌ **EKSİK** | İstasyon Kodu |
| vehiclePlate | C7 | ⚠️ vehicleType | Farklı isim |
| address | C8 | ✅ address | |
| callerOrganization | C9 | ⚠️ referringInstitution | Farklı isim |
| callTime | I4 | ✅ callTime | |
| arrivalTime | I5 | ✅ arrivalSceneTime | |
| patientArrivalTime | I6 | ✅ arrivalPatientTime | |
| departureTime | I7 | ✅ departureTime | |
| hospitalArrivalTime | I8 | ✅ hospitalArrivalTime | |
| returnTime | I9 | ✅ returnStationTime | |
| patientName | M4 | ✅ patientName | |
| tcNo | M8 | ✅ tcNo | |
| phone | M9 | ✅ phone | |
| birthDate | T8 | ❌ **EKSİK** | Doğum Tarihi |
| age | T9 | ✅ age | |
| chronicDiseases | X4 | ✅ chronicDiseases | |
| complaint | X7 | ✅ complaint | |
| bloodPressure | H17 | ✅ vitalSigns[].bp | |
| pulse | K17 | ✅ vitalSigns[].pulse | |
| respiration | M17 | ✅ vitalSigns[].respiration | |
| spo2 | I19 | ✅ vitalSigns[].spo2 | |
| temperature | Y19 | ✅ vitalSigns[].temp | |
| gcsMotor | O17 | ✅ motorResponse | |
| gcsVerbal | R17 | ✅ verbalResponse | |
| gcsEye | U17 | ✅ eyeOpening | |
| bloodSugar | Z17 | ❌ **EKSİK** | Kan Şekeri |
| diagnosis | B23 | ✅ diagnosis | |
| notes | I23 | ⚠️ applications | Farklı isim |
| hospitalName | L24 | ❌ **EKSİK** | Nakledilen Hastane |
| accidentVehiclePlate1-4 | P25-P28 | ❌ **EKSİK** | Kaza Araç Plakaları |
| cprStartTime | U25 | ✅ cprStart | |
| cprEndTime | U26 | ✅ cprEnd | |
| cprStopReason | U27 | ✅ cprReason | |

---

## ❌ MAPPING'DE EKSİK OLAN ALANLAR (Excel'de Var)

### 1. OLAY YERİ Checkboxları (Row 11-14)
Bu alanlar Excel'de var ama mapping'de YOK:

| Checkbox | Excel Hücresi (Label) | İşaret Hücresi |
|----------|----------------------|----------------|
| EV | P11 | **Q11** |
| YAYA | P12 | **Q12** |
| SUDA | P13 | **Q13** |
| ARAZİ | P14 | **Q14** |
| ARAÇTA | R11 | **S11** |
| BÜRO | R12 | **S12** |
| FABRİKA | R13 | **S13** |
| SOKAK | R14 | **S14** |
| STADYUM | T11 | **U11** |
| HUZUREVİ | T12 | **U12** |
| CAMİ | T13 | **U13** |
| YURT | T14 | **U14** |
| SAĞLIK KURUMU | V11 | **W11** |
| RESMİ DAİRE | V12 | **W12** |
| EĞİTİM KURUMU | V13 | **W13** |
| SPOR SALONU | V14 | **W14** |
| TPOC FİLYOS MERKEZİ | X11:Z11 | **X12:Z14** |

### 2. ÇAĞRI NEDENİ Detayları (Row 11-14)
Mevcut mapping'de sadece 4 seçenek var, Excel'de 15+ var:

| Checkbox | Excel Hücresi | İşaret Hücresi | Mapping'de |
|----------|---------------|----------------|------------|
| MEDİKAL | E11:F11 | **G11** | ✅ |
| TRAFİK KAZ | E12:F12 | **G12** | ✅ |
| DİĞER KAZA | E13:F13 | **G13** | ✅ |
| İŞ KAZASI | E14:F14 | **G14** | ✅ |
| YANGIN | H11 | **I11** | ❌ |
| İNTİHAR | H12 | **I12** | ❌ |
| KİMYASAL | H13 | **I13** | ❌ |
| ALLERJİ | H14 | **I14** | ❌ |
| ELEKTRİK ÇARP. | J11 | **K11** | ❌ |
| ATEŞLİ SİLAH | J12 | **K12** | ❌ |
| BOĞULMA | J13 | **K13** | ❌ |
| Kesici-Delici | J14 | **K14** | ❌ |
| DÜŞME | L11 | **M11** | ❌ |
| ALKOL İLAÇ | L12 | **M12** | ❌ |
| KÜNT TRAV | L13 | **M13** | ❌ |
| YANIK | L14 | **M14** | ❌ |
| LPG | N11 | **O11** | ❌ |
| TEDBİR | N12 | **O12** | ❌ |
| PROTOKOL | N13 | **O13** | ❌ |

### 3. PUPİLLER Checkboxları (Row 17-22, A sütunu)
| Checkbox | Hücre | İşaret Hücresi |
|----------|-------|----------------|
| NORMAL | B17 | **A17** |
| MİYOTİK | B18 | **A18** |
| MİDRİATİK | B19 | **A19** |
| ANİZOKORİK | B20 | **A20** |
| REAK. YOK | B21 | **A21** |
| FİKS DİLATE | B22 | **A22** |

### 4. DERİ Checkboxları (Row 17-22, C sütunu)
| Checkbox | Hücre | İşaret Hücresi |
|----------|-------|----------------|
| NORMAL | D17 | **C17** |
| SOLUK | D18 | **C18** |
| SİYANOTİK | D19 | **C19** |
| HİPEREMİK | D20 | **C20** |
| İKTERİK | D21 | **C21** |
| TERLİ | D22 | **C22** |

### 5. NABIZ Tipi Checkboxları (Row 19-22, K-L sütunu)
| Checkbox | Hücre | İşaret Hücresi |
|----------|-------|----------------|
| DÜZENLİ | L19 | **K19** |
| RİTMİK | L20 | **K20** |
| FİLİFORM | L21 | **K21** |
| ALINMIYOR | L22 | **K22** |

### 6. SOLUNUM Tipi Checkboxları (Row 19-22, M-N sütunu)
| Checkbox | Hücre | İşaret Hücresi |
|----------|-------|----------------|
| DÜZENLİ | N19 | **M19** |
| DÜZENSİZ | N20 | **M20** |
| DİSPNE | N21 | **M21** |
| YOK | N22 | **M22** |

### 7. NAKİL MESAFE Checkboxları (Row 27-29)
| Checkbox | Hücre | İşaret Hücresi |
|----------|-------|----------------|
| İLÇE İÇİ | K27:L27 | **M27** |
| İLÇE DIŞI | K28:L28 | **M28** |
| İL DIŞI | K29:L29 | **M29** |

---

## 💊 İLAÇLAR (Row 32-63, O-R sütunları)

**ÖNEMLİ: Bu ilaçlar Excel'de var ama mapping'de HİÇBİRİ YOK!**

| İlaç Adı | Label Hücresi | Adet Hücresi |
|----------|---------------|--------------|
| Arveles amp. | O32:R32 | **S32** |
| Dikloron amp. | O33:R33 | **S33** |
| Spazmolitik amp. | O34:R34 | **S34** |
| Adrenalin 0,5 mg amp. | O35:R35 | **S35** |
| Adrenalin 1 mg amp. | O36:R36 | **S36** |
| Atropin 0,5 mg amp. | O37:R37 | **S37** |
| Flumazenil amp. | O38:R38 | **S38** |
| Dopamin amp. | O39:R39 | **S39** |
| Citanest flk. (Priloc) | O40:R40 | **S40** |
| NaHCO3 amp. | O41:R41 | **S41** |
| Dizem amp. | O42:R42 | **S42** |
| Aminocordial amp. | O43:R43 | **S43** |
| Furosemid amp. | O44:R44 | **S44** |
| Ca Glukonat %10 amp. | O45:R45 | **S45** |
| Diltizem Ampul 25 mg | O46:R46 | **S46** |
| Avil amp. | O47:R47 | **S47** |
| Dekort amp. | O48:R48 | **S48** |
| Antiepileptik amp. | O49:R49 | **S49** |
| Prednol 40 mg amp. | O50:R50 | **S50** |
| Aktif kömür tüp | O51:R51 | **S51** |
| Beloc amp. | O52:R52 | **S52** |
| Salbutamol (İnhaler/Nebül) | O53:R53 | **S53** |
| Aritmal amp. %2 | O54:R54 | **S54** |
| Isoptin amp. | O55:R55 | **S55** |
| Kapril 25 mg tab. | O56:R56 | **S56** |
| Magnezyum Sülfat amp. | O57:R57 | **S57** |
| Isorid 5 mg tab. | O58:R58 | **S58** |
| Coraspin 300 mg tab. | O59:R59 | **S59** |
| Paracetamol Tablet | O60:R60 | **S60** |
| Midazolam Ampul | O61:R61 | **S61** |
| Dramamine ampul | O62:R62 | **S62** |
| Rotapamid amp. | O63:R63 | **S63** |

---

## 🩹 MALZEMELER (Row 32-63, U-Y sütunları)

**ÖNEMLİ: Bu malzemeler Excel'de var ama mapping'de HİÇBİRİ YOK!**

| Malzeme Adı | Label Hücresi | Adet Hücresi |
|-------------|---------------|--------------|
| Enjektör 1–2 cc | V32:Y32 | **Z32** |
| Enjektör 5 cc | V33:Y33 | **Z33** |
| Enjektör 10–20 cc | V34:Y34 | **Z34** |
| Monitör pedi (EKG elektrodu) | V35:Y35 | **Z35** |
| I.V. katater (No: 14–22) | V36:Y36 | **Z36** |
| I.V. katater (No: 24) | V37:Y37 | **Z37** |
| Serum seti | V38:Y38 | **Z38** |
| Steril eldiven | V39:Y39 | **Z39** |
| Cerrahi eldiven | V40:Y40 | **Z40** |
| Sponç | V41:Y41 | **Z41** |
| Sargı bezi | V42:Y42 | **Z42** |
| İdrar torbası | V43:Y43 | **Z43** |
| Bistüri ucu (No: ) | V44:Y44 | **Z44** |
| Entübasyon tüpü (Balonlu) | V45:Y45 | **Z45** |
| Entübasyon tüpü (Balonsuz) | V46:Y46 | **Z46** |
| Airway (No: ) | V47:Y47 | **Z47** |
| Foley sonda (No: ) | V48:Y48 | **Z48** |
| Nazo gastrik son. (No: ) | V49:Y49 | **Z49** |
| Atravmatik ipek (No: 3/0) | V50:Y50 | **Z50** |
| Atravmatik kat-küt (No: 3/0) | V51:Y51 | **Z51** |
| Doğum seti | V52:Y52 | **Z52** |
| Yanık battaniyesi | V53:Y53 | **Z53** |
| O2 Maskesi hazneli erişkin | V54:Y54 | **Z54** |
| O2 Maskesi hazneli pediatrik | V55:Y55 | **Z55** |
| O2 Kanülü nazal erişkin | V56:Y56 | **Z56** |
| O2 Kanülü nazal pediatrik | V57:Y57 | **Z57** |
| Flaster | V58:Y58 | **Z58** |
| Servikal collar (Boy: ) | V59:Y59 | **Z59** |
| Elastik bandaj | V60:Y60 | **Z60** |
| Etil Chloride Sprey | V61:Y61 | **Z61** |
| O2 MASKESİ HAZNESİZ ERİŞKİN | V62:Y62 | **Z62** |
| O2 MASKESİ HAZNESİZ PEDİATRİK | V63:Y63 | **Z63** |

---

## 💉 İŞLEMLER (Row 31-63, A-F ve H-L sütunları)

**ÖNEMLİ: Bu işlemler Excel'de var ama mapping'de YOK (sadece checkbox olarak frontend'de var)!**

### GENEL MÜDAHALE (B31-B55)
| İşlem | Label Hücresi | Adet Hücresi |
|-------|---------------|--------------|
| Muayene (Acil) | B31:F31 | **G31** |
| Ş.I. Ambulans Ücreti | B32:F32 | **G32** |
| Enjeksiyon IM | B34:F34 | **G34** |
| Enjeksiyon IV | B35:F35 | **G35** |
| Enjeksiyon SC | B36:F36 | **G36** |
| I.V. İlaç uygulaması | B37:F37 | **G37** |
| Damar yolu açılması | B38:F38 | **G38** |
| Sütür (küçük) | B39:F39 | **G39** |
| Mesane sondası takılması | B40:F40 | **G40** |
| Mide yıkanması | B41:F41 | **G41** |
| Pansuman (küçük) | B42:F42 | **G42** |
| Apse açmak | B43:F43 | **G43** |
| Yabancı cisim çıkartılması | B44:F44 | **G44** |
| Yanık pansum. (küçük) | B45:F45 | **G45** |
| Yanık pansum (orta) | B46:F46 | **G46** |
| NG sonda takma | B47:F47 | **G47** |
| Kulaktan buşon temizliği | B48:F48 | **G48** |
| Kol atel (kısa) | B49:F49 | **G49** |
| Bacak atel (kısa) | B50:F50 | **G50** |
| Cilt traksiyonu uygulaması | B51:F51 | **G51** |
| Servikal collar uygulaması | B52:F52 | **G52** |
| Travma yeleği | B53:F53 | **G53** |
| Vakum sedye uygulaması | B54:F54 | **G54** |
| Sırt tahtası uygulaması | B55:F55 | **G55** |

### DOLAŞIM DESTEĞİ (B57-B63)
| İşlem | Label Hücresi | Adet Hücresi |
|-------|---------------|--------------|
| CPR (Resüsitasyon) | B57:F57 | **G57** |
| EKG Uygulaması | B58:F58 | **G58** |
| Defibrilasyon (CPR) | B59:F59 | **G59** |
| Kardiyoversiyon | B60:F60 | **G60** |
| Monitörizasyon | B61:F61 | **G61** |
| Kanama kontrolü | B62:F62 | **G62** |
| Cut down | B63:F63 | **G63** |

### HAVA YOLU (I32-I37)
| İşlem | Label Hücresi | Adet Hücresi |
|-------|---------------|--------------|
| Balon Valf Maske | I32:L32 | **M32** |
| Aspirasyon uygulaması | I33:L33 | **M33** |
| Orofaringeal tüp uygulaması | I34:L34 | **M34** |
| Endotrakeal entübasyon | I35:L35 | **M35** |
| Mekanik ventilasyon (CPAP–BIPAP dahil) | I36:L36 | **M36** |
| Oksijen inhalasyon tedavisi | I37:L37 | **M37** |

### DİĞER İŞLEMLER (I39-I45)
| İşlem | Label Hücresi | Adet Hücresi |
|-------|---------------|--------------|
| Normal doğum | I39:L39 | **M39** |
| Kan şekeri ölçümü | I40:L40 | **M40** |
| Lokal anestezi | I41:L41 | **M41** |
| Tırnak avülizyonu | I42:L42 | **M42** |
| Transkutan PaO2 ölçümü | I43:L43 | **M43** |
| Debritman alınması | I44:L44 | **M44** |
| Sütür alınması | I45:L45 | **M45** |

### YENİDOĞAN İŞLEMLERİ (I47-I52)
| İşlem | Label Hücresi | Adet Hücresi |
|-------|---------------|--------------|
| Transport küvözi ile nakil | I47:L47 | **M47** |
| Yenidoğan canlandırma | I48:L48 | **M48** |
| Yenidoğan I.M. enjeksiyon | I49:L49 | **M49** |
| Yenidoğan I.V. enjeksiyon | I50:L50 | **M50** |
| Yenidoğan I.V. mayi takılması | I51:L51 | **M51** |
| Yenidoğan entübasyonu | I52:L52 | **M52** |

### SIVI TEDAVİSİ (I54-I63)
| İşlem | Label Hücresi | Adet Hücresi |
|-------|---------------|--------------|
| %0.9 NaCl 250 cc | I54:L54 | **M54** |
| %0.9 NaCl 500 cc | I55:L55 | **M55** |
| %0.9 NaCl 100 cc | I56:L56 | **M56** |
| %5 Dextroz 500 cc | I57:L57 | **M57** |
| %5 Dextroz 500 cc | I58:L58 | **M58** |
| %20 Mannitol 500 cc | I59:L59 | **M59** |
| İsolyte P 500 cc | I60:L60 | **M60** |
| İsolyte S 500 cc | I61:L61 | **M61** |
| %10 Dengeleyici Elektrolit 500 cc | I62:L62 | **M62** |
| Laktatlı Ringer 500 cc | I63:L63 | **M63** |

---

## ✍️ İMZA ALANLARI (Row 72-79)

| Alan | Hücre |
|------|-------|
| HASTAYI TESLİM ALANIN | A72:C73 |
| UNVANI | D72:F73 |
| ADI SOYADI | A74:F76 |
| İMZA (Teslim Alan) | A77:C79 |
| KAŞE | D77:F79 |
| HEKİM/PRM Adı | I74:L75 |
| HEKİM/PRM İmza | M74:O75 |
| SAĞLIK PER./ATT Adı | I76:L77 |
| SAĞLIK PER./ATT İmza | M76:O77 |
| SÜR./TEKN. Adı | I78:L79 |
| SÜR./TEKN. İmza | M78:O79 |

---

## 📝 SONRAKI ADIMLAR

### Öncelik 1: Frontend'e Eklenmesi Gereken Alanlar
1. ❌ `stationCode` - İstasyon Kodu
2. ❌ `birthDate` - Doğum Tarihi
3. ❌ `bloodSugar` - Kan Şekeri (vitalSigns'a eklenebilir)
4. ❌ `hospitalName` - Nakledilen Hastane
5. ❌ `accidentVehiclePlate1-4` - Kaza Araç Plakaları
6. ❌ Olay Yeri checkboxları (16 adet)
7. ❌ Çağrı Nedeni detay checkboxları (15 adet)
8. ❌ Nakil Mesafe checkboxları (3 adet)

### Öncelik 2: Mapping'e Eklenmesi Gereken Checkboxlar
1. Olay Yeri (16 checkbox)
2. Çağrı Nedeni detayları (15 checkbox)
3. Pupiller (6 checkbox)
4. Deri (6 checkbox)
5. Nabız tipi (4 checkbox)
6. Solunum tipi (4 checkbox)
7. Nakil mesafe (3 checkbox)

### Öncelik 3: İşlem/İlaç/Malzeme Mapping
1. İşlemler - adet ile birlikte (50+ kayıt)
2. İlaçlar - adet ile birlikte (35+ kayıt)
3. Malzemeler - adet ile birlikte (35+ kayıt)

---

## 🎯 CHECKBOX MAPPING ÖNERİSİ

```python
# Önerilen CHECKBOX_MAPPINGS yapısı
CHECKBOX_MAPPINGS = {
    "olay_yeri": {
        "field": "incidentLocation",
        "options": {
            "ev": "Q11",
            "yaya": "Q12",
            "suda": "Q13",
            "arazi": "Q14",
            "aracta": "S11",
            "buro": "S12",
            "fabrika": "S13",
            "sokak": "S14",
            "stadyum": "U11",
            "huzurevi": "U12",
            "cami": "U13",
            "yurt": "U14",
            "saglik_kurumu": "W11",
            "resmi_daire": "W12",
            "egitim_kurumu": "W13",
            "spor_salonu": "W14"
        }
    },
    "cagri_nedeni_detay": {
        "field": "callReasonDetail",
        "options": {
            "yangin": "I11",
            "intihar": "I12",
            "kimyasal": "I13",
            "allerji": "I14",
            "elektrik_carp": "K11",
            "atesli_silah": "K12",
            "bogulma": "K13",
            "kesici_delici": "K14",
            "dusme": "M11",
            "alkol_ilac": "M12",
            "kunt_trav": "M13",
            "yanik": "M14",
            "lpg": "O11",
            "tedbir": "O12",
            "protokol": "O13"
        }
    },
    "pupiller": {
        "field": "pupils",
        "options": {
            "normal": "A17",
            "miyotik": "A18",
            "midriatik": "A19",
            "anizokorik": "A20",
            "reak_yok": "A21",
            "fiks_dilate": "A22"
        }
    },
    "deri": {
        "field": "skin",
        "options": {
            "normal": "C17",
            "soluk": "C18",
            "siyanotik": "C19",
            "hiperemik": "C20",
            "ikterik": "C21",
            "terli": "C22"
        }
    },
    "nabiz_tipi": {
        "field": "pulseType",
        "options": {
            "duzenli": "K19",
            "ritmik": "K20",
            "filiform": "K21",
            "alinmiyor": "K22"
        }
    },
    "solunum_tipi": {
        "field": "respirationType",
        "options": {
            "duzenli": "M19",
            "duzensiz": "M20",
            "dispne": "M21",
            "yok": "M22"
        }
    },
    "nakil_mesafe": {
        "field": "transferDistance",
        "options": {
            "ilce_ici": "M27",
            "ilce_disi": "M28",
            "il_disi": "M29"
        }
    }
}
```

---

**Son Güncelleme:** 11 Aralık 2025

