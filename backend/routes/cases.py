from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import List, Optional, Any
from database import cases_collection, vehicles_collection, users_collection, shift_assignments_collection, medication_usage_collection
from models import Case, CaseCreate, CaseAssignTeam, CaseUpdateStatus, CaseStatusUpdate, MedicalFormData, DoctorApproval, CaseParticipant
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta
from utils.timezone import get_turkey_time
from email_service import send_case_notifications
from pydantic import BaseModel
import uuid
import os
import logging

# Bildirim servisi
try:
    from services.notification_service import notification_service, NotificationType, NotificationChannel
    NOTIFICATIONS_ENABLED = True
except ImportError:
    NOTIFICATIONS_ENABLED = False

# FCM Bildirim servisi
try:
    from services.firebase_service import send_fcm_to_multiple, send_case_notification_fcm
    FCM_ENABLED = True
except ImportError:
    FCM_ENABLED = False
    
logger = logging.getLogger(__name__)

router = APIRouter()

# Vaka numarası başlangıç değeri - 1'den başlar, 6 haneli format (000001)
CASE_NUMBER_START = 1

# Counter collection - günlük vaka numarası için
from database import db
counters_collection = db["counters"]

async def peek_next_case_sequence() -> int:
    """Günlük sıralı vaka numarasını ÖNİZLE - Counter'ı ARTIRMAZ"""
    # Türkiye saati (UTC+3)
    turkey_now = get_turkey_time()
    today = turkey_now.strftime("%Y%m%d")
    counter_id = f"case_number_{today}"
    
    # Sadece oku, artırma
    result = await counters_collection.find_one({"_id": counter_id})
    
    # Eğer yoksa ilk vaka 1 olacak
    current_seq = result["seq"] if result else 0
    next_seq = current_seq + 1
    
    logger.info(f"[CASE_NUMBER_PEEK] Bugün ({today}) için sonraki sıra: {next_seq}")
    return next_seq

async def get_next_case_sequence() -> int:
    """Günlük sıralı vaka numarası al - Atomic counter kullanarak (ARTIRIR)"""
    from pymongo import ReturnDocument
    
    # Türkiye saati (UTC+3)
    turkey_now = get_turkey_time()
    today = turkey_now.strftime("%Y%m%d")
    counter_id = f"case_number_{today}"
    
    # Atomic increment - findAndModify ile
    result = await counters_collection.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    
    seq = result["seq"] if result else 1
    logger.info(f"[CASE_NUMBER] Bugün ({today}) için sıra: {seq}")
    
    return seq

async def generate_case_number() -> str:
    """Generate case number in format YYYYMMDD-XXXXXX (starting from 000001)"""
    # Türkiye saati (UTC+3)
    now = get_turkey_time()
    date_str = now.strftime("%Y%m%d")
    seq = await get_next_case_sequence()
    # Tam 6 haneli format: 000001, 000002, ...
    seq_str = str(seq).zfill(6)
    return f"{date_str}-{seq_str}"

@router.get("/next-case-number")
async def get_next_case_number(request: Request):
    """Sonraki vaka numarasını döndür (SADECE ÖNİZLEME - Counter artırmaz)"""
    user = await get_current_user(request)
    
    # Türkiye saati (UTC+3)
    now = get_turkey_time()
    date_str = now.strftime("%Y%m%d")
    
    # PEEK kullan - counter'ı artırmaz!
    seq = await peek_next_case_sequence()
    seq_str = str(seq).zfill(6)
    
    return {"next_case_number": f"{date_str}-{seq_str}"}

@router.post("", response_model=Case)
async def create_case(data: CaseCreate, request: Request):
    """Create new case (Call Center)"""
    user = await get_current_user(request)
    
    # Generate case number (async - sıralı numara)
    case_number = await generate_case_number()
    
    # Timestamps oluştur - çağrı saatini kaydet
    timestamps_data = None
    if hasattr(data, 'timestamps') and data.timestamps:
        timestamps_data = data.timestamps.model_dump() if hasattr(data.timestamps, 'model_dump') else data.timestamps
    else:
        # Varsayılan olarak çağrı saatini şimdi olarak ayarla
        timestamps_data = {"call_received": datetime.now().isoformat()}
    
    # Create case
    new_case = Case(
        case_number=case_number,
        caller=data.caller,
        patient=data.patient,
        location=data.location,
        priority=data.priority,
        case_details=data.case_details if hasattr(data, 'case_details') else None,
        timestamps=timestamps_data,
        created_by=user.id
    )
    
    # Add initial status to history - kullanıcı adı ve rolü ile
    initial_status = CaseStatusUpdate(
        status="acildi",
        note="Vaka oluşturuldu",
        updated_by=user.id,
        updated_by_name=user.name,
        updated_by_role=user.role
    )
    new_case.status_history.append(initial_status)
    
    case_dict = new_case.model_dump(by_alias=True)
    await cases_collection.insert_one(case_dict)
    
    # Vaka oluşturma bildirimi gönder (arka planda)
    if NOTIFICATIONS_ENABLED:
        try:
            from services.notification_service import get_users_by_role
            
            # İlgili rollere bildirim gönder
            managers = await get_users_by_role(["merkez_ofis", "operasyon_muduru"])
            recipients = []
            for manager in managers:
                recipients.append({
                    "user_id": manager["id"],
                    "phone": manager.get("phone"),
                    "push_subscriptions": manager.get("push_subscriptions", []),
                    "fcm_token": manager.get("fcm_token"),
                    "notification_preferences": manager.get("notification_preferences", {})
                })
            
            if recipients:
                patient_info = case_dict.get("patient", {})
                location_info = case_dict.get("location", {})
                
                await notification_service.send_notification(
                    NotificationType.CASE_CREATED,
                    recipients,
                    {
                        "case_number": case_number,
                        "patient_name": f"{patient_info.get('name', '')} {patient_info.get('surname', '')}".strip() or "Belirtilmemiş",
                        "location": location_info.get("address", "Belirtilmemiş"),
                        "priority": case_dict.get("priority", "Normal"),
                        "created_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
                        "url": f"/dashboard/cases/{case_dict['_id']}"
                    },
                    channels=[NotificationChannel.SMS, NotificationChannel.WEB_PUSH, NotificationChannel.IN_APP]
                )
                logger.info(f"Sent case creation notifications to {len(recipients)} recipients")
        except Exception as e:
            logger.error(f"Error sending case creation notifications: {e}", exc_info=True)
    
    # Return with 'id' field for frontend
    case_dict["id"] = case_dict.pop("_id")
    return case_dict

