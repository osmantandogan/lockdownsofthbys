#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vaka Formu Excel Hücre Eşlemeleri
Bu dosya Vaka formu v2.xlsx template'i için hücre-alan eşlemelerini içerir.
FormTemplates sayfasından görüntülenebilir ve düzenlenebilir.
"""

# Vaka Formu Excel Hücre Eşlemeleri
# Format: { "hücre": {"alan": "form_data_key", "label": "Görünen Ad", "section": "Bölüm"} }

VAKA_FORM_CELL_MAPPING = {
    # ÜST BÖLÜM
    "U2": {"field": "case_number", "label": "ATN NO", "section": "Üst Bölüm", "source": "case_data"},
    "W2": {"field": "startKm", "label": "Başlangıç KM", "section": "Üst Bölüm", "source": "form_data"},
    "Y2": {"field": "endKm", "label": "Bitiş KM", "section": "Üst Bölüm", "source": "form_data"},
    
    # İSTASYON BÖLÜMÜ
    "C4": {"field": "healmedyProtocol", "label": "Protokol No", "section": "İstasyon", "source": "form_data", "fallback": "case_number"},
    "C5": {"field": "date", "label": "Tarih", "section": "İstasyon", "source": "auto", "format": "DD.MM.YYYY"},
    "C6": {"field": "stationCode", "label": "Kodu", "section": "İstasyon", "source": "form_data"},
    "C7": {"field": "vehiclePlate", "label": "Plaka", "section": "İstasyon", "source": "case_data.assigned_team.vehicle_plate"},
    "C8": {"field": "address", "label": "Hastanın Alındığı Adres", "section": "İstasyon", "source": "case_data.location.address"},
    "C9": {"field": "callerOrganization", "label": "Vakayı Veren Kurum", "section": "İstasyon", "source": "form_data"},
    
    # SAATLER BÖLÜMÜ
    "I4": {"field": "callTime", "label": "Çağrı Saati", "section": "Saatler", "source": "auto", "format": "HH:MM"},
    "I5": {"field": "arrivalTime", "label": "Olay Yerine Varış", "section": "Saatler", "source": "form_data"},
    "I6": {"field": "patientArrivalTime", "label": "Hastaya Varış", "section": "Saatler", "source": "form_data"},
    "I7": {"field": "departureTime", "label": "Olay Yerinden Ayrılış", "section": "Saatler", "source": "form_data"},
    "I8": {"field": "hospitalArrivalTime", "label": "Hastaneye Varış", "section": "Saatler", "source": "form_data"},
    "I9": {"field": "returnTime", "label": "İstasyona Dönüş", "section": "Saatler", "source": "form_data"},
    
    # HASTA BİLGİLERİ BÖLÜMÜ
    "M4": {"field": "patientName", "label": "Adı Soyadı", "section": "Hasta Bilgileri", "source": "case_data.patient.name + surname"},
    "M5": {"field": "address", "label": "Adresi", "section": "Hasta Bilgileri", "source": "case_data.location.address"},
    "M8": {"field": "tcNo", "label": "T.C. Kimlik No", "section": "Hasta Bilgileri", "source": "case_data.patient.tc_no"},
    "M9": {"field": "phone", "label": "Telefon", "section": "Hasta Bilgileri", "source": "case_data.patient.phone"},
    
    # CİNSİYET / YAŞ
    "T4": {"field": "gender", "label": "Erkek (X)", "section": "Cinsiyet", "source": "checkbox", "value": "erkek"},
    "T6": {"field": "gender", "label": "Kadın (X)", "section": "Cinsiyet", "source": "checkbox", "value": "kadin"},
    "T8": {"field": "birthDate", "label": "Doğum Tarihi", "section": "Yaş/Doğum", "source": "form_data"},
    "T9": {"field": "age", "label": "Yaş", "section": "Yaş/Doğum", "source": "case_data.patient.age"},
    
    # DURUMU / TRİYAJ
    "V4": {"field": "triageCode", "label": "Kırmızı Kod (X)", "section": "Triyaj", "source": "checkbox", "value": "kirmizi"},
    "V5": {"field": "triageCode", "label": "Sarı Kod (X)", "section": "Triyaj", "source": "checkbox", "value": "sari"},
    "V6": {"field": "triageCode", "label": "Yeşil Kod (X)", "section": "Triyaj", "source": "checkbox", "value": "yesil"},
    "V7": {"field": "triageCode", "label": "Siyah Kod (X)", "section": "Triyaj", "source": "checkbox", "value": "siyah"},
    "V8": {"field": "triageCode", "label": "Sosyal Endikasyon (X)", "section": "Triyaj", "source": "checkbox", "value": "sosyal"},
    
    # KRONİK HASTALIKLAR / ŞİKAYET
    "X4": {"field": "chronicDiseases", "label": "Kronik Hastalıklar", "section": "Anamnez", "source": "form_data"},
    "X7": {"field": "complaint", "label": "Hastanın Şikayeti", "section": "Anamnez", "source": "case_data.patient.complaint"},
    
    # VİTAL BULGULAR
    "H17": {"field": "bloodPressure", "label": "Tansiyon (Sistolik/Diastolik)", "section": "Vital Bulgular", "source": "form_data"},
    "K17": {"field": "pulse", "label": "Nabız", "section": "Vital Bulgular", "source": "form_data"},
    "M17": {"field": "respiration", "label": "Solunum", "section": "Vital Bulgular", "source": "form_data"},
    "I19": {"field": "spo2", "label": "SpO2 (%)", "section": "Vital Bulgular", "source": "form_data"},
    "Y19": {"field": "temperature", "label": "Ateş (°C)", "section": "Vital Bulgular", "source": "form_data"},
    
    # GLASGOW KOMA SKALASI
    "O17": {"field": "gcsMotor", "label": "GKS Motor", "section": "Glasgow", "source": "form_data"},
    "R17": {"field": "gcsVerbal", "label": "GKS Verbal", "section": "Glasgow", "source": "form_data"},
    "U17": {"field": "gcsEye", "label": "GKS Göz Açma", "section": "Glasgow", "source": "form_data"},
    
    # KAN ŞEKERİ
    "Z17": {"field": "bloodSugar", "label": "Kan Şekeri (Mg/dL)", "section": "Vital Bulgular", "source": "form_data"},
    
    # ÖN TANI / AÇIKLAMALAR
    "B23": {"field": "diagnosis", "label": "Ön Tanı", "section": "Tanı", "source": "form_data"},
    "I23": {"field": "notes", "label": "Açıklamalar", "section": "Açıklamalar", "source": "form_data"},
    
    # NAKİL BİLGİLERİ
    "L24": {"field": "hospitalName", "label": "Nakledilen Hastane", "section": "Nakil", "source": "form_data"},
    
    # KAZA BİLGİLERİ
    "P25": {"field": "accidentVehiclePlate1", "label": "Kazaya Karışan Araç 1", "section": "Kaza", "source": "form_data"},
    "P26": {"field": "accidentVehiclePlate2", "label": "Kazaya Karışan Araç 2", "section": "Kaza", "source": "form_data"},
    "P27": {"field": "accidentVehiclePlate3", "label": "Kazaya Karışan Araç 3", "section": "Kaza", "source": "form_data"},
    "P28": {"field": "accidentVehiclePlate4", "label": "Kazaya Karışan Araç 4", "section": "Kaza", "source": "form_data"},
    
    # CPR BİLGİLERİ
    "U25": {"field": "cprStartTime", "label": "CPR Başlama Zamanı", "section": "CPR", "source": "form_data"},
    "U26": {"field": "cprEndTime", "label": "CPR Bırakma Zamanı", "section": "CPR", "source": "form_data"},
    "U27": {"field": "cprStopReason", "label": "CPR Bırakma Nedeni", "section": "CPR", "source": "form_data"},
}

# Checkbox hücreleri
CHECKBOX_MAPPINGS = {
    "cinsiyet": {
        "field": "gender",
        "options": {
            "erkek": "T4",
            "kadin": "T6"
        }
    },
    "triyaj": {
        "field": "triageCode",
        "options": {
            "kirmizi": "V4",
            "sari": "V5",
            "yesil": "V6",
            "siyah": "V7",
            "sosyal": "V8"
        }
    },
    "cagri_tipi": {
        "field": "callType",
        "options": {
            "telsiz": "B11",
            "telefon": "B12",
            "diger": "B13"
        }
    },
    "sonuc": {
        "field": "result",
        "options": {
            "yerinde_mudahale": "C25",
            "hastaneye_nakil": "C26",
            "hastaneler_arasi_nakil": "C27",
            "tibbi_tetkik_icin_nakil": "C28",
            "eve_nakil": "C29",
            "ex_terinde_birakildi": "E25",
            "ex_morga_nakil": "E26",
            "nakil_reddi": "E27",
            "diger_ulasilan": "E28",
            "gorev_iptali": "E29"
        }
    },
    "adli_vaka": {
        "field": "isJudicialCase",
        "options": {
            "evet": "R29",
            "hayir": "T29"
        }
    }
}


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
    
    return {
        "cell_mappings": sections,
        "checkbox_mappings": CHECKBOX_MAPPINGS,
        "total_cells": len(VAKA_FORM_CELL_MAPPING),
        "total_checkboxes": sum(len(m["options"]) for m in CHECKBOX_MAPPINGS.values())
    }

