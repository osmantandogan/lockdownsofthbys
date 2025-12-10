"""
Şablon Bazlı PDF Oluşturma Servisi
Kullanıcının oluşturduğu şablonlara göre PDF üretir.
"""
from reportlab.lib.pagesizes import A4, A5, letter
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.utils import simpleSplit
from io import BytesIO
import os
import logging
from datetime import datetime
import unicodedata

logger = logging.getLogger(__name__)

# Türkçe karakterleri ASCII'ye dönüştür (font sorunu için yedek)
def normalize_turkish(text):
    """Türkçe karakterleri ASCII karşılıklarına dönüştür"""
    if text is None:
        return ""
    
    text = str(text)
    
    # Türkçe karakter eşleştirmesi
    turkish_map = {
        'ş': 's', 'Ş': 'S',
        'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ü': 'u', 'Ü': 'U',
        'ç': 'c', 'Ç': 'C',
        # Ek karakterler
        'â': 'a', 'Â': 'A',
        'î': 'i', 'Î': 'I',
        'û': 'u', 'Û': 'U',
    }
    
    for tr_char, ascii_char in turkish_map.items():
        text = text.replace(tr_char, ascii_char)
    
    # Kalan non-ASCII karakterleri temizle
    result = ""
    for char in text:
        if ord(char) < 256:
            result += char
        else:
            result += "?"
    
    return result


def safe_text(text):
    """Metin için güvenli çıktı - normalize_turkish wrapper"""
    return normalize_turkish(text)

# Sayfa boyutları
PAGE_SIZES = {
    "A4": A4,
    "A5": A5,
    "Letter": letter
}