@router.get("", response_model=List[Case])
async def get_cases(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    source: Optional[str] = None,  # 'call_center' or 'registration'
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    last_24h: Optional[bool] = False,
    user_id: Optional[str] = None,  # Hangi kullanıcı işlem yapmış
    medication_name: Optional[str] = None,  # Hangi ilaç kullanılmış
    has_hospital_transfer: Optional[bool] = None,  # Hastaneye sevk var mı
    page: Optional[int] = 1,
    limit: Optional[int] = 30
):
    """Get all cases with filters"""
    user = await get_current_user(request)
    
    # Build query
    query = {}
    filters = []
    
    # Role-based filtering - saha personeli sadece atandıkları veya oluşturdukları vakaları görür
    # Hemşire tüm vakaları görebilir
    if user.role in ["paramedik", "att", "sofor"]:
        # Atandığı VEYA oluşturduğu vakaları görsün
        filters.append({
            "$or": [
                {"assigned_team.driver_id": user.id},
                {"assigned_team.paramedic_id": user.id},
                {"assigned_team.att_id": user.id},
                {"assigned_team.nurse_id": user.id},
                {"created_by": user.id}  # Kendi oluşturduğu vakalar
            ]
        })
    # Hemşire tüm vakaları görebilir - filtre ekleme
    
    if status:
        filters.append({"status": status})
    
    if priority:
        filters.append({"priority": priority})
    
    if search:
        filters.append({
            "$or": [
                {"case_number": {"$regex": search, "$options": "i"}},
                {"patient.name": {"$regex": search, "$options": "i"}},
                {"patient.surname": {"$regex": search, "$options": "i"}}
            ]
        })
    
    # Source filter (kaynak filtresi)
    if source:
        if source == "call_center":
            # Çağrı merkezi - case_details.type yoksa veya 'ayaktan_basvuru' değilse
            filters.append({
                "$or": [
                    {"case_details.type": {"$exists": False}},
                    {"case_details.type": {"$ne": "ayaktan_basvuru"}}
                ]
            })
        elif source == "registration":
            # Kayıt ekranı - case_details.type == 'ayaktan_basvuru'
            filters.append({"case_details.type": "ayaktan_basvuru"})
    
    # Date filters
    if last_24h:
        last_24h_time = get_turkey_time() - timedelta(hours=24)
        filters.append({"created_at": {"$gte": last_24h_time}})
    else:
        if start_date:
            try:
                start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                start = start.replace(hour=0, minute=0, second=0, microsecond=0)
                filters.append({"created_at": {"$gte": start}})
            except:
                pass
        if end_date:
            try:
                end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                end = end.replace(hour=23, minute=59, second=59, microsecond=999999)
                filters.append({"created_at": {"$lte": end}})
            except:
                pass
    
    # Combine all filters with $and
    if filters:
        query = {"$and": filters} if len(filters) > 1 else filters[0]
    
    # Pagination
    skip = (page - 1) * limit if page > 0 else 0
    
    # Get cases
    cases_cursor = cases_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    cases = await cases_cursor.to_list(limit)
    
    # Advanced filters (user_id, medication_name, has_hospital_transfer)
    # These require additional lookups
    if user_id or medication_name is not None or has_hospital_transfer is not None:
        # Get case IDs that match advanced filters
        advanced_query = {}
        if user_id:
            # Kullanıcının işlem yaptığı vakalar
            # Status history'de veya medication usage'da veya participants'da
            advanced_query["$or"] = [
                {"status_history.updated_by": user_id},
                {"participants.user_id": user_id},
                {"assigned_team.driver_id": user_id},
                {"assigned_team.paramedic_id": user_id},
                {"assigned_team.att_id": user_id},
                {"assigned_team.nurse_id": user_id}
            ]
        
        if medication_name:
            # Medication usage'dan ilaç adına göre vakaları bul
            med_cases = await medication_usage_collection.find({
                "name": {"$regex": medication_name, "$options": "i"}
            }).to_list(1000)
            med_case_ids = [m.get("case_id") for m in med_cases if m.get("case_id")]
            if med_case_ids:
                if "$or" in advanced_query:
                    advanced_query["$or"].append({"_id": {"$in": med_case_ids}})
                else:
                    advanced_query["_id"] = {"$in": med_case_ids}
            else:
                # Eğer ilaç bulunamazsa boş liste döndür
                return []
        
        if has_hospital_transfer is not None:
            # Transfer sekmesinde "Hastaneye Nakil" veya "Hastaneler Arası Nakil" var mı?
            if has_hospital_transfer:
                # Medical form'da transfer bilgisi var mı kontrol et
                # Bu durumda medical_form.transfers array'inde "Hastaneye Nakil" veya "Hastaneler Arası Nakil" olmalı
                pass  # Bu filtreyi case query'ye ekleyemeyiz çünkü medical_form nested, sonra filtreleyeceğiz
        
        # Apply advanced filters to cases
        if advanced_query:
            advanced_cases = await cases_collection.find(advanced_query).to_list(1000)
            advanced_case_ids = [c["_id"] for c in advanced_cases]
            cases = [c for c in cases if c["_id"] in advanced_case_ids]
        
        # Hospital transfer filter
        if has_hospital_transfer is not None:
            filtered_cases = []
            for case in cases:
                medical_form = case.get("medical_form", {})
                transfers = medical_form.get("transfers", {})
                has_transfer = (
                    transfers.get("Hastaneye Nakil") or 
                    transfers.get("Hastaneler Arası Nakil")
                )
                if has_hospital_transfer == has_transfer:
                    filtered_cases.append(case)
            cases = filtered_cases
    
    for case in cases:
        case["id"] = case.pop("_id")
        
        # Add source info for frontend
        case_details = case.get("case_details", {})
        if case_details.get("type") == "ayaktan_basvuru":
            case["source"] = "registration"
        else:
            case["source"] = "call_center"
    
    return cases

