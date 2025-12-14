"""
Dinamik Excel Export Service
Excel şablonundaki data_mappings kullanarak vaka verilerini doldurur
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter, column_index_from_string
from datetime import datetime
from io import BytesIO
import logging
import re

logger = logging.getLogger(__name__)


def format_date(date_val):
    """Tarih formatla"""
    if not date_val:
        return ""
    try:
        if isinstance(date_val, datetime):
            return date_val.strftime("%d.%m.%Y")
        if isinstance(date_val, str):
            dt = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
            return dt.strftime("%d.%m.%Y")
    except:
        pass
    return str(date_val)[:10] if date_val else ""


def format_time(time_val):
    """Saat formatla"""
    if not time_val:
        return ""
    try:
        if isinstance(time_val, datetime):
            return time_val.strftime("%H:%M")
        if isinstance(time_val, str):
            if len(time_val) == 5 and ':' in time_val:
                return time_val
            dt = datetime.fromisoformat(time_val.replace('Z', '+00:00'))
            return dt.strftime("%H:%M")
    except:
        pass
    return str(time_val)[:5] if time_val else ""


def get_nested_value(data: dict, key_path: str):
    """
    Noktalı notasyon ile nested değer al
    Örnek: 'patient.name' -> data['patient']['name']
    """
    keys = key_path.split('.')
    value = data
    
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return None
        if value is None:
            return None
    
    return value


def get_case_field_value(case_data: dict, field_key: str) -> str:
    """
    field_key'e göre vaka verisinden değer çek
    """
    
    # Temel alanlar
    basic_mappings = {
        'caseNumber': lambda d: d.get('case_number', ''),
        'caseDate': lambda d: format_date(d.get('created_at')),
        'vehiclePlate': lambda d: d.get('assigned_team', {}).get('vehicle', '') or d.get('vehicle_info', {}).get('plate', ''),
        'pickupAddress': lambda d: d.get('location', {}).get('address', ''),
        'startKm': lambda d: d.get('vehicle_info', {}).get('start_km', ''),
        'endKm': lambda d: d.get('vehicle_info', {}).get('end_km', ''),
        'totalKm': lambda d: d.get('vehicle_info', {}).get('total_km', ''),
        'referringInstitution': lambda d: d.get('referring_institution', '') or d.get('company', ''),
    }
    
    # Saat alanları
    time_mappings = {
        'callTime': lambda d: format_time(d.get('time_info', {}).get('call_time')),
        'departureTime': lambda d: format_time(d.get('time_info', {}).get('departure_time')),
        'arrivalTime': lambda d: format_time(d.get('time_info', {}).get('arrival_time')),
        'patientTime': lambda d: format_time(d.get('time_info', {}).get('patient_time') or d.get('time_info', {}).get('patient_arrival_time')),
        'hospitalTime': lambda d: format_time(d.get('time_info', {}).get('hospital_time') or d.get('time_info', {}).get('hospital_arrival_time')),
        'returnTime': lambda d: format_time(d.get('time_info', {}).get('return_time')),
    }
    
    # Hasta bilgileri
    patient_mappings = {
        'patientName': lambda d: f"{d.get('patient', {}).get('name', '')} {d.get('patient', {}).get('surname', '')}".strip(),
        'patientTcNo': lambda d: d.get('patient', {}).get('tc_no', ''),
        'patientAge': lambda d: d.get('patient', {}).get('age', ''),
        'patientGender': lambda d: d.get('patient', {}).get('gender', ''),
        'patientPhone': lambda d: d.get('caller', {}).get('phone', '') or d.get('patient', {}).get('phone', ''),
        'patientAddress': lambda d: d.get('patient', {}).get('address', ''),
        'patientComplaint': lambda d: d.get('patient', {}).get('complaint', '') or d.get('complaint', ''),
        'chronicDiseases': lambda d: d.get('chronic_diseases', '') or d.get('medical_form', {}).get('chronic_diseases', ''),
    }
    
    # Sonuç/Nakil bilgileri
    result_mappings = {
        'transferHospital': lambda d: d.get('transfer_hospital', ''),
        'transferType': lambda d: d.get('transfer_type', ''),
        'caseResult': lambda d: d.get('case_result', '') or d.get('status', ''),
        'isForensic': lambda d: 'Evet' if d.get('is_forensic') else 'Hayır',
        'priority': lambda d: d.get('priority', ''),
    }
    
    # Vital bulgular (dinamik)
    vital_pattern = re.match(r'vital(Time|BP|Pulse|SpO2|Resp|Temp)(\d+)', field_key)
    if vital_pattern:
        vital_type = vital_pattern.group(1)
        vital_index = int(vital_pattern.group(2)) - 1
        vital_signs = case_data.get('vital_signs', [])
        
        if vital_index < len(vital_signs):
            vs = vital_signs[vital_index]
            type_map = {
                'Time': lambda v: format_time(v.get('time')),
                'BP': lambda v: v.get('blood_pressure', ''),
                'Pulse': lambda v: v.get('pulse', ''),
                'SpO2': lambda v: v.get('spo2', ''),
                'Resp': lambda v: v.get('respiration', ''),
                'Temp': lambda v: v.get('temperature', ''),
            }
            return str(type_map.get(vital_type, lambda v: '')(vs))
        return ''
    
    # GKS
    gks_mappings = {
        'gcsTotal': lambda d: d.get('clinical_observations', {}).get('gks', {}).get('total', ''),
    }
    
    # Klinik gözlemler
    clinical_mappings = {
        'bloodSugar': lambda d: d.get('blood_sugar', '') or d.get('clinical_observations', {}).get('blood_sugar', ''),
        'bodyTemp': lambda d: d.get('body_temperature', '') or d.get('clinical_observations', {}).get('body_temp', ''),
    }
    
    # Checkbox alanları - değer varsa ☑, yoksa ☐
    # Çağrı tipi
    if field_key.startswith('callType.'):
        call_type = case_data.get('call_type', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if call_type == option else '☐'
    
    # Cinsiyet
    if field_key.startswith('gender.'):
        gender = case_data.get('patient', {}).get('gender', '').lower()
        option = field_key.split('.')[1].lower()
        gender_map = {'erkek': 'erkek', 'male': 'erkek', 'kadın': 'kadin', 'kadin': 'kadin', 'female': 'kadin'}
        return '☑' if gender_map.get(gender) == option else '☐'
    
    # Öncelik/Triyaj
    if field_key.startswith('priority.'):
        priority = case_data.get('priority', '').lower()
        option = field_key.split('.')[1].lower()
        priority_map = {'critical': 'kirmizi', 'high': 'sari', 'medium': 'yesil', 'low': 'siyah'}
        return '☑' if priority_map.get(priority, priority) == option else '☐'
    
    # Çağrı nedeni
    if field_key.startswith('callReason.'):
        reason = case_data.get('call_reason', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if reason == option else '☐'
    
    # Pupil
    if field_key.startswith('pupil.'):
        pupils = case_data.get('clinical_observations', {}).get('pupils', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if pupils == option else '☐'
    
    # Deri
    if field_key.startswith('skin.'):
        skin = case_data.get('clinical_observations', {}).get('skin', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if skin == option else '☐'
    
    # Nabız tipi
    if field_key.startswith('pulseType.'):
        pulse_type = case_data.get('clinical_observations', {}).get('pulse_type', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if pulse_type == option else '☐'
    
    # Solunum tipi
    if field_key.startswith('respType.'):
        resp_type = case_data.get('clinical_observations', {}).get('resp_type', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if resp_type == option else '☐'
    
    # GKS Motor/Verbal/Eye
    if field_key.startswith('gcsMotor.'):
        gks = case_data.get('clinical_observations', {}).get('gks', {})
        motor = gks.get('motor', 0)
        target = int(field_key.split('.')[1])
        return '☑' if motor == target else '☐'
    
    if field_key.startswith('gcsVerbal.'):
        gks = case_data.get('clinical_observations', {}).get('gks', {})
        verbal = gks.get('verbal', 0)
        target = int(field_key.split('.')[1])
        return '☑' if verbal == target else '☐'
    
    if field_key.startswith('gcsEye.'):
        gks = case_data.get('clinical_observations', {}).get('gks', {})
        eye = gks.get('eye', 0)
        target = int(field_key.split('.')[1])
        return '☑' if eye == target else '☐'
    
    # Sonuç checkboxları
    if field_key.startswith('outcome.'):
        result = case_data.get('case_result', '').lower() or case_data.get('status', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if result == option else '☐'
    
    # Transfer tipi
    if field_key.startswith('transferType.'):
        transfer = case_data.get('transfer_type', '').lower()
        option = field_key.split('.')[1].lower()
        return '☑' if transfer == option else '☐'
    
    # Adli vaka
    if field_key.startswith('forensic.'):
        is_forensic = case_data.get('is_forensic', False)
        option = field_key.split('.')[1].lower()
        if option == 'evet':
            return '☑' if is_forensic else '☐'
        else:
            return '☑' if not is_forensic else '☐'
    
    # İşlemler (Prosedürler) - proc.islem_adi.cb veya proc.islem_adi.adet
    if field_key.startswith('proc.'):
        procedures = case_data.get('procedures', [])
        parts = field_key.split('.')
        proc_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'  # cb veya adet
        
        for proc in procedures:
            if proc_name in proc.get('code', '').lower() or proc_name in proc.get('name', '').lower():
                if field_type == 'adet':
                    return str(proc.get('count', proc.get('quantity', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # Hava yolu işlemleri - airway.islem_adi.cb veya airway.islem_adi.adet
    if field_key.startswith('airway.'):
        procedures = case_data.get('procedures', [])
        parts = field_key.split('.')
        airway_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for proc in procedures:
            if airway_name in proc.get('code', '').lower() or airway_name in proc.get('name', '').lower():
                if field_type == 'adet':
                    return str(proc.get('count', proc.get('quantity', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # Dolaşım desteği - circ.islem_adi.cb veya circ.islem_adi.adet
    if field_key.startswith('circ.'):
        procedures = case_data.get('procedures', [])
        parts = field_key.split('.')
        circ_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for proc in procedures:
            if circ_name in proc.get('code', '').lower() or circ_name in proc.get('name', '').lower():
                if field_type == 'adet':
                    return str(proc.get('count', proc.get('quantity', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # Diğer işlemler - other.islem_adi.cb veya other.islem_adi.adet
    if field_key.startswith('other.'):
        procedures = case_data.get('procedures', [])
        parts = field_key.split('.')
        other_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for proc in procedures:
            if other_name in proc.get('code', '').lower() or other_name in proc.get('name', '').lower():
                if field_type == 'adet':
                    return str(proc.get('count', proc.get('quantity', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # Yenidoğan işlemleri - newborn.islem_adi.cb veya newborn.islem_adi.adet
    if field_key.startswith('newborn.'):
        procedures = case_data.get('procedures', [])
        parts = field_key.split('.')
        nb_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for proc in procedures:
            if nb_name in proc.get('code', '').lower() or nb_name in proc.get('name', '').lower():
                if field_type == 'adet':
                    return str(proc.get('count', proc.get('quantity', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # İlaçlar - med.ilac_adi.cb veya med.ilac_adi.adet
    if field_key.startswith('med.'):
        medications = case_data.get('medications', [])
        parts = field_key.split('.')
        med_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for med in medications:
            if med_name in med.get('name', '').lower() or med_name in med.get('code', '').lower():
                if field_type == 'adet':
                    return str(med.get('quantity', med.get('count', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # Eski format için de destek - medication.
    if field_key.startswith('medication.'):
        medications = case_data.get('medications', [])
        med_name = field_key.split('.')[1].lower()
        for med in medications:
            if med_name in med.get('name', '').lower() or med_name in med.get('code', '').lower():
                return med.get('quantity', '☑')
        return ''
    
    # Malzemeler - mat.malzeme_adi.cb veya mat.malzeme_adi.adet
    if field_key.startswith('mat.'):
        materials = case_data.get('materials', [])
        parts = field_key.split('.')
        mat_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for mat in materials:
            if mat_name in mat.get('name', '').lower() or mat_name in mat.get('code', '').lower():
                if field_type == 'adet':
                    return str(mat.get('quantity', mat.get('count', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # Eski format için de destek - material.
    if field_key.startswith('material.'):
        materials = case_data.get('materials', [])
        mat_name = field_key.split('.')[1].lower()
        for mat in materials:
            if mat_name in mat.get('name', '').lower() or mat_name in mat.get('code', '').lower():
                return mat.get('quantity', '☑')
        return ''
    
    # Sıvı tedavisi - fluid.sivi_adi.cb veya fluid.sivi_adi.adet
    if field_key.startswith('fluid.'):
        fluids = case_data.get('fluids', []) or case_data.get('iv_fluids', [])
        parts = field_key.split('.')
        fluid_name = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        for fluid in fluids:
            if fluid_name in fluid.get('name', '').lower():
                if field_type == 'adet':
                    return str(fluid.get('quantity', fluid.get('count', 1)))
                return '☑'
        return '☐' if field_type == 'cb' else ''
    
    # İmzalar
    sig_mappings = {
        'sig.hekim_prm_name': lambda d: d.get('signatures', {}).get('doctor_name', ''),
        'sig.saglik_per_name': lambda d: d.get('signatures', {}).get('paramedic_name', ''),
        'sig.sofor_name': lambda d: d.get('signatures', {}).get('driver_name', ''),
        'sig.teslim_adi': lambda d: d.get('signatures', {}).get('receiver_name', ''),
        'sig.teslim_unvan': lambda d: d.get('signatures', {}).get('receiver_title', ''),
        'sig.hasta_adi': lambda d: d.get('signatures', {}).get('patient_name', ''),
    }
    
    # Red formları
    reject_mappings = {
        'reject.hastane_neden': lambda d: d.get('hospital_rejection', {}).get('reason', ''),
        'reject.hastane_doktor': lambda d: d.get('hospital_rejection', {}).get('doctor_name', ''),
        'reject.hasta_aciklama': lambda d: d.get('patient_rejection', {}).get('reason', ''),
        'reject.hasta_adi': lambda d: d.get('patient_rejection', {}).get('patient_name', ''),
    }
    
    # Refakatçi
    escort_mappings = {
        'escort.adi': lambda d: d.get('escort', {}).get('name', ''),
    }
    
    # Genel notlar
    if field_key == 'generalNotes':
        return case_data.get('notes', '') or case_data.get('medical_form', {}).get('notes', '')
    
    # Tüm mapping'leri kontrol et
    all_mappings = {
        **basic_mappings,
        **time_mappings,
        **patient_mappings,
        **result_mappings,
        **gks_mappings,
        **clinical_mappings,
        **sig_mappings,
        **reject_mappings,
        **escort_mappings,
    }
    
    if field_key in all_mappings:
        result = all_mappings[field_key](case_data)
        return str(result) if result is not None else ''
    
    # Nested path dene
    nested_value = get_nested_value(case_data, field_key)
    if nested_value is not None:
        return str(nested_value)
    
    return ''


def parse_cell_address(address: str):
    """
    A1 -> (1, 1), B2 -> (2, 2), AA10 -> (10, 27)
    """
    match = re.match(r'^([A-Z]+)(\d+)$', address.upper())
    if not match:
        return None, None
    
    col_str = match.group(1)
    row = int(match.group(2))
    
    col = 0
    for char in col_str:
        col = col * 26 + (ord(char) - ord('A') + 1)
    
    return row, col


def export_case_with_template(template: dict, case_data: dict) -> BytesIO:
    """
    Excel şablonu ve data_mappings kullanarak vaka formunu doldur
    
    Args:
        template: Excel şablonu (cells, merged_cells, data_mappings, vb.)
        case_data: Vaka verileri
    
    Returns:
        BytesIO: Doldurulmuş Excel dosyası
    """
    
    wb = Workbook()
    ws = wb.active
    ws.title = template.get('name', 'Vaka Formu')[:31]
    
    max_row = template.get('max_row', 100)
    max_col = template.get('max_column', 30)
    
    # Satır yükseklikleri
    row_heights = template.get('row_heights', {})
    for row_str, height in row_heights.items():
        try:
            ws.row_dimensions[int(row_str)].height = height
        except:
            pass
    
    # Sütun genişlikleri
    column_widths = template.get('column_widths', {})
    for col_letter, width in column_widths.items():
        try:
            ws.column_dimensions[col_letter].width = width
        except:
            pass
    
    # Data mappings
    data_mappings = template.get('data_mappings', {})
    
    # Önce tüm hücreleri şablondan doldur
    cells_data = template.get('cells', [])
    for cell_info in cells_data:
        row = cell_info.get('row', 1)
        col = cell_info.get('col', 1)
        cell = ws.cell(row=row, column=col)
        
        address = cell_info.get('address', f"{get_column_letter(col)}{row}")
        
        # Eğer bu hücre bir mapping içeriyorsa, vaka verisini kullan
        if address in data_mappings:
            field_key = data_mappings[address]
            value = get_case_field_value(case_data, field_key)
            cell.value = value
        else:
            # Mapping yoksa şablondaki değeri kullan
            cell.value = cell_info.get('value', '')
        
        # Stilleri uygula
        font_data = cell_info.get('font', {})
        if font_data:
            try:
                font_color = None
                if font_data.get('color') and len(str(font_data['color'])) >= 6:
                    font_color = str(font_data['color'])[-6:]
                
                cell.font = Font(
                    name=font_data.get('name') or 'Calibri',
                    size=font_data.get('size') or 11,
                    bold=font_data.get('bold', False),
                    italic=font_data.get('italic', False),
                    color=font_color
                )
            except Exception as e:
                logger.warning(f"Font hatası: {e}")
        
        fill_data = cell_info.get('fill', {})
        if fill_data and fill_data.get('color') and fill_data['color'] != '00000000':
            try:
                fill_color = str(fill_data['color'])[-6:]
                cell.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type='solid')
            except:
                pass
        
        align_data = cell_info.get('alignment', {})
        if align_data:
            try:
                cell.alignment = Alignment(
                    horizontal=align_data.get('horizontal') or 'left',
                    vertical=align_data.get('vertical') or 'center',
                    wrap_text=align_data.get('wrap_text', False)
                )
            except:
                pass
        
        border_data = cell_info.get('border', {})
        if border_data and any([border_data.get(s) for s in ['left', 'right', 'top', 'bottom']]):
            try:
                cell.border = Border(
                    left=Side(style=border_data.get('left')) if border_data.get('left') else None,
                    right=Side(style=border_data.get('right')) if border_data.get('right') else None,
                    top=Side(style=border_data.get('top')) if border_data.get('top') else None,
                    bottom=Side(style=border_data.get('bottom')) if border_data.get('bottom') else None
                )
            except:
                pass
    
    # Mapping'de olup hücrelerde olmayan değerleri de yaz
    for address, field_key in data_mappings.items():
        row, col = parse_cell_address(address)
        if row and col:
            cell = ws.cell(row=row, column=col)
            if not cell.value:  # Eğer hala boşsa
                value = get_case_field_value(case_data, field_key)
                cell.value = value
    
    # Birleşik hücreler
    merged_cells = template.get('merged_cells', [])
    for merge_info in merged_cells:
        try:
            merge_range = merge_info.get('range')
            if merge_range:
                ws.merge_cells(merge_range)
        except Exception as e:
            logger.warning(f"Merge hatası: {merge_range} - {e}")
    
    # BytesIO'ya kaydet
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    return output

