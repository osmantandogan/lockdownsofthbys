from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime
import uuid
from utils.timezone import get_turkey_time

# User Roles
UserRole = Literal[
    "merkez_ofis",
    "operasyon_muduru",
    "doktor",
    "hemsire",
    "paramedik",
    "att",
    "bas_sofor",
    "sofor",
    "cagri_merkezi",
    "personel",  # New: General staff role (no specific screens)
    "temizlik"   # New: Temizlik personeli
]

# User Models
class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    email: EmailStr
    name: str
    picture: Optional[str] = None  # Google picture
    profile_photo: Optional[str] = None  # Custom uploaded photo (Base64)
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    tc_no: Optional[str] = None
    temp_roles: List[str] = Field(default_factory=list)  # Temporary roles
    is_active: bool = True
    signature: Optional[str] = None  # Base64 signature data
    signature_updated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=get_turkey_time)

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    tc_no: Optional[str] = None

# Case Models
CasePriority = Literal["yuksek", "orta", "dusuk"]
CaseStatus = Literal[
    "acildi",
    "ekip_bilgilendirildi",
    "ekip_yola_cikti",
    "sahada",
    "hasta_alindi",
    "doktor_konsultasyonu",
    "merkeze_donus",
    "hastane_sevki",
    "tamamlandi",
    "iptal"
]

class CallerInfo(BaseModel):
    name: str
    phone: str
    relationship: str
    organization: Optional[str] = None

class PatientInfo(BaseModel):
    name: str
    surname: str
    tc_no: Optional[str] = None
    age: int
    birth_date: Optional[str] = None  # Doğum tarihi (YYYY-MM-DD)
    gender: Literal["erkek", "kadin", "diger"]
    complaint: str
    phone: Optional[str] = None
    clinic: Optional[str] = None
    preliminary_diagnosis: Optional[str] = None
    patient_type: Optional[Literal["proje_calisani", "disaridan_vatandas"]] = "disaridan_vatandas"  # New field

class LocationInfo(BaseModel):
    address: str
    district: Optional[str] = None
    village_or_neighborhood: Optional[str] = None
    coordinates: Optional[dict] = None  # {"lat": 41.0082, "lng": 28.9784}
    address_description: Optional[str] = None  # Adres tarifi
    pickup_location: Optional[str] = None
    first_dropoff: Optional[str] = None
    final_dropoff: Optional[str] = None

