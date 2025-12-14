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
    
    # Saat alanları (V3 formatı)
    time_mappings = {
        'callTime': lambda d: format_time(d.get('time_info', {}).get('callTime') or d.get('time_info', {}).get('call_time')),
        'arrivalSceneTime': lambda d: format_time(d.get('time_info', {}).get('arrivalTime') or d.get('time_info', {}).get('arrival_time')),
        'arrivalPatientTime': lambda d: format_time(d.get('time_info', {}).get('patientArrivalTime') or d.get('time_info', {}).get('patient_arrival_time')),
        'departureSceneTime': lambda d: format_time(d.get('time_info', {}).get('departureTime') or d.get('time_info', {}).get('departure_time')),
        'arrivalHospitalTime': lambda d: format_time(d.get('time_info', {}).get('hospitalArrivalTime') or d.get('time_info', {}).get('hospital_arrival_time')),
        'returnStationTime': lambda d: format_time(d.get('time_info', {}).get('stationReturnTime') or d.get('time_info', {}).get('return_time')),
        # Eski isimler için uyumluluk
        'departureTime': lambda d: format_time(d.get('time_info', {}).get('departureTime') or d.get('time_info', {}).get('departure_time')),
        'arrivalTime': lambda d: format_time(d.get('time_info', {}).get('arrivalTime') or d.get('time_info', {}).get('arrival_time')),
        'patientTime': lambda d: format_time(d.get('time_info', {}).get('patientArrivalTime') or d.get('time_info', {}).get('patient_arrival_time')),
        'hospitalTime': lambda d: format_time(d.get('time_info', {}).get('hospitalArrivalTime') or d.get('time_info', {}).get('hospital_arrival_time')),
        'returnTime': lambda d: format_time(d.get('time_info', {}).get('stationReturnTime') or d.get('time_info', {}).get('return_time')),
    }
    
    # Hasta bilgileri (V3 formatı)
    patient_mappings = {
        'patientName': lambda d: f"{d.get('patient', {}).get('name', '')} {d.get('patient', {}).get('surname', '')}".strip(),
        'patientTcNo': lambda d: d.get('patient', {}).get('tc_no', '') or d.get('patient', {}).get('tcNo', ''),
        'patientAge': lambda d: str(d.get('patient', {}).get('age', '')) if d.get('patient', {}).get('age') else '',
        'patientGender': lambda d: d.get('patient', {}).get('gender', ''),
        'patientPhone': lambda d: d.get('caller', {}).get('phone', '') or d.get('patient', {}).get('phone', ''),
        'patientAddress': lambda d: d.get('patient', {}).get('address', '') or d.get('location', {}).get('address', ''),
        'patientHomeAddress': lambda d: d.get('location', {}).get('address', '') or d.get('patient', {}).get('address', ''),
        'patientPickupAddress': lambda d: d.get('location', {}).get('pickup_location', '') or d.get('location', {}).get('address_description', ''),
        'patientComplaint': lambda d: d.get('patient', {}).get('complaint', '') or d.get('complaint', ''),
        'chronicDiseases': lambda d: d.get('chronic_diseases', '') or d.get('extended_form', {}).get('chronicDiseases', ''),
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
    
    # Sonuç checkboxları - extended_form.outcome'dan al
    if field_key.startswith('outcome.'):
        extended_form = case_data.get('extended_form', {})
        result = extended_form.get('outcome', '') or case_data.get('case_result', '') or case_data.get('status', '')
        result = result.lower() if result else ''
        option = field_key.split('.')[1].lower()
        return '☑' if option in result or result == option else '☐'
    
    # Transfer tipi - extended_form.transferType'dan al
    if field_key.startswith('transferType.') or field_key.startswith('distance.'):
        extended_form = case_data.get('extended_form', {})
        transfer = extended_form.get('transferType', '') or case_data.get('transfer_type', '')
        transfer = transfer.lower() if transfer else ''
        option = field_key.split('.')[1].lower()
        return '☑' if option in transfer or transfer == option else '☐'
    
    # Olay yeri checkboxları - extended_form.sceneType'dan al
    if field_key.startswith('scene.'):
        extended_form = case_data.get('extended_form', {})
        scene = extended_form.get('sceneType', '') or case_data.get('scene_type', '')
        scene = scene.lower() if scene else ''
        option = field_key.split('.')[1].lower()
        return '☑' if option in scene or scene == option else '☐'
    
    # Adli vaka
    if field_key.startswith('forensic.'):
        is_forensic = case_data.get('is_forensic', False)
        option = field_key.split('.')[1].lower()
        if option == 'evet':
            return '☑' if is_forensic else '☐'
        else:
            return '☑' if not is_forensic else '☐'
    
    # ============ PROCEDURE MAPPING ============
    # Frontend'de procedures dictionary olarak kaydediliyor:
    # {"Muayene (Acil)": {checked: true, adet: 2}}
    # Mapping key: proc.muayene_acil.cb veya proc.muayene_acil.adet
    
    # İşlem adı -> Mapping key eşleştirmesi
    PROCEDURE_NAME_MAPPING = {
        'muayene_acil': ['Muayene (Acil)', 'Muayene Acil'],
        'enjeksiyon_im': ['Enjeksiyon IM'],
        'enjeksiyon_iv': ['Enjeksiyon IV'],
        'enjeksiyon_sc': ['Enjeksiyon SC'],
        'iv_ilac': ['I.V. İlaç uygulaması', 'IV İlaç'],
        'damar_yolu': ['Damar yolu açılması', 'Damar yolu'],
        'sutur': ['Sütür (küçük)', 'Sütür'],
        'mesane_sondasi': ['Mesane sondası takılması', 'Mesane sondası'],
        'mide_yikama': ['Mide yıkanması', 'Mide yıkama'],
        'pansuman_kucuk': ['Pansuman (küçük)', 'Pansuman'],
        'apse': ['Apse açmak', 'Apse'],
        'yabanci_cisim': ['Yabancı cisim çıkartılması', 'Yabancı cisim'],
        'yanik_pansuman_kucuk': ['Yanık pansumanı (küçük)', 'Yanık pansuman küçük'],
        'yanik_pansuman_orta': ['Yanık pansumanı (orta)', 'Yanık pansuman orta'],
        'ng_sonda': ['NG sonda takma', 'NG sonda'],
        'kulak_buson': ['Kulaktan buşon temizliği', 'Kulak buşon'],
        'kol_atel': ['Kol atel (kısa)', 'Kol atel'],
        'bacak_atel': ['Bacak atel (kısa)', 'Bacak atel'],
        'cilt_traksiyon': ['Cilt traksiyonu uygulaması', 'Cilt traksiyon'],
        'servikal_collar': ['Servikal collar uygulaması', 'Servikal collar'],
        'travma_yelegi': ['Travma yeleği', 'Travma yelek'],
        'vakum_sedye': ['Vakum sedye uygulaması', 'Vakum sedye'],
        'sirt_tahtasi': ['Sırt tahtası uygulaması', 'Sırt tahtası'],
        # Dolaşım desteği
        'cpr': ['CPR (Resüsitasyon)', 'CPR'],
        'ekg': ['EKG Uygulaması', 'EKG'],
        'defibrilasyon': ['Defibrilasyon (CPR)', 'Defibrilasyon'],
        'kardiyoversiyon': ['Kardiyoversiyon'],
        'monitorizasyon': ['Monitörizasyon'],
        'kanama_kontrolu': ['Kanama kontrolü', 'Kanama kontrol'],
        'cut_down': ['Cut down'],
        # Hava yolu
        'balon_valf': ['Balon Valf Maske', 'Balon valf'],
        'aspirasyon': ['Aspirasyon uygulaması', 'Aspirasyon'],
        'orofaringeal': ['Orofaringeal tüp uygulaması', 'Orofaringeal tüp'],
        'entubasyon': ['Endotrakeal entübasyon', 'Entübasyon'],
        'mekanik_vent': ['Mekanik ventilasyon (CPAP–BIPAP dahil)', 'Mekanik ventilasyon'],
        'oksijen': ['Oksijen inhalasyon', 'Oksijen'],
        # Diğer işlemler
        'normal_dogum': ['Normal doğum (Suda dahil)', 'Normal doğum'],
        'kan_sekeri': ['Kan şekeri ölçümü', 'Kan şekeri'],
        'lokal_anestezi': ['Lokal anestezi', 'Lokal'],
        'tirnak_avulsiyon': ['Tırnak avülsiyonu', 'Tırnak'],
        'transkutan_pao2': ['Transkutan PaO2-CO2', 'Transkutan'],
        'debritman': ['Debridman', 'Debridman'],
        'sutur_alinmasi': ['Sütür alınması', 'Sütür alma'],
        # Yenidoğan
        'transport_kuvoz': ['Transport küvöz', 'Küvöz'],
        'canlandirma': ['Yenidoğan canlandırma', 'Canlandırma'],
        'im_enjeksiyon': ['IM enjeksiyon', 'IM'],
        'iv_enjeksiyon': ['IV enjeksiyon', 'IV'],
        'iv_mayi': ['IV mayi', 'Mayi'],
        # Sıvı tedavisi
        'nacl_250': ['%0.9 NaCl 250 cc', 'NaCl 250'],
        'nacl_500': ['%0.9 NaCl 500 cc', 'NaCl 500'],
        'nacl_100': ['%0.9 NaCl 100 cc', 'NaCl 100'],
        'dextroz_500': ['%5 Dextroz 500 cc', 'Dextroz 500'],
        'mannitol_500': ['%20 Mannitol 500 cc', 'Mannitol 500'],
        'isolyte_p': ['İsolyte P 500 cc', 'Isolyte P'],
        'isolyte_s': ['İsolyte S 500 cc', 'Isolyte S'],
        'dengeleyici': ['Dengeleyici solüsyon', 'Dengeleyici'],
        'ringer_laktat': ['Laktatlı Ringer 500 cc', 'Ringer laktat'],
    }
    
    def find_procedure_value(procedures_dict, proc_key, field_type):
        """Dictionary formatındaki procedures içinden değer bul"""
        if not isinstance(procedures_dict, dict):
            return None
        
        # Mapping'den olası isimler al
        possible_names = PROCEDURE_NAME_MAPPING.get(proc_key, [proc_key])
        
        for proc_name, proc_value in procedures_dict.items():
            # İsim eşleşmesi kontrol et
            proc_name_lower = proc_name.lower()
            matched = False
            
            for possible in possible_names:
                if possible.lower() in proc_name_lower or proc_name_lower in possible.lower():
                    matched = True
                    break
            
            # Genel eşleşme de dene
            if not matched and proc_key.replace('_', ' ') in proc_name_lower:
                matched = True
            if not matched and proc_key.replace('_', '') in proc_name_lower.replace(' ', ''):
                matched = True
            
            if matched:
                if isinstance(proc_value, dict):
                    if proc_value.get('checked'):
                        if field_type == 'adet':
                            return str(proc_value.get('adet', 1))
                        return '☑'
                elif proc_value:  # Boolean true
                    if field_type == 'adet':
                        return '1'
                    return '☑'
        
        return '☐' if field_type == 'cb' else ''
    
    # İşlemler - proc., airway., circ., other., newborn., fluid. prefix'leri
    procedure_prefixes = ['proc.', 'airway.', 'circ.', 'other.', 'newborn.', 'fluid.']
    for prefix in procedure_prefixes:
        if field_key.startswith(prefix):
            procedures = case_data.get('procedures', {})
            parts = field_key.split('.')
            proc_key = parts[1].lower() if len(parts) > 1 else ''
            field_type = parts[2] if len(parts) > 2 else 'cb'
            
            result = find_procedure_value(procedures, proc_key, field_type)
            if result:
                return result
            return '☐' if field_type == 'cb' else ''
    
    # ============ MEDICATION MAPPING ============
    MEDICATION_NAME_MAPPING = {
        'arveles': ['Arveles amp.', 'Arveles'],
        'dikloron': ['Dikloron amp.', 'Dikloron'],
        'spazmolitik': ['Spazmolitik amp.', 'Spazmolitik'],
        'adrenalin_05': ['Adrenalin 0,5 mg amp.', 'Adrenalin 0.5'],
        'adrenalin_1': ['Adrenalin 1 mg amp.', 'Adrenalin 1'],
        'atropin': ['Atropin 0,5 mg amp.', 'Atropin'],
        'flumazenil': ['Flumazenil amp.', 'Flumazenil'],
        'dopamin': ['Dopamin amp.', 'Dopamin'],
        'citanest': ['Citanest flk.', 'Citanest', 'Priloc'],
        'nahco3': ['NaHCO3 amp.', 'NaHCO3', 'Bikarbonat'],
        'dizem': ['Dizem amp.', 'Dizem'],
        'aminocordial': ['Aminocordial amp.', 'Aminocordial'],
        'furosemid': ['Furosemid amp.', 'Furosemid', 'Lasix'],
        'ca_glukonat': ['Ca Glukonat amp.', 'Kalsiyum glukonat'],
        'diltizem': ['Diltizem amp.', 'Diltizem'],
        'avil': ['Avil amp.', 'Avil'],
        'dekort': ['Dekort amp.', 'Dekort'],
        'antiepileptik': ['Antiepileptik amp.', 'Antiepileptik'],
        'prednol': ['Prednol amp.', 'Prednol'],
        'aktif_komur': ['Aktif kömür', 'Aktif komur'],
        'beloc': ['Beloc amp.', 'Beloc'],
        'salbutamol': ['Salbutamol amp.', 'Salbutamol', 'Ventolin'],
        'aritmal': ['Aritmal amp.', 'Aritmal'],
        'isoptin': ['Isoptin amp.', 'Isoptin'],
        'kapril': ['Kapril amp.', 'Kapril'],
        'magnezyum': ['Magnezyum amp.', 'Magnezyum'],
        'isorid': ['Isorid amp.', 'Isorid'],
        'coraspin': ['Coraspin tab.', 'Coraspin', 'Aspirin'],
        'paracetamol': ['Paracetamol', 'Perfalgan'],
        'midazolam': ['Midazolam amp.', 'Midazolam', 'Dormicum'],
        'dramamine': ['Dramamine amp.', 'Dramamine'],
        'rotapamid': ['Rotapamid amp.', 'Rotapamid'],
    }
    
    if field_key.startswith('med.'):
        medications = case_data.get('medications', [])
        parts = field_key.split('.')
        med_key = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        possible_names = MEDICATION_NAME_MAPPING.get(med_key, [med_key])
        
        # medications liste formatında
        if isinstance(medications, list):
            for med in medications:
                med_name = (med.get('name', '') or '').lower()
                med_code = (med.get('code', '') or '').lower()
                
                for possible in possible_names:
                    if possible.lower() in med_name or possible.lower() in med_code or med_key in med_name:
                        if field_type == 'adet':
                            return str(med.get('quantity', med.get('count', 1)))
                        if field_type == 'tur':
                            return med.get('route', med.get('type', ''))
                        return '☑'
        
        return '☐' if field_type == 'cb' else ''
    
    # ============ MATERIAL MAPPING ============
    MATERIAL_NAME_MAPPING = {
        'enjektor_1_2': ['Enjektör 1-2 cc', 'Enjektör 1-2'],
        'enjektor_5': ['Enjektör 5 cc', 'Enjektör 5'],
        'enjektor_10_20': ['Enjektör 10-20 cc', 'Enjektör 10-20'],
        'monitor_pedi': ['Monitör pedi', 'Monitor pedi'],
        'iv_kateter_14_22': ['I.V. katater 14-22', 'IV kateter 14-22'],
        'iv_kateter_24': ['I.V. katater 24', 'IV kateter 24'],
        'serum_seti': ['Serum seti'],
        'steril_eldiven': ['Steril eldiven'],
        'cerrahi_eldiven': ['Cerrahi eldiven'],
        'sponc': ['Sponç'],
        'sargi_bezi': ['Sargı bezi'],
        'idrar_torbasi': ['İdrar torbası', 'Idrar torbası'],
        'bisturi_ucu': ['Bistüri ucu', 'Bisturi'],
        'entubasyon_balonlu': ['Entübasyon tüpü (balonlu)', 'Entübasyon balonlu'],
        'entubasyon_balonsuz': ['Entübasyon tüpü (balonsuz)', 'Entübasyon balonsuz'],
        'airway': ['Airway'],
        'foley_sonda': ['Foley sonda'],
        'ng_sonda': ['NG sonda'],
        'atravmatik_ipek': ['Atravmatik ipek sütür', 'Atravmatik ipek'],
        'atravmatik_katkut': ['Atravmatik katkut sütür', 'Atravmatik katkut'],
        'dogum_seti': ['Doğum seti'],
        'yanik_battaniyesi': ['Yanık battaniyesi'],
        'o2_maskesi_hazneli_eriskin': ['O2 maskesi hazneli (erişkin)', 'O2 maskesi hazneli erişkin'],
        'o2_maskesi_hazneli_pediatrik': ['O2 maskesi hazneli (pediatrik)', 'O2 maskesi hazneli pediatrik'],
        'o2_kanulu_eriskin': ['O2 kanülü (erişkin)', 'O2 kanülü erişkin'],
        'o2_kanulu_pediatrik': ['O2 kanülü (pediatrik)', 'O2 kanülü pediatrik'],
        'flaster': ['Flaster'],
        'servikal_collar': ['Servikal collar'],
        'elastik_bandaj': ['Elastik bandaj'],
        'etil_chloride': ['Etil chloride', 'Etil klorid'],
        'o2_maskesi_haznesiz_eriskin': ['O2 maskesi haznesiz (erişkin)', 'O2 maskesi haznesiz erişkin'],
        'o2_maskesi_haznesiz_pediatrik': ['O2 maskesi haznesiz (pediatrik)', 'O2 maskesi haznesiz pediatrik'],
    }
    
    if field_key.startswith('mat.'):
        materials = case_data.get('materials', {})
        parts = field_key.split('.')
        mat_key = parts[1].lower() if len(parts) > 1 else ''
        field_type = parts[2] if len(parts) > 2 else 'cb'
        
        possible_names = MATERIAL_NAME_MAPPING.get(mat_key, [mat_key])
        
        # materials dictionary formatında
        if isinstance(materials, dict):
            for mat_name, mat_value in materials.items():
                mat_name_lower = mat_name.lower()
                matched = False
                
                for possible in possible_names:
                    if possible.lower() in mat_name_lower or mat_name_lower in possible.lower():
                        matched = True
                        break
                
                if not matched and mat_key.replace('_', ' ') in mat_name_lower:
                    matched = True
                
                if matched:
                    if isinstance(mat_value, dict):
                        if mat_value.get('checked'):
                            if field_type == 'adet':
                                return str(mat_value.get('adet', 1))
                            return '☑'
                    elif mat_value:
                        if field_type == 'adet':
                            return '1'
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

