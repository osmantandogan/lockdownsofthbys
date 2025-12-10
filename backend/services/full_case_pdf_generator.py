"""
Tam Vaka PDF Oluşturma Servisi
Vakadaki TÜM verileri sabit formatta A4 PDF'e döker.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Table, TableStyle
from reportlab.lib.utils import simpleSplit
from io import BytesIO
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Türkçe karakterleri ASCII'ye dönüştür
def normalize_turkish(text):
    if text is None:
        return ""
    text = str(text)
    turkish_map = {
        'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
        'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
        'ü': 'u', 'Ü': 'U', 'ç': 'c', 'Ç': 'C',
        'â': 'a', 'Â': 'A', 'î': 'i', 'Î': 'I', 'û': 'u', 'Û': 'U',
    }
    for tr_char, ascii_char in turkish_map.items():
        text = text.replace(tr_char, ascii_char)
    result = ""
    for char in text:
        if ord(char) < 256:
            result += char
        else:
            result += "?"
    return result


def safe_get(obj, *keys, default=""):
    """Nested dictionary'den güvenli değer al"""
    if obj is None:
        return default
    current = obj
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key, default)
        else:
            return default
        if current is None:
            return default
    if isinstance(current, dict):
        return str(current) if current else default
    if isinstance(current, list):
        return ", ".join(str(v) for v in current) if current else default
    return str(current) if current else default


def format_datetime(dt):
    """Datetime'ı formatla"""
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        return dt.strftime("%d.%m.%Y %H:%M")
    if isinstance(dt, str):
        return dt
    return str(dt)