class AssignedTeam(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    paramedic_id: Optional[str] = None
    att_id: Optional[str] = None
    nurse_id: Optional[str] = None
    assigned_at: datetime = Field(default_factory=get_turkey_time)

class CaseStatusUpdate(BaseModel):
    status: CaseStatus
    note: Optional[str] = None
    updated_by: str
    updated_by_name: Optional[str] = None  # Kullanıcı adı
    updated_by_role: Optional[str] = None  # Kullanıcı rolü (att, paramedik, hemsire vb.)
    updated_at: datetime = Field(default_factory=get_turkey_time)
    location: Optional[dict] = None  # GPS coordinates

class MedicalFormData(BaseModel):
    """Real-time editable medical form data"""
    # Vital signs
    blood_pressure: Optional[str] = None
    pulse: Optional[int] = None
    spo2: Optional[int] = None
    temperature: Optional[float] = None
    respiration_rate: Optional[int] = None
    blood_sugar: Optional[int] = None
    gcs: Optional[int] = None  # Glasgow Coma Scale
    
    # Diagnosis
    preliminary_diagnosis: Optional[List[dict]] = None  # [{code, name}] - ICD codes
    final_diagnosis: Optional[List[dict]] = None
    
    # Treatment
    treatments: Optional[List[dict]] = None  # List of treatments applied
    medications: Optional[List[dict]] = None  # List of medications given
    
    # Transfer info
    transfer_hospital: Optional[dict] = None  # {name, type, il, ilce}
    transfer_time: Optional[datetime] = None
    
    # Notes
    anamnesis: Optional[str] = None  # History
    physical_exam: Optional[str] = None
    notes: Optional[str] = None
    
    # Signatures
    patient_signature: Optional[str] = None  # Base64
    staff_signature: Optional[str] = None
    
class DoctorApproval(BaseModel):
    """Doctor approval status"""
    status: Literal["pending", "approved", "rejected"] = "pending"
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None

class CaseParticipant(BaseModel):
    """Active participant in case form"""
    user_id: str
    user_name: str
    user_role: str
    joined_at: datetime = Field(default_factory=get_turkey_time)
    last_activity: datetime = Field(default_factory=get_turkey_time)

class Case(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    case_number: str  # Format: YYYYMMDD-XXXX
    caller: CallerInfo
    patient: PatientInfo
    location: LocationInfo
    priority: CasePriority
    status: CaseStatus = "acildi"
    assigned_team: Optional[AssignedTeam] = None  # Ana/ilk atanan ekip
    assigned_teams: List[AssignedTeam] = Field(default_factory=list)  # YENİ: Birden fazla ekip desteği
    status_history: List[CaseStatusUpdate] = Field(default_factory=list)
    case_details: Optional[dict] = None  # Extra form fields
    
    # Real-time collaboration
    medical_form: Optional[MedicalFormData] = None
    participants: List[CaseParticipant] = Field(default_factory=list)
    doctor_approval: Optional[DoctorApproval] = None
    last_form_update: Optional[datetime] = None
    last_form_updater: Optional[str] = None
    
    # Video call
    video_room_id: Optional[str] = None
    
    # YENİ: Healmedy Lokasyonu (Nakil > Healmedy altında)
    healmedy_location_id: Optional[str] = None  # osman_gazi_fpu vb.
    healmedy_location_name: Optional[str] = None
    
    # Zaman damgaları
    timestamps: Optional[dict] = None  # {call_received, scene_arrival, patient_contact, scene_departure, hospital_arrival, station_return}
    
    created_by: str
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class CaseTimestamps(BaseModel):
    """Vaka zaman damgaları"""
    call_received: Optional[datetime] = None  # Çağrı alındı
    scene_arrival: Optional[datetime] = None  # Olay yerine varış
    patient_contact: Optional[datetime] = None  # Hastaya varış
    scene_departure: Optional[datetime] = None  # Olay yerinden ayrılış
    hospital_arrival: Optional[datetime] = None  # Hastaneye varış
    station_return: Optional[datetime] = None  # İstasyona dönüş

class CaseCreate(BaseModel):
    caller: CallerInfo
    patient: PatientInfo
    location: LocationInfo
    priority: CasePriority
    case_details: Optional[dict] = None
    timestamps: Optional[CaseTimestamps] = None

class CaseAssignTeam(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    paramedic_id: Optional[str] = None
    att_id: Optional[str] = None
    nurse_id: Optional[str] = None


class CaseAssignMultipleTeams(BaseModel):
    """Birden fazla araç atama"""
    vehicle_ids: List[str]  # Birden fazla araç ID

class CaseUpdateStatus(BaseModel):
    status: CaseStatus
    note: Optional[str] = None

# Vehicle Models
VehicleStatus = Literal["musait", "gorevde", "bakimda", "arizali", "kullanim_disi"]
VehicleType = Literal["ambulans", "arac"]

class Vehicle(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    plate: str
    type: VehicleType
    status: VehicleStatus = "musait"
    km: int = 0
    fuel_level: Optional[int] = None  # 0-100
    qr_code: str = Field(default_factory=lambda: str(uuid.uuid4()))
    current_case_id: Optional[str] = None
    
    # İstasyon kodu (ambulanslar için)
    station_code: Optional[str] = None  # Örn: 9365, 9370, 9375, 9360, 9355, 9356
    
    # Lokasyon bilgisi
    healmedy_location_id: Optional[str] = None
    healmedy_location_name: Optional[str] = None
    
    # Maintenance tracking (from Excel)
    last_inspection_date: Optional[datetime] = None
    next_maintenance_km: Optional[int] = None  # Next 20000 block
    
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class VehicleCreate(BaseModel):
    plate: str
    type: VehicleType
    km: int = 0
    fuel_level: Optional[int] = None
    station_code: Optional[str] = None
    last_inspection_date: Optional[datetime] = None
    next_maintenance_km: Optional[int] = None

class VehicleUpdate(BaseModel):
    plate: Optional[str] = None
    status: Optional[VehicleStatus] = None
    km: Optional[int] = None
    fuel_level: Optional[int] = None
    station_code: Optional[str] = None
    last_inspection_date: Optional[datetime] = None
    next_maintenance_km: Optional[int] = None

# Stock Models
# Eski sabit lokasyonlar (geriye dönük uyumluluk için)
# StockLocation = Literal["ambulans", "saha_ofis", "acil_canta", "merkez_depo"]
# Artık dinamik lokasyonlar kullanıyoruz (araç plakaları, bekleme noktaları vb.)
StockLocation = str  # Dinamik lokasyon desteği

class StockItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str
    code: str  # Internal code
    gtin: Optional[str] = None  # GS1 GTIN (14 digits) - from barcode
    quantity: int
    min_quantity: int
    location: StockLocation
    location_detail: Optional[str] = None  # e.g., vehicle plate, room number
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None  # From barcode (21)
    expiry_date: Optional[datetime] = None
    qr_code: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit: str = "adet"  # adet, kutu, ampul, ml, etc.
    
    # YENİ: Kutu/Adet yönetimi
    unit_type: Literal["kutu", "adet"] = "adet"  # Merkez depoda kutu, sahada adet
    box_quantity: Optional[int] = None  # Kutudaki adet sayısı (karekoddan veya manuel)
    original_box_id: Optional[str] = None  # Parçalandıysa ana kutu referansı
    
    # YENİ: Lokasyon referansı
    field_location_id: Optional[str] = None  # FieldLocation ID referansı
    source_transfer_id: Optional[str] = None  # Hangi transferle geldi
    
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class StockItemCreate(BaseModel):
    name: str
    code: str
    gtin: Optional[str] = None
    quantity: int
    min_quantity: int
    location: StockLocation
    location_detail: Optional[str] = None
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    unit: str = "adet"

class StockItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    location: Optional[StockLocation] = None
    location_detail: Optional[str] = None
    gtin: Optional[str] = None
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    unit: Optional[str] = None

# Medication Usage Models (Case-specific)
MedicationSourceType = Literal["arac", "carter"]  # Araç stoğu veya lokasyon dolab (carter)


class MedicationUsage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    case_id: str
    stock_item_id: Optional[str] = None  # Reference to stock item (if matched)
    
    # From barcode/manual entry
    name: str
    gtin: Optional[str] = None
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    
    # Usage info
    quantity: int = 1
    unit: str = "adet"
    dosage: Optional[str] = None  # e.g., "500mg", "10ml"
    route: Optional[str] = None  # IV, IM, oral, etc.
    
    # Tracking
    added_by: str
    added_by_name: str
    added_at: datetime = Field(default_factory=get_turkey_time)
    
    # Stock deduction
    stock_deducted: bool = False
    vehicle_plate: Optional[str] = None  # Which vehicle's stock
    
    # YENİ: Kaynak bilgisi (Araç mı, Carter mı?)
    source_type: Optional[MedicationSourceType] = "arac"  # arac veya carter
    source_location_id: Optional[str] = None  # FieldLocation ID
    source_location_name: Optional[str] = None  # Görüntüleme için

class MedicationUsageCreate(BaseModel):
    name: str
    gtin: Optional[str] = None
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    quantity: int = 1
    unit: str = "adet"
    dosage: Optional[str] = None
    route: Optional[str] = None
    stock_item_id: Optional[str] = None
    # YENİ: Kaynak bilgisi
    source_type: Optional[str] = None  # 'vehicle' veya 'carter'
    source_location_id: Optional[str] = None
    source_location_name: Optional[str] = None

# Stock Usage Log (for audit)
class StockUsageLog(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    stock_item_id: str
    case_id: Optional[str] = None
    medication_usage_id: Optional[str] = None
    
    action: Literal["kullanim", "iade", "duzeltme", "transfer", "sayim"]
    quantity_change: int  # Negative for usage, positive for return
    previous_quantity: int
    new_quantity: int
    
    reason: Optional[str] = None
    performed_by: str
    performed_by_name: str
    performed_at: datetime = Field(default_factory=get_turkey_time)

# Parsed Barcode Data
class ParsedBarcodeData(BaseModel):
    gtin: Optional[str] = None
    lot_number: Optional[str] = None
    serial_number: Optional[str] = None
    expiry_date: Optional[str] = None  # YYMMDD format from barcode
    expiry_date_parsed: Optional[datetime] = None  # Parsed datetime
    raw_data: str

# Shift Types
ShiftType = Literal["saha_24", "ofis_8"]  # saha_24: 08:00-08:00(+1), ofis_8: 08:00-17:00

# Shift Models
class ShiftAssignment(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    user_id: str
    vehicle_id: Optional[str] = None
    location_type: Literal["arac", "saglik_merkezi"] = "arac"
    health_center_name: Optional[str] = None
    assigned_by: str
    shift_date: datetime
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None  # HH:MM format
    end_date: Optional[datetime] = None  # For night shifts that span to next day
    
    # YENİ: Healmedy Lokasyonu
    healmedy_location_id: Optional[str] = None  # osman_gazi_fpu, green_zone_ronesans vb.
    healmedy_location_name: Optional[str] = None  # Görüntüleme için
    status: Literal["pending", "started", "completed", "cancelled"] = "pending"
    is_driver_duty: bool = False  # ATT/Paramedik için şoför görevi var mı?
    shift_type: ShiftType = "saha_24"  # Vardiya tipi: saha 24 saat veya ofis 8 saat
    assigned_role: Optional[str] = None  # Geçici görev rolü (örn: paramedik → şoför olarak görevlendirildi)
    created_at: datetime = Field(default_factory=get_turkey_time)

class Shift(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    assignment_id: Optional[str] = None
    user_id: str
    vehicle_id: Optional[str] = None
    vehicle_plate: Optional[str] = None
    start_time: datetime = Field(default_factory=get_turkey_time)
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    start_km: Optional[int] = None
    end_km: Optional[int] = None
    status: Literal["active", "on_break", "completed", "cancelled"] = "active"
    notes: Optional[str] = None
    
    # Location info (for health center shifts)
    location_type: Optional[Literal["arac", "saglik_merkezi"]] = "arac"
    health_center_name: Optional[str] = None
    
    # Admin started shift
    started_by_admin: bool = False
    admin_id: Optional[str] = None
    admin_note: Optional[str] = None
    
    # Vehicle inspection photos - Updated with new photo fields
    # front: Ön taraf, back: Arka taraf, left: Sol taraf, right: Sağ taraf
    # rear_cabin_open: Arka kapılar açık arka kabin (eski trunk)
    # interior: İç kabin, engine: Kaput içi motor
    # left_door_open: Sol kapı açık, right_door_open: Sağ kapı açık
    # front_cabin: Ön kabin, front_cabin_seats_back: Ön kabin koltuk arkası
    # damages: Hasar fotoğrafları (opsiyonel, sınırsız)
    photos: Optional[dict] = None
    
    # Daily control form
    daily_control: Optional[dict] = None
    
    # Handover form  
    handover_form: Optional[dict] = None
    
    # Handover session reference
    handover_session_id: Optional[str] = None
    
    # YENİ: Vardiya Bitirme Bilgileri (ATT/Paramedik için)
    end_photos: Optional[dict] = None  # 4 köşe fotoğrafları
    # rear_cabin_corner_1: Sol-ön köşe
    # rear_cabin_corner_2: Sağ-ön köşe
    # rear_cabin_corner_3: Sol-arka köşe
    # rear_cabin_corner_4: Sağ-arka köşe
    
    quick_checkout: bool = False  # Hızlı doldurma kullanıldı mı
    end_signature: Optional[str] = None  # Bitiş imzası (Base64)
    end_otp_verified: bool = False  # OTP ile mi onaylandı
    
    # Günlük kontrol formu dolduruldu mu (ekip bazlı)
    daily_control_filled_by: Optional[str] = None  # Dolduran kişi ID
    daily_control_filled_at: Optional[datetime] = None
    
    # YENİ: Healmedy Lokasyonu
    healmedy_location_id: Optional[str] = None
    healmedy_location_name: Optional[str] = None
    
    # YENİ: Form açılış-kapanış zamanları (Log için)
    form_opened_at: Optional[datetime] = None  # Form ne zaman açıldı
    form_completed_at: Optional[datetime] = None  # Form ne zaman tamamlandı
    section_times: Optional[dict] = None  # Her section ne kadar sürdü
    
    created_at: datetime = Field(default_factory=get_turkey_time)


# Handover Session - Devir Teslim Oturumu
class HandoverSession(BaseModel):
    """Vardiya devir teslim süreci"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    
    # Taraflar
    giver_id: str  # Devreden şoför
    giver_name: str
    receiver_id: str  # Devralan şoför
    receiver_name: str
    
    # Araç
    vehicle_id: str
    vehicle_plate: str
    
    # Durum
    status: Literal["waiting_receiver", "waiting_manager", "approved", "rejected", "expired"] = "waiting_receiver"
    
    # Zaman logları
    form_opened_at: datetime = Field(default_factory=get_turkey_time)  # Form ne zaman açıldı
    receiver_signed_at: Optional[datetime] = None  # Devralan ne zaman imzaladı
    manager_action_at: Optional[datetime] = None  # Yönetici ne zaman işlem yaptı
    
    # Onay bilgileri
    receiver_signature: Optional[str] = None  # Base64 imza
    receiver_otp_verified: bool = False  # OTP ile mi onaylandı
    manager_id: Optional[str] = None  # Onaylayan yönetici
    manager_name: Optional[str] = None
    rejection_reason: Optional[str] = None
    
    # Vardiya başlatma logları
    receiver_login_at: Optional[datetime] = None  # Devralan sisteme ne zaman girdi
    shift_start_clicked_at: Optional[datetime] = None  # Vardiya başlat ne zaman tıklandı
    shift_started_at: Optional[datetime] = None  # Vardiya gerçekte ne zaman başladı
    
    # İlişkili kayıtlar
    giver_shift_id: Optional[str] = None  # Devreden şoförün vardiyası
    receiver_shift_id: Optional[str] = None  # Devralanın başlattığı vardiya
    
    # Form verileri
    handover_form_data: Optional[dict] = None  # Devir teslim formu
    
    # Geçerlilik
    expires_at: Optional[datetime] = None  # Oturum geçerlilik süresi
    
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class ShiftStart(BaseModel):
    vehicle_qr: str
    photos: Optional[dict] = None
    daily_control: Optional[dict] = None

class ShiftEnd(BaseModel):
    shift_id: str
    notes: Optional[str] = None
    handover_form: Optional[dict] = None

# Notification Models
class Notification(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    user_id: str
    title: str
    message: str
    type: Literal["info", "warning", "error", "success"]
    is_read: bool = False
    created_at: datetime = Field(default_factory=get_turkey_time)

# Audit Log Models
class AuditLog(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    details: dict
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=get_turkey_time)

# Vehicle KM Log Models
class VehicleKmLog(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    vehicle_id: str
    case_id: Optional[str] = None
    shift_id: Optional[str] = None
    user_id: str
    start_km: int
    end_km: int
    km_difference: int
    log_type: Literal["case", "shift", "maintenance", "other"]
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=get_turkey_time)

# Document Metadata Models
class DocumentMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    form_type: str  # Form türü (kvkk, ambulance_case, etc.)
    doc_no: str  # Döküman numarası
    publish_date: datetime  # Yayın tarihi
    page_count: int  # Sayfa sayısı
    page_no: str  # Sayfa no (örn: "1-5")
    revision_no: int  # Revizyon numarası
    created_by: str
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class DocumentMetadataCreate(BaseModel):
    form_type: str
    doc_no: str
    publish_date: datetime
    page_count: int
    page_no: str
    revision_no: int

class DocumentMetadataUpdate(BaseModel):
    doc_no: Optional[str] = None
    publish_date: Optional[datetime] = None
    page_count: Optional[int] = None
    page_no: Optional[str] = None
    revision_no: Optional[int] = None

# Form Models
FormType = Literal[
    "kvkk", "injection", "puncture", "minor_surgery", "general_consent",
    "medicine_request", "material_request", "medical_gas_request",
    "ambulance_equipment", "pre_case_check", "ambulance_case",
    "daily_control", "handover", "zimmet", "siparis_talep"
]

class FormSubmission(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    form_type: FormType
    form_data: dict
    submitted_by: str
    patient_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    case_id: Optional[str] = None
    status: Literal["draft", "submitted", "approved", "rejected"] = "submitted"
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class FormSubmissionCreate(BaseModel):
    form_type: FormType
    form_data: dict
    patient_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    case_id: Optional[str] = None


# ==================== HASTA KARTI MODELLERI ====================

# Kan Grubu
BloodType = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-", "Bilinmiyor"]

# Cinsiyet
Gender = Literal["erkek", "kadin", "diger", "belirtilmemis"]

# Alerji Tipi
AllergyType = Literal["ilac", "gida", "cevresel", "latex", "diger"]

# Alerji Şiddeti
AllergySeverity = Literal["hafif", "orta", "siddetli", "anafilaksi"]

class Allergy(BaseModel):
    """Alerji kaydı"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: AllergyType
    name: str  # Alerjen adı (örn: Penisilin, Fıstık)
    severity: AllergySeverity
    reaction: Optional[str] = None  # Reaksiyon açıklaması
    notes: Optional[str] = None
    recorded_by: Optional[str] = None  # Kaydeden kullanıcı ID
    recorded_at: datetime = Field(default_factory=get_turkey_time)

class ChronicDisease(BaseModel):
    """Kronik hastalık kaydı"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Hastalık adı (örn: Diyabet, Hipertansiyon)
    icd_code: Optional[str] = None  # ICD-10 kodu
    diagnosis_date: Optional[str] = None  # Tanı tarihi
    status: Literal["aktif", "kontrol_altinda", "remisyon", "iyilesmis"] = "aktif"
    medications: Optional[str] = None  # Kullandığı ilaçlar
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    recorded_at: datetime = Field(default_factory=get_turkey_time)

class DoctorNote(BaseModel):
    """Doktor notu / brif"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doctor_id: str
    doctor_name: str
    title: str  # Not başlığı
    content: str  # Not içeriği
    priority: Literal["dusuk", "normal", "yuksek", "kritik"] = "normal"
    is_alert: bool = False  # Uyarı olarak gösterilsin mi?
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class MedicalHistory(BaseModel):
    """Tıbbi geçmiş kaydı (vaka bazlı)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    case_id: str
    case_number: str
    date: datetime
    complaint: str  # Şikayet
    diagnosis: Optional[str] = None  # Tanı
    treatment: Optional[str] = None  # Tedavi
    medications_given: Optional[List[str]] = None  # Verilen ilaçlar
    vital_signs: Optional[dict] = None  # Vital bulgular
    outcome: Optional[str] = None  # Sonuç
    notes: Optional[str] = None
    attended_by: Optional[str] = None  # Müdahale eden

class EmergencyContact(BaseModel):
    """Acil durum iletişim bilgisi"""
    name: str
    relationship: str  # Yakınlık (örn: eş, anne, kardeş)
    phone: str
    is_primary: bool = False

class PatientCard(BaseModel):
    """Hasta Kartı Ana Modeli"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    
    # Kimlik Bilgileri
    tc_no: str  # TC Kimlik No (unique)
    name: str
    surname: str
    birth_date: Optional[str] = None
    gender: Gender = "belirtilmemis"
    blood_type: BloodType = "Bilinmiyor"
    
    # İletişim Bilgileri
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    
    # Acil Durum İletişim
    emergency_contacts: List[EmergencyContact] = Field(default_factory=list)
    
    # Tıbbi Bilgiler
    allergies: List[Allergy] = Field(default_factory=list)
    chronic_diseases: List[ChronicDisease] = Field(default_factory=list)
    doctor_notes: List[DoctorNote] = Field(default_factory=list)
    medical_history: List[MedicalHistory] = Field(default_factory=list)
    
    # Genel Notlar
    general_notes: Optional[str] = None
    
    # Sigorta Bilgileri
    insurance_type: Optional[str] = None  # SGK, Özel, Yok
    insurance_number: Optional[str] = None
    
    # Meta
    created_by: str
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)
    last_accessed_at: Optional[datetime] = None
    last_accessed_by: Optional[str] = None

class PatientCardCreate(BaseModel):
    """Hasta kartı oluşturma"""
    tc_no: str
    name: str
    surname: str
    birth_date: Optional[str] = None
    gender: Optional[Gender] = "belirtilmemis"
    blood_type: Optional[BloodType] = "Bilinmiyor"
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    insurance_type: Optional[str] = None
    insurance_number: Optional[str] = None
    general_notes: Optional[str] = None

class PatientCardUpdate(BaseModel):
    """Hasta kartı güncelleme"""
    name: Optional[str] = None
    surname: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[Gender] = None
    blood_type: Optional[BloodType] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    insurance_type: Optional[str] = None
    insurance_number: Optional[str] = None
    general_notes: Optional[str] = None

class PatientAccessRequest(BaseModel):
    """Hemşire için erişim isteği"""
    patient_id: str
    reason: str  # Erişim nedeni
    approval_code: str  # Doktor/müdürden alınan onay kodu

class PatientAccessLog(BaseModel):
    """Hasta kartı erişim logu"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    patient_id: str
    patient_tc: str
    user_id: str
    user_name: str
    user_role: str
    access_type: Literal["view", "edit", "add_allergy", "add_disease", "add_note", "add_history"]
    access_granted: bool
    approval_code: Optional[str] = None  # Hemşire için onay kodu
    approved_by: Optional[str] = None  # Onaylayan (hemşire erişimi için)
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=get_turkey_time)


# ==================== MALZEME TALEBİ MODELLERİ ====================

MaterialRequestStatus = Literal["pending", "approved", "rejected", "completed"]
MaterialRequestPriority = Literal["normal", "urgent", "critical"]

class MaterialRequestItem(BaseModel):
    """Talep edilen malzeme"""
    name: str
    quantity: int = 1
    unit: str = "adet"
    notes: Optional[str] = None

class MaterialRequest(BaseModel):
    """Malzeme Talebi - Şoförler tarafından oluşturulur"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    
    # Talep eden
    requester_id: str
    requester_name: str
    requester_role: str
    
    # Araç/Lokasyon bilgisi
    vehicle_id: Optional[str] = None
    vehicle_plate: Optional[str] = None
    location: Optional[str] = None  # Lokasyon adı (araç veya bekleme noktası)
    
    # Talep detayları
    items: List[MaterialRequestItem] = Field(default_factory=list)
    priority: MaterialRequestPriority = "normal"
    notes: Optional[str] = None
    
    # Durum
    status: MaterialRequestStatus = "pending"
    
    # Onay bilgileri
    reviewed_by: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    
    # Tamamlama bilgileri
    completed_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)

class MaterialRequestCreate(BaseModel):
    """Malzeme talebi oluşturma"""
    vehicle_id: Optional[str] = None
    vehicle_plate: Optional[str] = None
    location: Optional[str] = None
    items: List[MaterialRequestItem]
    priority: MaterialRequestPriority = "normal"
    notes: Optional[str] = None


# ==================== HEALMEDY LOKASYONLARI ====================

# Sabit Healmedy Lokasyonları
HEALMEDY_LOCATIONS = [
    {"id": "osman_gazi_fpu", "name": "Osman Gazi/FPU"},
    {"id": "green_zone_ronesans", "name": "Green Zone/Rönesans"},
    {"id": "bati_kuzey_isg", "name": "Batı-Kuzey/İSG BİNA"},
    {"id": "red_zone_kara", "name": "Red Zone/Kara Tesisleri"},
    {"id": "dogu_rihtimi", "name": "Doğu Rıhtımı"},
    {"id": "filyos_saglik_merkezi", "name": "Filyos Sağlık Merkezi"},
    {"id": "merkez_ofis", "name": "Merkez Ofis"},
    {"id": "liman_giris", "name": "Liman Girişi"},
    {"id": "ana_depo", "name": "Ana Depo"},
]

# Lokasyon tipi
FieldLocationType = Literal["merkez_depo", "arac", "carter"]


class FieldLocation(BaseModel):
    """Saha Lokasyonu - Araç, Carter (dolap), Merkez Depo"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str  # Lokasyon adı
    location_type: FieldLocationType  # merkez_depo, arac, carter
    
    # Healmedy lokasyonu (osman_gazi_fpu, green_zone_ronesans vb.)
    healmedy_location_id: Optional[str] = None
    healmedy_location_name: Optional[str] = None
    
    # Araç ilişkisi
    vehicle_id: Optional[str] = None  # Carter için bağlı olduğu araç
    vehicle_plate: Optional[str] = None
    
    # QR Kod
    qr_code: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Durum
    is_active: bool = True
    
    # Meta
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)


class FieldLocationCreate(BaseModel):
    """Saha lokasyonu oluşturma"""
    name: str
    location_type: FieldLocationType
    healmedy_location_id: Optional[str] = None
    vehicle_id: Optional[str] = None


# ==================== STOK TRANSFER ====================

StockTransferType = Literal["box_to_units", "location_transfer", "return"]


class StockTransfer(BaseModel):
    """Stok Transferi - Depodan araç/carter'a, kutu→adet dönüşümü"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    
    # Kaynak
    from_location_id: str
    from_location_name: str
    from_location_type: FieldLocationType
    
    # Hedef
    to_location_id: str
    to_location_name: str
    to_location_type: FieldLocationType
    
    # Ürün bilgisi
    stock_item_id: str
    stock_item_name: str
    gtin: Optional[str] = None
    lot_number: Optional[str] = None
    
    # Miktar (Kutu olarak gönderilir, adet olarak alınır)
    quantity_boxes: int = 0  # Kaç kutu gönderildi
    units_per_box: int = 1   # Kutuda kaç adet var
    total_units: int = 0     # Toplam adet (boxes * units_per_box)
    
    # Transfer tipi
    transfer_type: StockTransferType
    
    # Kim yaptı
    transferred_by: str
    transferred_by_name: str
    
    # Notlar
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=get_turkey_time)


class StockTransferCreate(BaseModel):
    """Stok transferi oluşturma"""
    from_location_id: str
    to_location_id: str
    stock_item_id: str
    quantity_boxes: int
    units_per_box: int = 1  # Karekoddan veya manuel
    transfer_type: StockTransferType = "location_transfer"
    notes: Optional[str] = None


# ==================== LOKASYON DEĞİŞİKLİĞİ İSTEĞİ ====================

LocationChangeStatus = Literal["pending", "approved", "rejected"]


class LocationChangeRequest(BaseModel):
    """Lokasyon Değişikliği İsteği - ATT/Paramedik lokasyon değiştirir"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    
    # İstek sahibi
    requester_id: str
    requester_name: str
    requester_role: str
    
    # Araç
    vehicle_id: str
    vehicle_plate: str
    
    # Lokasyonlar
    from_location_id: str
    from_location_name: str
    to_location_id: str
    to_location_name: str
    
    # Neden
    reason: Optional[str] = None
    
    # Durum
    status: LocationChangeStatus = "pending"
    
    # Onay bilgisi
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    created_at: datetime = Field(default_factory=get_turkey_time)


class LocationChangeRequestCreate(BaseModel):
    """Lokasyon değişikliği isteği oluşturma"""
    vehicle_id: str
    to_location_id: str
    reason: Optional[str] = None


# ==================== VARDİYA GÜNCEL LOKASYON ====================

class VehicleCurrentLocation(BaseModel):
    """Aracın güncel lokasyonu"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    vehicle_id: str
    vehicle_plate: Optional[str] = None
    
    # Atanan lokasyon (vardiya başında)
    assigned_location_id: Optional[str] = None
    assigned_location_name: Optional[str] = None
    
    # Güncel lokasyon (değişebilir)
    current_location_id: Optional[str] = None
    current_location_name: Optional[str] = None
    
    # Kim güncelledi
    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=get_turkey_time)
    
    # Vardiya bilgisi
    shift_id: Optional[str] = None
    shift_date: Optional[datetime] = None


# ==================== PDF ŞABLON MODELLERİ ====================

# Kullanılabilir kutucuk tipleri
PdfBlockType = Literal[
    "hasta_zaman",          # Hasta ve Zaman Bilgileri
    "tibbi_bilgiler",       # Tıbbi Bilgiler
    "nakil_hastanesi",      # Nakil Hastanesi
    "vitaller",             # Vital Bulgular
    "klinik_gozlemler",     # Klinik Gözlemler
    "anamnez",              # Anamnez
    "fizik_muayene",        # Fizik Muayene
    "uygulamalar",          # Uygulamalar/Müdahaleler
    "genel_notlar",         # Genel Notlar
    "ilac_malzeme",         # Kullanılan İlaç ve Malzemeler
    "transfer_durumu",      # Transfer Durumu
    "tasit_protokol",       # Taşıt ve Protokol Bilgileri
    "hasta_bilgilendirme",  # Hasta Bilgilendirme Onayı
    "hastane_reddi",        # Hastanenin Hasta Reddi
    "hasta_reddi",          # Hastanın Hizmet Reddi
    "teslim_imzalar",       # Teslim İmzaları
    "resim",                # Özel Resim
    "metin",                # Özel Metin
    "bos"                   # Boş Alan
]

# Şablonun kullanılabileceği yerler
PdfTemplateUsage = Literal[
    "vaka_formu",           # Vaka Formu PDF
    "vardiya_formu",        # Vardiya Formu PDF
    "hasta_karti",          # Hasta Kartı PDF
    "genel_rapor"           # Genel Rapor
]


class PdfBlockField(BaseModel):
    """Kutucuk içindeki alan tanımı"""
    field_id: str           # Alan ID'si (örn: "patient_name", "blood_pressure")
    label: str              # Görünen etiket
    visible: bool = True    # Görünür mü?
    order: int = 0          # Sıralama


class PdfBlock(BaseModel):
    """PDF'teki bir kutucuk"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    block_type: PdfBlockType
    title: str              # Kutucuk başlığı
    
    # Pozisyon ve boyut (piksel cinsinden, A4: 595x842 pt)
    x: float = 0
    y: float = 0
    width: float = 280      # Varsayılan genişlik
    height: float = 100     # Varsayılan yükseklik
    
    # Sayfa numarası (0-indexed)
    page: int = 0
    
    # İçerik alanları (özelleştirilebilir)
    fields: List[PdfBlockField] = Field(default_factory=list)
    
    # Özel içerik (metin veya resim bloğu için)
    custom_content: Optional[str] = None
    custom_image: Optional[str] = None  # Base64
    
    # Stil
    show_border: bool = True
    show_title: bool = True
    font_size: int = 10
    background_color: Optional[str] = None


class PdfHeaderFooter(BaseModel):
    """Üst/Alt bilgi alanı"""
    enabled: bool = False
    height: float = 50      # Piksel
    
    # İçerik
    left_text: Optional[str] = None     # Sol metin (örn: "HEALMEDY")
    center_text: Optional[str] = None   # Orta metin
    right_text: Optional[str] = None    # Sağ metin (örn: tarih)
    
    # Logo
    logo: Optional[str] = None          # Base64
    logo_position: Literal["left", "center", "right"] = "left"
    
    # Sayfa numarası
    show_page_number: bool = False
    page_number_format: str = "Sayfa {current}/{total}"


class PdfTemplate(BaseModel):
    """PDF Şablon tanımı"""
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str                           # Şablon adı
    description: Optional[str] = None   # Açıklama
    
    # Sayfa ayarları
    page_count: int = 1                 # Sayfa sayısı
    page_size: Literal["A4", "A5", "Letter"] = "A4"
    orientation: Literal["portrait", "landscape"] = "portrait"
    
    # Üst/Alt bilgi
    header: PdfHeaderFooter = Field(default_factory=PdfHeaderFooter)
    footer: PdfHeaderFooter = Field(default_factory=PdfHeaderFooter)
    
    # Kutucuklar
    blocks: List[PdfBlock] = Field(default_factory=list)
    
    # Kullanım yeri
    usage_types: List[PdfTemplateUsage] = Field(default_factory=list)
    
    # Varsayılan mı?
    is_default: bool = False
    
    # Oluşturan
    created_by: str
    created_by_name: str
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)
    
    # Aktif mi?
    is_active: bool = True


class PdfTemplateCreate(BaseModel):
    """Şablon oluşturma"""
    name: str
    description: Optional[str] = None
    page_count: int = 1
    page_size: Literal["A4", "A5", "Letter"] = "A4"
    orientation: Literal["portrait", "landscape"] = "portrait"
    header: Optional[PdfHeaderFooter] = None
    footer: Optional[PdfHeaderFooter] = None
    blocks: List[PdfBlock] = Field(default_factory=list)
    usage_types: List[PdfTemplateUsage] = Field(default_factory=list)
    is_default: bool = False


class PdfTemplateUpdate(BaseModel):
    """Şablon güncelleme"""
    name: Optional[str] = None
    description: Optional[str] = None
    page_count: Optional[int] = None
    page_size: Optional[Literal["A4", "A5", "Letter"]] = None
    orientation: Optional[Literal["portrait", "landscape"]] = None
    header: Optional[PdfHeaderFooter] = None
    footer: Optional[PdfHeaderFooter] = None
    blocks: Optional[List[PdfBlock]] = None
    usage_types: Optional[List[PdfTemplateUsage]] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None