# Kutucuk tipinden veri çekme eşleştirmesi
BLOCK_DATA_MAPPING = {
    # === YILDIZLI BLOKLAR (Yeni Eklenen) ===
    "istasyon": {
        "protokol_112": lambda c, m: c.get("protocol_112", "") or m.get("protocol112", "") or "",
        "tarih": lambda c, m: c.get("created_at", "").strftime("%d.%m.%Y") if hasattr(c.get("created_at", ""), "strftime") else datetime.now().strftime("%d.%m.%Y"),
        "vaka_kodu": lambda c, m: c.get("case_number", "") or c.get("_id", "")[:8],
        "plaka": lambda c, m: c.get("vehicle_info", {}).get("plate", "") or c.get("vehicle", {}).get("plate", "") or "",
    },
    "saatler": {
        "cagri_saati": lambda c, m: m.get("callTime", "") or m.get("timestamps", {}).get("call", "") or "",
        "olay_yerine_varis": lambda c, m: m.get("arrivalScene", "") or m.get("timestamps", {}).get("scene", "") or "",
        "hastaya_varis": lambda c, m: m.get("arrivalPatient", "") or m.get("timestamps", {}).get("patient", "") or "",
        "olay_yerinden_ayrilis": lambda c, m: m.get("departureScene", "") or m.get("timestamps", {}).get("departure", "") or "",
        "hastaneye_varis": lambda c, m: m.get("arrivalHospital", "") or m.get("timestamps", {}).get("hospital", "") or "",
        "istasyona_donus": lambda c, m: m.get("returnStation", "") or m.get("timestamps", {}).get("return", "") or "",
    },
    "hasta_bilgileri_detayli": {
        "ad_soyad": lambda c, m: f"{c.get('patient', {}).get('name', '')} {c.get('patient', {}).get('surname', '')}".strip() or m.get("patientName", "") or "",
        "tc_kimlik": lambda c, m: c.get("patient", {}).get("tc_no", "") or m.get("tcNo", "") or "",
        "dogum_tarihi_yas": lambda c, m: f"{c.get('patient', {}).get('birth_date', '')} / {c.get('patient', {}).get('age', '')} yaş".strip(" /") or str(m.get("age", "")) or "",
        "cinsiyet": lambda c, m: c.get("patient", {}).get("gender", "") or m.get("gender", "") or "",
        "adres": lambda c, m: c.get("patient", {}).get("address", "") or m.get("address", "") or c.get("location", {}).get("address", "") or "",
        "telefon": lambda c, m: c.get("patient", {}).get("phone", "") or m.get("phone", "") or c.get("caller", {}).get("phone", "") or "",
    },
    "hasta_durumu": {
        "durum": lambda c, m: m.get("patient_status", "") or m.get("patientStatus", "") or m.get("status", "") or c.get("patient", {}).get("status", "") or "",
    },
    "kronik_hastaliklar": {
        "kronik": lambda c, m: m.get("chronicDiseases", "") or m.get("chronic_diseases", "") or c.get("patient", {}).get("chronic_diseases", "") or "",
    },
    "hasta_sikayeti": {
        "sikayet": lambda c, m: c.get("patient", {}).get("complaint", "") or m.get("complaint", "") or m.get("chief_complaint", "") or "",
    },
    # === YENİ FORMAT BLOCK TYPES ===
    "hasta_bilgileri": {
        "tc_no": lambda c, m: c.get("patient", {}).get("tc_no", "") or m.get("tcNo", ""),
        "ad": lambda c, m: c.get("patient", {}).get("name", "") or m.get("patientName", ""),
        "soyad": lambda c, m: c.get("patient", {}).get("surname", "") or m.get("patientSurname", ""),
        "yas": lambda c, m: str(c.get("patient", {}).get("age", "") or m.get("age", "") or ""),
        "dogum_tarihi": lambda c, m: c.get("patient", {}).get("birth_date", "") or m.get("birthDate", ""),
        "cinsiyet": lambda c, m: c.get("patient", {}).get("gender", "") or m.get("gender", ""),
    },
    "cagri_bilgileri": {
        "cagri_zamani": lambda c, m: c.get("created_at", "").strftime("%d.%m.%Y %H:%M") if hasattr(c.get("created_at", ""), "strftime") else "",
        "cagri_tipi": lambda c, m: c.get("call_type", "") or m.get("callType", ""),
        "cagri_nedeni": lambda c, m: c.get("call_reason", "") or m.get("callReason", "") or c.get("patient", {}).get("complaint", ""),
        "vakayi_veren": lambda c, m: c.get("caller", {}).get("company_name", "") or "",
    },
    "zaman_bilgileri": {
        "cagri_saati": lambda c, m: m.get("callTime", "") or m.get("timestamps", {}).get("call", ""),
        "olay_yerine_varis": lambda c, m: m.get("arrivalScene", "") or m.get("timestamps", {}).get("scene", ""),
        "hastaya_varis": lambda c, m: m.get("arrivalPatient", "") or m.get("timestamps", {}).get("patient", ""),
        "ayrilis": lambda c, m: m.get("departureScene", "") or m.get("timestamps", {}).get("departure", ""),
        "hastaneye_varis": lambda c, m: m.get("arrivalHospital", "") or m.get("timestamps", {}).get("hospital", ""),
        "istasyona_donus": lambda c, m: m.get("returnStation", "") or m.get("timestamps", {}).get("return", ""),
    },
    "vital_bulgular_1": {
        "saat": lambda c, m: m.get("vitalSigns", [{}])[0].get("time", "") if m.get("vitalSigns") else "",
        "tansiyon": lambda c, m: m.get("vitalSigns", [{}])[0].get("bp", "") if m.get("vitalSigns") else "",
        "nabiz": lambda c, m: str(m.get("vitalSigns", [{}])[0].get("pulse", "")) if m.get("vitalSigns") else "",
        "spo2": lambda c, m: str(m.get("vitalSigns", [{}])[0].get("spo2", "")) if m.get("vitalSigns") else "",
        "solunum": lambda c, m: str(m.get("vitalSigns", [{}])[0].get("respiration", "")) if m.get("vitalSigns") else "",
        "ates": lambda c, m: str(m.get("vitalSigns", [{}])[0].get("temp", "")) if m.get("vitalSigns") else "",
    },
    "vital_bulgular_2": {
        "saat": lambda c, m: m.get("vitalSigns", [{}, {}])[1].get("time", "") if len(m.get("vitalSigns", [])) > 1 else "",
        "tansiyon": lambda c, m: m.get("vitalSigns", [{}, {}])[1].get("bp", "") if len(m.get("vitalSigns", [])) > 1 else "",
        "nabiz": lambda c, m: str(m.get("vitalSigns", [{}, {}])[1].get("pulse", "")) if len(m.get("vitalSigns", [])) > 1 else "",
        "spo2": lambda c, m: str(m.get("vitalSigns", [{}, {}])[1].get("spo2", "")) if len(m.get("vitalSigns", [])) > 1 else "",
        "solunum": lambda c, m: str(m.get("vitalSigns", [{}, {}])[1].get("respiration", "")) if len(m.get("vitalSigns", [])) > 1 else "",
        "ates": lambda c, m: str(m.get("vitalSigns", [{}, {}])[1].get("temp", "")) if len(m.get("vitalSigns", [])) > 1 else "",
    },
    "vital_bulgular_3": {
        "saat": lambda c, m: m.get("vitalSigns", [{}, {}, {}])[2].get("time", "") if len(m.get("vitalSigns", [])) > 2 else "",
        "tansiyon": lambda c, m: m.get("vitalSigns", [{}, {}, {}])[2].get("bp", "") if len(m.get("vitalSigns", [])) > 2 else "",
        "nabiz": lambda c, m: str(m.get("vitalSigns", [{}, {}, {}])[2].get("pulse", "")) if len(m.get("vitalSigns", [])) > 2 else "",
        "spo2": lambda c, m: str(m.get("vitalSigns", [{}, {}, {}])[2].get("spo2", "")) if len(m.get("vitalSigns", [])) > 2 else "",
        "solunum": lambda c, m: str(m.get("vitalSigns", [{}, {}, {}])[2].get("respiration", "")) if len(m.get("vitalSigns", [])) > 2 else "",
        "ates": lambda c, m: str(m.get("vitalSigns", [{}, {}, {}])[2].get("temp", "")) if len(m.get("vitalSigns", [])) > 2 else "",
    },
    "klinik_gozlemler": {
        "bilinc": lambda c, m: m.get("clinical_observations", {}).get("consciousness", ""),
        "duygu": lambda c, m: m.get("clinical_observations", {}).get("mood", ""),
        "pupil": lambda c, m: m.get("clinical_observations", {}).get("pupil_response", ""),
        "cilt": lambda c, m: m.get("clinical_observations", {}).get("skin_status", ""),
        "solunum_tipi": lambda c, m: m.get("clinical_observations", {}).get("breathing_type", ""),
        "nabiz_tipi": lambda c, m: m.get("clinical_observations", {}).get("pulse_type", ""),
    },
    "gks_skorlari": {
        "motor": lambda c, m: str(m.get("clinical_observations", {}).get("motorResponse", "")),
        "verbal": lambda c, m: str(m.get("clinical_observations", {}).get("verbalResponse", "")),
        "goz": lambda c, m: str(m.get("clinical_observations", {}).get("eyeOpening", "")),
        "toplam": lambda c, m: str(m.get("clinical_observations", {}).get("gcs_total", "")),
    },
    "anamnez": {
        "sikayet": lambda c, m: c.get("patient", {}).get("complaint", "") or m.get("complaint", ""),
        "oyku": lambda c, m: m.get("anamnesis", "") or m.get("history", ""),
        "kronik": lambda c, m: m.get("chronicDiseases", "") or m.get("chronic_diseases", ""),
    },
    "fizik_muayene": {
        "muayene": lambda c, m: m.get("physical_exam", {}).get("general_status", "") or m.get("physicalExam", ""),
    },
    "uygulanan_islemler": {
        "maske": lambda c, m: "Evet" if m.get("procedures", {}).get("mask", False) else "",
        "airway": lambda c, m: "Evet" if m.get("procedures", {}).get("airway", False) else "",
        "entubasyon": lambda c, m: "Evet" if m.get("procedures", {}).get("intubation", False) else "",
        "lma": lambda c, m: "Evet" if m.get("procedures", {}).get("lma", False) else "",
        "cpr": lambda c, m: "Evet" if m.get("cpr_performed", False) else "",
        "defib": lambda c, m: "Evet" if m.get("procedures", {}).get("defibrillation", False) else "",
        "diger": lambda c, m: m.get("other_procedures", ""),
    },
    "cpr_bilgileri": {
        "uygulayan": lambda c, m: m.get("cpr_info", {}).get("performer", ""),
        "baslangic": lambda c, m: m.get("cpr_info", {}).get("start_time", ""),
        "bitis": lambda c, m: m.get("cpr_info", {}).get("end_time", ""),
        "neden": lambda c, m: m.get("cpr_info", {}).get("reason", ""),
    },
    "nakil_durumu": {
        "nakil_tipi": lambda c, m: m.get("transfer_type", "") or m.get("transferType", ""),
        "transfer_tipi": lambda c, m: m.get("extended_form", {}).get("outcome", ""),
    },
    "nakil_hastanesi": {
        "hastane": lambda c, m: m.get("transfer_hospital", {}).get("name", "") or m.get("transfer1", "") or m.get("transfer2", ""),
        "protokol": lambda c, m: m.get("hospital_protocol", "") or m.get("hospitalProtocol", ""),
    },
    "healmedy_lokasyonu": {
        "lokasyon": lambda c, m: c.get("healmedy_location", {}).get("name", "") or "",
    },
    "arac_bilgileri": {
        "plaka": lambda c, m: c.get("vehicle_info", {}).get("plate", "") or c.get("vehicle", {}).get("plate", ""),
        "baslangic_km": lambda c, m: str(c.get("vehicle_info", {}).get("start_km", "")),
        "bitis_km": lambda c, m: str(c.get("vehicle_info", {}).get("end_km", "")),
        "protokol_112": lambda c, m: c.get("protocol_112", "") or m.get("protocol112", ""),
    },
    "ekip_bilgileri": {
        "sofor": lambda c, m: c.get("team", {}).get("driver", {}).get("name", ""),
        "paramedik": lambda c, m: c.get("team", {}).get("paramedic", {}).get("name", ""),
        "att": lambda c, m: c.get("team", {}).get("att", {}).get("name", ""),
        "hemsire": lambda c, m: c.get("team", {}).get("nurse", {}).get("name", ""),
    },
    "kullanilan_ilaclar": {
        "ilac_adi": lambda c, m: format_medications(m.get("medications_used", [])),
        "doz": lambda c, m: "",
        "yol": lambda c, m: "",
        "saat": lambda c, m: "",
    },
    "kullanilan_malzemeler": {
        "malzeme": lambda c, m: format_materials(m.get("materials_used", [])),
    },
    "tani_icd10": {
        "icd_kod": lambda c, m: m.get("diagnosis", {}).get("icd_code", ""),
        "tani": lambda c, m: m.get("diagnosis", {}).get("description", ""),
    },
    "imza_hasta": {
        "ad_soyad": lambda c, m: m.get("inline_consents", {}).get("patient", {}).get("name", ""),
        "imza": lambda c, m: "[IMZA]",
    },
    "imza_doktor": {
        "ad_soyad": lambda c, m: m.get("inline_consents", {}).get("doctor", {}).get("name", ""),
        "imza": lambda c, m: "[IMZA]",
    },
    "imza_saglik_personeli": {
        "ad_soyad": lambda c, m: m.get("inline_consents", {}).get("health_personnel", {}).get("name", ""),
        "imza": lambda c, m: "[IMZA]",
    },
    "imza_sofor": {
        "ad_soyad": lambda c, m: m.get("inline_consents", {}).get("driver", {}).get("name", ""),
        "imza": lambda c, m: "[IMZA]",
    },
    "imza_teslim_alan": {
        "ad_soyad": lambda c, m: m.get("inline_consents", {}).get("receiver", {}).get("name", ""),
        "imza": lambda c, m: "[IMZA]",
    },
    "adli_vaka": {
        "adli": lambda c, m: "Evet" if m.get("is_forensic", False) or c.get("is_forensic", False) else "Hayir",
    },
    "vaka_sonucu": {
        "sonuc": lambda c, m: m.get("extended_form", {}).get("outcome", "") or m.get("outcome", ""),
    },
    "genel_notlar": {
        "notlar": lambda c, m: m.get("notes", "") or m.get("generalNotes", ""),
    },
    "logo_baslik": {
        "logo": lambda c, m: "",
        "baslik": lambda c, m: "AMBULANS VAKA FORMU",
        "alt_baslik": lambda c, m: "Healmedy Saglik Hizmetleri",
    },
    # === ESKİ FORMAT BLOCK TYPES (geriye uyumluluk) ===
    "hasta_zaman": {
        "case_number": lambda c, m: c.get("case_number", "") or m.get("healmedyProtocol", "") or c.get("_id", "")[:8],
        "case_date": lambda c, m: (
            c.get("created_at", "").strftime("%d.%m.%Y") if hasattr(c.get("created_at", ""), "strftime") 
            else (m.get("date", "") or datetime.now().strftime("%d.%m.%Y"))
        ),
        "case_time": lambda c, m: (
            c.get("created_at", "").strftime("%H:%M") if hasattr(c.get("created_at", ""), "strftime")
            else (m.get("callTime", "") or datetime.now().strftime("%H:%M"))
        ),
        "patient_name": lambda c, m: (
            f"{c.get('patient', {}).get('name', '')} {c.get('patient', {}).get('surname', '')}".strip() or
            m.get("patientName", "") or
            "Test Hasta"
        ),
        "patient_surname": lambda c, m: c.get("patient", {}).get("surname", "") or m.get("patientSurname", ""),
        "patient_tc": lambda c, m: c.get("patient", {}).get("tc_no", "") or m.get("tcNo", ""),
        "patient_age": lambda c, m: str(c.get("patient", {}).get("age", "") or m.get("age", "") or ""),
        "patient_gender": lambda c, m: c.get("patient", {}).get("gender", "") or m.get("gender", ""),
        "patient_phone": lambda c, m: c.get("patient", {}).get("phone", "") or m.get("phone", ""),
    },
    "tibbi_bilgiler": {
        "complaint": lambda c, m: (
            c.get("patient", {}).get("complaint", "") or 
            m.get("complaint", "") or
            "Göğüs ağrısı"
        ),
        "chronic_diseases": lambda c, m: (
            m.get("chronic_diseases", "") or 
            m.get("chronicDiseases", "") or
            "Hipertansiyon, Diyabet"
        ),
        "allergies": lambda c, m: m.get("allergies", "") or m.get("allergy", "") or "Penisilin",
        "medications": lambda c, m: m.get("current_medications", "") or m.get("medications", "") or "",
        "blood_type": lambda c, m: m.get("blood_type", "") or m.get("bloodType", "") or "",
    },
    "vitaller": {
        "blood_pressure": lambda c, m: (
            f"{m.get('vitals', {}).get('systolic', '')}/{m.get('vitals', {}).get('diastolic', '')}" or
            (m.get("vitalSigns", [{}])[0].get("bp", "") if m.get("vitalSigns") else "") or
            "120/80"
        ),
        "pulse": lambda c, m: (
            str(m.get("vitals", {}).get("pulse", "")) or
            (str(m.get("vitalSigns", [{}])[0].get("pulse", "")) if m.get("vitalSigns") else "") or
            "72"
        ),
        "spo2": lambda c, m: (
            str(m.get("vitals", {}).get("spo2", "")) or
            (str(m.get("vitalSigns", [{}])[0].get("spo2", "")) if m.get("vitalSigns") else "") or
            "98"
        ),
        "temperature": lambda c, m: (
            str(m.get("vitals", {}).get("temperature", "")) or
            (str(m.get("vitalSigns", [{}])[0].get("temp", "")) if m.get("vitalSigns") else "") or
            "36.5"
        ),
        "respiratory_rate": lambda c, m: (
            str(m.get("vitals", {}).get("respiratory_rate", "")) or
            (str(m.get("vitalSigns", [{}])[0].get("respiration", "")) if m.get("vitalSigns") else "") or
            "16"
        ),
        "blood_sugar": lambda c, m: str(m.get("vitals", {}).get("blood_sugar", "")),
        "gcs_total": lambda c, m: str(m.get("clinical_observations", {}).get("gcs_total", "")),
    },
    "nakil_hastanesi": {
        "hospital_name": lambda c, m: (
            m.get("transfer_hospital", {}).get("name", "") or
            m.get("transfer1", "") or
            m.get("transfer2", "") or
            "Test Hastanesi"
        ),
        "hospital_type": lambda c, m: m.get("transfer_hospital", {}).get("type", "") or "Devlet",
        "hospital_address": lambda c, m: m.get("transfer_hospital", {}).get("address", "") or "",
        "transfer_reason": lambda c, m: m.get("transfer_reason", "") or m.get("transferReason", "") or "",
    },
    "klinik_gozlemler": {
        "consciousness": lambda c, m: m.get("clinical_observations", {}).get("consciousness", ""),
        "pupil_response": lambda c, m: m.get("clinical_observations", {}).get("pupil_response", ""),
        "skin_status": lambda c, m: m.get("clinical_observations", {}).get("skin_status", ""),
        "motor_response": lambda c, m: str(m.get("clinical_observations", {}).get("motorResponse", "")),
        "verbal_response": lambda c, m: str(m.get("clinical_observations", {}).get("verbalResponse", "")),
        "eye_opening": lambda c, m: str(m.get("clinical_observations", {}).get("eyeOpening", "")),
    },
    "anamnez": {
        "anamnez_text": lambda c, m: m.get("anamnesis", ""),
        "history": lambda c, m: m.get("history", ""),
        "current_complaint": lambda c, m: m.get("current_complaint", ""),
    },
    "fizik_muayene": {
        "general_status": lambda c, m: m.get("physical_exam", {}).get("general_status", ""),
        "head_neck": lambda c, m: m.get("physical_exam", {}).get("head_neck", ""),
        "chest": lambda c, m: m.get("physical_exam", {}).get("chest", ""),
        "abdomen": lambda c, m: m.get("physical_exam", {}).get("abdomen", ""),
        "extremities": lambda c, m: m.get("physical_exam", {}).get("extremities", ""),
        "neurological": lambda c, m: m.get("physical_exam", {}).get("neurological", ""),
    },
    "uygulamalar": {
        "procedures_list": lambda c, m: ", ".join(m.get("procedures", [])) if m.get("procedures") else "",
        "iv_access": lambda c, m: m.get("iv_access", ""),
        "airway": lambda c, m: m.get("airway_management", ""),
        "cpr": lambda c, m: "Evet" if m.get("cpr_performed") else "Hayır",
        "other_procedures": lambda c, m: m.get("other_procedures", ""),
    },
    "genel_notlar": {
        "notes": lambda c, m: m.get("notes", ""),
        "special_notes": lambda c, m: m.get("special_notes", ""),
    },
    "ilaclar_malzemeler": {
        "medications_used": lambda c, m: format_medications(m.get("medications_used", [])),
        "materials_used": lambda c, m: format_materials(m.get("materials_used", [])),
        "quantities": lambda c, m: "",
    },
    "transfer_durumu": {
        "transfer_status": lambda c, m: m.get("extended_form", {}).get("outcome", ""),
        "transfer_time": lambda c, m: "",
        "arrival_time": lambda c, m: "",
        "outcome": lambda c, m: m.get("extended_form", {}).get("outcome", ""),
    },
    "tasit_protokol": {
        "vehicle_plate": lambda c, m: c.get("vehicle_info", {}).get("plate", ""),
        "vehicle_type": lambda c, m: c.get("vehicle_info", {}).get("type", ""),
        "protocol_number": lambda c, m: c.get("case_number", ""),
        "driver_name": lambda c, m: "",
        "team_members": lambda c, m: "",
    },
    "onam_bilgilendirme": {
        "consent_text": lambda c, m: "Hasta bilgilendirildi.",
        "patient_signature": lambda c, m: "[IMZA]",
        "consent_date": lambda c, m: datetime.now().strftime("%d.%m.%Y"),
    },
    "hastane_reddi": {
        "rejection_reason": lambda c, m: m.get("inline_consents", {}).get("hospital_rejection", {}).get("reason", ""),
        "hospital_signature": lambda c, m: "[IMZA]",
        "rejection_date": lambda c, m: datetime.now().strftime("%d.%m.%Y"),
    },
    "hasta_reddi": {
        "service_rejection_reason": lambda c, m: m.get("inline_consents", {}).get("patient_rejection", {}).get("reason", ""),
        "patient_rejection_signature": lambda c, m: "[IMZA]",
        "rejection_date": lambda c, m: datetime.now().strftime("%d.%m.%Y"),
    },
    "teslim_imzalar": {
        "receiver_name": lambda c, m: m.get("inline_consents", {}).get("handover", {}).get("receiver_name", ""),
        "receiver_signature": lambda c, m: "[IMZA]",
        "doctor_signature": lambda c, m: "[IMZA]",
        "paramedic_signature": lambda c, m: "[IMZA]",
        "driver_signature": lambda c, m: "[IMZA]",
    },
}