@router.get("/{case_id}")
async def get_case(case_id: str, request: Request):
    """Get case by ID with 36-hour access restriction"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # 36 saat erişim kısıtı kontrolü
    access_info = await check_case_access(case_doc, user)
    
    case_doc["id"] = case_doc.pop("_id")
    case_doc["access_info"] = access_info
    
    return case_doc


async def check_case_access(case_doc: dict, user) -> dict:
    """
    36 saat erişim kısıtı kontrolü
    Returns: access_info dict with can_edit, is_restricted, reason
    """
    # Varsayılan: tam erişim
    access_info = {
        "can_view": True,
        "can_edit": True,
        "is_restricted": False,
        "reason": None,
        "requires_approval": False
    }
    
    # Operasyon Müdürü ve Merkez Ofis için her zaman tam erişim
    exempt_roles = ['operasyon_muduru', 'merkez_ofis']
    if user.role in exempt_roles:
        return access_info
    
    # Vakanın oluşturulma zamanını kontrol et
    created_at = case_doc.get("created_at")
    if not created_at:
        return access_info
    
    # 36 saat kontrolü
    hours_36 = timedelta(hours=36)
    now = get_turkey_time()
    
    # Eğer created_at string ise parse et
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        except:
            return access_info
    
    time_elapsed = now - created_at.replace(tzinfo=None)
    
    if time_elapsed > hours_36:
        # 36 saat geçmiş - kısıtlı erişim
        access_info["can_edit"] = False
        access_info["is_restricted"] = True
        access_info["reason"] = "36 saat geçtiği için düzenleme yetkisi kaldırıldı"
        access_info["requires_approval"] = True
        access_info["hours_elapsed"] = int(time_elapsed.total_seconds() / 3600)
    
    return access_info


class CaseAccessApprovalRequest(BaseModel):
    """Vaka erişim onayı isteği"""
    case_id: str
    otp_code: str
    approver_id: str  # Onaylayan müdürün ID'si


@router.post("/{case_id}/request-access")
async def request_case_access(case_id: str, data: CaseAccessApprovalRequest, request: Request):
    """
    36 saat sonrası vaka erişimi için OTP onayı al
    Müdürün OTP koduyla onay gerektirir
    """
    user = await get_current_user(request)
    
    # Vakayı kontrol et
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Onaylayıcıyı kontrol et (müdür veya merkez ofis olmalı)
    approver = await users_collection.find_one({"_id": data.approver_id})
    if not approver:
        raise HTTPException(status_code=404, detail="Onaylayıcı bulunamadı")
    
    if approver.get("role") not in ['operasyon_muduru', 'merkez_ofis']:
        raise HTTPException(status_code=403, detail="Sadece müdür veya merkez ofis onaylayabilir")
    
    # OTP kodunu doğrula
    from services.otp_service import verify_user_otp
    
    otp_secret = approver.get("otp_secret")
    if not otp_secret:
        raise HTTPException(status_code=400, detail="Onaylayıcının OTP'si oluşturulmamış")
    
    if not verify_user_otp(otp_secret, data.otp_code):
        raise HTTPException(status_code=400, detail="Geçersiz onay kodu")
    
    # Erişim izni ver - vakaya geçici erişim kaydı ekle
    access_grant = {
        "user_id": user.id,
        "granted_by": data.approver_id,
        "granted_at": get_turkey_time(),
        "expires_at": get_turkey_time() + timedelta(hours=4),  # 4 saatlik erişim
        "otp_verified": True
    }
    
    await cases_collection.update_one(
        {"_id": case_id},
        {"$push": {"access_grants": access_grant}}
    )
    
    logger.info(f"Case {case_id} access granted to {user.id} by {data.approver_id}")
    
    return {
        "success": True,
        "message": "Erişim onaylandı. 4 saat boyunca düzenleme yapabilirsiniz.",
        "expires_at": access_grant["expires_at"].isoformat()
    }


class PatientInfoUpdate(BaseModel):
    """Hasta bilgisi güncelleme"""
    name: Optional[str] = None
    surname: Optional[str] = None
    tc_no: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


@router.patch("/{case_id}/patient")
async def update_patient_info(case_id: str, data: PatientInfoUpdate, request: Request):
    """
    Hasta bilgilerini güncelle (Ad-Soyad, TC, Yaş, Cinsiyet)
    Düzenleme yetkisi olan tüm roller erişebilir
    """
    user = await get_current_user(request)
    
    # Düzenleme yetkisi kontrolü
    edit_roles = ['operasyon_muduru', 'merkez_ofis', 'doktor', 'hemsire', 'paramedik', 'att']
    if user.role not in edit_roles:
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok")
    
    # Vakayı kontrol et
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Güncellenecek alanları hazırla
    update_fields = {}
    if data.name is not None:
        update_fields["patient.name"] = data.name
    if data.surname is not None:
        update_fields["patient.surname"] = data.surname
    if data.tc_no is not None:
        update_fields["patient.tc_no"] = data.tc_no
    if data.age is not None:
        update_fields["patient.age"] = data.age
    if data.birth_date is not None:
        update_fields["patient.birth_date"] = data.birth_date
    if data.gender is not None:
        update_fields["patient.gender"] = data.gender
    if data.phone is not None:
        update_fields["patient.phone"] = data.phone
    if data.address is not None:
        update_fields["patient.address"] = data.address
    if data.status is not None:
        update_fields["patient.status"] = data.status
    
    if not update_fields:
        return {"message": "Güncellenecek alan yok"}
    
    update_fields["updated_at"] = get_turkey_time()
    
    await cases_collection.update_one(
        {"_id": case_id},
        {"$set": update_fields}
    )
    
    logger.info(f"Patient info updated for case {case_id} by {user.id}")
    
    return {
        "success": True,
        "message": "Hasta bilgileri güncellendi"
    }


@router.post("/{case_id}/assign-team")
async def assign_team(case_id: str, data: CaseAssignTeam, request: Request):
    """Assign team to case (Operation Manager, Call Center, Nurse, Doctor)"""
    user = await get_current_user(request)
    
    # Çağrı merkezi, hemşire ve doktor da ekip atayabilir
    allowed_roles = ["merkez_ofis", "operasyon_muduru", "cagri_merkezi", "hemsire", "doktor"]
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok")
    
    # Check if vehicle exists and is available
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Sadece ambulans tipindeki araçlara vaka ataması yapılabilir
    if vehicle.get("type") != "ambulans":
        raise HTTPException(status_code=400, detail="Sadece ambulans tipindeki araçlara vaka ataması yapılabilir")
    
    if vehicle["status"] != "musait":
        raise HTTPException(status_code=400, detail="Vehicle is not available")
    
    # Bugünkü vardiya atamalarından ekibi otomatik bul
    
    # O araca atanmış personeli bul
    vehicle_assignments = await shift_assignments_collection.find({
        "vehicle_id": data.vehicle_id,
        "status": {"$in": ["pending", "started"]}
    }).to_list(100)
    
    logger.info(f"Found {len(vehicle_assignments)} assignments for vehicle {data.vehicle_id}")
    
    # Ekip ID'lerini doldur (eğer gönderilmemişse)
    assigned_team = data.model_dump()
    
    for assignment in vehicle_assignments:
        user_id = assignment.get("user_id")
        logger.info(f"Processing assignment: user_id={user_id}")
        if user_id:
            # Kullanıcının rolünü bul
            assigned_user = await users_collection.find_one({"_id": user_id})
            if assigned_user:
                role = assigned_user.get("role")
                user_name = assigned_user.get("name", "")
                logger.info(f"User {user_id} has role: {role}, name: {user_name}")
                if role == "sofor" or role == "bas_sofor":
                    if not assigned_team.get("driver_id"):
                        assigned_team["driver_id"] = user_id
                        assigned_team["driver_name"] = user_name
                        logger.info(f"Set driver_id to {user_id}, name: {user_name}")
                elif role == "paramedik":
                    if not assigned_team.get("paramedic_id"):
                        assigned_team["paramedic_id"] = user_id
                        assigned_team["paramedic_name"] = user_name
                        logger.info(f"Set paramedic_id to {user_id}, name: {user_name}")
                elif role == "att":
                    if not assigned_team.get("att_id"):
                        assigned_team["att_id"] = user_id
                        assigned_team["att_name"] = user_name
                        logger.info(f"Set att_id to {user_id}, name: {user_name}")
                elif role == "hemsire":
                    if not assigned_team.get("nurse_id"):
                        assigned_team["nurse_id"] = user_id
                        assigned_team["nurse_name"] = user_name
                        logger.info(f"Set nurse_id to {user_id}, name: {user_name}")
                elif role == "doktor":
                    if not assigned_team.get("doctor_id"):
                        assigned_team["doctor_id"] = user_id
                        assigned_team["doctor_name"] = user_name
                        logger.info(f"Set doctor_id to {user_id}, name: {user_name}")
    
    logger.info(f"Final assigned_team: {assigned_team}")
    assigned_team["assigned_at"] = get_turkey_time()
    
    status_update = CaseStatusUpdate(
        status="ekip_bilgilendirildi",
        note="Ekip görevlendirildi",
        updated_by=user.id,
        updated_by_name=user.name,
        updated_by_role=user.role
    )
    
    await cases_collection.update_one(
        {"_id": case_id},
        {
            "$set": {
                "assigned_team": assigned_team,
                "status": "ekip_bilgilendirildi",
                "updated_at": get_turkey_time()
            },
            "$push": {"status_history": status_update.model_dump()}
        }
    )
    
    # Update vehicle status
    await vehicles_collection.update_one(
        {"_id": data.vehicle_id},
        {
            "$set": {
                "status": "gorevde",
                "current_case_id": case_id,
                "updated_at": get_turkey_time()
            }
        }
    )
    
    # Bildirim gönder (arka planda)
    if NOTIFICATIONS_ENABLED:
        try:
            # Vaka bilgilerini al
            case_doc = await cases_collection.find_one({"_id": case_id})
            
            # Alıcıları belirle: ekip üyeleri + müdür + doktor
            recipient_ids = []
            
            # Ekip üyelerini ekle
            for key in ["driver_id", "paramedic_id", "att_id", "nurse_id"]:
                if assigned_team.get(key):
                    recipient_ids.append(assigned_team[key])
            
            # Doktor ve operasyon müdürü ekle
            managers = await users_collection.find({
                "role": {"$in": ["doktor", "operasyon_muduru", "merkez_ofis"]},
                "is_active": True
            }).to_list(50)
            
            for mgr in managers:
                if mgr["_id"] not in recipient_ids:
                    recipient_ids.append(mgr["_id"])
            
            # Alıcı bilgilerini topla
            recipients = []
            for rid in recipient_ids:
                user_doc = await users_collection.find_one({"_id": rid})
                if user_doc:
                    recipients.append({
                        "user_id": rid,
                        "phone": user_doc.get("phone"),
                        "push_subscriptions": user_doc.get("push_subscriptions", []),
                        "fcm_token": user_doc.get("fcm_token"),
                        "notification_preferences": user_doc.get("notification_preferences", {})
                    })
            
            # Vaka oluşturma bildirimi gönder
            if recipients:
                patient_info = case_doc.get("patient", {})
                location_info = case_doc.get("location", {})
                
                await notification_service.send_notification(
                    NotificationType.CASE_ASSIGNED,
                    recipients,
                    {
                        "case_number": case_doc.get("case_number"),
                        "patient_name": f"{patient_info.get('name', '')} {patient_info.get('surname', '')}".strip() or "Belirtilmemiş",
                        "location": location_info.get("address", "Belirtilmemiş"),
                        "priority": case_doc.get("priority", "Normal"),
                        "vehicle_plate": vehicle.get("plate", ""),
                        "url": f"/dashboard/cases/{case_id}"
                    }
                )
                logger.info(f"Sent notifications to {len(recipients)} recipients for case {case_id}")
        except Exception as e:
            logger.error(f"Error sending case notifications: {e}")
    
    # ========== FCM BİLDİRİMİ - ATT/PARAMEDİK/ŞOFÖR İÇİN ACİL ALARM ==========
    if FCM_ENABLED:
        try:
            case_doc = await cases_collection.find_one({"_id": case_id})
            patient_info = case_doc.get("patient", {})
            location_info = case_doc.get("location", {})
            
            # Saha personelinin FCM token'larını topla (att, paramedik, şoför)
            field_personnel_ids = []
            for key in ["driver_id", "paramedic_id", "att_id"]:
                if assigned_team.get(key):
                    field_personnel_ids.append(assigned_team[key])
            
            fcm_tokens = []
            for user_id in field_personnel_ids:
                user_doc = await users_collection.find_one({"_id": user_id})
                if user_doc and user_doc.get("fcm_tokens"):
                    # Token objelerinden sadece token string'lerini çıkar
                    for token_obj in user_doc["fcm_tokens"]:
                        if isinstance(token_obj, dict) and token_obj.get("token"):
                            fcm_tokens.append(token_obj["token"])
                        elif isinstance(token_obj, str):
                            fcm_tokens.append(token_obj)
            
            if fcm_tokens:
                patient_name = f"{patient_info.get('name', '')} {patient_info.get('surname', '')}".strip() or "Belirtilmemiş"
                address = location_info.get("address", "Belirtilmemiş")
                priority = case_doc.get("priority", "Normal")
                
                # Acil/Kritik vakalar için emergency channel kullan
                notification_type = "new_case"  # Android'de emergency alarm tetikler
                
                result = await send_fcm_to_multiple(
                    tokens=fcm_tokens,
                    title=f"🚨 YENİ VAKA - {priority.upper()}",
                    body=f"{patient_name}\n📍 {address}",
                    data={
                        "case_id": case_id,
                        "case_number": case_doc.get("case_number", ""),
                        "navigate_to": f"/dashboard/cases/{case_id}",
                        "target_roles": "att,paramedik,sofor"
                    },
                    notification_type=notification_type,
                    priority="high"
                )
                logger.info(f"FCM emergency sent to {len(fcm_tokens)} tokens: {result}")
        except Exception as e:
            logger.error(f"Error sending FCM notification: {e}")
    
    return {"message": "Team assigned successfully"}


@router.post("/{case_id}/assign-multiple-teams")
async def assign_multiple_teams(case_id: str, request: Request):
    """
    Vakaya birden fazla araç/ekip ata
    Body: { "vehicle_ids": ["id1", "id2", ...] }
    """
    user = await get_current_user(request)
    
    # Yetki kontrolü - baş şoför de ekleyebilsin
    allowed_roles = ["merkez_ofis", "operasyon_muduru", "cagri_merkezi", "hemsire", "doktor", "bas_sofor"]
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlemi yapmaya yetkiniz yok")
    
    body = await request.json()
    vehicle_ids = body.get("vehicle_ids", [])
    
    if not vehicle_ids:
        raise HTTPException(status_code=400, detail="En az bir araç seçmelisiniz")
    
    # Vakayı kontrol et
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    assigned_teams = []
    all_recipient_ids = []
    
    for vehicle_id in vehicle_ids:
        # Araç kontrolü
        vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        if not vehicle:
            logger.warning(f"Vehicle {vehicle_id} not found, skipping")
            continue
        
        # Sadece ambulans tipindeki araçlara vaka ataması yapılabilir
        if vehicle.get("type") != "ambulans":
            logger.warning(f"Vehicle {vehicle_id} is not an ambulance, skipping")
            continue
        
        # Araç müsait değilse uyarı ver ama engelleme (çoklu atama olabilir)
        if vehicle["status"] != "musait":
            logger.warning(f"Vehicle {vehicle_id} is not available (status: {vehicle['status']})")
        
        # Ekip bilgilerini al
        vehicle_assignments = await shift_assignments_collection.find({
            "vehicle_id": vehicle_id,
            "status": {"$in": ["pending", "started"]}
        }).to_list(100)
        
        team_data = {
            "vehicle_id": vehicle_id,
            "vehicle_plate": vehicle.get("plate"),
            "assigned_at": get_turkey_time()
        }
        
        for assignment in vehicle_assignments:
            user_id = assignment.get("user_id")
            if user_id:
                assigned_user = await users_collection.find_one({"_id": user_id})
                if assigned_user:
                    role = assigned_user.get("role")
                    user_name = assigned_user.get("name", "")
                    if role in ["sofor", "bas_sofor"] and not team_data.get("driver_id"):
                        team_data["driver_id"] = user_id
                        team_data["driver_name"] = user_name
                    elif role == "paramedik" and not team_data.get("paramedic_id"):
                        team_data["paramedic_id"] = user_id
                        team_data["paramedic_name"] = user_name
                    elif role == "att" and not team_data.get("att_id"):
                        team_data["att_id"] = user_id
                        team_data["att_name"] = user_name
                    elif role == "hemsire" and not team_data.get("nurse_id"):
                        team_data["nurse_id"] = user_id
                        team_data["nurse_name"] = user_name
                    elif role == "doktor" and not team_data.get("doctor_id"):
                        team_data["doctor_id"] = user_id
                        team_data["doctor_name"] = user_name
                    
                    # Bildirim listesine ekle
                    if user_id not in all_recipient_ids:
                        all_recipient_ids.append(user_id)
        
        assigned_teams.append(team_data)
        
        # Araç durumunu güncelle
        await vehicles_collection.update_one(
            {"_id": vehicle_id},
            {
                "$set": {
                    "status": "gorevde",
                    "current_case_id": case_id,
                    "updated_at": get_turkey_time()
                }
            }
        )
    
    if not assigned_teams:
        raise HTTPException(status_code=400, detail="Hiçbir araç atanamadı")
    
    # Status update
    status_update = CaseStatusUpdate(
        status="ekip_bilgilendirildi",
        note=f"{len(assigned_teams)} araç görevlendirildi",
        updated_by=user.id,
        updated_by_name=user.name,
        updated_by_role=user.role
    )
    
    # Vakayı güncelle - ilk ekibi assigned_team olarak, tümünü assigned_teams olarak kaydet
    update_data = {
        "assigned_team": assigned_teams[0],  # Geriye uyumluluk için ilk ekip
        "assigned_teams": assigned_teams,     # Tüm ekipler
        "status": "ekip_bilgilendirildi",
        "updated_at": get_turkey_time()
    }
    
    await cases_collection.update_one(
        {"_id": case_id},
        {
            "$set": update_data,
            "$push": {"status_history": status_update.model_dump()}
        }
    )
    
    # Bildirimleri gönder
    if NOTIFICATIONS_ENABLED and all_recipient_ids:
        try:
            recipients = await users_collection.find({"_id": {"$in": all_recipient_ids}}).to_list(100)
            await onesignal_service.send_notification_to_users(
                recipients,
                title=f"🚨 Vaka: {case_doc.get('case_number')}",
                message=f"Yeni vaka atandı. {len(assigned_teams)} araç görevlendirildi.",
                data={
                    "type": "case_assigned",
                    "case_id": case_id,
                    "url": f"/dashboard/cases/{case_id}"
                }
            )
        except Exception as e:
            logger.error(f"Error sending notifications: {e}")
    
    return {
        "message": f"{len(assigned_teams)} araç başarıyla görevlendirildi",
        "assigned_teams": assigned_teams
    }


@router.patch("/{case_id}/status")
async def update_case_status(case_id: str, data: CaseUpdateStatus, request: Request):
    """Update case status"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Create status update with user info
    status_update = CaseStatusUpdate(
        status=data.status,
        note=data.note,
        updated_by=user.id,
        updated_by_name=user.name,
        updated_by_role=user.role
    )
    
    update_data = {
        "status": data.status,
        "updated_at": get_turkey_time()
    }
    
    # If case is completed or cancelled, free the vehicle
    if data.status in ["tamamlandi", "iptal"]:
        if case_doc.get("assigned_team"):
            vehicle_id = case_doc["assigned_team"]["vehicle_id"]
            await vehicles_collection.update_one(
                {"_id": vehicle_id},
                {
                    "$set": {
                        "status": "musait",
                        "current_case_id": None,
                        "updated_at": get_turkey_time()
                    }
                }
            )
    
    await cases_collection.update_one(
        {"_id": case_id},
        {
            "$set": update_data,
            "$push": {"status_history": status_update.model_dump()}
        }
    )
    
    return {"message": "Case status updated successfully"}

