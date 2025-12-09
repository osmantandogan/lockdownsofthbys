from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import List, Optional, Any
from database import cases_collection, vehicles_collection, users_collection, shift_assignments_collection
from models import Case, CaseCreate, CaseAssignTeam, CaseUpdateStatus, CaseStatusUpdate, MedicalFormData, DoctorApproval, CaseParticipant
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta
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
    
logger = logging.getLogger(__name__)

router = APIRouter()

# Vaka numarası başlangıç değeri - 1'den başlar, 6 haneli format (000001)
CASE_NUMBER_START = 1

async def get_next_case_sequence() -> int:
    """Günlük sıralı vaka numarası al - 1'den başlar"""
    today = datetime.utcnow().strftime("%Y%m%d")
    
    # Bugünkü en yüksek vaka numarasını bul
    pipeline = [
        {"$match": {"case_number": {"$regex": f"^{today}-"}}},
        {"$project": {
            "seq": {
                "$toInt": {
                    "$arrayElemAt": [{"$split": ["$case_number", "-"]}, 1]
                }
            }
        }},
        {"$sort": {"seq": -1}},
        {"$limit": 1}
    ]
    
    result = await cases_collection.aggregate(pipeline).to_list(1)
    
    if result and len(result) > 0:
        return result[0]["seq"] + 1
    else:
        return CASE_NUMBER_START

async def generate_case_number() -> str:
    """Generate case number in format YYYYMMDD-XXXXXX (starting from 000001)"""
    # Türkiye saati (UTC+3)
    now = datetime.utcnow() + timedelta(hours=3)
    date_str = now.strftime("%Y%m%d")
    seq = await get_next_case_sequence()
    # 6 haneli format: 000001, 000002, ...
    seq_str = str(seq).zfill(6) if seq < 100000 else str(seq)
    return f"{date_str}-{seq_str}"

@router.get("/next-case-number")
async def get_next_case_number(request: Request):
    """Sonraki vaka numarasını döndür (önizleme için)"""
    user = await get_current_user(request)
    
    # Türkiye saati (UTC+3)
    now = datetime.utcnow() + timedelta(hours=3)
    date_str = now.strftime("%Y%m%d")
    seq = await get_next_case_sequence()
    seq_str = str(seq).zfill(6) if seq < 100000 else str(seq)
    
    return {"next_case_number": f"{date_str}-{seq_str}"}

@router.post("", response_model=Case)
async def create_case(data: CaseCreate, request: Request):
    """Create new case (Call Center)"""
    user = await get_current_user(request)
    
    # Generate case number (async - sıralı numara)
    case_number = await generate_case_number()
    
    # Create case
    new_case = Case(
        case_number=case_number,
        caller=data.caller,
        patient=data.patient,
        location=data.location,
        priority=data.priority,
        case_details=data.case_details if hasattr(data, 'case_details') else None,
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
    search: Optional[str] = None
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
    
    # Combine all filters with $and
    if filters:
        query = {"$and": filters} if len(filters) > 1 else filters[0]
    
    cases = await cases_collection.find(query).sort("created_at", -1).to_list(1000)
    
    for case in cases:
        case["id"] = case.pop("_id")
    
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
    now = datetime.utcnow()
    
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
        "granted_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(hours=4),  # 4 saatlik erişim
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
    gender: Optional[str] = None


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
    if data.gender is not None:
        update_fields["patient.gender"] = data.gender
    
    if not update_fields:
        return {"message": "Güncellenecek alan yok"}
    
    update_fields["updated_at"] = datetime.utcnow()
    
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
                logger.info(f"User {user_id} has role: {role}")
                if role == "sofor" or role == "bas_sofor":
                    if not assigned_team.get("driver_id"):
                        assigned_team["driver_id"] = user_id
                        logger.info(f"Set driver_id to {user_id}")
                elif role == "paramedik":
                    if not assigned_team.get("paramedic_id"):
                        assigned_team["paramedic_id"] = user_id
                        logger.info(f"Set paramedic_id to {user_id}")
                elif role == "att":
                    if not assigned_team.get("att_id"):
                        assigned_team["att_id"] = user_id
                        logger.info(f"Set att_id to {user_id}")
                elif role == "hemsire":
                    if not assigned_team.get("nurse_id"):
                        assigned_team["nurse_id"] = user_id
                        logger.info(f"Set nurse_id to {user_id}")
    
    logger.info(f"Final assigned_team: {assigned_team}")
    assigned_team["assigned_at"] = datetime.utcnow()
    
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
                "updated_at": datetime.utcnow()
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
                "updated_at": datetime.utcnow()
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
    
    return {"message": "Team assigned successfully"}

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
        "updated_at": datetime.utcnow()
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
                        "updated_at": datetime.utcnow()
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
        joined_at=datetime.utcnow(),
        last_activity=datetime.utcnow()
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
    cutoff = datetime.utcnow() - timedelta(minutes=5)
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
                "last_form_update": datetime.utcnow(),
                "last_form_updater": user.id,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Update participant's last activity
    await cases_collection.update_one(
        {"_id": case_id, "participants.user_id": user.id},
        {"$set": {"participants.$.last_activity": datetime.utcnow()}}
    )
    
    return {
        "message": "Form güncellendi",
        "updated_by": user.name,
        "updated_at": datetime.utcnow().isoformat()
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
        approved_at=datetime.utcnow(),
        rejection_reason=data.rejection_reason if data.status == "rejected" else None,
        notes=data.notes
    )
    
    # Update case
    await cases_collection.update_one(
        {"_id": case_id},
        {
            "$set": {
                "doctor_approval": approval.model_dump(),
                "updated_at": datetime.utcnow()
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
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        filename = f"VAKA_FORMU_{case_number}_{date_str}.xlsx"
        
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Excel export hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Excel oluşturma hatası: {str(e)}")
