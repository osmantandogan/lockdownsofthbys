from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime
import uuid

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
    "cagri_merkezi"
]

# User Models
class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    email: EmailStr
    name: str
    picture: Optional[str] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    tc_no: Optional[str] = None
    temp_roles: List[str] = Field(default_factory=list)  # Temporary roles
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
    gender: Literal["erkek", "kadin", "diger"]
    complaint: str
    phone: Optional[str] = None
    clinic: Optional[str] = None
    preliminary_diagnosis: Optional[str] = None

class LocationInfo(BaseModel):
    address: str
    district: Optional[str] = None
    village_or_neighborhood: Optional[str] = None
    coordinates: Optional[dict] = None
    address_description: Optional[str] = None
    pickup_location: Optional[str] = None
    first_dropoff: Optional[str] = None
    final_dropoff: Optional[str] = None

class AssignedTeam(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    paramedic_id: Optional[str] = None
    att_id: Optional[str] = None
    nurse_id: Optional[str] = None
    assigned_at: datetime = Field(default_factory=datetime.utcnow)

class CaseStatusUpdate(BaseModel):
    status: CaseStatus
    note: Optional[str] = None
    updated_by: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    location: Optional[dict] = None  # GPS coordinates

class Case(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    case_number: str  # Format: YYYYMMDD-XXXX
    caller: CallerInfo
    patient: PatientInfo
    location: LocationInfo
    priority: CasePriority
    status: CaseStatus = "acildi"
    assigned_team: Optional[AssignedTeam] = None
    status_history: List[CaseStatusUpdate] = Field(default_factory=list)
    case_details: Optional[dict] = None  # Extra form fields
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CaseCreate(BaseModel):
    caller: CallerInfo
    patient: PatientInfo
    location: LocationInfo
    priority: CasePriority
    case_details: Optional[dict] = None

class CaseAssignTeam(BaseModel):
    vehicle_id: str
    driver_id: Optional[str] = None
    paramedic_id: Optional[str] = None
    att_id: Optional[str] = None
    nurse_id: Optional[str] = None

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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class VehicleCreate(BaseModel):
    plate: str
    type: VehicleType
    km: int = 0
    fuel_level: Optional[int] = None

class VehicleUpdate(BaseModel):
    plate: Optional[str] = None
    status: Optional[VehicleStatus] = None
    km: Optional[int] = None
    fuel_level: Optional[int] = None

# Stock Models
StockLocation = Literal["ambulans", "saha_ofis", "acil_canta", "merkez_depo"]

class StockItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str
    code: str
    quantity: int
    min_quantity: int
    location: StockLocation
    location_detail: Optional[str] = None  # e.g., vehicle plate, room number
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    qr_code: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class StockItemCreate(BaseModel):
    name: str
    code: str
    quantity: int
    min_quantity: int
    location: StockLocation
    location_detail: Optional[str] = None
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None

class StockItemUpdate(BaseModel):
    quantity: Optional[int] = None
    min_quantity: Optional[int] = None
    location: Optional[StockLocation] = None
    location_detail: Optional[str] = None

# Shift Models
class Shift(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    user_id: str
    vehicle_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ShiftStart(BaseModel):
    vehicle_qr: str

class ShiftEnd(BaseModel):
    shift_id: str
    notes: Optional[str] = None

# Notification Models
class Notification(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    user_id: str
    title: str
    message: str
    type: Literal["info", "warning", "error", "success"]
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

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
    created_at: datetime = Field(default_factory=datetime.utcnow)