@router.get("/stats/dashboard")
async def get_dashboard_stats(request: Request):
    """Get dashboard statistics"""
    await get_current_user(request)
    
    # Active cases
    active_cases = await cases_collection.count_documents({
        "status": {"$nin": ["tamamlandi", "iptal"]}
    })
    
    # Available vehicles
    available_vehicles = await vehicles_collection.count_documents({
        "status": "musait"
    })
    
    # Priority breakdown
    high_priority = await cases_collection.count_documents({
        "priority": "yuksek",
        "status": {"$nin": ["tamamlandi", "iptal"]}
    })
    
    return {
        "active_cases": active_cases,
        "available_vehicles": available_vehicles,
        "high_priority_cases": high_priority
    }

@router.post("/{case_id}/send-notification")
async def send_notification(case_id: str, vehicle_id: Optional[str] = None, request: Request = None):
    """Send notification about case to relevant users"""
    user = await get_current_user(request)
    
    # Get case
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get vehicle plate if vehicle_id provided
    vehicle_plate = None
    if vehicle_id:
        vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        if vehicle:
            vehicle_plate = vehicle.get("plate")
    
    # Prepare notification data
    notification_data = {
        "case_number": case_doc.get("case_number"),
        "priority": case_doc.get("priority"),
        "patient": case_doc.get("patient"),
        "caller": case_doc.get("caller"),
        "location": case_doc.get("location"),
        "assigned_team": case_doc.get("assigned_team"),
        "vehicle_plate": vehicle_plate
    }
    
    # Send notifications
    sent_count = await send_case_notifications(notification_data, users_collection, vehicle_id)
    
    return {
        "message": "Notifications sent successfully",
        "sent_count": sent_count
    }