def format_medications(meds):
    """İlaç listesini formatla"""
    if not meds:
        return ""
    return "\n".join([f"• {m.get('name', '')} - {m.get('quantity', '')} {m.get('unit', '')}" for m in meds])


def format_materials(materials):
    """Malzeme listesini formatla"""
    if not materials:
        return ""
    return "\n".join([f"• {m.get('name', '')} x{m.get('quantity', 1)}" for m in materials])


def get_field_value(block_type, field_id, case_data, medical_form):
    """Kutucuk tipine göre alan değerini çek - örnek verilerle destekle"""
    mapping = BLOCK_DATA_MAPPING.get(block_type, {})
    getter = mapping.get(field_id)
    
    value = ""
    if getter:
        try:
            value = getter(case_data, medical_form)
        except Exception as e:
            logger.warning(f"Error getting field value: {block_type}.{field_id}: {e}")
            value = ""
    
    # Eğer değer boşsa, örnek veri göster (test amaçlı)
    if not value or value.strip() == "":
        # Örnek veriler
        sample_data = {
            "case_number": case_data.get("case_number", "20251210-000001"),
            "case_date": datetime.now().strftime("%d.%m.%Y"),
            "case_time": datetime.now().strftime("%H:%M"),
            "patient_name": "Test Hasta",
            "patient_surname": "Test Soyad",
            "patient_tc": "12345678901",
            "patient_age": "45",
            "patient_gender": "Erkek",
            "patient_phone": "05551234567",
            "complaint": "Göğüs ağrısı",
            "chronic_diseases": "Hipertansiyon, Diyabet",
            "allergies": "Penisilin",
            "blood_pressure": "120/80",
            "pulse": "72",
            "spo2": "98",
            "temperature": "36.5",
            "hospital_name": "Test Hastanesi",
            "hospital_type": "Devlet",
        }
        value = sample_data.get(field_id, "")
    
    return str(value) if value else ""


