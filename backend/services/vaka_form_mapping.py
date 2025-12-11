#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vaka Formu Excel Hücre Eşlemeleri
Bu dosya Vaka formu v2.xlsx template'i için hücre-alan eşlemelerini içerir.
FormTemplates sayfasından görüntülenebilir ve düzenlenebilir.

Son Güncelleme: 11 Aralık 2025 - TÜM EKSİKLER EKLENDİ
"""

# =============================================================================
# VAKA FORMU EXCEL HÜCRE EŞLEMELERİ
# Format: { "hücre": {"field": "form_data_key", "label": "Görünen Ad", "section": "Bölüm", "source": "kaynak"} }
# =============================================================================

VAKA_FORM_CELL_MAPPING = {
    # ==================== ÜST BÖLÜM ====================
    "U2": {"field": "case_number", "label": "ATN NO", "section": "Üst Bölüm", "source": "case_data"},
    "W2": {"field": "startKm", "label": "Başlangıç KM", "section": "Üst Bölüm", "source": "form_data"},
    "Y2": {"field": "endKm", "label": "Bitiş KM", "section": "Üst Bölüm", "source": "form_data"},
    
    # ==================== İSTASYON BÖLÜMÜ ====================
    "C4": {"field": "healmedyProtocol", "label": "Protokol No", "section": "İstasyon", "source": "form_data", "fallback": "case_number"},
    "C5": {"field": "date", "label": "Tarih", "section": "İstasyon", "source": "auto", "format": "DD.MM.YYYY"},
    "C6": {"field": "stationCode", "label": "İstasyon Kodu", "section": "İstasyon", "source": "form_data"},
    "C7": {"field": "vehiclePlate", "label": "Plaka", "section": "İstasyon", "source": "case_data.assigned_team.vehicle_plate"},
    "C8": {"field": "pickupAddress", "label": "Hastanın Alındığı Adres", "section": "İstasyon", "source": "form_data"},
    "C9": {"field": "callerOrganization", "label": "Vakayı Veren Kurum", "section": "İstasyon", "source": "form_data"},
    
    # ==================== SAATLER BÖLÜMÜ ====================
    "I4": {"field": "callTime", "label": "Çağrı Saati", "section": "Saatler", "source": "auto", "format": "HH:MM"},
    "I5": {"field": "arrivalSceneTime", "label": "Olay Yerine Varış", "section": "Saatler", "source": "form_data"},
    "I6": {"field": "arrivalPatientTime", "label": "Hastaya Varış", "section": "Saatler", "source": "form_data"},
    "I7": {"field": "departureTime", "label": "Olay Yerinden Ayrılış", "section": "Saatler", "source": "form_data"},
    "I8": {"field": "hospitalArrivalTime", "label": "Hastaneye Varış", "section": "Saatler", "source": "form_data"},
    "I9": {"field": "returnStationTime", "label": "İstasyona Dönüş", "section": "Saatler", "source": "form_data"},
    
    # ==================== HASTA BİLGİLERİ BÖLÜMÜ ====================
    "M4": {"field": "patientName", "label": "Adı Soyadı", "section": "Hasta Bilgileri", "source": "case_data.patient.name + surname"},
    "M5": {"field": "address", "label": "Adresi", "section": "Hasta Bilgileri", "source": "case_data.location.address"},
    "M8": {"field": "tcNo", "label": "T.C. Kimlik No", "section": "Hasta Bilgileri", "source": "case_data.patient.tc_no"},
    "M9": {"field": "phone", "label": "Telefon", "section": "Hasta Bilgileri", "source": "case_data.patient.phone"},
    
    # ==================== CİNSİYET / YAŞ ====================
    "T8": {"field": "birthDate", "label": "Doğum Tarihi", "section": "Yaş/Doğum", "source": "form_data", "format": "DD.MM.YYYY"},
    "T9": {"field": "age", "label": "Yaş", "section": "Yaş/Doğum", "source": "case_data.patient.age"},
    
    # ==================== KRONİK HASTALIKLAR / ŞİKAYET ====================
    "X4": {"field": "chronicDiseases", "label": "Kronik Hastalıklar", "section": "Anamnez", "source": "form_data"},
    "X7": {"field": "complaint", "label": "Hastanın Şikayeti", "section": "Anamnez", "source": "case_data.patient.complaint"},
    
    # ==================== VİTAL BULGULAR - 1. ÖLÇÜM ====================
    "E17": {"field": "vitalTime1", "label": "1. Ölçüm Saati", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].time"},
    "H17": {"field": "bloodPressure1", "label": "1. Tansiyon", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].bp"},
    "K17": {"field": "pulse1", "label": "1. Nabız", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].pulse"},
    "M17": {"field": "respiration1", "label": "1. Solunum", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].respiration"},
    "X17": {"field": "bloodSugar1", "label": "1. Kan Şekeri", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].bloodSugar"},
    
    # ==================== VİTAL BULGULAR - 2. ÖLÇÜM ====================
    "E18": {"field": "vitalTime2", "label": "2. Ölçüm Saati", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].time"},
    "H18": {"field": "bloodPressure2", "label": "2. Tansiyon", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].bp"},
    "K18": {"field": "pulse2", "label": "2. Nabız", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].pulse"},
    "M18": {"field": "respiration2", "label": "2. Solunum", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].respiration"},
    "X18": {"field": "bloodSugar2", "label": "2. Kan Şekeri", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].bloodSugar"},
    
    # ==================== VİTAL BULGULAR - 3. ÖLÇÜM ====================
    "E19": {"field": "vitalTime3", "label": "3. Ölçüm Saati", "section": "Vital Bulgular", "source": "form_data.vitalSigns[2].time"},
    "H20": {"field": "spo2_1", "label": "1. SpO2", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].spo2"},
    "H21": {"field": "spo2_2", "label": "2. SpO2", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].spo2"},
    "H22": {"field": "spo2_3", "label": "3. SpO2", "section": "Vital Bulgular", "source": "form_data.vitalSigns[2].spo2"},
    
    # ==================== ATEŞ ÖLÇÜMLERİ ====================
    "X20": {"field": "temperature1", "label": "1. Ateş", "section": "Vital Bulgular", "source": "form_data.vitalSigns[0].temp"},
    "X21": {"field": "temperature2", "label": "2. Ateş", "section": "Vital Bulgular", "source": "form_data.vitalSigns[1].temp"},
    "X22": {"field": "temperature3", "label": "3. Ateş", "section": "Vital Bulgular", "source": "form_data.vitalSigns[2].temp"},
    
    # ==================== GLASGOW KOMA SKALASI ====================
    "U22": {"field": "gksTotal", "label": "GKS Toplam Puan", "section": "Glasgow", "source": "calculated"},
    
    # ==================== ÖN TANI / AÇIKLAMALAR ====================
    "C23": {"field": "diagnosis", "label": "Ön Tanı", "section": "Tanı", "source": "form_data"},
    "K23": {"field": "notes", "label": "Açıklamalar", "section": "Açıklamalar", "source": "form_data"},
    
    # ==================== NAKİL BİLGİLERİ ====================
    "K25": {"field": "hospitalName", "label": "Nakledilen Hastane", "section": "Nakil", "source": "form_data"},
    
    # ==================== KAZA BİLGİLERİ ====================
    "P25": {"field": "accidentVehiclePlate1", "label": "Kazaya Karışan Araç 1", "section": "Kaza", "source": "form_data"},
    "P26": {"field": "accidentVehiclePlate2", "label": "Kazaya Karışan Araç 2", "section": "Kaza", "source": "form_data"},
    "P27": {"field": "accidentVehiclePlate3", "label": "Kazaya Karışan Araç 3", "section": "Kaza", "source": "form_data"},
    "P28": {"field": "accidentVehiclePlate4", "label": "Kazaya Karışan Araç 4", "section": "Kaza", "source": "form_data"},
    
    # ==================== CPR BİLGİLERİ ====================
    "W25": {"field": "cprStartTime", "label": "CPR Başlama Zamanı", "section": "CPR", "source": "form_data"},
    "W26": {"field": "cprEndTime", "label": "CPR Bırakma Zamanı", "section": "CPR", "source": "form_data"},
    "T28": {"field": "cprStopReason", "label": "CPR Bırakma Nedeni", "section": "CPR", "source": "form_data"},
    
    # ==================== TPOC FİLYOS LOKASYONU ====================
    "X12": {"field": "tpocLocation", "label": "TPOC Filyos Merkezi Lokasyonu", "section": "Olay Yeri", "source": "form_data"},
    
    # ==================== İMZA ALANLARI ====================
    # Hastayı Teslim Alan
    "D73": {"field": "receiverTitle", "label": "Teslim Alan Ünvanı", "section": "İmzalar", "source": "form_data"},
    "A75": {"field": "receiverName", "label": "Teslim Alan Adı Soyadı", "section": "İmzalar", "source": "form_data"},
    
    # Ambulans Personeli
    "I74": {"field": "doctorParamedicName", "label": "Doktor/Paramedik Adı", "section": "İmzalar", "source": "form_data"},
    "I76": {"field": "healthStaffName", "label": "Sağlık Personeli/ATT Adı", "section": "İmzalar", "source": "form_data"},
    "I78": {"field": "driverName", "label": "Sürücü/Teknisyen Adı", "section": "İmzalar", "source": "form_data"},
    
    # Hasta/Yakını Reddi
    "P65": {"field": "patientRejectText", "label": "Hasta Reddi Metni", "section": "Redler", "source": "static"},
    "W69": {"field": "patientRejectName", "label": "Reddeden Adı Soyadı", "section": "Redler", "source": "form_data"},
}

# =============================================================================
# CHECKBOX EŞLEMELERİ
# =============================================================================

CHECKBOX_MAPPINGS = {
    # ==================== CİNSİYET ====================
    "cinsiyet": {
        "field": "gender",
        "section": "Hasta Bilgileri",
        "options": {
            "erkek": "T4",
            "kadin": "T6"
        }
    },
    
    # ==================== TRİYAJ / DURUM ====================
    "triyaj": {
        "field": "triageCode",
        "section": "Triyaj",
        "options": {
            "kirmizi": "W4",
            "sari": "W5",
            "yesil": "W6",
            "siyah": "W7",
            "sosyal": "W8"
        }
    },
    
    # ==================== ÇAĞRI TİPİ ====================
    "cagri_tipi": {
        "field": "callType",
        "section": "Çağrı",
        "options": {
            "telsiz": "D11",
            "telefon": "D12",
            "diger": "D13"
        }
    },
    
    # ==================== ÇAĞRI NEDENİ - ANA ====================
    "cagri_nedeni": {
        "field": "callReason",
        "section": "Çağrı Nedeni",
        "options": {
            "medikal": "G11",
            "trafik_kaza": "G12",
            "diger_kaza": "G13",
            "is_kazasi": "G14"
        }
    },
    
    # ==================== ÇAĞRI NEDENİ - DETAY ====================
    "cagri_nedeni_detay": {
        "field": "callReasonDetail",
        "section": "Çağrı Nedeni Detay",
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
    
    # ==================== OLAY YERİ ====================
    "olay_yeri": {
        "field": "incidentLocation",
        "section": "Olay Yeri",
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
    
    # ==================== PUPİLLER ====================
    "pupiller": {
        "field": "pupils",
        "section": "Muayene Bulguları",
        "options": {
            "normal": "A17",
            "miyotik": "A18",
            "midriatik": "A19",
            "anizokorik": "A20",
            "reak_yok": "A21",
            "fiks_dilate": "A22"
        }
    },
    
    # ==================== DERİ ====================
    "deri": {
        "field": "skin",
        "section": "Muayene Bulguları",
        "options": {
            "normal": "C17",
            "soluk": "C18",
            "siyanotik": "C19",
            "hiperemik": "C20",
            "ikterik": "C21",
            "terli": "C22"
        }
    },
    
    # ==================== NABIZ TİPİ ====================
    "nabiz_tipi": {
        "field": "pulseType",
        "section": "Muayene Bulguları",
        "options": {
            "duzenli": "K19",
            "ritmik": "K20",
            "filiform": "K21",
            "alinmiyor": "K22"
        }
    },
    
    # ==================== SOLUNUM TİPİ ====================
    "solunum_tipi": {
        "field": "respirationType",
        "section": "Muayene Bulguları",
        "options": {
            "duzenli": "M19",
            "duzensiz": "M20",
            "dispne": "M21",
            "yok": "M22"
        }
    },
    
    # ==================== GLASGOW - MOTOR ====================
    "gks_motor": {
        "field": "gcsMotor",
        "section": "Glasgow",
        "options": {
            "6_emre_itaat": "O17",
            "5_agriyi_lokalize": "O18",
            "4_agridan_kacinma": "O19",
            "3_fleksor_yanit": "O20",
            "2_extensor_yanit": "O21",
            "1_yanit_yok": "O22"
        }
    },
    
    # ==================== GLASGOW - VERBAL ====================
    "gks_verbal": {
        "field": "gcsVerbal",
        "section": "Glasgow",
        "options": {
            "5_oriente": "R17",
            "4_konfuze": "R18",
            "3_uygunsuz_sozler": "R19",
            "2_anlamsiz_bagirma": "R20",
            "1_yanit_yok": "R21"
        }
    },
    
    # ==================== GLASGOW - GÖZ AÇMA ====================
    "gks_goz": {
        "field": "gcsEye",
        "section": "Glasgow",
        "options": {
            "4_spontan": "U17",
            "3_sesle": "U18",
            "2_agriyla": "U19",
            "1_yanit_yok": "U20"
        }
    },
    
    # ==================== SONUÇ ====================
    "sonuc": {
        "field": "result",
        "section": "Sonuç",
        "options": {
            "yerinde_mudahale": "A25",
            "hastaneye_nakil": "A26",
            "hastaneler_arasi_nakil": "A27",
            "tibbi_tetkik_icin_nakil": "A28",
            "eve_nakil": "A29",
            "ex_yerinde_birakildi": "C25",
            "ex_morga_nakil": "C26",
            "nakil_reddi": "C27",
            "diger_ulasilan": "C28",
            "gorev_iptali": "C29",
            "baska_aracla_nakil": "E25",
            "tlfla_baska_aracla": "E26",
            "asilsiz_ihbar": "E27",
            "yaralanan_yok": "E28",
            "olay_yerinde_bekleme": "E29"
        }
    },
    
    # ==================== NAKİL MESAFESİ ====================
    "nakil_mesafe": {
        "field": "transferDistance",
        "section": "Nakil",
        "options": {
            "ilce_ici": "M27",
            "ilce_disi": "M28",
            "il_disi": "M29"
        }
    },
    
    # ==================== ADLİ VAKA ====================
    "adli_vaka": {
        "field": "isJudicialCase",
        "section": "Adli",
        "options": {
            "evet": "R29",
            "hayir": "T29"
        }
    }
}

# =============================================================================
# İŞLEMLER (Checkbox + Adet)
# =============================================================================

PROCEDURE_MAPPINGS = {
    # ==================== GENEL MÜDAHALE ====================
    "genel_mudahale": {
        "section": "Genel Müdahale",
        "items": {
            "muayene_acil": {"label": "Muayene (Acil)", "checkbox": "A31", "adet": "G31"},
            "ambulans_ucreti": {"label": "Ş.I. Ambulans Ücreti", "checkbox": "A32", "adet": "G32"},
            "enjeksiyon_im": {"label": "Enjeksiyon IM", "checkbox": "A34", "adet": "G34"},
            "enjeksiyon_iv": {"label": "Enjeksiyon IV", "checkbox": "A35", "adet": "G35"},
            "enjeksiyon_sc": {"label": "Enjeksiyon SC", "checkbox": "A36", "adet": "G36"},
            "iv_ilac_uygulamasi": {"label": "I.V. İlaç uygulaması", "checkbox": "A37", "adet": "G37"},
            "damar_yolu_acilmasi": {"label": "Damar yolu açılması", "checkbox": "A38", "adet": "G38"},
            "sutur_kucuk": {"label": "Sütür (küçük)", "checkbox": "A39", "adet": "G39"},
            "mesane_sondasi": {"label": "Mesane sondası takılması", "checkbox": "A40", "adet": "G40"},
            "mide_yikanmasi": {"label": "Mide yıkanması", "checkbox": "A41", "adet": "G41"},
            "pansuman_kucuk": {"label": "Pansuman (küçük)", "checkbox": "A42", "adet": "G42"},
            "apse_acmak": {"label": "Apse açmak", "checkbox": "A43", "adet": "G43"},
            "yabanci_cisim": {"label": "Yabancı cisim çıkartılması", "checkbox": "A44", "adet": "G44"},
            "yanik_pansuman_kucuk": {"label": "Yanık pansum. (küçük)", "checkbox": "A45", "adet": "G45"},
            "yanik_pansuman_orta": {"label": "Yanık pansum (orta)", "checkbox": "A46", "adet": "G46"},
            "ng_sonda": {"label": "NG sonda takma", "checkbox": "A47", "adet": "G47"},
            "kulak_buson": {"label": "Kulaktan buşon temizliği", "checkbox": "A48", "adet": "G48"},
            "kol_atel": {"label": "Kol atel (kısa)", "checkbox": "A49", "adet": "G49"},
            "bacak_atel": {"label": "Bacak atel (kısa)", "checkbox": "A50", "adet": "G50"},
            "cilt_traksiyonu": {"label": "Cilt traksiyonu uygulaması", "checkbox": "A51", "adet": "G51"},
            "servikal_collar": {"label": "Servikal collar uygulaması", "checkbox": "A52", "adet": "G52"},
            "travma_yelegi": {"label": "Travma yeleği", "checkbox": "A53", "adet": "G53"},
            "vakum_sedye": {"label": "Vakum sedye uygulaması", "checkbox": "A54", "adet": "G54"},
            "sirt_tahtasi": {"label": "Sırt tahtası uygulaması", "checkbox": "A55", "adet": "G55"},
        }
    },
    
    # ==================== DOLAŞIM DESTEĞİ ====================
    "dolasim_destegi": {
        "section": "Dolaşım Desteği",
        "items": {
            "cpr": {"label": "CPR (Resüsitasyon)", "checkbox": "A57", "adet": "G57"},
            "ekg": {"label": "EKG Uygulaması", "checkbox": "A58", "adet": "G58"},
            "defibrilasyon": {"label": "Defibrilasyon (CPR)", "checkbox": "A59", "adet": "G59"},
            "kardiyoversiyon": {"label": "Kardiyoversiyon", "checkbox": "A60", "adet": "G60"},
            "monitorizasyon": {"label": "Monitörizasyon", "checkbox": "A61", "adet": "G61"},
            "kanama_kontrolu": {"label": "Kanama kontrolü", "checkbox": "A62", "adet": "G62"},
            "cut_down": {"label": "Cut down", "checkbox": "A63", "adet": "G63"},
        }
    },
    
    # ==================== HAVA YOLU ====================
    "hava_yolu": {
        "section": "Hava Yolu",
        "items": {
            "balon_valf_maske": {"label": "Balon Valf Maske", "checkbox": "H32", "adet": "M32"},
            "aspirasyon": {"label": "Aspirasyon uygulaması", "checkbox": "H33", "adet": "M33"},
            "orofaringeal": {"label": "Orofaringeal tüp uygulaması", "checkbox": "H34", "adet": "M34"},
            "entübasyon": {"label": "Endotrakeal entübasyon", "checkbox": "H35", "adet": "M35"},
            "mekanik_ventilasyon": {"label": "Mekanik ventilasyon (CPAP–BIPAP dahil)", "checkbox": "H36", "adet": "M36"},
            "oksijen_inhalasyon": {"label": "Oksijen inhalasyon tedavisi", "checkbox": "H37", "adet": "M37"},
        }
    },
    
    # ==================== DİĞER İŞLEMLER ====================
    "diger_islemler": {
        "section": "Diğer İşlemler",
        "items": {
            "normal_dogum": {"label": "Normal doğum", "checkbox": "H39", "adet": "M39"},
            "kan_sekeri_olcumu": {"label": "Kan şekeri ölçümü", "checkbox": "H40", "adet": "M40"},
            "lokal_anestezi": {"label": "Lokal anestezi", "checkbox": "H41", "adet": "M41"},
            "tirnak_avulizyonu": {"label": "Tırnak avülizyonu", "checkbox": "H42", "adet": "M42"},
            "transkutan_pao2": {"label": "Transkutan PaO2 ölçümü", "checkbox": "H43", "adet": "M43"},
            "debritman": {"label": "Debritman alınması", "checkbox": "H44", "adet": "M44"},
            "sutur_alinmasi": {"label": "Sütür alınması", "checkbox": "H45", "adet": "M45"},
        }
    },
    
    # ==================== YENİDOĞAN İŞLEMLERİ ====================
    "yenidogan": {
        "section": "Yenidoğan İşlemleri",
        "items": {
            "transport_kuvoz": {"label": "Transport küvözi ile nakil", "checkbox": "H47", "adet": "M47"},
            "yenidogan_canlandirma": {"label": "Yenidoğan canlandırma", "checkbox": "H48", "adet": "M48"},
            "yenidogan_im": {"label": "Yenidoğan I.M. enjeksiyon", "checkbox": "H49", "adet": "M49"},
            "yenidogan_iv": {"label": "Yenidoğan I.V. enjeksiyon", "checkbox": "H50", "adet": "M50"},
            "yenidogan_mayi": {"label": "Yenidoğan I.V. mayi takılması", "checkbox": "H51", "adet": "M51"},
            "yenidogan_entubasyon": {"label": "Yenidoğan entübasyonu", "checkbox": "H52", "adet": "M52"},
        }
    },
    
    # ==================== SIVI TEDAVİSİ ====================
    "sivi_tedavisi": {
        "section": "Sıvı Tedavisi",
        "items": {
            "nacl_250": {"label": "%0.9 NaCl 250 cc", "checkbox": "H54", "adet": "M54"},
            "nacl_500": {"label": "%0.9 NaCl 500 cc", "checkbox": "H55", "adet": "M55"},
            "nacl_100": {"label": "%0.9 NaCl 100 cc", "checkbox": "H56", "adet": "M56"},
            "dextroz_500_1": {"label": "%5 Dextroz 500 cc", "checkbox": "H57", "adet": "M57"},
            "dextroz_500_2": {"label": "%5 Dextroz 500 cc (2)", "checkbox": "H58", "adet": "M58"},
            "mannitol_500": {"label": "%20 Mannitol 500 cc", "checkbox": "H59", "adet": "M59"},
            "isolyte_p": {"label": "İsolyte P 500 cc", "checkbox": "H60", "adet": "M60"},
            "isolyte_s": {"label": "İsolyte S 500 cc", "checkbox": "H61", "adet": "M61"},
            "dengeleyici_elektrolit": {"label": "%10 Dengeleyici Elektrolit 500 cc", "checkbox": "H62", "adet": "M62"},
            "laktatli_ringer": {"label": "Laktatlı Ringer 500 cc", "checkbox": "H63", "adet": "M63"},
        }
    }
}

# =============================================================================
# İLAÇLAR (Adet ile)
# =============================================================================

MEDICATION_MAPPINGS = {
    "ilaclar": {
        "section": "Kullanılan İlaçlar",
        "items": {
            "arveles": {"label": "Arveles amp.", "checkbox": "N32", "adet": "S32", "uyg_turu": "S32"},
            "dikloron": {"label": "Dikloron amp.", "checkbox": "N33", "adet": "S33", "uyg_turu": "S33"},
            "spazmolitik": {"label": "Spazmolitik amp.", "checkbox": "N34", "adet": "S34", "uyg_turu": "S34"},
            "adrenalin_05": {"label": "Adrenalin 0,5 mg amp.", "checkbox": "N35", "adet": "S35", "uyg_turu": "S35"},
            "adrenalin_1": {"label": "Adrenalin 1 mg amp.", "checkbox": "N36", "adet": "S36", "uyg_turu": "S36"},
            "atropin": {"label": "Atropin 0,5 mg amp.", "checkbox": "N37", "adet": "S37", "uyg_turu": "S37"},
            "flumazenil": {"label": "Flumazenil amp.", "checkbox": "N38", "adet": "S38", "uyg_turu": "S38"},
            "dopamin": {"label": "Dopamin amp.", "checkbox": "N39", "adet": "S39", "uyg_turu": "S39"},
            "citanest": {"label": "Citanest flk. (Priloc)", "checkbox": "N40", "adet": "S40", "uyg_turu": "S40"},
            "nahco3": {"label": "NaHCO3 amp.", "checkbox": "N41", "adet": "S41", "uyg_turu": "S41"},
            "dizem": {"label": "Dizem amp.", "checkbox": "N42", "adet": "S42", "uyg_turu": "S42"},
            "aminocordial": {"label": "Aminocordial amp.", "checkbox": "N43", "adet": "S43", "uyg_turu": "S43"},
            "furosemid": {"label": "Furosemid amp.", "checkbox": "N44", "adet": "S44", "uyg_turu": "S44"},
            "ca_glukonat": {"label": "Ca Glukonat %10 amp.", "checkbox": "N45", "adet": "S45", "uyg_turu": "S45"},
            "diltizem": {"label": "Diltizem Ampul 25 mg", "checkbox": "N46", "adet": "S46", "uyg_turu": "S46"},
            "avil": {"label": "Avil amp.", "checkbox": "N47", "adet": "S47", "uyg_turu": "S47"},
            "dekort": {"label": "Dekort amp.", "checkbox": "N48", "adet": "S48", "uyg_turu": "S48"},
            "antiepileptik": {"label": "Antiepileptik amp.", "checkbox": "N49", "adet": "S49", "uyg_turu": "S49"},
            "prednol": {"label": "Prednol 40 mg amp.", "checkbox": "N50", "adet": "S50", "uyg_turu": "S50"},
            "aktif_komur": {"label": "Aktif kömür tüp", "checkbox": "N51", "adet": "S51", "uyg_turu": "S51"},
            "beloc": {"label": "Beloc amp.", "checkbox": "N52", "adet": "S52", "uyg_turu": "S52"},
            "salbutamol": {"label": "Salbutamol (İnhaler/Nebül)", "checkbox": "N53", "adet": "S53", "uyg_turu": "S53"},
            "aritmal": {"label": "Aritmal amp. %2", "checkbox": "N54", "adet": "S54", "uyg_turu": "S54"},
            "isoptin": {"label": "Isoptin amp.", "checkbox": "N55", "adet": "S55", "uyg_turu": "S55"},
            "kapril": {"label": "Kapril 25 mg tab.", "checkbox": "N56", "adet": "S56", "uyg_turu": "S56"},
            "magnezyum_sulfat": {"label": "Magnezyum Sülfat amp.", "checkbox": "N57", "adet": "S57", "uyg_turu": "S57"},
            "isorid": {"label": "Isorid 5 mg tab.", "checkbox": "N58", "adet": "S58", "uyg_turu": "S58"},
            "coraspin": {"label": "Coraspin 300 mg tab.", "checkbox": "N59", "adet": "S59", "uyg_turu": "S59"},
            "paracetamol": {"label": "Paracetamol Tablet", "checkbox": "N60", "adet": "S60", "uyg_turu": "S60"},
            "midazolam": {"label": "Midazolam Ampul", "checkbox": "N61", "adet": "S61", "uyg_turu": "S61"},
            "dramamine": {"label": "Dramamine ampul", "checkbox": "N62", "adet": "S62", "uyg_turu": "S62"},
            "rotapamid": {"label": "Rotapamid amp.", "checkbox": "N63", "adet": "S63", "uyg_turu": "S63"},
        }
    }
}

# =============================================================================
# MALZEMELER (Adet ile)
# =============================================================================

MATERIAL_MAPPINGS = {
    "malzemeler": {
        "section": "Kullanılan Malzemeler",
        "items": {
            "enjektor_1_2": {"label": "Enjektör 1–2 cc", "checkbox": "U32", "adet": "Z32"},
            "enjektor_5": {"label": "Enjektör 5 cc", "checkbox": "U33", "adet": "Z33"},
            "enjektor_10_20": {"label": "Enjektör 10–20 cc", "checkbox": "U34", "adet": "Z34"},
            "monitor_pedi": {"label": "Monitör pedi (EKG elektrodu)", "checkbox": "U35", "adet": "Z35"},
            "iv_katater_14_22": {"label": "I.V. katater (No: 14–22)", "checkbox": "U36", "adet": "Z36"},
            "iv_katater_24": {"label": "I.V. katater (No: 24)", "checkbox": "U37", "adet": "Z37"},
            "serum_seti": {"label": "Serum seti", "checkbox": "U38", "adet": "Z38"},
            "steril_eldiven": {"label": "Steril eldiven", "checkbox": "U39", "adet": "Z39"},
            "cerrahi_eldiven": {"label": "Cerrahi eldiven", "checkbox": "U40", "adet": "Z40"},
            "sponc": {"label": "Sponç", "checkbox": "U41", "adet": "Z41"},
            "sargi_bezi": {"label": "Sargı bezi", "checkbox": "U42", "adet": "Z42"},
            "idrar_torbasi": {"label": "İdrar torbası", "checkbox": "U43", "adet": "Z43"},
            "bisturi_ucu": {"label": "Bistüri ucu (No: )", "checkbox": "U44", "adet": "Z44"},
            "entubasyon_balonlu": {"label": "Entübasyon tüpü (Balonlu)", "checkbox": "U45", "adet": "Z45"},
            "entubasyon_balonsuz": {"label": "Entübasyon tüpü (Balonsuz)", "checkbox": "U46", "adet": "Z46"},
            "airway": {"label": "Airway (No: )", "checkbox": "U47", "adet": "Z47"},
            "foley_sonda": {"label": "Foley sonda (No: )", "checkbox": "U48", "adet": "Z48"},
            "nazo_gastrik": {"label": "Nazo gastrik son. (No: )", "checkbox": "U49", "adet": "Z49"},
            "atravmatik_ipek": {"label": "Atravmatik ipek (No: 3/0)", "checkbox": "U50", "adet": "Z50"},
            "atravmatik_katkut": {"label": "Atravmatik kat-küt (No: 3/0)", "checkbox": "U51", "adet": "Z51"},
            "dogum_seti": {"label": "Doğum seti", "checkbox": "U52", "adet": "Z52"},
            "yanik_battaniyesi": {"label": "Yanık battaniyesi", "checkbox": "U53", "adet": "Z53"},
            "o2_maskesi_hazneli_eriskin": {"label": "O2 Maskesi hazneli erişkin", "checkbox": "U54", "adet": "Z54"},
            "o2_maskesi_hazneli_pediatrik": {"label": "O2 Maskesi hazneli pediatrik", "checkbox": "U55", "adet": "Z55"},
            "o2_kanulu_eriskin": {"label": "O2 Kanülü nazal erişkin", "checkbox": "U56", "adet": "Z56"},
            "o2_kanulu_pediatrik": {"label": "O2 Kanülü nazal pediatrik", "checkbox": "U57", "adet": "Z57"},
            "flaster": {"label": "Flaster", "checkbox": "U58", "adet": "Z58"},
            "servikal_collar_malz": {"label": "Servikal collar (Boy: )", "checkbox": "U59", "adet": "Z59"},
            "elastik_bandaj": {"label": "Elastik bandaj", "checkbox": "U60", "adet": "Z60"},
            "etil_chloride": {"label": "Etil Chloride Sprey", "checkbox": "U61", "adet": "Z61"},
            "o2_maskesi_haznesiz_eriskin": {"label": "O2 MASKESİ HAZNESİZ ERİŞKİN", "checkbox": "U62", "adet": "Z62"},
            "o2_maskesi_haznesiz_pediatrik": {"label": "O2 MASKESİ HAZNESİZ PEDİATRİK", "checkbox": "U63", "adet": "Z63"},
        }
    }
}


# =============================================================================
# YARDIMCI FONKSİYONLAR
# =============================================================================

def get_cell_mapping_for_display():
    """Frontend'de göstermek için hücre eşlemelerini döndürür"""
    sections = {}
    
    for cell, info in VAKA_FORM_CELL_MAPPING.items():
        section = info.get("section", "Diğer")
        if section not in sections:
            sections[section] = []
        
        sections[section].append({
            "cell": cell,
            "field": info["field"],
            "label": info["label"],
            "source": info.get("source", "form_data"),
            "format": info.get("format"),
            "value": info.get("value")
        })
    
    # Checkbox mapping'lerini de ekle
    checkbox_sections = {}
    for group_name, group_data in CHECKBOX_MAPPINGS.items():
        section = group_data.get("section", "Checkboxlar")
        if section not in checkbox_sections:
            checkbox_sections[section] = []
        
        for value, cell in group_data["options"].items():
            checkbox_sections[section].append({
                "cell": cell,
                "field": group_data["field"],
                "label": f"{group_name}: {value}",
                "source": "checkbox",
                "value": value
            })
    
    return {
        "cell_mappings": sections,
        "checkbox_mappings": CHECKBOX_MAPPINGS,
        "procedure_mappings": PROCEDURE_MAPPINGS,
        "medication_mappings": MEDICATION_MAPPINGS,
        "material_mappings": MATERIAL_MAPPINGS,
        "total_cells": len(VAKA_FORM_CELL_MAPPING),
        "total_checkboxes": sum(len(m["options"]) for m in CHECKBOX_MAPPINGS.values()),
        "total_procedures": sum(len(cat["items"]) for cat in PROCEDURE_MAPPINGS.values()),
        "total_medications": sum(len(cat["items"]) for cat in MEDICATION_MAPPINGS.values()),
        "total_materials": sum(len(cat["items"]) for cat in MATERIAL_MAPPINGS.values()),
    }


def get_all_field_names():
    """Tüm alan isimlerini döndürür (frontend validasyonu için)"""
    fields = set()
    
    # Cell mapping'lerden
    for info in VAKA_FORM_CELL_MAPPING.values():
        fields.add(info["field"])
    
    # Checkbox mapping'lerden
    for group_data in CHECKBOX_MAPPINGS.values():
        fields.add(group_data["field"])
    
    return sorted(list(fields))