# ============================================================================
# REAL-TIME COLLABORATION ENDPOINTS
# ============================================================================

class MedicalFormUpdate(BaseModel):
    """Partial update for medical form"""
    field: str
    value: Any

@router.post("/{case_id}/join")
async def join_case(case_id: str, request: Request):
    """Join case as participant (real-time collaboration)"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Check if user is authorized (assigned to case or doctor/nurse/admin)
    is_authorized = False
    assigned_team = case_doc.get("assigned_team", {})
    
    if user.role in ["merkez_ofis", "operasyon_muduru", "doktor", "hemsire"]:
        is_authorized = True
    elif user.id in [
        assigned_team.get("driver_id"),
        assigned_team.get("paramedic_id"),
        assigned_team.get("att_id"),
        assigned_team.get("nurse_id")
    ]:
        is_authorized = True
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Bu vakaya erişim yetkiniz yok")
    
    # Add or update participant
    participant = CaseParticipant(
        user_id=user.id,
        user_name=user.name,
        user_role=user.role,
        joined_at=get_turkey_time(),
        last_activity=get_turkey_time()
    )
    
    # Remove old entry if exists, then add new
    await cases_collection.update_one(
        {"_id": case_id},
        {"$pull": {"participants": {"user_id": user.id}}}
    )
    await cases_collection.update_one(
        {"_id": case_id},
        {"$push": {"participants": participant.model_dump()}}
    )
    
    return {"message": "Vakaya katıldınız", "participant": participant.model_dump()}

@router.post("/{case_id}/leave")
async def leave_case(case_id: str, request: Request):
    """Leave case as participant"""
    user = await get_current_user(request)
    
    await cases_collection.update_one(
        {"_id": case_id},
        {"$pull": {"participants": {"user_id": user.id}}}
    )
    
    return {"message": "Vakadan ayrıldınız"}

@router.get("/{case_id}/participants")
async def get_participants(case_id: str, request: Request):
    """Get active participants in case with profile photos"""
    await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Filter out inactive participants (last activity > 5 minutes ago)
    cutoff = get_turkey_time() - timedelta(minutes=5)
    participants = case_doc.get("participants", [])
    
    active_participants = []
    for p in participants:
        last_activity = p.get("last_activity")
        if isinstance(last_activity, str):
            last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
        if last_activity and last_activity > cutoff:
            # Kullanıcının profil fotoğrafını al
            user_id = p.get("user_id")
            if user_id:
                user_doc = await users_collection.find_one({"_id": user_id})
                if user_doc:
                    p["profile_photo"] = user_doc.get("profile_photo")
            active_participants.append(p)
    
    return {"participants": active_participants}

@router.patch("/{case_id}/medical-form")
async def update_medical_form(case_id: str, request: Request):
    """Update medical form (real-time collaboration)"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Get form data from request body
    form_data = await request.json()
    
    # Update medical form
    current_form = case_doc.get("medical_form") or {}
    
    # Merge with new data
    for key, value in form_data.items():
        if key not in ["_id", "id"]:
            current_form[key] = value
    
    # Update case
    await cases_collection.update_one(
        {"_id": case_id},
        {
            "$set": {
                "medical_form": current_form,
                "last_form_update": get_turkey_time(),
                "last_form_updater": user.id,
                "updated_at": get_turkey_time()
            }
        }
    )
    
    # Update participant's last activity
    await cases_collection.update_one(
        {"_id": case_id, "participants.user_id": user.id},
        {"$set": {"participants.$.last_activity": get_turkey_time()}}
    )
    
    return {
        "message": "Form güncellendi",
        "updated_by": user.name,
        "updated_at": get_turkey_time().isoformat()
    }

@router.get("/{case_id}/medical-form")
async def get_medical_form(case_id: str, request: Request):
    """Get medical form data"""
    await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    return {
        "medical_form": case_doc.get("medical_form"),
        "last_update": case_doc.get("last_form_update"),
        "last_updater": case_doc.get("last_form_updater"),
        "doctor_approval": case_doc.get("doctor_approval"),
        "participants": case_doc.get("participants", [])
    }

# ============================================================================
# DOCTOR APPROVAL ENDPOINTS
# ============================================================================

class DoctorApprovalRequest(BaseModel):
    status: str  # "approved" or "rejected"
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None

@router.post("/{case_id}/doctor-approval")
async def doctor_approval(case_id: str, data: DoctorApprovalRequest, request: Request):
    """Doctor approves or rejects the case treatment"""
    user = await get_current_user(request)
    
    # Only doctors can approve
    if user.role != "doktor":
        raise HTTPException(status_code=403, detail="Sadece doktorlar onay verebilir")
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    approval = DoctorApproval(
        status=data.status,
        doctor_id=user.id,
        doctor_name=user.name,
        approved_at=get_turkey_time(),
        rejection_reason=data.rejection_reason if data.status == "rejected" else None,
        notes=data.notes
    )
    
    # Update case
    await cases_collection.update_one(
        {"_id": case_id},
        {
            "$set": {
                "doctor_approval": approval.model_dump(),
                "updated_at": get_turkey_time()
            }
        }
    )
    
    # Add to status history with user info
    status_note = f"Doktor {user.name} tarafından {'onaylandı' if data.status == 'approved' else 'reddedildi'}"
    if data.rejection_reason:
        status_note += f": {data.rejection_reason}"
    
    status_update = CaseStatusUpdate(
        status=case_doc.get("status"),  # Keep current status
        note=status_note,
        updated_by=user.id,
        updated_by_name=user.name,
        updated_by_role=user.role
    )
    
    await cases_collection.update_one(
        {"_id": case_id},
        {"$push": {"status_history": status_update.model_dump()}}
    )
    
    return {
        "message": f"İşlem {'onaylandı' if data.status == 'approved' else 'reddedildi'}",
        "approval": approval.model_dump()
    }

# ============================================================================
# VIDEO CALL ENDPOINTS
# ============================================================================

@router.post("/{case_id}/start-video-call")
async def start_video_call(case_id: str, request: Request):
    """Start video call for case using Jitsi Meet
    
    Kendi Jitsi sunucunuzu kullanmak için .env dosyasına ekleyin:
    JITSI_DOMAIN=jitsi.your-domain.com
    """
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Create a unique room name for Jitsi (always use case_number for consistency)
    case_number = case_doc.get("case_number", case_id[:8])
    # Clean room name - remove special characters for Jitsi
    video_room_id = f"HealMedy{case_number}".replace("-", "").replace(" ", "")
    
    # Get Jitsi domain from environment or use default
    jitsi_domain = os.environ.get("JITSI_DOMAIN", "meet.jit.si")
    
    # Update case with video call info
    await cases_collection.update_one(
        {"_id": case_id},
        {"$set": {
            "video_room_id": video_room_id, 
            "video_call_active": True,
            "jitsi_domain": jitsi_domain
        }}
    )
    
    # Build Jitsi URL
    jitsi_url = f"https://{jitsi_domain}/{video_room_id}"
    
    return {
        "room_id": video_room_id,
        "room_url": jitsi_url,
        "jitsi_domain": jitsi_domain,
        "started_by": user.name,
        "message": "Görüntülü görüşme başlatıldı."
    }


# ============================================================================
# EXCEL EXPORT ENDPOINT
# ============================================================================

from fastapi.responses import StreamingResponse
from services.excel_export_service import export_case_to_excel

