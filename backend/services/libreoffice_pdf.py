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
    
    # Hücre eşlemesi - Vaka formu v2.xlsx yapısına göre
    # NOT: Değerler label'ın yanındaki DEĞER hücrelerine yazılmalı, label'a değil!
    # Birleşik hücrelerin sol-üst köşesine yazılır
    cell_mapping = {
        # ÜST BÖLÜM - ATN NO, KM bilgileri (Row 2 - değer satırı)
        'U2': case_data.get('case_number', ''),  # ATN NO değeri (U1 label, U2 değer)
        'W2': form_data.get('startKm', ''),  # BAŞLANGIÇ KM değeri
        'Y2': form_data.get('endKm', ''),  # BİTİŞ KM değeri
        
        # İSTASYON BÖLÜMÜ - Değer hücreleri C sütununda
        'C4': form_data.get('healmedyProtocol') or case_data.get('case_number', ''),  # PROTOKOL NO değeri
        'C5': date_str,  # TARİH değeri (A5 label, C5 değer - eğer ayrıysa)
        'C6': form_data.get('stationCode', ''),  # KODU değeri
        'C7': vehicle_plate,  # PLAKA değeri
        'C8': address,  # HASTANIN ALINDIĞI ADRES değeri
        'C9': form_data.get('callerOrganization', ''),  # VAKAYI VEREN KURUM değeri
        
        # SAATLER BÖLÜMÜ - Değer hücreleri I sütununda
        'I4': call_time,  # ÇAĞRI SAATİ değeri
        'I5': form_data.get('arrivalTime', ''),  # OLAY YERİNE VARIŞ değeri
        'I6': form_data.get('patientArrivalTime', ''),  # HASTAYA VARIŞ değeri
        'I7': form_data.get('departureTime', ''),  # OLAY YERİNDEN AYRILIŞ değeri
        'I8': form_data.get('hospitalArrivalTime', ''),  # HASTANEYE VARIŞ değeri
        'I9': form_data.get('returnTime', ''),  # İSTASYONA DÖNÜŞ değeri
        
        # HASTA BİLGİLERİ BÖLÜMÜ - Değer hücreleri M sütununda
        'M4': patient_name,  # ADI SOYADI değeri (K4 label, M4 değer)
        'M5': address,  # ADRESİ değeri (aslında K5:L7 birleşik, M5 değer)
        'M8': tc_no,  # T.C. KİMLİK NO değeri
        'M9': phone,  # TELEFON değeri
        
        # CİNSİYET / YAŞ / DURUMU - T sütunu değerler için
        'T9': age,  # YAŞ değeri (S9 label, T9 değer)
        'T8': form_data.get('birthDate', ''),  # Doğum Tarihi değeri
        
        # KRONİK HASTALIKLAR - X4 değer hücresi
        'X4': chronic_diseases,  # KRONİK HASTALIKLAR değeri
        
        # HASTANIN ŞİKAYETİ - X7 değer hücresi
        'X7': complaint,  # HASTANIN ŞİKAYETİ değeri
        
        # VİTAL BULGULAR (Row 17-22)
        # Tansiyon değerleri - H17 birleşik hücrede sistol/diastol
        'H17': blood_pressure,  # Tansiyon (ör: 120/80)
        'K17': pulse,  # NABIZ değeri
        'M17': respiration,  # SOLUNUM değeri
        'I19': spo2,  # SPO2 (%) değeri
        'Y19': temperature,  # ATEŞ (°C) değeri
        
        # GKS (Glasgow Koma Skalası)
        'O17': form_data.get('gcsMotor', ''),  # Motor değeri
        'R17': form_data.get('gcsVerbal', ''),  # Verbal değeri
        'U17': form_data.get('gcsEye', ''),  # Göz açma değeri
        
        # KAN ŞEKERİ
        'Z17': form_data.get('bloodSugar', ''),  # Kan şekeri Mg/dL
        
        # ÖN TANI (Row 23)
        'B23': form_data.get('diagnosis', ''),  # ÖN TANI değeri
        
        # AÇIKLAMALAR
        'I23': form_data.get('notes', ''),  # AÇIKLAMALAR değeri
        
        # NAKLEDİLEN HASTANE
        'L24': form_data.get('hospitalName', ''),  # NAKLEDİLEN HASTANE değeri
        
        # KAZAYA KARIŞAN ARAÇ PLAKA
        'P25': form_data.get('accidentVehiclePlate1', ''),
        'P26': form_data.get('accidentVehiclePlate2', ''),
        'P27': form_data.get('accidentVehiclePlate3', ''),
        'P28': form_data.get('accidentVehiclePlate4', ''),
        
        # CPR bilgileri
        'U25': form_data.get('cprStartTime', ''),  # CPR BAŞLAMA ZAMANI
        'U26': form_data.get('cprEndTime', ''),  # CPR BIRAKMA ZAMANI
        'U27': form_data.get('cprStopReason', ''),  # CPR BIRAKMA NEDENİ
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
    
    # Checkboxları işle - Vaka formu v2.xlsx yapısına göre
    
    # CİNSİYET - T4 ve T6 checkbox hücreleri
    if gender:
        if gender.lower() in ['erkek', 'male', 'e', 'm']:
            try:
                ws['T4'] = 'X'  # ERKEK checkbox
            except:
                pass
        elif gender.lower() in ['kadın', 'kadin', 'female', 'k', 'f']:
            try:
                ws['T6'] = 'X'  # KADIN checkbox
            except:
                pass
    
    # DURUMU / TRİYAJ KODU - V4-V8 checkbox hücreleri
    triage_code = form_data.get('triageCode', '') or form_data.get('durumu', '')
    if triage_code:
        triage_cells = {
            'kirmizi': 'V4',  # KIRMIZI KOD
            'sari': 'V5',  # SARI KOD
            'yesil': 'V6',  # YEŞİL KOD
            'siyah': 'V7',  # SİYAH KOD
            'sosyal': 'V8',  # SOSYAL ENDİKASYON
        }
        target_cell = triage_cells.get(triage_code.lower().replace(' ', '_').replace('ı', 'i'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # ÇAĞRI TİPİ (A11-A13)
    call_type = form_data.get('callType', '')
    if call_type:
        call_type_cells = {
            'telsiz': 'B11',
            'telefon': 'B12',
            'diger': 'B13',
        }
        target_cell = call_type_cells.get(call_type.lower())
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # ÇAĞRI NEDENİ (E11-E14, H11-H14, vb.)
    call_reason = form_data.get('callReason', '') or case_data.get('case_type', '')
    if call_reason:
        reason_cells = {
            'medikal': 'F11',
            'trafik_kazasi': 'F12',
            'is_kazasi': 'F14',
            'yangin': 'I11',
            'intihar': 'I12',
            'kimyasal': 'I13',
            'allerji': 'I14',
            'elektrik_carpmasi': 'K11',
            'atesli_silah': 'K12',
            'bogulma': 'K13',
            'kesici_delici': 'K14',
            'dusme': 'M11',
            'alkol_ilac': 'M12',
            'kunt_travma': 'M13',
            'yanik': 'M14',
            'lpg': 'O11',
            'tedbir': 'O12',
            'protokol': 'O13',
        }
        target_cell = reason_cells.get(call_reason.lower().replace(' ', '_').replace('ı', 'i'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # OLAY YERİ (P11-V14)
    scene_location = form_data.get('sceneLocation', '')
    if scene_location:
        location_cells = {
            'ev': 'Q11',
            'aracta': 'S11',
            'stadyum': 'U11',
            'saglik_kurumu': 'W11',
            'yaya': 'Q12',
            'buro': 'S12',
            'huzurevi': 'U12',
            'resmi_daire': 'W12',
            'suda': 'Q13',
            'fabrika': 'S13',
            'cami': 'U13',
            'egitim_kurumu': 'W13',
            'arazi': 'Q14',
            'sokak': 'S14',
            'yurt': 'U14',
            'spor_salonu': 'W14',
        }
        target_cell = location_cells.get(scene_location.lower().replace(' ', '_').replace('ı', 'i'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # PUPİLLER (B17-B22)
    pupils = form_data.get('pupils', '')
    if pupils:
        pupil_cells = {
            'normal': 'C17',
            'miyotik': 'C18',
            'midriatik': 'C19',
            'anizokorik': 'C20',
            'reaksiyon_yok': 'C21',
            'fiks_dilate': 'C22',
        }
        target_cell = pupil_cells.get(pupils.lower().replace(' ', '_'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # DERİ (D17-D22)
    skin = form_data.get('skin', '')
    if skin:
        skin_cells = {
            'normal': 'E17',
            'soluk': 'E18',
            'siyanotik': 'E19',
            'hiperemik': 'E20',
            'ikterik': 'E21',
            'terli': 'E22',
        }
        target_cell = skin_cells.get(skin.lower())
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # SONUÇ (B25-D29)
    result = form_data.get('result', '')
    if result:
        result_cells = {
            'yerinde_mudahale': 'C25',
            'hastaneye_nakil': 'C26',
            'hastaneler_arasi_nakil': 'C27',
            'tibbi_tetkik_icin_nakil': 'C28',
            'eve_nakil': 'C29',
            'ex_terinde_birakildi': 'E25',
            'ex_morga_nakil': 'E26',
            'nakil_reddi': 'E27',
            'diger_ulasilan': 'E28',
            'gorev_iptali': 'E29',
            'baska_aracla_nakil': 'G25',
            'tlfla_bsk_aracla_nakil': 'G26',
            'asilsiz_ihbar': 'G27',
            'yaralanan_yok': 'G28',
            'olay_yerinde_bekleme': 'G29',
        }
        target_cell = result_cells.get(result.lower().replace(' ', '_').replace('ı', 'i'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
            except:
                pass
    
    # ADLİ VAKA (Q29: EVET, S29: HAYIR)
    is_judicial = form_data.get('isJudicialCase', '')
    if is_judicial:
        if str(is_judicial).lower() in ['true', 'evet', '1', 'yes']:
            try:
                ws['R29'] = 'X'  # EVET
            except:
                pass
        elif str(is_judicial).lower() in ['false', 'hayir', '0', 'no']:
            try:
                ws['T29'] = 'X'  # HAYIR
            except:
                pass
    
    # NAKIL TÜRÜ - İLÇE İÇİ/DIŞI/İL DIŞI (K27-K29)
    transfer_type = form_data.get('transferType', '')
    if transfer_type:
        transfer_cells = {
            'ilce_ici': 'L27',
            'ilce_disi': 'L28',
            'il_disi': 'L29',
        }
        target_cell = transfer_cells.get(transfer_type.lower().replace(' ', '_'))
        if target_cell:
            try:
                ws[target_cell] = 'X'
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