def generate_full_case_pdf(case_data, medical_form):
    """Vakadaki TÜM verileri içeren PDF oluştur"""
    
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Sayfa marjları
    margin_left = 30
    margin_right = 30
    margin_top = 40
    margin_bottom = 40
    content_width = width - margin_left - margin_right
    
    current_y = height - margin_top
    page_num = 1
    
    def new_page():
        nonlocal current_y, page_num
        # Sayfa numarası
        c.setFont("Helvetica", 8)
        c.drawRightString(width - margin_right, 20, f"Sayfa {page_num}")
        c.showPage()
        page_num += 1
        current_y = height - margin_top
        draw_header()
    
    def check_space(needed):
        nonlocal current_y
        if current_y - needed < margin_bottom:
            new_page()
    
    def draw_header():
        nonlocal current_y
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(width/2, current_y, normalize_turkish("AMBULANS VAKA FORMU"))
        current_y -= 20
        c.setFont("Helvetica", 9)
        c.drawCentredString(width/2, current_y, normalize_turkish("Healmedy Saglik Hizmetleri"))
        current_y -= 25
    
    def draw_section_title(title):
        nonlocal current_y
        check_space(25)
        c.setFillColor(colors.Color(0.2, 0.2, 0.6))
        c.rect(margin_left, current_y - 5, content_width, 18, fill=True, stroke=False)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin_left + 5, current_y, normalize_turkish(title))
        c.setFillColor(colors.black)
        current_y -= 22
    
    def draw_field(label, value, half_width=False):
        nonlocal current_y
        check_space(15)
        c.setFont("Helvetica-Bold", 8)
        label_text = normalize_turkish(f"{label}:")
        c.drawString(margin_left + 5, current_y, label_text)
        
        c.setFont("Helvetica", 8)
        value_text = normalize_turkish(str(value) if value else "-")
        
        # Değeri label'dan sonra yaz
        label_width = c.stringWidth(label_text, "Helvetica-Bold", 8) + 5
        max_value_width = (content_width / 2 if half_width else content_width) - label_width - 15
        
        # Uzun metinleri sar
        if c.stringWidth(value_text, "Helvetica", 8) > max_value_width:
            lines = simpleSplit(value_text, "Helvetica", 8, max_value_width)
            for i, line in enumerate(lines[:3]):  # Max 3 satır
                c.drawString(margin_left + 5 + label_width, current_y - (i * 10), line)
            current_y -= (min(len(lines), 3) * 10) + 5
        else:
            c.drawString(margin_left + 5 + label_width, current_y, value_text)
            current_y -= 12
    
    def draw_two_columns(fields):
        """İki sütunlu alan çiz"""
        nonlocal current_y
        col_width = content_width / 2
        start_y = current_y
        
        for i, (label, value) in enumerate(fields):
            check_space(15)
            col = i % 2
            x = margin_left + (col * col_width)
            
            if col == 0:
                start_y = current_y
            
            c.setFont("Helvetica-Bold", 8)
            label_text = normalize_turkish(f"{label}:")
            c.drawString(x + 5, current_y if col == 0 else start_y, label_text)
            
            c.setFont("Helvetica", 8)
            value_text = normalize_turkish(str(value) if value else "-")[:40]
            label_w = c.stringWidth(label_text, "Helvetica-Bold", 8) + 3
            c.drawString(x + 5 + label_w, current_y if col == 0 else start_y, value_text)
            
            if col == 1:
                current_y -= 12
        
        if len(fields) % 2 == 1:
            current_y -= 12
    
    # ============ PDF İÇERİĞİ ============
    
    draw_header()
    
    # 1. İSTASYON BİLGİLERİ
    draw_section_title("1. ISTASYON BILGILERI")
    draw_two_columns([
        ("Vaka Kodu", safe_get(case_data, "case_number")),
        ("Tarih", format_datetime(safe_get(case_data, "created_at"))),
        ("112 Protokol No", safe_get(case_data, "protocol_112") or safe_get(medical_form, "protocol112")),
        ("Plaka", safe_get(case_data, "vehicle_info", "plate") or safe_get(case_data, "vehicle", "plate")),
    ])
    
    # 2. SAATLER
    draw_section_title("2. SAATLER")
    draw_two_columns([
        ("Cagri Saati", safe_get(medical_form, "callTime") or safe_get(medical_form, "timestamps", "call")),
        ("Olay Yerine Varis", safe_get(medical_form, "arrivalTime") or safe_get(medical_form, "arrivalScene") or safe_get(medical_form, "timestamps", "scene")),
        ("Olay Yerinden Ayrilis", safe_get(medical_form, "departureTime") or safe_get(medical_form, "departureScene") or safe_get(medical_form, "timestamps", "departure")),
        ("Hastaneye Varis", safe_get(medical_form, "hospitalArrivalTime") or safe_get(medical_form, "arrivalHospital") or safe_get(medical_form, "timestamps", "hospital")),
        ("Istasyona Donus", safe_get(medical_form, "returnStation") or safe_get(medical_form, "timestamps", "return")),
        ("Bekleme Suresi", f"{safe_get(medical_form, 'waitHours') or '0'} saat {safe_get(medical_form, 'waitMinutes') or '0'} dk"),
    ])
    
    # 3. HASTA BİLGİLERİ
    draw_section_title("3. HASTA BILGILERI")
    patient = case_data.get("patient", {}) or {}
    caller = case_data.get("caller", {}) or {}
    location = case_data.get("location", {}) or {}
    
    draw_two_columns([
        ("Adi Soyadi", f"{safe_get(patient, 'name')} {safe_get(patient, 'surname')}".strip() or safe_get(medical_form, "patientName")),
        ("T.C. Kimlik No", safe_get(patient, "tc_no") or safe_get(medical_form, "tcNo")),
        ("Dogum Tarihi", safe_get(patient, "birth_date") or safe_get(medical_form, "birthDate")),
        ("Yas", safe_get(patient, "age") or safe_get(medical_form, "age")),
        ("Cinsiyet", safe_get(patient, "gender") or safe_get(medical_form, "gender")),
        ("Telefon", safe_get(patient, "phone") or safe_get(caller, "phone") or safe_get(medical_form, "phone")),
        ("Durumu", safe_get(patient, "status") or safe_get(medical_form, "patientStatus")),
    ])
    
    draw_field("Adres", safe_get(patient, "address") or safe_get(location, "address") or safe_get(medical_form, "address"))
    
    # 4. ÇAĞRI BİLGİLERİ
    draw_section_title("4. CAGRI BILGILERI")
    draw_two_columns([
        ("Arayan Kisi", safe_get(caller, "name")),
        ("Arayan Telefon", safe_get(caller, "phone")),
        ("Firma/Kurum", safe_get(caller, "company_name")),
        ("Cagri Tipi", safe_get(case_data, "call_type") or safe_get(medical_form, "callType")),
    ])
    draw_field("Sikayet/Aciklama", safe_get(patient, "complaint") or safe_get(medical_form, "complaint"))
    
    # 5. KONUM BİLGİLERİ
    draw_section_title("5. KONUM BILGILERI")
    draw_two_columns([
        ("Il", safe_get(location, "city")),
        ("Ilce", safe_get(location, "district")),
        ("Mahalle", safe_get(location, "neighborhood")),
    ])
    draw_field("Tam Adres", safe_get(location, "address"))
    if safe_get(location, "lat") and safe_get(location, "lng"):
        draw_field("Koordinat", f"{safe_get(location, 'lat')}, {safe_get(location, 'lng')}")
    
    # 6. VİTAL BULGULAR
    draw_section_title("6. VITAL BULGULAR")
    vital_signs = medical_form.get("vitalSigns", []) or []
    vitals = medical_form.get("vitals", {}) or {}
    
    if vital_signs:
        for i, vs in enumerate(vital_signs[:3]):
            if isinstance(vs, dict):
                draw_two_columns([
                    (f"{i+1}. Olcum Saati", safe_get(vs, "time")),
                    ("Tansiyon", safe_get(vs, "bp")),
                    ("Nabiz", safe_get(vs, "pulse")),
                    ("SpO2", safe_get(vs, "spo2")),
                    ("Solunum", safe_get(vs, "respiration")),
                    ("Ates", safe_get(vs, "temp")),
                ])
    elif vitals:
        draw_two_columns([
            ("Tansiyon", f"{safe_get(vitals, 'systolic')}/{safe_get(vitals, 'diastolic')}"),
            ("Nabiz", safe_get(vitals, "pulse")),
            ("SpO2", safe_get(vitals, "spo2")),
            ("Solunum", safe_get(vitals, "respiratory_rate")),
            ("Ates", safe_get(vitals, "temperature")),
            ("Kan Sekeri", safe_get(vitals, "blood_sugar")),
        ])
    else:
        draw_field("Vital Bulgu", "Kaydedilmemis")
    
    # 7. KLİNİK GÖZLEMLER
    draw_section_title("7. KLINIK GOZLEMLER")
    clinical = medical_form.get("clinical_observations", {}) or {}
    
    # Bilinç durumu - hem eski hem yeni field'lara bak
    consciousness = safe_get(clinical, "consciousness") or safe_get(medical_form, "consciousStatus")
    if consciousness is True:
        consciousness = "Açık"
    elif consciousness is False:
        consciousness = "Kapalı"
    
    draw_two_columns([
        ("Bilinc Durumu", consciousness),
        ("Pupil", safe_get(clinical, "pupil_response") or safe_get(medical_form, "pupils")),
        ("Cilt", safe_get(clinical, "skin_status") or safe_get(medical_form, "skin")),
        ("Solunum Tipi", safe_get(clinical, "breathing_type") or safe_get(medical_form, "respiration")),
        ("Nabiz Tipi", safe_get(clinical, "pulse_type") or safe_get(medical_form, "pulse")),
        ("Duygusal Durum", safe_get(medical_form, "emotionalState")),
    ])
    
    # GKS - hem gcs objesi hem doğrudan field'lara bak
    gcs = medical_form.get("gcs", {}) or {}
    motor = safe_get(gcs, "motorResponse") or safe_get(clinical, "motorResponse") or safe_get(medical_form, "motorResponse")
    verbal = safe_get(gcs, "verbalResponse") or safe_get(clinical, "verbalResponse") or safe_get(medical_form, "verbalResponse")
    eye = safe_get(gcs, "eyeOpening") or safe_get(clinical, "eyeOpening") or safe_get(medical_form, "eyeOpening")
    gks_total = safe_get(clinical, "gcs_total")
    if motor or verbal or eye or gks_total:
        draw_two_columns([
            ("GKS Motor", motor),
            ("GKS Verbal", verbal),
            ("GKS Goz", eye),
            ("GKS Toplam", gks_total),
        ])
    
    # 8. ANAMNEZ
    draw_section_title("8. ANAMNEZ")
    draw_field("Sikayet", safe_get(patient, "complaint") or safe_get(medical_form, "complaint"))
    draw_field("Oyku", safe_get(medical_form, "anamnesis") or safe_get(medical_form, "history"))
    draw_field("Kronik Hastaliklar", safe_get(medical_form, "chronicDiseases") or safe_get(medical_form, "chronic_diseases"))
    draw_field("Alerjiler", safe_get(medical_form, "allergies"))
    draw_field("Mevcut Ilaclar", safe_get(medical_form, "current_medications"))
    
    # 9. FİZİK MUAYENE
    draw_section_title("9. FIZIK MUAYENE")
    physical = medical_form.get("physical_exam", {}) or {}
    if physical:
        draw_field("Genel Durum", safe_get(physical, "general_status"))
        draw_field("Bas-Boyun", safe_get(physical, "head_neck"))
        draw_field("Gogus", safe_get(physical, "chest"))
        draw_field("Karin", safe_get(physical, "abdomen"))
        draw_field("Ekstremite", safe_get(physical, "extremities"))
        draw_field("Norolojik", safe_get(physical, "neurological"))
    else:
        draw_field("Fizik Muayene", safe_get(medical_form, "physicalExam") or "Kaydedilmemis")
    
    # 10. UYGULANAN İŞLEMLER
    draw_section_title("10. UYGULANAN ISLEMLER")
    procedures = medical_form.get("procedures", [])
    if isinstance(procedures, list) and procedures:
        draw_field("Islemler", ", ".join(str(p) for p in procedures))
    elif isinstance(procedures, dict):
        for key, val in procedures.items():
            if val:
                draw_field(key.replace("_", " ").title(), str(val))
    
    draw_field("Damar Yolu", safe_get(medical_form, "iv_access"))
    draw_field("Hava Yolu", safe_get(medical_form, "airway_management"))
    draw_field("Uygulamalar", safe_get(medical_form, "applications"))
    
    # CPR bilgileri - hem cpr objesi hem doğrudan field'lara bak
    cpr = medical_form.get("cpr", {}) or {}
    cpr_by = safe_get(cpr, "by") or safe_get(medical_form, "cprBy")
    cpr_start = safe_get(cpr, "start") or safe_get(medical_form, "cprStart")
    cpr_end = safe_get(cpr, "end") or safe_get(medical_form, "cprEnd")
    cpr_reason = safe_get(cpr, "reason") or safe_get(medical_form, "cprReason")
    
    if cpr_by or cpr_start or cpr_end or cpr_reason:
        draw_field("CPR", "Evet")
        draw_two_columns([
            ("CPR Yapan", cpr_by),
            ("CPR Baslangic", cpr_start),
            ("CPR Bitis", cpr_end),
            ("CPR Sonuc", cpr_reason),
        ])
    else:
        draw_field("CPR", "Yapilmadi")
    
    draw_field("Diger Islemler", safe_get(medical_form, "other_procedures"))
    
    # 11. KULLANILAN İLAÇLAR
    draw_section_title("11. KULLANILAN ILACLAR")
    medications = medical_form.get("medications_used", []) or []
    if medications:
        for med in medications[:10]:
            if isinstance(med, dict):
                med_text = f"{safe_get(med, 'name')} - {safe_get(med, 'quantity')} {safe_get(med, 'unit')}"
                draw_field("Ilac", med_text)
            else:
                draw_field("Ilac", str(med))
    else:
        draw_field("Ilac", "Kullanilmadi")
    
    # 12. KULLANILAN MALZEMELER
    draw_section_title("12. KULLANILAN MALZEMELER")
    materials = medical_form.get("materials_used", []) or []
    if materials:
        for mat in materials[:10]:
            if isinstance(mat, dict):
                mat_text = f"{safe_get(mat, 'name')} x{safe_get(mat, 'quantity', '1')}"
                draw_field("Malzeme", mat_text)
            else:
                draw_field("Malzeme", str(mat))
    else:
        draw_field("Malzeme", "Kullanilmadi")
    
    # 13. NAKİL BİLGİLERİ
    draw_section_title("13. NAKIL BILGILERI")
    transfer = medical_form.get("transfer_hospital", {}) or {}
    draw_two_columns([
        ("Nakil Tipi", safe_get(medical_form, "transfer_type") or safe_get(medical_form, "transferType")),
        ("Sonuc", safe_get(medical_form, "extended_form", "outcome") or safe_get(medical_form, "outcome")),
        ("Hastane 1", safe_get(transfer, "name") or safe_get(medical_form, "transfer1")),
        ("Hastane 2", safe_get(medical_form, "transfer2")),
        ("Hastane Protokol", safe_get(medical_form, "hospital_protocol") or safe_get(medical_form, "hospitalProtocol")),
    ])
    
    # 14. ARAÇ VE EKİP BİLGİLERİ
    draw_section_title("14. ARAC VE EKIP BILGILERI")
    vehicle = case_data.get("vehicle_info", {}) or case_data.get("vehicle", {}) or {}
    team = case_data.get("team", {}) or {}
    
    draw_two_columns([
        ("Plaka", safe_get(vehicle, "plate") or safe_get(medical_form, "vehicleType")),
        ("Arac Tipi", safe_get(vehicle, "type")),
        ("Baslangic KM", safe_get(vehicle, "start_km") or safe_get(medical_form, "startKm")),
        ("Bitis KM", safe_get(vehicle, "end_km") or safe_get(medical_form, "endKm")),
        ("Kurum", safe_get(medical_form, "institution")),
        ("Gidis-Donus", safe_get(medical_form, "roundTrip")),
    ])
    
    draw_two_columns([
        ("Sofor", safe_get(team, "driver", "name")),
        ("Paramedik", safe_get(team, "paramedic", "name")),
        ("ATT", safe_get(team, "att", "name")),
        ("Hemsire", safe_get(team, "nurse", "name")),
        ("Doktor", safe_get(team, "doctor", "name")),
    ])
    
    # 14.5 REFAKATÇI BİLGİLERİ
    companions = safe_get(medical_form, "companions")
    if companions:
        draw_section_title("14.5 REFAKATCI BILGILERI")
        draw_field("Refakatci", companions)
    
    # 14.6 İZOLASYON
    isolation = medical_form.get("isolation", [])
    if isolation:
        if isinstance(isolation, list):
            draw_section_title("14.6 IZOLASYON")
            draw_field("Izolasyon Onlemleri", ", ".join(str(i) for i in isolation))
    
    # 15. GENEL NOTLAR
    draw_section_title("15. GENEL NOTLAR")
    draw_field("Notlar", safe_get(medical_form, "notes") or safe_get(medical_form, "generalNotes") or "Yok")
    
    # 16. ONAM FORMLARI
    draw_section_title("16. ONAM FORMLARI")
    inline_consents = medical_form.get("inline_consents", {}) or {}
    
    # Hasta bilgilendirme
    patient_info_consent = inline_consents.get("patient_info", {})
    if patient_info_consent:
        draw_field("Hasta Bilgilendirme", "Onaylandi" if patient_info_consent.get("approved") else "Onaylanmadi")
    
    # Hastane reddi
    hospital_rejection = inline_consents.get("hospital_rejection", {})
    if hospital_rejection and hospital_rejection.get("reason"):
        draw_field("Hastane Reddi", safe_get(hospital_rejection, "reason"))
        draw_field("Hastane", safe_get(hospital_rejection, "hospital_name"))
    
    # Hasta reddi
    patient_rejection = inline_consents.get("patient_rejection", {})
    if patient_rejection and patient_rejection.get("reason"):
        draw_field("Hasta Hizmet Reddi", safe_get(patient_rejection, "reason"))
    
    # Teslim imzaları
    handover = inline_consents.get("handover", {})
    if handover:
        draw_field("Teslim Alan", safe_get(handover, "receiver_name"))
    
    # 17. VAKA DURUMU
    draw_section_title("17. VAKA DURUMU")
    draw_two_columns([
        ("Durum", safe_get(case_data, "status")),
        ("Olusturulma", format_datetime(safe_get(case_data, "created_at"))),
        ("Son Guncelleme", format_datetime(safe_get(case_data, "updated_at"))),
        ("Olusturan", safe_get(case_data, "created_by_name")),
    ])
    
    # Son sayfa numarası
    c.setFont("Helvetica", 8)
    c.drawRightString(width - margin_right, 20, f"Sayfa {page_num}")
    
    # İmza alanları
    check_space(60)
    current_y -= 20
    c.setFont("Helvetica", 8)
    sig_width = content_width / 4
    
    sig_labels = ["Hasta/Yakini", "Hekim/Paramedik", "Saglik Personeli", "Sofor"]
    for i, label in enumerate(sig_labels):
        x = margin_left + (i * sig_width)
        c.drawCentredString(x + sig_width/2, current_y, normalize_turkish(label))
        c.line(x + 10, current_y - 30, x + sig_width - 10, current_y - 30)
        c.drawCentredString(x + sig_width/2, current_y - 40, "Imza")
    
    c.save()
    buffer.seek(0)
    return buffer