@router.get("/{case_id}/export-excel")
async def export_case_excel(case_id: str, request: Request):
    """Vaka formunu Excel şablonuna doldurarak indir"""
    user = await get_current_user(request)
    
    # Vakayı getir
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Vaka verilerini hazırla
    case_data = {
        "case_number": case_doc.get("case_number", ""),
        "created_at": case_doc.get("created_at"),
        "priority": case_doc.get("priority", ""),
        "status": case_doc.get("status", ""),
        "patient": case_doc.get("patient", {}),
        "caller": case_doc.get("caller", {}),
        "location": case_doc.get("location", {}),
        "assigned_team": case_doc.get("assigned_team", {}),
        "vehicle_info": case_doc.get("vehicle_info", {}),
        "time_info": case_doc.get("time_info", {}),
        "company": case_doc.get("company", ""),
        "call_type": case_doc.get("call_type", ""),
        "call_reason": case_doc.get("call_reason", ""),
        "complaint": case_doc.get("complaint", case_doc.get("patient", {}).get("complaint", "")),
        "chronic_diseases": case_doc.get("chronic_diseases", ""),
        "blood_sugar": case_doc.get("blood_sugar", ""),
        "body_temperature": case_doc.get("body_temperature", ""),
        "is_forensic": case_doc.get("is_forensic", False),
        "case_result": case_doc.get("case_result", ""),
        "transfer_hospital": case_doc.get("transfer_hospital", ""),
        "transfer_type": case_doc.get("transfer_type", ""),
        "referring_institution": case_doc.get("referring_institution", ""),
    }
    
    # Medical form verilerini al
    medical_form = case_doc.get("medical_form", {})
    
    # Vital signs
    vital_signs = case_doc.get("vital_signs", [])
    
    # Clinical observations
    clinical_obs = case_doc.get("clinical_observations", {})
    
    # CPR data
    cpr_data = case_doc.get("cpr_data", {})
    
    # Procedures
    procedures = case_doc.get("procedures", [])
    
    # Medications
    medications = case_doc.get("medications", [])
    
    # Materials
    materials = case_doc.get("materials", [])
    
    # Signatures
    signatures = case_doc.get("signatures", {})
    
    # Excel oluştur
    try:
        excel_buffer = export_case_to_excel(
            case_data=case_data,
            medical_form=medical_form,
            vital_signs=vital_signs,
            clinical_obs=clinical_obs,
            cpr_data=cpr_data,
            procedures=procedures,
            medications=medications,
            materials=materials,
            signatures=signatures
        )
        
        # Dosya adı
        case_number = case_doc.get("case_number", case_id[:8])
        date_str = get_turkey_time().strftime("%Y-%m-%d")
        filename = f"VAKA_FORMU_{case_number}_{date_str}.xlsx"
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Excel export hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Excel oluşturma hatası: {str(e)}")


# ============================================================================
# DİNAMİK EXCEL EXPORT - Mapping Kullanan
# ============================================================================

from services.dynamic_excel_export import export_case_with_template

@router.get("/{case_id}/export-excel-template/{template_id}")
async def export_case_with_excel_template(case_id: str, template_id: str, request: Request):
    """
    Vakayı belirli bir Excel şablonu ve onun data_mappings'i ile doldurarak indir
    """
    user = await get_current_user(request)
    
    # Vakayı getir
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Excel şablonunu getir
    excel_templates_collection = db["excel_templates"]
    template = await excel_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Excel şablonu bulunamadı")
    
    # Tüm vaka verilerini hazırla
    case_data = {
        "case_number": case_doc.get("case_number", ""),
        "created_at": case_doc.get("created_at"),
        "priority": case_doc.get("priority", ""),
        "status": case_doc.get("status", ""),
        "patient": case_doc.get("patient", {}),
        "caller": case_doc.get("caller", {}),
        "location": case_doc.get("location", {}),
        "assigned_team": case_doc.get("assigned_team", {}),
        "vehicle_info": case_doc.get("vehicle_info", {}),
        "time_info": case_doc.get("time_info", {}),
        "company": case_doc.get("company", ""),
        "call_type": case_doc.get("call_type", ""),
        "call_reason": case_doc.get("call_reason", ""),
        "complaint": case_doc.get("complaint", case_doc.get("patient", {}).get("complaint", "")),
        "chronic_diseases": case_doc.get("chronic_diseases", ""),
        "blood_sugar": case_doc.get("blood_sugar", ""),
        "body_temperature": case_doc.get("body_temperature", ""),
        "is_forensic": case_doc.get("is_forensic", False),
        "case_result": case_doc.get("case_result", ""),
        "transfer_hospital": case_doc.get("transfer_hospital", ""),
        "transfer_type": case_doc.get("transfer_type", ""),
        "referring_institution": case_doc.get("referring_institution", ""),
        "medical_form": case_doc.get("medical_form", {}),
        "vital_signs": case_doc.get("vital_signs", []),
        "clinical_observations": case_doc.get("clinical_observations", {}),
        "cpr_data": case_doc.get("cpr_data", {}),
        "procedures": case_doc.get("procedures", []),
        "medications": case_doc.get("medications", []),
        "materials": case_doc.get("materials", []),
        "fluids": case_doc.get("fluids", []) or case_doc.get("iv_fluids", []),
        "signatures": case_doc.get("signatures", {}),
        "hospital_rejection": case_doc.get("hospital_rejection", {}),
        "patient_rejection": case_doc.get("patient_rejection", {}),
        "escort": case_doc.get("escort", {}),
        "notes": case_doc.get("notes", ""),
    }
    
    try:
        # Dinamik export
        excel_buffer = export_case_with_template(template, case_data)
        
        # Dosya adı
        case_number = case_doc.get("case_number", case_id[:8])
        template_name = template.get("name", "sablon")
        date_str = get_turkey_time().strftime("%Y-%m-%d")
        
        # Türkçe karakterleri temizle
        safe_name = template_name.replace('ş', 's').replace('Ş', 'S').replace('ı', 'i').replace('İ', 'I')
        safe_name = safe_name.replace('ğ', 'g').replace('Ğ', 'G').replace('ü', 'u').replace('Ü', 'U')
        safe_name = safe_name.replace('ö', 'o').replace('Ö', 'O').replace('ç', 'c').replace('Ç', 'C')
        
        filename = f"VAKA_{case_number}_{safe_name}_{date_str}.xlsx"
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except Exception as e:
        logger.error(f"Dinamik Excel export hatası: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Excel oluşturma hatası: {str(e)}")


# ============================================================================
# VAKA FORM MAPPING EXPORT - Görsel Editör Mapping'i ile
# ============================================================================

from services.dynamic_excel_export import get_case_field_value