class TemplatePdfGenerator:
    """Şablon bazlı PDF oluşturucu"""
    
    def __init__(self, template, case_data, medical_form=None):
        self.template = template
        self.case_data = case_data
        self.medical_form = medical_form or {}
        
        # Sayfa boyutu
        page_size_name = template.get("page_size", "A4")
        self.page_size = PAGE_SIZES.get(page_size_name, A4)
        
        # Yönlendirme
        if template.get("orientation") == "landscape":
            self.page_size = (self.page_size[1], self.page_size[0])
        
        self.page_width, self.page_height = self.page_size
        self.page_count = template.get("page_count", 1)
        
        # Buffer
        self.buffer = BytesIO()
        self.canvas = canvas.Canvas(self.buffer, pagesize=self.page_size)
        
    def generate(self):
        """PDF oluştur ve buffer döndür"""
        
        blocks = self.template.get("blocks", [])
        header = self.template.get("header", {})
        footer = self.template.get("footer", {})
        
        for page_num in range(self.page_count):
            # Sayfadaki blokları filtrele
            page_blocks = [b for b in blocks if b.get("page", 0) == page_num]
            
            # Üst bilgi
            if header.get("enabled"):
                self._draw_header(header)
            
            # Blokları çiz
            for block in page_blocks:
                self._draw_block(block)
            
            # Alt bilgi
            if footer.get("enabled"):
                self._draw_footer(footer, page_num + 1)
            
            # Sonraki sayfa
            if page_num < self.page_count - 1:
                self.canvas.showPage()
        
        self.canvas.save()
        self.buffer.seek(0)
        return self.buffer
    
    def _draw_header(self, header):
        """Üst bilgi çiz"""
        height = header.get("height", 50)
        y = self.page_height - height
        
        # Arka plan
        self.canvas.setFillColor(colors.Color(0.95, 0.95, 0.95))
        self.canvas.rect(0, y, self.page_width, height, fill=True, stroke=False)
        
        # Metin
        text = header.get("text", "")
        if text:
            self.canvas.setFillColor(colors.black)
            self.canvas.setFont("Helvetica-Bold", 10)
            self.canvas.drawCentredString(self.page_width / 2, y + height / 2 - 5, normalize_turkish(text))
        
        # Logo (eğer varsa)
        logo = header.get("logo")
        if logo:
            # Base64 logo çizimi - sonra eklenebilir
            pass
    
    def _draw_footer(self, footer, page_num):
        """Alt bilgi çiz"""
        height = footer.get("height", 40)
        
        # Arka plan
        self.canvas.setFillColor(colors.Color(0.95, 0.95, 0.95))
        self.canvas.rect(0, 0, self.page_width, height, fill=True, stroke=False)
        
        # Metin
        text = footer.get("text", "")
        if text:
            self.canvas.setFillColor(colors.black)
            self.canvas.setFont("Helvetica", 8)
            self.canvas.drawCentredString(self.page_width / 2, height / 2 - 3, normalize_turkish(text))
        
        # Sayfa numarası
        if footer.get("show_page_number"):
            format_str = footer.get("page_number_format", "Sayfa {current}/{total}")
            page_text = format_str.replace("{current}", str(page_num)).replace("{total}", str(self.page_count))
            self.canvas.drawRightString(self.page_width - 20, height / 2 - 3, normalize_turkish(page_text))
    
    def _draw_block(self, block):
        """Kutucuğu çiz"""
        block_type = block.get("block_type", "")
        x = block.get("x", 0)
        y_from_top = block.get("y", 0)
        width = block.get("width", 200)
        height = block.get("height", 100)
        
        # ReportLab Y koordinatı alttan başlar, dönüştür
        y = self.page_height - y_from_top - height
        
        # Çerçeve
        if block.get("show_border", True):
            self.canvas.setStrokeColor(colors.Color(0.8, 0.8, 0.8))
            self.canvas.setLineWidth(0.5)
            self.canvas.rect(x, y, width, height, fill=False, stroke=True)
        
        # Arka plan
        bg_color = block.get("background_color")
        if bg_color:
            try:
                # Hex renk
                if bg_color.startswith("#"):
                    r = int(bg_color[1:3], 16) / 255
                    g = int(bg_color[3:5], 16) / 255
                    b = int(bg_color[5:7], 16) / 255
                    self.canvas.setFillColor(colors.Color(r, g, b))
                    self.canvas.rect(x, y, width, height, fill=True, stroke=False)
            except:
                pass
        
        # Başlık
        title_height = 0
        if block.get("show_title", True):
            title = normalize_turkish(block.get("title", ""))
            title_height = 15
            
            # Başlık arka planı
            self.canvas.setFillColor(colors.Color(0.9, 0.9, 0.9))
            self.canvas.rect(x, y + height - title_height, width, title_height, fill=True, stroke=False)
            
            # Başlık metni
            self.canvas.setFillColor(colors.black)
            self.canvas.setFont("Helvetica-Bold", 9)
            self.canvas.drawString(x + 5, y + height - title_height + 4, title)
        
        # İçerik
        content_y = y + height - title_height - 5
        content_height = height - title_height - 10
        
        fields = block.get("fields", [])
        visible_fields = [f for f in fields if f.get("visible", True)]
        
        # Sıralı alanları yazdır
        visible_fields.sort(key=lambda f: f.get("order", 0))
        
        font_size = block.get("font_size", 8)  # Biraz küçült
        self.canvas.setFont("Helvetica", font_size)
        self.canvas.setFillColor(colors.black)
        
        line_height = font_size + 2  # Daha kompakt
        current_y = content_y
        available_width = width - 10  # Sol ve sağ padding
        
        for field in visible_fields:
            # Alt sınır kontrolü
            if current_y < y + 5:
                break
            
            field_id = field.get("field_id", "")
            label = normalize_turkish(field.get("label", field_id))
            value = normalize_turkish(get_field_value(block_type, field_id, self.case_data, self.medical_form))
            
            # Label: Value formatında yazdır
            if value and value.strip():
                text = f"{label}: {value}"
            else:
                text = f"{label}: -"
            
            # Metni çok satırlı yap (wrap)
            try:
                # Metni satırlara böl
                lines = simpleSplit(text, "Helvetica", font_size, available_width)
                
                # Her satırı yazdır
                for line in lines:
                    if current_y < y + 5:
                        break
                    self.canvas.drawString(x + 5, current_y, line)
                    current_y -= line_height
                    
                    # Çok fazla satır varsa dur
                    if current_y < y + 10:
                        break
            except Exception as e:
                # Fallback: basit kırpma
                logger.warning(f"Text wrapping error: {e}")
                max_chars = int(available_width / (font_size * 0.5))
                if len(text) > max_chars:
                    text = text[:max_chars-3] + "..."
                self.canvas.drawString(x + 5, current_y, text)
                current_y -= line_height
            
            # Alanlar arası boşluk
            current_y -= 1
        
        # Özel içerik (metin bloğu için)
        if block_type == "metin":
            custom_text = normalize_turkish(block.get("custom_content", ""))
            if custom_text:
                self.canvas.drawString(x + 5, content_y, custom_text[:50])


