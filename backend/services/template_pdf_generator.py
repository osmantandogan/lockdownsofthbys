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
    "hasta_zaman": {
        "case_number": lambda c, m: c.get("case_number", ""),
        "case_date": lambda c, m: c.get("created_at", "").strftime("%d.%m.%Y") if c.get("created_at") else "",
        "case_time": lambda c, m: c.get("created_at", "").strftime("%H:%M") if c.get("created_at") else "",
        "patient_name": lambda c, m: c.get("patient", {}).get("name", ""),
        "patient_surname": lambda c, m: c.get("patient", {}).get("surname", ""),
        "patient_tc": lambda c, m: c.get("patient", {}).get("tc_no", ""),
        "patient_age": lambda c, m: str(c.get("patient", {}).get("age", "")),
        "patient_gender": lambda c, m: c.get("patient", {}).get("gender", ""),
        "patient_phone": lambda c, m: c.get("patient", {}).get("phone", ""),
    },
    "tibbi_bilgiler": {
        "complaint": lambda c, m: c.get("patient", {}).get("complaint", ""),
        "chronic_diseases": lambda c, m: m.get("chronic_diseases", ""),
        "allergies": lambda c, m: m.get("allergies", ""),
        "medications": lambda c, m: m.get("current_medications", ""),
        "blood_type": lambda c, m: m.get("blood_type", ""),
    },
    "vitaller": {
        "blood_pressure": lambda c, m: f"{m.get('vitals', {}).get('systolic', '')}/{m.get('vitals', {}).get('diastolic', '')}",
        "pulse": lambda c, m: str(m.get("vitals", {}).get("pulse", "")),
        "spo2": lambda c, m: str(m.get("vitals", {}).get("spo2", "")),
        "temperature": lambda c, m: str(m.get("vitals", {}).get("temperature", "")),
        "respiratory_rate": lambda c, m: str(m.get("vitals", {}).get("respiratory_rate", "")),
        "blood_sugar": lambda c, m: str(m.get("vitals", {}).get("blood_sugar", "")),
        "gcs_total": lambda c, m: str(m.get("clinical_observations", {}).get("gcs_total", "")),
    },
    "nakil_hastanesi": {
        "hospital_name": lambda c, m: m.get("transfer_hospital", {}).get("name", ""),
        "hospital_type": lambda c, m: m.get("transfer_hospital", {}).get("type", ""),
        "hospital_address": lambda c, m: "",
        "transfer_reason": lambda c, m: m.get("transfer_reason", ""),
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
    """Kutucuk tipine göre alan değerini çek"""
    mapping = BLOCK_DATA_MAPPING.get(block_type, {})
    getter = mapping.get(field_id)
    if getter:
        try:
            return getter(case_data, medical_form)
        except Exception as e:
            logger.warning(f"Error getting field value: {block_type}.{field_id}: {e}")
            return ""
    return ""


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
        
        font_size = block.get("font_size", 9)
        self.canvas.setFont("Helvetica", font_size)
        self.canvas.setFillColor(colors.black)
        
        line_height = font_size + 3
        current_y = content_y
        
        for field in visible_fields:
            if current_y < y + 5:
                # İçerik taştı - "..." ekle
                self.canvas.drawString(x + 5, y + 5, "...")
                break
            
            field_id = field.get("field_id", "")
            label = normalize_turkish(field.get("label", field_id))
            value = normalize_turkish(get_field_value(block_type, field_id, self.case_data, self.medical_form))
            
            # Label: Value formatında yazdır
            text = f"{label}: {value}" if value else f"{label}:"
            
            # Metni kırp (genişliğe sığmazsa)
            max_chars = int((width - 10) / (font_size * 0.5))
            if len(text) > max_chars:
                text = text[:max_chars-3] + "..."
            
            self.canvas.drawString(x + 5, current_y, text)
            current_y -= line_height
        
        # Özel içerik (metin bloğu için)
        if block_type == "metin":
            custom_text = normalize_turkish(block.get("custom_content", ""))
            if custom_text:
                self.canvas.drawString(x + 5, content_y, custom_text[:50])


def generate_pdf_from_template(template, case_data, medical_form=None):
    """Şablondan PDF oluştur"""
    generator = TemplatePdfGenerator(template, case_data, medical_form)
    return generator.generate()