def build_export_case_data(case_doc: dict, medical_form: dict = None) -> dict:
    """
    Vaka ve medical_form verilerini export için birleştirir
    Frontend'deki CaseDetail.js'de kaydedilen tüm verileri içerir
    """
    if medical_form is None:
        medical_form = case_doc.get("medical_form", {})
    
    extended_form = medical_form.get("extended_form", {})
    clinical_obs = medical_form.get("clinical_obs", {})
    
    # Vehicle info birleştir
    vehicle_info = {**case_doc.get("vehicle_info", {}), **medical_form.get("vehicle_info", {})}
    
    # Time info birleştir
    time_info = {**case_doc.get("time_info", {}), **medical_form.get("time_info", {})}
    
    # Assigned team
    assigned_team = case_doc.get("assigned_team", {})
    
    return {
        "case_number": case_doc.get("case_number", ""),
        "created_at": case_doc.get("created_at"),
        "priority": case_doc.get("priority", ""),
        "status": case_doc.get("status", ""),
        "patient": case_doc.get("patient", {}),
        "caller": case_doc.get("caller", {}),
        "location": case_doc.get("location", {}),
        "assigned_team": assigned_team,
        
        # ATN NO - birden fazla yerden kontrol
        "atn_no": case_doc.get("atn_no", "") or extended_form.get("atnNo", "") or medical_form.get("atn_no", "") or vehicle_info.get("atn_no", ""),
        
        # PLAKA - assigned_team.vehicle veya vehicle_info.plate
        "vehicle_plate": assigned_team.get("vehicle", "") or vehicle_info.get("plate", "") or extended_form.get("vehiclePlate", "") or vehicle_info.get("plaka", ""),
        
        # VAKAYI VEREN KURUM - frontend'de referralSource olarak kaydediliyor
        "referring_institution": case_doc.get("referring_institution", "") or case_doc.get("company", "") or extended_form.get("referralSource", "") or extended_form.get("referringInstitution", "") or extended_form.get("vakayiVerenKurum", ""),
        
        # KM bilgileri
        "start_km": vehicle_info.get("start_km", "") or vehicle_info.get("baslangic_km", "") or extended_form.get("startKm", ""),
        "end_km": vehicle_info.get("end_km", "") or vehicle_info.get("bitis_km", "") or extended_form.get("endKm", ""),
        "total_km": vehicle_info.get("total_km", "") or vehicle_info.get("toplam_km", "") or extended_form.get("totalKm", ""),
        
        # İstasyon - frontend'de stationCode olarak kaydediliyor
        "station_name": case_doc.get("station_name", "") or assigned_team.get("station", "") or extended_form.get("stationCode", "") or extended_form.get("stationName", ""),
        
        # Kodu
        "case_code": case_doc.get("case_code", "") or extended_form.get("caseCode", "") or case_doc.get("code", ""),
        
        # TRİYAJ KODU - frontend'de triageCode olarak kaydediliyor
        "triage_code": extended_form.get("triageCode", "") or case_doc.get("priority", ""),
        
        # vehicle_info ve time_info
        "vehicle_info": vehicle_info,
        "time_info": time_info,
        "company": case_doc.get("company", ""),
        
        # call_type ve call_reason: extended_form içinden de al
        "call_type": case_doc.get("call_type", "") or extended_form.get("callType", ""),
        "call_reason": case_doc.get("call_reason", "") or extended_form.get("callReason", ""),
        "complaint": case_doc.get("complaint", "") or case_doc.get("patient", {}).get("complaint", ""),
        "chronic_diseases": case_doc.get("chronic_diseases", "") or medical_form.get("chronic_diseases", "") or extended_form.get("chronicDiseases", ""),
        "is_forensic": case_doc.get("is_forensic", False) or extended_form.get("isForensic", False),
        "case_result": case_doc.get("case_result", "") or extended_form.get("outcome", ""),
        "transfer_hospital": case_doc.get("transfer_hospital", "") or extended_form.get("transferHospital", "") or extended_form.get("nakledilenHastane", ""),
        
        # Vital signs - clinical_obs içinden de al
        "vital_signs": case_doc.get("vital_signs", []) or medical_form.get("vital_signs", []) or clinical_obs.get("vital_signs", []),
        
        # Clinical observations - tüm kaynaklardan birleştir
        "clinical_observations": {
            **case_doc.get("clinical_observations", {}), 
            **clinical_obs,
            # Ek alanlar
            "blood_sugar": clinical_obs.get("blood_sugar", "") or extended_form.get("kanSekeri", ""),
            "temperature": clinical_obs.get("temperature", "") or extended_form.get("ates", ""),
            "pulseType": clinical_obs.get("pulseType", {}) or extended_form.get("pulseType", {}),
            "respType": clinical_obs.get("respType", {}) or extended_form.get("respType", {}),
            "pupils": clinical_obs.get("pupils", {}) or extended_form.get("pupils", {}),
            "skin": clinical_obs.get("skin", {}) or extended_form.get("skin", {}),
            "gks": clinical_obs.get("gks", {}) or extended_form.get("gks", {}),
        },
        
        # Ön tanı ve açıklama
        "on_tani": medical_form.get("on_tani", "") or extended_form.get("onTani", "") or case_doc.get("preliminary_diagnosis", ""),
        "aciklamalar": medical_form.get("aciklamalar", "") or extended_form.get("aciklamalar", "") or case_doc.get("notes", ""),
        
        # Extended form (checkbox'lar için) - tam olarak aktar
        "extended_form": extended_form,
        
        # PROCEDURES - Dictionary format: {"Muayene (Acil)": {checked: true, adet: 2}}
        "procedures": medical_form.get("procedures", {}),
        
        # MEDICATIONS - hem case hem medical_form'dan, hem list hem dict format
        "medications": case_doc.get("medications", []) or medical_form.get("medications", []) or [],
        
        # MATERIALS - Dictionary format: {"Enjektör 1-2 cc": {checked: true, adet: 5}}
        "materials": medical_form.get("materials", {}),
        
        # Transfers (nakil bilgileri)
        "transfers": medical_form.get("transfers", {}),
        
        # Fluids
        "fluids": case_doc.get("fluids", []) or case_doc.get("iv_fluids", []) or medical_form.get("fluids", []),
        
        # İmzalar - hem signatures hem extended_form'dan
        "signatures": {
            **case_doc.get("signatures", {}), 
            **medical_form.get("signatures", {}),
            # Extended form'dan da al
            "doctor_name": extended_form.get("hekimAdi", ""),
            "paramedic_name": extended_form.get("saglikPerAdi", ""),
            "driver_name": extended_form.get("soforAdi", ""),
            "receiver_name": extended_form.get("teslimAlanAdi", ""),
            "receiver_title": extended_form.get("teslimAlanUnvan", ""),
            "patient_name": extended_form.get("hastaYakiniAdi", ""),
        },
        
        "hospital_rejection": case_doc.get("hospital_rejection", {}),
        "patient_rejection": case_doc.get("patient_rejection", {}),
        
        # CPR data
        "cpr_data": medical_form.get("cpr_data", {}) or extended_form.get("cprData", {}),
        
        # Isolation
        "isolation": medical_form.get("isolation", {}),
        
        # Scene type (olay yeri)
        "scene_type": extended_form.get("sceneType", "") or extended_form.get("scene", {}),
        
        # Transfer type
        "transfer_type": extended_form.get("transferType", ""),
        
        # Kazaya karışan araçlar
        "crash_vehicles": extended_form.get("crashVehicles", []),
    }