def generate_table_pdf(template, case_data, medical_form=None):
    """Tablo şablonundan PDF oluştur"""
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=30, bottomMargin=30)
    
    cells = template.get("cells", [])
    rows = template.get("rows", 10)
    cols = template.get("columns", 6)
    
    # Tablo verisi oluştur
    table_data = [['' for _ in range(cols)] for _ in range(rows)]
    
    # Her hücreyi doldur
    for cell in cells:
        row = cell.get("row", 0)
        col = cell.get("col", 0)
        content_block = cell.get("content_block", {})
        
        if row < rows and col < cols and content_block:
            block_id = content_block.get("id", "")
            block_name = content_block.get("name", "")
            
            # Block verilerini al
            mapping = BLOCK_DATA_MAPPING.get(block_id, {})
            values = []
            for field_id, getter in mapping.items():
                try:
                    val = getter(case_data, medical_form or {})
                    if val:
                        values.append(str(val))
                except:
                    pass
            
            if values:
                table_data[row][col] = normalize_turkish("\n".join(values[:3]))
            else:
                table_data[row][col] = normalize_turkish(block_name)
    
    # Tablo oluştur
    col_width = 500 / cols
    table = Table(table_data, colWidths=[col_width] * cols)
    table.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    doc.build([table])
    buffer.seek(0)
    return buffer


def generate_pdf_from_template(template, case_data, medical_form=None):
    """Şablondan PDF oluştur - hem PDF hem Tablo şablonlarını destekler"""
    
    # Tablo şablonu mı?
    template_type = template.get("template_type", "pdf")
    if template_type == "table" or template.get("cells"):
        return generate_table_pdf(template, case_data, medical_form)
    
    # Template içindeki tüm metinleri normalize et
    def deep_normalize(obj):
        """Nested dict/list içindeki tüm stringleri normalize et"""
        if isinstance(obj, str):
            return normalize_turkish(obj)
        elif isinstance(obj, dict):
            return {k: deep_normalize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [deep_normalize(item) for item in obj]
        else:
            return obj
    
    # Template ve verileri normalize et
    normalized_template = deep_normalize(template)
    normalized_case = deep_normalize(case_data)
    normalized_medical = deep_normalize(medical_form) if medical_form else {}
    
    generator = TemplatePdfGenerator(normalized_template, normalized_case, normalized_medical)
    return generator.generate()

