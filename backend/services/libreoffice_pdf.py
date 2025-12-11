#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LibreOffice-based Excel to PDF Generator
Uses LibreOffice headless to convert Excel files to PDF with perfect formatting
"""

import subprocess
import os
import shutil
import tempfile
import logging
from datetime import datetime
from openpyxl import load_workbook

logger = logging.getLogger(__name__)


def populate_excel_with_case_data(excel_path: str, output_path: str, case_data: dict, form_data: dict = None) -> str:
    """
    Excel template'i vaka verileriyle doldurur
    
    Args:
        excel_path: Orijinal Excel template yolu
        output_path: Doldurulmuş Excel'in kaydedileceği yol
        case_data: Backend'den gelen vaka verisi
        form_data: Frontend'den gelen form verisi
    
    Returns:
        str: Doldurulmuş Excel dosyasının yolu
    """
    form_data = form_data or {}
    case_data = case_data or {}
    
    # Excel'i yükle
    wb = load_workbook(excel_path)
    ws = wb.active
    
    # Helper fonksiyonlar
    def safe_get(d, *keys, default=''):
        for key in keys:
            if isinstance(d, dict):
                d = d.get(key, {})
            else:
                return default
        return d if d else default
    
    # Tarih formatla
    date_str = form_data.get('date', '')
    if not date_str and case_data.get('created_at'):
        try:
            created_at = case_data['created_at']
            if isinstance(created_at, str):
                date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
                date_obj = created_at
            date_str = date_obj.strftime('%d.%m.%Y')
        except:
            date_str = ''
    
    # Saat formatla
    call_time = form_data.get('callTime', '')
    if not call_time and case_data.get('created_at'):
        try:
            created_at = case_data['created_at']
            if isinstance(created_at, str):
                date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            else:
                date_obj = created_at
            call_time = date_obj.strftime('%H:%M')
        except:
            call_time = ''
    
    # Hasta adı
    patient_name = form_data.get('patientName', '')
    if not patient_name:
        first = safe_get(case_data, 'patient', 'name')
        last = safe_get(case_data, 'patient', 'surname')
        patient_name = f"{first} {last}".strip()
    
    # Araç plakası
    vehicle_plate = form_data.get('vehicleType', '') or form_data.get('vehiclePlate', '')
    if not vehicle_plate:
        assigned_team = case_data.get('assigned_team', {})
        if isinstance(assigned_team, dict):
            vehicle_plate = assigned_team.get('vehicle_plate', '')
    
    # Adres
    address = form_data.get('address', '')
    if not address:
        location = case_data.get('location', {})
        if isinstance(location, dict):
            address = location.get('address', '')
    
    # Telefon
    phone = form_data.get('phone', '')
    if not phone:
        phone = safe_get(case_data, 'patient', 'phone') or safe_get(case_data, 'caller', 'phone')
    
    # Şikayet
    complaint = form_data.get('complaint', '')
    if not complaint:
        complaint = safe_get(case_data, 'patient', 'complaint') or case_data.get('description', '')
    
    # Yaş
    age = form_data.get('age', '')
    if not age:
        patient_age = safe_get(case_data, 'patient', 'age')
        if patient_age:
            age = str(patient_age)
    
    # Cinsiyet
    gender = form_data.get('gender', '')
    if not gender:
        gender = safe_get(case_data, 'patient', 'gender')
    
    # TC Kimlik No
    tc_no = form_data.get('tcNo', '')
    if not tc_no:
        tc_no = safe_get(case_data, 'patient', 'tc_no')
    
    # Kronik hastalıklar
    chronic_diseases = form_data.get('chronicDiseases', '')
    
    # Alerjiler
    allergies = form_data.get('allergies', '')
    
    # Vital bulgular
    vitals = form_data.get('vitals', {}) or {}
    blood_pressure = vitals.get('bloodPressure', '') or form_data.get('bloodPressure', '')
    pulse = vitals.get('pulse', '') or form_data.get('pulse', '')
    spo2 = vitals.get('spo2', '') or form_data.get('spo2', '')
    temperature = vitals.get('temperature', '') or form_data.get('temperature', '')
    respiration = vitals.get('respiration', '') or form_data.get('respiration', '')
    gcs = vitals.get('gcs', '') or form_data.get('gcs', '')
    
    # Hücre eşlemesi - Excel template yapısına göre düzenlenecek
    # Bu eşleme VAKA_FORMU_TEMPLATE.xlsx yapısına göre ayarlanmalı
    cell_mapping = {
        # Üst bölüm
        'T5': case_data.get('case_number', ''),  # ATN NO
        'W5': form_data.get('startKm', ''),  # BAŞLANGIÇ KM
        'Z5': form_data.get('endKm', ''),  # BİTİŞ KM
        
        # İSTASYON bölümü
        'E9': form_data.get('healmedyProtocol') or case_data.get('case_number', ''),  # PROTOKOL NO
        'E11': date_str,  # TARİH
        'E13': vehicle_plate,  # PLAKA
        
        # SAATLER bölümü
        'J9': call_time,  # ÇAĞRI SAATİ
        'J10': form_data.get('arrivalTime', ''),  # OLAY YERİNE VARIŞ
        'J11': form_data.get('patientArrivalTime', ''),  # HASTAYA VARIŞ
        'J12': form_data.get('departureTime', ''),  # OLAY YERİNDEN AYRILIŞ
        'J13': form_data.get('hospitalArrivalTime', ''),  # HASTANEYE VARIŞ
        
        # HASTA BİLGİLERİ bölümü
        'N9': patient_name,  # ADI SOYADI
        'N10': address,  # ADRESİ
        'N14': phone,  # TELEFON
        
        # CİNSİYET / YAŞ bölümü
        'U13': age,  # YAŞ
        
        # T.C. KİMLİK NO
        'V15': tc_no,  # T.C. KİMLİK NO
        
        # KRONİK HASTALIKLAR
        'Y9': chronic_diseases,  # KRONİK HASTALIKLAR
        
        # ALERJİLER
        'Y10': allergies,  # ALERJİLER
        
        # HASTANIN ŞİKAYETİ
        'Y12': complaint,  # ŞİKAYET
        
        # MUAYENE BULGULARI / VİTAL BULGULAR
        'E18': blood_pressure,  # Tansiyon
        'H18': pulse,  # Nabız
        'K18': spo2,  # SpO2
        'N18': temperature,  # Ateş
        'Q18': respiration,  # Solunum
        'T18': gcs,  # GKS
        
        # Sevk edilen hastane
        'N21': form_data.get('hospitalName', ''),  # Hastane adı
        
        # Tanı
        'E25': form_data.get('diagnosis', ''),  # Tanı
        
        # Ekip bilgileri
        'E30': form_data.get('teamDoctor', ''),  # Doktor
        'E31': form_data.get('teamNurse', '') or form_data.get('teamParamedic', ''),  # Hemşire/Paramedik
        'E32': form_data.get('teamDriver', ''),  # Şoför
    }
    
    # Birleşik hücre haritası oluştur
    merged_cells_map = {}
    for mr in ws.merged_cells.ranges:
        for row in range(mr.min_row, mr.max_row + 1):
            for col in range(mr.min_col, mr.max_col + 1):
                cell_coord = ws.cell(row=row, column=col).coordinate
                top_left = ws.cell(row=mr.min_row, column=mr.min_col).coordinate
                merged_cells_map[cell_coord] = top_left
    
    # Hücrelere değer yaz
    for cell_ref, value in cell_mapping.items():
        if value:
            try:
                target_cell = merged_cells_map.get(cell_ref, cell_ref)
                ws[target_cell] = str(value)
            except Exception as e:
                logger.warning(f"Hücreye yazılamadı {cell_ref}: {e}")
    
    # Checkboxları işle (İSG vaka türü, cinsiyet vb.)
    # Bu kısım template yapısına göre özelleştirilebilir
    case_type = form_data.get('caseType', '') or case_data.get('case_type', '')
    if case_type:
        # İSG vaka türüne göre X işareti koy
        case_type_cells = {
            'trafik_kazasi': 'B17',
            'is_kazasi': 'D17',
            'ev_kazasi': 'F17',
            'darp': 'H17',
            'yanik': 'J17',
            'zehirlenme': 'L17',
            'diger': 'N17',
        }
        target_cell = case_type_cells.get(case_type.lower().replace(' ', '_'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # Cinsiyet işareti
    if gender:
        if gender.lower() in ['erkek', 'male', 'e', 'm']:
            try:
                ws['R13'] = 'X'  # Erkek
            except:
                pass
        elif gender.lower() in ['kadın', 'kadin', 'female', 'k', 'f']:
            try:
                ws['S13'] = 'X'  # Kadın
            except:
                pass
    
    # Kaydet
    wb.save(output_path)
    logger.info(f"Excel dolduruldu: {output_path}")
    
    return output_path


def convert_excel_to_pdf_libreoffice(excel_path: str, output_dir: str) -> str:
    """
    LibreOffice Headless kullanarak Excel'i PDF'e çevirir
    
    Args:
        excel_path: Excel dosyasının yolu
        output_dir: PDF'in kaydedileceği dizin
    
    Returns:
        str: Oluşturulan PDF dosyasının yolu
    """
    try:
        # LibreOffice komutu
        cmd = [
            'soffice',
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', output_dir,
            excel_path
        ]
        
        logger.info(f"LibreOffice çalıştırılıyor: {' '.join(cmd)}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60  # 60 saniye timeout
        )
        
        if result.returncode != 0:
            logger.error(f"LibreOffice hatası: {result.stderr}")
            raise Exception(f"LibreOffice dönüşüm hatası: {result.stderr}")
        
        # PDF dosya adını hesapla
        excel_filename = os.path.basename(excel_path)
        pdf_filename = os.path.splitext(excel_filename)[0] + '.pdf'
        pdf_path = os.path.join(output_dir, pdf_filename)
        
        if not os.path.exists(pdf_path):
            raise Exception(f"PDF oluşturulamadı: {pdf_path}")
        
        logger.info(f"PDF oluşturuldu: {pdf_path}")
        return pdf_path
        
    except subprocess.TimeoutExpired:
        logger.error("LibreOffice zaman aşımı")
        raise Exception("PDF dönüşümü zaman aşımına uğradı")
    except FileNotFoundError:
        logger.error("LibreOffice bulunamadı")
        raise Exception("LibreOffice kurulu değil. Dockerfile'da 'libreoffice-calc' yüklendiğinden emin olun.")


def generate_case_pdf_with_libreoffice(
    template_path: str,
    case_data: dict,
    form_data: dict = None,
    output_filename: str = None
) -> str:
    """
    Vaka verilerini kullanarak Excel template'ten PDF oluşturur
    
    Args:
        template_path: Excel template dosyasının yolu
        case_data: Vaka verileri
        form_data: Form verileri (opsiyonel)
        output_filename: Çıktı dosya adı (opsiyonel)
    
    Returns:
        str: Oluşturulan PDF dosyasının yolu
    """
    # Temp dizin oluştur
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    temp_dir = os.path.join(backend_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    case_id = case_data.get('_id', case_data.get('id', 'unknown'))
    case_number = case_data.get('case_number', case_id)
    
    # Geçici Excel dosyası oluştur
    temp_excel = os.path.join(temp_dir, f"temp_case_{case_id}.xlsx")
    
    try:
        # Excel'i verilerle doldur
        populate_excel_with_case_data(template_path, temp_excel, case_data, form_data)
        
        # LibreOffice ile PDF'e çevir
        pdf_path = convert_excel_to_pdf_libreoffice(temp_excel, temp_dir)
        
        # İstenen dosya adına yeniden adlandır
        if output_filename:
            final_pdf_path = os.path.join(temp_dir, output_filename)
            if os.path.exists(final_pdf_path):
                os.remove(final_pdf_path)
            shutil.move(pdf_path, final_pdf_path)
            pdf_path = final_pdf_path
        
        return pdf_path
        
    finally:
        # Geçici Excel dosyasını temizle
        if os.path.exists(temp_excel):
            try:
                os.remove(temp_excel)
            except:
                pass


def check_libreoffice_installed() -> bool:
    """LibreOffice'in kurulu olup olmadığını kontrol eder"""
    try:
        result = subprocess.run(
            ['soffice', '--version'],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except:
        return False