@router.get("/{case_id}/export-excel-mapped")
async def export_case_with_vaka_form_mapping(case_id: str, request: Request):
    """Vakayı Vaka Form Mapping kullanarak Excel'e export et (şablon formatıyla)"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    mapping_doc = await db.vaka_form_mappings.find_one({"_id": "default"})
    if not mapping_doc or not mapping_doc.get("flat_mappings"):
        raise HTTPException(status_code=404, detail="Vaka form mapping bulunamadı. Önce mapping oluşturun.")
    
    flat_mappings = mapping_doc.get("flat_mappings", {})
    logo_info = mapping_doc.get("logo", {})
    
    # Medical form verilerini al (CaseDetail'de kaydedilen)
    medical_form = case_doc.get("medical_form", {})
    
    case_data = build_export_case_data(case_doc, medical_form)
    
    try:
        from openpyxl import load_workbook
        from openpyxl.drawing.image import Image as XLImage
        import base64
        import re
        import os
        
        # VAKA FORMU ŞABLONUNU YÜKLE
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        template_path = os.path.join(backend_dir, "templates", "VAKA_FORMU_TEMPLATE.xlsx")
        
        if os.path.exists(template_path):
            wb = load_workbook(template_path)
            ws = wb.active
            logger.info(f"Şablon yüklendi: {template_path}")
        else:
            # Şablon yoksa boş workbook
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Vaka Formu"
            logger.warning(f"Şablon bulunamadı, boş oluşturuluyor: {template_path}")
        
        # Logo
        if logo_info.get("url") and logo_info.get("cell"):
            try:
                logo_url = logo_info["url"]
                if logo_url.startswith("data:image"):
                    header, encoded = logo_url.split(",", 1)
                    logo_data = base64.b64decode(encoded)
                    from io import BytesIO
                    img_buffer = BytesIO(logo_data)
                    img = XLImage(img_buffer)
                    img.width = 150
                    img.height = 60
                    ws.add_image(img, logo_info["cell"])
            except Exception as e:
                logger.warning(f"Logo eklenemedi: {e}")
        
        # Mapping'leri uygula - şablondaki hücrelere değer yaz
        for cell_address, field_key in flat_mappings.items():
            if field_key == "__LOGO__":
                continue
            
            value = get_case_field_value(case_data, field_key)
            
            match = re.match(r'^([A-Z]+)(\d+)$', cell_address.upper())
            if match:
                try:
                    ws[cell_address] = value
                except Exception as e:
                    logger.warning(f"Hücre yazma hatası {cell_address}: {e}")
        
        from io import BytesIO
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        
        case_number = case_doc.get("case_number", case_id[:8])
        date_str = get_turkey_time().strftime("%Y-%m-%d")
        filename = f"VAKA_FORMU_{case_number}_{date_str}.xlsx"
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
        
    except Exception as e:
        logger.error(f"Mapped Excel export hatası: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Excel oluşturma hatası: {str(e)}")


@router.get("/{case_id}/export-pdf-mapped")
async def export_case_pdf_with_mapping(case_id: str, request: Request):
    """Vakayı Vaka Form Mapping kullanarak PDF olarak export et (Tek Sayfa)"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    mapping_doc = await db.vaka_form_mappings.find_one({"_id": "default"})
    if not mapping_doc or not mapping_doc.get("flat_mappings"):
        raise HTTPException(status_code=404, detail="Vaka form mapping bulunamadı. Önce mapping oluşturun.")
    
    flat_mappings = mapping_doc.get("flat_mappings", {})
    logo_info = mapping_doc.get("logo", {})
    
    # Medical form verilerini al
    medical_form = case_doc.get("medical_form", {})
    case_data = build_export_case_data(case_doc, medical_form)
    
    try:
        from openpyxl import load_workbook
        from openpyxl.drawing.image import Image as XLImage
        import base64
        import re
        import os
        import subprocess
        import tempfile
        import uuid
        
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        template_path = os.path.join(backend_dir, "templates", "VAKA_FORMU_TEMPLATE.xlsx")
        
        if os.path.exists(template_path):
            wb = load_workbook(template_path)
            ws = wb.active
        else:
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = "Vaka Formu"
        
        # Logo
        if logo_info.get("url") and logo_info.get("cell"):
            try:
                logo_url = logo_info["url"]
                if logo_url.startswith("data:image"):
                    header, encoded = logo_url.split(",", 1)
                    logo_data = base64.b64decode(encoded)
                    from io import BytesIO
                    img_buffer = BytesIO(logo_data)
                    img = XLImage(img_buffer)
                    img.width = 150
                    img.height = 60
                    ws.add_image(img, logo_info["cell"])
            except Exception as e:
                logger.warning(f"Logo eklenemedi: {e}")
        
        # Mapping'leri uygula
        for cell_address, field_key in flat_mappings.items():
            if field_key == "__LOGO__":
                continue
            
            value = get_case_field_value(case_data, field_key)
            
            match = re.match(r'^([A-Z]+)(\d+)$', cell_address.upper())
            if match:
                try:
                    ws[cell_address] = value
                except Exception as e:
                    logger.warning(f"Hücre yazma hatası {cell_address}: {e}")
        
        # SAYFA AYARLARI: A4 Dikey (Portrait), tek sayfaya sığdır, tam sayfa kullan
        try:
            from openpyxl.worksheet.properties import PageSetupProperties
            
            # Sayfa ayarları
            ws.page_setup.orientation = 'portrait'  # Dikey
            ws.page_setup.paperSize = 9  # A4 (9 = A4)
            ws.page_setup.fitToWidth = 1  # 1 sayfa genişliğine sığdır
            ws.page_setup.fitToHeight = 1  # 1 sayfa yüksekliğine sığdır
            ws.page_setup.fitToPage = True  # FitToPage modunu etkinleştir
            
            # Sheet properties
            if ws.sheet_properties.pageSetUpPr is None:
                ws.sheet_properties.pageSetUpPr = PageSetupProperties()
            ws.sheet_properties.pageSetUpPr.fitToPage = True
            
            # Print area: Sadece veri olan hücreler (79 satır x 20 sütun - şablon boyutu)
            from openpyxl.utils import get_column_letter
            max_row = min(ws.max_row, 79) if ws.max_row else 79
            max_col = min(ws.max_column, 20) if ws.max_column else 20
            print_area = f"A1:{get_column_letter(max_col)}{max_row}"
            ws.print_area = print_area
            
            # Kenar boşlukları - minimum (inç cinsinden, sayfanın tamamını kullan)
            ws.page_margins.left = 0.2
            ws.page_margins.right = 0.2
            ws.page_margins.top = 0.2
            ws.page_margins.bottom = 0.2
            ws.page_margins.header = 0
            ws.page_margins.footer = 0
            
            logger.info(f"Sayfa ayarları: A4 Portrait, FitToPage=True, PrintArea={print_area}")
        except Exception as e:
            logger.warning(f"Sayfa ayarları yapılamadı: {e}")
        
        # Geçici Excel dosyası oluştur
        temp_dir = os.path.join(backend_dir, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_xlsx = os.path.join(temp_dir, f"case_{case_id}_{uuid.uuid4().hex[:8]}.xlsx")
        wb.save(temp_xlsx)
        
        # LibreOffice ile PDF'e dönüştür (A4 tek sayfa)
        try:
            # Önce ODS'ye çevir, sonra PDF'e (sayfa ayarları daha iyi korunuyor)
            # ODS dönüşümü
            result1 = subprocess.run([
                'libreoffice', '--headless', '--convert-to', 'ods',
                '--outdir', temp_dir, temp_xlsx
            ], capture_output=True, timeout=60, text=True)
            
            temp_ods = temp_xlsx.replace('.xlsx', '.ods')
            
            # ODS dosyasını aç ve sayfa ayarlarını düzelt
            if os.path.exists(temp_ods):
                try:
                    # ODS dosyasını zipfile olarak aç ve styles.xml'i düzenle
                    import zipfile
                    import xml.etree.ElementTree as ET
                    
                    # ODS'yi aç
                    with zipfile.ZipFile(temp_ods, 'r') as zf:
                        content = {name: zf.read(name) for name in zf.namelist()}
                    
                    # styles.xml'i düzenle - A4 Dikey (Portrait) ve tek sayfaya sığdır
                    if 'styles.xml' in content:
                        styles_xml = content['styles.xml'].decode('utf-8')
                        
                        # Sayfa ayarlarını değiştir
                        # fo:page-width="21cm" fo:page-height="29.7cm" (A4 portrait)
                        # style:scale-to-pages="1"
                        import re
                        
                        # A4 portrait boyutları
                        styles_xml = re.sub(r'fo:page-width="[^"]*"', 'fo:page-width="21cm"', styles_xml)
                        styles_xml = re.sub(r'fo:page-height="[^"]*"', 'fo:page-height="29.7cm"', styles_xml)
                        
                        # Orientation'ı portrait yap
                        styles_xml = re.sub(r'style:print-orientation="[^"]*"', 'style:print-orientation="portrait"', styles_xml)
                        
                        # Kenar boşluklarını minimize et
                        styles_xml = re.sub(r'fo:margin-top="[^"]*"', 'fo:margin-top="0.5cm"', styles_xml)
                        styles_xml = re.sub(r'fo:margin-bottom="[^"]*"', 'fo:margin-bottom="0.5cm"', styles_xml)
                        styles_xml = re.sub(r'fo:margin-left="[^"]*"', 'fo:margin-left="0.5cm"', styles_xml)
                        styles_xml = re.sub(r'fo:margin-right="[^"]*"', 'fo:margin-right="0.5cm"', styles_xml)
                        
                        # Ölçekleme ekle
                        if 'style:scale-to-pages' not in styles_xml:
                            styles_xml = styles_xml.replace(
                                'style:print-orientation="portrait"',
                                'style:print-orientation="portrait" style:scale-to-pages="1"'
                            )
                        
                        content['styles.xml'] = styles_xml.encode('utf-8')
                    
                    # Yeni ODS dosyası oluştur
                    temp_ods_fixed = temp_ods.replace('.ods', '_fixed.ods')
                    with zipfile.ZipFile(temp_ods_fixed, 'w', zipfile.ZIP_DEFLATED) as zf:
                        for name, data in content.items():
                            zf.writestr(name, data)
                    
                    # Eski ODS'yi sil, yenisini kullan
                    os.remove(temp_ods)
                    os.rename(temp_ods_fixed, temp_ods)
                    
                except Exception as e:
                    logger.warning(f"ODS düzenleme hatası: {e}")
            
            # Kaynak dosya (ODS veya XLSX)
            source_file = temp_ods if os.path.exists(temp_ods) else temp_xlsx
            
            # PDF'e dönüştür
            result2 = subprocess.run([
                'libreoffice', '--headless', '--convert-to', 'pdf',
                '--outdir', temp_dir, source_file
            ], capture_output=True, timeout=60, text=True)
            
            pdf_path = source_file.replace('.ods', '.pdf').replace('.xlsx', '.pdf')
            
            if os.path.exists(pdf_path):
                # PDF'i oku
                with open(pdf_path, 'rb') as f:
                    pdf_content = f.read()
                
                # Temizlik
                for f_path in [temp_xlsx, temp_ods, pdf_path]:
                    try:
                        if os.path.exists(f_path):
                            os.remove(f_path)
                    except:
                        pass
                
                case_number = case_doc.get("case_number", case_id[:8])
                date_str = get_turkey_time().strftime("%Y-%m-%d")
                filename = f"VAKA_FORMU_{case_number}_{date_str}.pdf"
                
                from io import BytesIO
                return StreamingResponse(
                    BytesIO(pdf_content),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'}
                )
            else:
                error_msg = result2.stderr if result2.stderr else result2.stdout
                logger.error(f"PDF oluşturulamadı. LibreOffice çıktısı: {error_msg}")
                for f_path in [temp_xlsx, temp_ods]:
                    try:
                        if os.path.exists(f_path):
                            os.remove(f_path)
                    except:
                        pass
                raise HTTPException(status_code=500, detail=f"PDF dönüştürme başarısız: {error_msg[:200]}")
                
        except subprocess.TimeoutExpired:
            os.remove(temp_xlsx)
            raise HTTPException(status_code=500, detail="PDF dönüştürme zaman aşımı")
        except FileNotFoundError:
            # LibreOffice yok - Excel döndür
            logger.warning("LibreOffice bulunamadı, Excel döndürülüyor")
            with open(temp_xlsx, 'rb') as f:
                excel_content = f.read()
            os.remove(temp_xlsx)
            
            case_number = case_doc.get("case_number", case_id[:8])
            date_str = get_turkey_time().strftime("%Y-%m-%d")
            filename = f"VAKA_FORMU_{case_number}_{date_str}.xlsx"
            
            from io import BytesIO
            return StreamingResponse(
                BytesIO(excel_content),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF export hatası: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"PDF oluşturma hatası: {str(e)}")