from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Body, Depends
from typing import List, Optional
from database import shifts_collection, vehicles_collection, shift_assignments_collection, users_collection
from models import Shift, ShiftStart, ShiftEnd, ShiftAssignment
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta
from pydantic import BaseModel, validator
import base64
import uuid
import logging
import pytz

logger = logging.getLogger(__name__)

router = APIRouter()

# Request model for creating shift assignment
class ShiftAssignmentCreate(BaseModel):
    model_config = {"extra": "forbid"}
    
    user_id: str
    vehicle_id: Optional[str] = None
    location_type: str = "arac"
    health_center_name: Optional[str] = None
    shift_date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    end_date: Optional[str] = None
    healmedy_location_id: Optional[str] = None  # YENİ: Healmedy lokasyonu

# ============================================================================
# SHIFT ASSIGNMENT ENDPOINTS - YENİDEN YAZILDI
# ============================================================================

# Helper function to serialize assignment
def serialize_assignment(assignment):
    """Convert MongoDB document to JSON-serializable format"""
    if isinstance(assignment, dict):
        assignment = dict(assignment)
    else:
        assignment = assignment.model_dump(by_alias=True) if hasattr(assignment, 'model_dump') else dict(assignment)
    
    if "_id" in assignment:
        assignment["id"] = str(assignment.pop("_id"))
    elif "id" not in assignment and hasattr(assignment, 'id'):
        assignment["id"] = str(assignment.id)
    
    # Convert datetime fields
    for field in ["shift_date", "end_date", "created_at"]:
        if field in assignment and isinstance(assignment[field], datetime):
            assignment[field] = assignment[field].isoformat()
        elif field in assignment and isinstance(assignment[field], str) and 'T' in assignment[field]:
            pass  # Already ISO string
    
    return assignment

@router.get("/assignments/today")
async def get_today_assignments(request: Request):
    """Get today's shift assignments - visible to all users"""
    await get_current_user(request)  # Just verify user is logged in
    
    from database import users_collection
    from datetime import timedelta
    
    # Türkiye saati (UTC+3) kullan
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    today = turkey_now.date()
    today_str = today.isoformat()
    logger.info(f"Bugünkü atamalar sorgusu - Bugün (TR): {today}")
    
    # Find all assignments that include today
    # Either: shift_date is today OR (shift_date <= today AND end_date >= today)
    all_assignments = await shift_assignments_collection.find({
        "status": {"$in": ["pending", "started"]}
    }).to_list(1000)
    
    # Filter assignments that are active today
    today_assignments = []
    for assignment in all_assignments:
        shift_date_str = assignment.get("shift_date", "")
        end_date_str = assignment.get("end_date", "")
        
        # Parse shift date
        if isinstance(shift_date_str, datetime):
            shift_date = shift_date_str.date()
        elif isinstance(shift_date_str, str):
            try:
                if 'T' in shift_date_str:
                    shift_date = datetime.fromisoformat(shift_date_str.replace('Z', '+00:00')).date()
                else:
                    shift_date = datetime.strptime(shift_date_str, "%Y-%m-%d").date()
            except:
                continue
        else:
            continue
        
        # Parse end date
        end_date = shift_date  # Default to same day
        if end_date_str:
            if isinstance(end_date_str, datetime):
                end_date = end_date_str.date()
            elif isinstance(end_date_str, str):
                try:
                    if 'T' in end_date_str:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                    else:
                        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                except:
                    pass
        
        # Check if today falls within the assignment period
        if shift_date <= today <= end_date:
            today_assignments.append(assignment)
    
    # Enrich with user information
    enriched_assignments = []
    for assignment in today_assignments:
        user_doc = await users_collection.find_one({"_id": assignment.get("user_id")})
        serialized = serialize_assignment(assignment)
        if user_doc:
            serialized["user_name"] = user_doc.get("name", "Bilinmiyor")
            serialized["user_role"] = user_doc.get("role", "-")
            serialized["profile_photo"] = user_doc.get("profile_photo")  # Profil fotoğrafı
        enriched_assignments.append(serialized)
    
    # Group by location type
    vehicle_assignments = [a for a in enriched_assignments if a.get("location_type") == "arac"]
    health_center_assignments = [a for a in enriched_assignments if a.get("location_type") == "saglik_merkezi"]
    
    # Get vehicle info for vehicle assignments
    for assignment in vehicle_assignments:
        vehicle_id = assignment.get("vehicle_id")
        if vehicle_id:
            vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
            if vehicle:
                assignment["vehicle_plate"] = vehicle.get("plate", "")
                assignment["vehicle_type"] = vehicle.get("type", "")
    
    return {
        "date": today_str,
        "vehicle_assignments": vehicle_assignments,
        "health_center_assignments": health_center_assignments,
        "total_count": len(enriched_assignments)
    }

@router.get("/assignments/my")
async def get_my_assignments(request: Request):
    """Get user's shift assignments"""
    user = await get_current_user(request)
    
    assignments = await shift_assignments_collection.find({
        "user_id": user.id,
        "status": {"$in": ["pending", "started"]}
    }).sort("shift_date", -1).to_list(100)
    
    result = []
    for a in assignments:
        serialized = serialize_assignment(a)
        # Araç bilgisini ekle
        vehicle_id = a.get("vehicle_id")
        if vehicle_id:
            vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
            if vehicle:
                serialized["vehicle_plate"] = vehicle.get("plate", "")
                serialized["vehicle_type"] = vehicle.get("type", "")
                serialized["vehicle"] = {
                    "plate": vehicle.get("plate"),
                    "type": vehicle.get("type"),
                    "km": vehicle.get("km")
                }
        result.append(serialized)
    
    return result

@router.get("/assignments")
async def get_all_assignments(request: Request):
    """Get all shift assignments (Admin only)"""
    current_user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    from database import users_collection
    
    assignments = await shift_assignments_collection.find({}).sort("shift_date", -1).to_list(1000)
    
    result = []
    for a in assignments:
        serialized = serialize_assignment(a)
        # Kullanıcı bilgilerini ekle
        user_doc = await users_collection.find_one({"_id": a.get("user_id")})
        if user_doc:
            serialized["user_name"] = user_doc.get("name", "Bilinmiyor")
            serialized["user_role"] = user_doc.get("role", "-")
            serialized["profile_photo"] = user_doc.get("profile_photo")
        result.append(serialized)
    
    return result

@router.post("/create-assignment-v2")
async def create_shift_assignment(data: ShiftAssignmentCreate, request: Request):
    """Create shift assignment (Admin only)"""
    current_user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    # Validate user exists
    from database import users_collection
    user = await users_collection.find_one({"_id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate vehicle if location type is vehicle
    if data.location_type == "arac":
        if not data.vehicle_id:
            raise HTTPException(status_code=400, detail="Vehicle ID is required for vehicle assignments")
        vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
    elif data.location_type == "saglik_merkezi":
        if not data.health_center_name:
            data.health_center_name = "Sağlık Merkezi"
    
    # Parse shift_date
    try:
        if 'T' in data.shift_date:
            shift_date = datetime.fromisoformat(data.shift_date.replace('Z', '+00:00'))
        else:
            shift_date = datetime.strptime(data.shift_date, '%Y-%m-%d')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid shift_date: {str(e)}")
    
    # Parse end_date
    end_date = None
    if data.end_date:
        try:
            if 'T' in data.end_date:
                end_date = datetime.fromisoformat(data.end_date.replace('Z', '+00:00'))
            else:
                end_date = datetime.strptime(data.end_date, '%Y-%m-%d')
                end_date = end_date.replace(hour=23, minute=59, second=59)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid end_date: {str(e)}")
    
    # Check for overlaps
    active_assignments = await shift_assignments_collection.find({
        "user_id": data.user_id,
        "status": {"$in": ["pending", "started"]}
    }).to_list(100)
    
    new_end = end_date if end_date else shift_date
    
    for existing in active_assignments:
        existing_start = existing.get("shift_date")
        existing_end = existing.get("end_date") or existing_start
        
        # Convert to datetime if needed
        if isinstance(existing_start, str):
            existing_start = datetime.fromisoformat(existing_start.replace('Z', '+00:00'))
        if isinstance(existing_end, str):
            existing_end = datetime.fromisoformat(existing_end.replace('Z', '+00:00'))
        
        if not isinstance(existing_start, datetime) or not isinstance(existing_end, datetime):
            continue
        
        # Check overlap
        if shift_date <= existing_end and new_end >= existing_start:
            raise HTTPException(
                status_code=400,
                detail=f"User already has an assignment from {existing_start.strftime('%Y-%m-%d')} to {existing_end.strftime('%Y-%m-%d')}"
            )
    
    # Healmedy lokasyon adını bul
    healmedy_location_name = None
    if data.healmedy_location_id:
        from models import HEALMEDY_LOCATIONS
        location = next((l for l in HEALMEDY_LOCATIONS if l["id"] == data.healmedy_location_id), None)
        if location:
            healmedy_location_name = location["name"]
    
    # Create assignment
    assignment = ShiftAssignment(
        user_id=data.user_id,
        vehicle_id=data.vehicle_id if data.vehicle_id else None,
        location_type=data.location_type or "arac",
        health_center_name=data.health_center_name,
        assigned_by=current_user.id,
        shift_date=shift_date,
        start_time=data.start_time,
        end_time=data.end_time,
        end_date=end_date,
        healmedy_location_id=data.healmedy_location_id,
        healmedy_location_name=healmedy_location_name
    )
    
    assignment_dict = assignment.model_dump(by_alias=True)
    result = await shift_assignments_collection.insert_one(assignment_dict)
    
    # Healmedy lokasyonu seçildiyse araç lokasyonunu güncelle
    if data.healmedy_location_id and data.vehicle_id and healmedy_location_name:
        from database import vehicle_current_locations_collection
        turkey_tz = pytz.timezone('Europe/Istanbul')
        turkey_now = datetime.now(turkey_tz)
        
        await vehicle_current_locations_collection.update_one(
            {"vehicle_id": data.vehicle_id},
            {"$set": {
                "vehicle_id": data.vehicle_id,
                "vehicle_plate": vehicle.get("plate") if vehicle else "",
                "assigned_location_id": data.healmedy_location_id,
                "assigned_location_name": healmedy_location_name,
                "current_location_id": data.healmedy_location_id,
                "current_location_name": healmedy_location_name,
                "updated_by": current_user.id,
                "updated_at": turkey_now
            }},
            upsert=True
        )
        logger.info(f"Araç lokasyonu güncellendi: {vehicle.get('plate') if vehicle else data.vehicle_id} → {healmedy_location_name}")
    
    inserted_doc = await shift_assignments_collection.find_one({"_id": result.inserted_id})
    if not inserted_doc:
        raise HTTPException(status_code=500, detail="Failed to create assignment")
    
    return serialize_assignment(inserted_doc)

@router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, request: Request):
    """Delete shift assignment (Admin only)"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    result = await shift_assignments_collection.delete_one({"_id": assignment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return {"message": "Assignment deleted successfully"}

@router.post("/assignments/{assignment_id}/start")
async def admin_start_shift(assignment_id: str, request: Request):
    """Admin can start shift on behalf of user (Operasyon Müdürü, Merkez Ofis, Baş Şoför)"""
    admin_user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    from database import users_collection
    
    # Find the assignment
    assignment = await shift_assignments_collection.find_one({"_id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Atama bulunamadı")
    
    if assignment.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Bu vardiya zaten başlatılmış veya tamamlanmış")
    
    # Get the assigned user
    assigned_user = await users_collection.find_one({"_id": assignment.get("user_id")})
    if not assigned_user:
        raise HTTPException(status_code=404, detail="Atanan kullanıcı bulunamadı")
    
    # Check if user already has an active shift
    active_shift = await shifts_collection.find_one({
        "user_id": assignment.get("user_id"),
        "status": {"$in": ["active", "on_break"]}
    })
    
    if active_shift:
        raise HTTPException(status_code=400, detail="Bu kullanıcının zaten aktif bir vardiyası var")
    
    # Get vehicle info if it's a vehicle assignment
    vehicle_plate = None
    vehicle_id = assignment.get("vehicle_id")
    if vehicle_id:
        vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        if vehicle:
            vehicle_plate = vehicle.get("plate")
            # Update vehicle status to "gorevde"
            await vehicles_collection.update_one(
                {"_id": vehicle_id},
                {"$set": {"status": "gorevde", "updated_at": datetime.utcnow()}}
            )
    
    # Create shift
    new_shift = Shift(
        user_id=assignment.get("user_id"),
        vehicle_id=vehicle_id,
        vehicle_plate=vehicle_plate,
        start_km=0,  # Admin başlatınca km 0 olarak başlar
        status="active",
        location_type=assignment.get("location_type", "arac"),
        health_center_name=assignment.get("health_center_name"),
        started_by_admin=True,
        admin_id=admin_user.id,
        admin_note=f"{admin_user.name} tarafından manuel olarak başlatıldı"
    )
    
    shift_dict = new_shift.model_dump(by_alias=True)
    await shifts_collection.insert_one(shift_dict)
    
    # Update assignment status
    await shift_assignments_collection.update_one(
        {"_id": assignment_id},
        {
            "$set": {
                "status": "started",
                "started_at": datetime.utcnow(),
                "started_by_admin": True,
                "admin_id": admin_user.id
            }
        }
    )
    
    return {
        "message": f"{assigned_user.get('name', 'Kullanıcı')} için vardiya başarıyla başlatıldı",
        "shift_id": str(shift_dict["_id"]),
        "user_name": assigned_user.get("name"),
        "vehicle_plate": vehicle_plate,
        "location_type": assignment.get("location_type")
    }

@router.post("/start", response_model=Shift)
async def start_shift(data: ShiftStart, request: Request):
    """Start shift by scanning vehicle QR code"""
    user = await get_current_user(request)
    
    # Find vehicle by QR code
    vehicle = await vehicles_collection.find_one({"qr_code": data.vehicle_qr})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı. QR kodu geçersiz.")
    
    # Check if user has TODAY's assignment for this vehicle
    # Türkiye saati (UTC+3) kullan
    from datetime import timedelta
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    today = turkey_now.date()
    yesterday = today - timedelta(days=1)  # Dün de kabul et (gece yarısı toleransı)
    logger.info(f"Vardiya başlatma kontrolü - Bugün (TR): {today}, Dün (TR): {yesterday}, Kullanıcı: {user.id}, Araç: {vehicle.get('plate')}")
    
    # Get all pending assignments for this user and vehicle
    all_assignments = await shift_assignments_collection.find({
        "user_id": user.id,
        "vehicle_id": vehicle["_id"],
        "status": "pending"
    }).to_list(100)
    
    # Filter to find an assignment that is valid for today
    valid_assignment = None
    for assignment in all_assignments:
        shift_date_str = assignment.get("shift_date", "")
        end_date_str = assignment.get("end_date", "")
        
        # Parse shift date
        if isinstance(shift_date_str, datetime):
            shift_date = shift_date_str.date()
        elif isinstance(shift_date_str, str):
            try:
                if 'T' in shift_date_str:
                    shift_date = datetime.fromisoformat(shift_date_str.replace('Z', '+00:00')).date()
                else:
                    shift_date = datetime.strptime(shift_date_str, "%Y-%m-%d").date()
            except:
                continue
        else:
            continue
        
        # Parse end date
        end_date = shift_date  # Default to same day
        if end_date_str:
            if isinstance(end_date_str, datetime):
                end_date = end_date_str.date()
            elif isinstance(end_date_str, str):
                try:
                    if 'T' in end_date_str:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                    else:
                        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                except:
                    pass
        
        # Check if today OR yesterday falls within the assignment period
        # (Gece yarısı toleransı - vardiya gece yarısını geçebilir)
        is_valid_today = shift_date <= today <= end_date
        is_valid_yesterday = shift_date <= yesterday <= end_date
        
        logger.info(f"Atama kontrolü: {shift_date} - {end_date}, Bugün geçerli: {is_valid_today}, Dün geçerli: {is_valid_yesterday}")
        
        if is_valid_today or is_valid_yesterday:
            valid_assignment = assignment
            break
    
    if not valid_assignment:
        # Get user's actual assignment for today to show in error
        user_today_assignment = await shift_assignments_collection.find_one({
            "user_id": user.id,
            "status": "pending"
        })
        
        if user_today_assignment:
            assigned_vehicle = await vehicles_collection.find_one({"_id": user_today_assignment.get("vehicle_id")})
            assigned_plate = assigned_vehicle.get("plate", "Bilinmiyor") if assigned_vehicle else "Bilinmiyor"
            raise HTTPException(
                status_code=403, 
                detail=f"Bu araç ({vehicle.get('plate')}) size atanmamış. Bugün için atanan aracınız: {assigned_plate}"
            )
        else:
            raise HTTPException(
                status_code=403, 
                detail="Bu araç için bugün geçerli vardiya atamanız yok. Lütfen yöneticinizle iletişime geçin."
            )
    
    assignment = valid_assignment
    
    # Check if user already has an active shift
    active_shift = await shifts_collection.find_one({
        "user_id": user.id,
        "end_time": None
    })
    
    if active_shift:
        raise HTTPException(status_code=400, detail="Zaten aktif bir vardiyanz var")
    
    # Create new shift
    new_shift = Shift(
        assignment_id=assignment["_id"],
        user_id=user.id,
        vehicle_id=vehicle["_id"],
        vehicle_plate=vehicle.get("plate"),  # Plaka bilgisini ekle
        start_time=datetime.utcnow(),
        photos=data.photos,
        daily_control=data.daily_control
    )
    
    shift_dict = new_shift.model_dump(by_alias=True)
    await shifts_collection.insert_one(shift_dict)
    
    # Update assignment status
    await shift_assignments_collection.update_one(
        {"_id": assignment["_id"]},
        {"$set": {"status": "started"}}
    )
    
    # Günlük kontrol formunu form geçmişine kaydet
    if data.daily_control:
        from database import forms_collection
        import uuid
        
        daily_control_form = {
            "_id": str(uuid.uuid4()),
            "form_type": "daily_control",
            "submitted_by": user.id,
            "form_data": data.daily_control,
            "vehicle_plate": vehicle.get("plate"),
            "vehicle_id": vehicle["_id"],
            "shift_id": new_shift.id,
            "created_at": datetime.utcnow()
        }
        await forms_collection.insert_one(daily_control_form)
        logger.info(f"Günlük kontrol formu kaydedildi: {daily_control_form['_id']}")
    
    # Araç fotoğraflarını kaydet (ayrı bir collection'da)
    if data.photos:
        from database import db
        shift_photos_collection = db["shift_photos"]
        
        photos_doc = {
            "_id": str(uuid.uuid4()),
            "shift_id": new_shift.id,
            "user_id": user.id,
            "vehicle_id": vehicle["_id"],
            "vehicle_plate": vehicle.get("plate"),
            "photos": data.photos,
            "created_at": datetime.utcnow()
        }
        await shift_photos_collection.insert_one(photos_doc)
        logger.info(f"Vardiya fotoğrafları kaydedildi: {photos_doc['_id']}")
    
    return new_shift

@router.post("/end", response_model=Shift)
async def end_shift(data: ShiftEnd, request: Request):
    """End shift"""
    user = await get_current_user(request)
    
    # Find active shift
    shift_doc = await shifts_collection.find_one({
        "_id": data.shift_id,
        "user_id": user.id,
        "end_time": None
    })
    
    if not shift_doc:
        raise HTTPException(status_code=404, detail="Active shift not found")
    
    # Calculate duration
    end_time = datetime.utcnow()
    start_time = shift_doc["start_time"]
    duration_minutes = int((end_time - start_time).total_seconds() / 60)
    
    # Update shift
    result = await shifts_collection.find_one_and_update(
        {"_id": data.shift_id},
        {
            "$set": {
                "end_time": end_time,
                "duration_minutes": duration_minutes,
                "notes": data.notes
            }
        },
        return_document=True
    )
    
    # Assignment status'unu "completed" olarak güncelle
    if shift_doc.get("assignment_id"):
        await shift_assignments_collection.update_one(
            {"_id": shift_doc["assignment_id"]},
            {"$set": {"status": "completed"}}
        )
        logger.info(f"Assignment {shift_doc['assignment_id']} marked as completed")
    
    result["id"] = result.pop("_id")
    return Shift(**result)

@router.get("/active")
async def get_active_shift(request: Request):
    """Get user's active shift with vehicle info"""
    user = await get_current_user(request)
    
    shift_doc = await shifts_collection.find_one({
        "user_id": user.id,
        "end_time": None
    })
    
    if not shift_doc:
        return None
    
    shift_doc["id"] = shift_doc.pop("_id")
    
    # Araç bilgisini ekle
    vehicle_id = shift_doc.get("vehicle_id")
    if vehicle_id and not shift_doc.get("vehicle_plate"):
        vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        if vehicle:
            shift_doc["vehicle_plate"] = vehicle.get("plate", "")
            shift_doc["vehicle_type"] = vehicle.get("type", "")
            shift_doc["vehicle"] = {
                "plate": vehicle.get("plate"),
                "type": vehicle.get("type"),
                "km": vehicle.get("km")
            }
    
    return shift_doc

@router.get("/history")
async def get_shift_history(
    request: Request,
    user_id: Optional[str] = None,
    limit: int = 50
):
    """Get shift history with vehicle info"""
    current_user = await get_current_user(request)
    
    # If user_id provided, check permission
    if user_id and user_id != current_user.id:
        if current_user.role not in ["merkez_ofis", "operasyon_muduru"]:
            raise HTTPException(status_code=403, detail="Permission denied")
    else:
        user_id = current_user.id
    
    shifts = await shifts_collection.find(
        {"user_id": user_id}
    ).sort("start_time", -1).limit(limit).to_list(limit)
    
    result = []
    for shift in shifts:
        shift["id"] = shift.pop("_id")
        # Araç bilgisini ekle
        vehicle_id = shift.get("vehicle_id")
        if vehicle_id and not shift.get("vehicle_plate"):
            vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
            if vehicle:
                shift["vehicle_plate"] = vehicle.get("plate", "")
        result.append(shift)
    
    return result

@router.get("/photos")
async def get_shift_photos(
    request: Request,
    vehicle_plate: Optional[str] = None,
    limit: int = 50
):
    """
    Vardiya fotoğraflarını getir
    Baş Şoför, Operasyon Müdürü ve Merkez Ofis erişebilir
    """
    current_user = await get_current_user(request)
    
    # Sadece yetkili roller erişebilir
    if current_user.role not in ["merkez_ofis", "operasyon_muduru", "bas_sofor"]:
        raise HTTPException(status_code=403, detail="Bu sayfaya erişim yetkiniz yok")
    
    from database import db
    shift_photos_collection = db["shift_photos"]
    
    query = {}
    if vehicle_plate:
        query["vehicle_plate"] = vehicle_plate
    
    photos = await shift_photos_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Kullanıcı bilgisini ekle
    for photo in photos:
        photo["id"] = photo.pop("_id")
        user_doc = await users_collection.find_one({"_id": photo.get("user_id")})
        if user_doc:
            photo["user_name"] = user_doc.get("name", "Bilinmiyor")
            photo["user_role"] = user_doc.get("role", "")
    
    return photos

@router.get("/photos/{shift_id}")
async def get_shift_photos_by_id(shift_id: str, request: Request):
    """Belirli bir vardiyaya ait fotoğrafları getir"""
    current_user = await get_current_user(request)
    
    # Sadece yetkili roller erişebilir
    if current_user.role not in ["merkez_ofis", "operasyon_muduru", "bas_sofor"]:
        raise HTTPException(status_code=403, detail="Bu sayfaya erişim yetkiniz yok")
    
    from database import db
    shift_photos_collection = db["shift_photos"]
    
    photo_doc = await shift_photos_collection.find_one({"shift_id": shift_id})
    if not photo_doc:
        return None
    
    photo_doc["id"] = photo_doc.pop("_id")
    
    # Kullanıcı bilgisini ekle
    user_doc = await users_collection.find_one({"_id": photo_doc.get("user_id")})
    if user_doc:
        photo_doc["user_name"] = user_doc.get("name", "Bilinmiyor")
        photo_doc["user_role"] = user_doc.get("role", "")
    
    return photo_doc

@router.get("/stats/summary")
async def get_shift_stats(request: Request, user_id: Optional[str] = None):
    """Get shift statistics"""
    current_user = await get_current_user(request)
    
    if user_id and user_id != current_user.id:
        if current_user.role not in ["merkez_ofis", "operasyon_muduru"]:
            raise HTTPException(status_code=403, detail="Permission denied")
    else:
        user_id = current_user.id
    
    # Active shifts count
    active = await shifts_collection.count_documents({
        "user_id": user_id,
        "end_time": None
    })
    
    # Total shifts
    total = await shifts_collection.count_documents({"user_id": user_id})
    
    # Total hours worked
    completed_shifts = await shifts_collection.find({
        "user_id": user_id,
        "end_time": {"$ne": None}
    }).to_list(1000)
    
    total_minutes = sum(shift.get("duration_minutes", 0) for shift in completed_shifts)
    total_hours = total_minutes / 60
    
    return {
        "active_shifts": active,
        "total_shifts": total,
        "total_hours_worked": round(total_hours, 2)
    }


# ============================================================================
# GÜNLÜK FORM KONTROLÜ - EKİP BAZLI
# ============================================================================

@router.get("/check-daily-form/{vehicle_id}")
async def check_daily_form_filled(vehicle_id: str, request: Request, date: Optional[str] = None):
    """
    Bu araç için bugün günlük kontrol formu doldurulmuş mu?
    ATT/Paramedik'ten biri doldurduysa diğerinin doldurmasına gerek yok
    """
    user = await get_current_user(request)
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            target_date = turkey_now
    else:
        target_date = turkey_now
    
    # Bugünün başlangıcı ve bitişi
    day_start = datetime(target_date.year, target_date.month, target_date.day)
    day_end = day_start + timedelta(days=1)
    
    # Bu araç ve bu gün için günlük form doldurulmuş mı?
    filled_shift = await shifts_collection.find_one({
        "vehicle_id": vehicle_id,
        "daily_control_filled_by": {"$ne": None},
        "daily_control_filled_at": {"$gte": day_start, "$lt": day_end}
    })
    
    if filled_shift:
        # Dolduran kişi bilgisini al
        filler = await users_collection.find_one({"_id": filled_shift.get("daily_control_filled_by")})
        filler_name = filler.get("name") if filler else "Bilinmiyor"
        
        return {
            "filled": True,
            "filled_by": filled_shift.get("daily_control_filled_by"),
            "filled_by_name": filler_name,
            "filled_at": filled_shift.get("daily_control_filled_at"),
            "shift_id": filled_shift.get("_id"),
            "message": f"Günlük kontrol formu {filler_name} tarafından doldurulmuş"
        }
    
    return {
        "filled": False,
        "message": "Bu araç için bugün günlük kontrol formu doldurulmamış"
    }


@router.post("/log-section-time")
async def log_section_time(request: Request):
    """
    Form doldurma sürelerini logla (ATT/Paramedik için zaman kısıtlamaları)
    """
    user = await get_current_user(request)
    body = await request.json()
    
    shift_id = body.get("shift_id")
    section_index = body.get("section_index")
    duration_seconds = body.get("duration_seconds")
    
    if not shift_id:
        raise HTTPException(status_code=400, detail="shift_id gerekli")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Mevcut section_times'ı al
    shift = await shifts_collection.find_one({"_id": shift_id})
    if not shift:
        raise HTTPException(status_code=404, detail="Vardiya bulunamadı")
    
    section_times = shift.get("section_times") or {}
    section_times[f"section_{section_index}"] = {
        "duration_seconds": duration_seconds,
        "completed_at": turkey_now.isoformat()
    }
    
    await shifts_collection.update_one(
        {"_id": shift_id},
        {"$set": {"section_times": section_times}}
    )
    
    return {"message": f"Section {section_index} süresi kaydedildi"}


@router.post("/mark-daily-form-filled")
async def mark_daily_form_filled(request: Request):
    """
    Günlük kontrol formunu doldurulmuş olarak işaretle
    """
    user = await get_current_user(request)
    body = await request.json()
    
    shift_id = body.get("shift_id")
    
    if not shift_id:
        raise HTTPException(status_code=400, detail="shift_id gerekli")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    await shifts_collection.update_one(
        {"_id": shift_id},
        {"$set": {
            "daily_control_filled_by": user.id,
            "daily_control_filled_at": turkey_now
        }}
    )
    
    logger.info(f"Günlük kontrol formu dolduruldu: {shift_id} - {user.name}")
    
    return {"message": "Günlük kontrol formu doldurulmuş olarak işaretlendi"}


# ============================================================================
# TOPLU VARDİYA ATAMA - EXCEL İLE
# ============================================================================

from fastapi import UploadFile, File
from io import BytesIO

@router.post("/bulk-upload")
async def bulk_upload_shifts(file: UploadFile = File(...), request: Request = None):
    """
    Excel dosyası ile toplu vardiya atama
    Sadece Mesul Müdür, Baş Şoför ve Merkez Ofis kullanabilir
    
    Excel formatı:
    | TC/Email | Araç Plaka | Lokasyon Tipi | Lokasyon Adı | Başlangıç Tarihi | Bitiş Tarihi | Vardiya Tipi |
    | 12345678901 | 34 ABC 123 | arac | - | 2025-01-15 | 2025-01-16 | saha_24 |
    | email@test.com | - | saglik_merkezi | Filyos SM | 2025-01-15 | 2025-01-15 | ofis_8 |
    """
    current_user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor", "mesul_mudur"])(request)
    
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl kütüphanesi yüklü değil")
    
    # Dosyayı oku
    contents = await file.read()
    workbook = openpyxl.load_workbook(BytesIO(contents))
    sheet = workbook.active
    
    results = {
        "success": [],
        "errors": [],
        "total_rows": 0,
        "successful_count": 0,
        "error_count": 0
    }
    
    # İlk satır başlık, 2. satırdan itibaren veri
    for row_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0]:  # Boş satır
            continue
        
        results["total_rows"] += 1
        
        try:
            tc_or_email = str(row[0]).strip() if row[0] else None
            vehicle_plate = str(row[1]).strip() if row[1] else None
            location_type = str(row[2]).strip().lower() if row[2] else "arac"
            location_name = str(row[3]).strip() if row[3] else None
            start_date_str = str(row[4]).strip() if row[4] else None
            end_date_str = str(row[5]).strip() if row[5] else None
            shift_type = str(row[6]).strip() if row[6] else "saha_24"
            
            if not tc_or_email or not start_date_str:
                results["errors"].append({
                    "row": row_idx,
                    "error": "TC/Email ve başlangıç tarihi zorunlu"
                })
                results["error_count"] += 1
                continue
            
            # Kullanıcıyı bul (TC veya email ile)
            user_doc = None
            if "@" in tc_or_email:
                user_doc = await users_collection.find_one({"email": tc_or_email})
            else:
                user_doc = await users_collection.find_one({"tc_no": tc_or_email})
            
            if not user_doc:
                results["errors"].append({
                    "row": row_idx,
                    "error": f"Kullanıcı bulunamadı: {tc_or_email}"
                })
                results["error_count"] += 1
                continue
            
            # Araç bul (eğer araç atama ise)
            vehicle_id = None
            if location_type == "arac" and vehicle_plate:
                vehicle_doc = await vehicles_collection.find_one({"plate": vehicle_plate})
                if not vehicle_doc:
                    results["errors"].append({
                        "row": row_idx,
                        "error": f"Araç bulunamadı: {vehicle_plate}"
                    })
                    results["error_count"] += 1
                    continue
                vehicle_id = vehicle_doc["_id"]
            
            # Tarihleri parse et
            from datetime import datetime as dt
            try:
                if isinstance(row[4], dt):
                    start_date = row[4]
                else:
                    start_date = dt.strptime(start_date_str, "%Y-%m-%d")
                
                if end_date_str:
                    if isinstance(row[5], dt):
                        end_date = row[5]
                    else:
                        end_date = dt.strptime(end_date_str, "%Y-%m-%d")
                else:
                    end_date = start_date
            except ValueError as e:
                results["errors"].append({
                    "row": row_idx,
                    "error": f"Tarih formatı hatalı: {str(e)}"
                })
                results["error_count"] += 1
                continue
            
            # Vardiya tipi ve saatleri belirle
            if shift_type == "ofis_8":
                start_time = "08:00"
                end_time = "17:00"
            else:  # saha_24
                start_time = "08:00"
                end_time = "08:00"
                # 24 saat vardiya için bitiş tarihi bir gün sonra
                if end_date == start_date:
                    end_date = start_date + timedelta(days=1)
            
            # Atama oluştur
            assignment = ShiftAssignment(
                user_id=user_doc["_id"],
                vehicle_id=vehicle_id,
                location_type=location_type if location_type in ["arac", "saglik_merkezi"] else "arac",
                health_center_name=location_name if location_type == "saglik_merkezi" else None,
                assigned_by=current_user.id,
                shift_date=start_date,
                start_time=start_time,
                end_time=end_time,
                end_date=end_date,
                shift_type=shift_type if shift_type in ["saha_24", "ofis_8"] else "saha_24"
            )
            
            assignment_dict = assignment.model_dump(by_alias=True)
            await shift_assignments_collection.insert_one(assignment_dict)
            
            results["success"].append({
                "row": row_idx,
                "user": user_doc.get("name"),
                "vehicle": vehicle_plate,
                "date": start_date.strftime("%Y-%m-%d")
            })
            results["successful_count"] += 1
            
        except Exception as e:
            results["errors"].append({
                "row": row_idx,
                "error": str(e)
            })
            results["error_count"] += 1
    
    logger.info(f"Toplu vardiya atama: {results['successful_count']} başarılı, {results['error_count']} hatalı")
    
    return results


@router.get("/bulk-upload/template")
async def get_bulk_upload_template(request: Request):
    """Excel şablon dosyasını indir"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor", "mesul_mudur"])(request)
    
    try:
        import openpyxl
        from fastapi.responses import StreamingResponse
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl kütüphanesi yüklü değil")
    
    # Yeni workbook oluştur
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Vardiya Atama"
    
    # Başlıklar
    headers = [
        "TC/Email",
        "Araç Plaka",
        "Lokasyon Tipi (arac/saglik_merkezi)",
        "Lokasyon Adı (Sağlık Merkezi ise)",
        "Başlangıç Tarihi (YYYY-MM-DD)",
        "Bitiş Tarihi (YYYY-MM-DD)",
        "Vardiya Tipi (saha_24/ofis_8)"
    ]
    
    for col, header in enumerate(headers, 1):
        ws.cell(row=1, column=col, value=header)
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 25
    
    # Örnek satırlar
    examples = [
        ["12345678901", "34 ABC 123", "arac", "", "2025-01-15", "2025-01-16", "saha_24"],
        ["email@test.com", "", "saglik_merkezi", "Filyos SM", "2025-01-15", "2025-01-15", "ofis_8"]
    ]
    
    for row_idx, example in enumerate(examples, 2):
        for col_idx, value in enumerate(example, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)
    
    # Dosyayı BytesIO'ya kaydet
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=vardiya_atama_sablonu.xlsx"}
    )


# ============================================================================
# DEVİR TESLİM OTURUMU
# ============================================================================

from database import db
handover_sessions_collection = db.handover_sessions

@router.post("/handover/start")
async def start_handover_session(request: Request):
    """
    Devir teslim oturumu başlat (Devreden şoför)
    Sadece 07:30-08:30 arasında başlatılabilir
    """
    from models import HandoverSession
    from datetime import time
    
    user = await get_current_user(request)
    body = await request.json()
    
    # Aktif vardiya kontrolü
    active_shift = await shifts_collection.find_one({
        "user_id": user.id,
        "status": "active"
    })
    
    if not active_shift:
        raise HTTPException(status_code=400, detail="Aktif vardiyanz yok. Önce vardiya başlatın.")
    
    # Saat kontrolü (07:30-08:30 arası) - Türkiye saati
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    current_time = turkey_now.time()
    handover_start = time(7, 30)
    handover_end = time(8, 30)
    
    # Debug için saati logla
    logger.info(f"Devir teslim saat kontrolü - Şu an: {current_time}, Aralık: {handover_start}-{handover_end}")
    
    # Test modunda saat kontrolünü atla
    skip_time_check = body.get("skip_time_check", False)
    
    if not skip_time_check and not (handover_start <= current_time <= handover_end):
        raise HTTPException(
            status_code=400, 
            detail=f"Devir teslim sadece 07:30-08:30 arasında yapılabilir. Şu an: {current_time.strftime('%H:%M')}"
        )
    
    vehicle_id = active_shift.get("vehicle_id")
    if not vehicle_id:
        raise HTTPException(status_code=400, detail="Vardiyaya araç atanmamış")
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Sonraki vardiyalı kişiyi bul
    today = turkey_now.date()
    tomorrow = today + timedelta(days=1)
    
    next_assignments = await shift_assignments_collection.find({
        "vehicle_id": vehicle_id,
        "user_id": {"$ne": user.id},
        "status": "pending"
    }).to_list(100)
    
    # Bugün veya yarın için geçerli atama
    receiver_assignment = None
    for assignment in next_assignments:
        shift_date = assignment.get("shift_date")
        if isinstance(shift_date, str):
            shift_date = datetime.fromisoformat(shift_date.replace('Z', '+00:00'))
        if isinstance(shift_date, datetime):
            assignment_date = shift_date.date()
            if assignment_date == today or assignment_date == tomorrow:
                receiver_assignment = assignment
                break
    
    if not receiver_assignment:
        raise HTTPException(status_code=400, detail="Bu araç için sonraki vardiya ataması bulunamadı")
    
    # Devralan kullanıcı bilgisi
    receiver_user = await users_collection.find_one({"_id": receiver_assignment.get("user_id")})
    if not receiver_user:
        raise HTTPException(status_code=400, detail="Devralan kullanıcı bulunamadı")
    
    # Mevcut bekleyen oturum var mı kontrol et
    existing_session = await handover_sessions_collection.find_one({
        "vehicle_id": vehicle_id,
        "status": {"$in": ["waiting_receiver", "waiting_manager"]}
    })
    
    if existing_session:
        # Varolan oturumu döndür
        existing_session["id"] = existing_session.pop("_id")
        return existing_session
    
    # Yeni oturum oluştur
    session = HandoverSession(
        giver_id=user.id,
        giver_name=user.name,
        receiver_id=receiver_user["_id"],
        receiver_name=receiver_user.get("name", ""),
        vehicle_id=vehicle_id,
        vehicle_plate=vehicle.get("plate", ""),
        giver_shift_id=active_shift["_id"],
        expires_at=turkey_now + timedelta(hours=2)  # 2 saat geçerli
    )
    
    session_dict = session.model_dump(by_alias=True)
    await handover_sessions_collection.insert_one(session_dict)
    
    logger.info(f"Devir teslim oturumu başlatıldı: {session.id} - {user.name} -> {receiver_user.get('name')}")
    
    session_dict["id"] = session_dict.pop("_id")
    return session_dict


@router.get("/handover/active")
async def get_active_handover(request: Request):
    """
    Kullanıcının aktif devir teslim oturumunu getir
    (Hem devreden hem devralan için)
    """
    user = await get_current_user(request)
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Kullanıcının devreden veya devralan olduğu aktif oturum
    session = await handover_sessions_collection.find_one({
        "$or": [
            {"giver_id": user.id},
            {"receiver_id": user.id}
        ],
        "status": {"$in": ["waiting_receiver", "waiting_manager"]},
        "expires_at": {"$gt": turkey_now}
    })
    
    if not session:
        return None
    
    session["id"] = session.pop("_id")
    
    # Kullanıcının rolünü ekle
    session["user_role_in_session"] = "giver" if session["giver_id"] == user.id else "receiver"
    
    return session


@router.post("/handover/{session_id}/sign")
async def sign_handover(session_id: str, request: Request):
    """
    Devir teslim oturumunu imzala (Devralan şoför)
    İmza veya OTP ile onay
    """
    user = await get_current_user(request)
    body = await request.json()
    
    session = await handover_sessions_collection.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    
    if session["receiver_id"] != user.id:
        raise HTTPException(status_code=403, detail="Bu oturumu sadece devralan onaylayabilir")
    
    if session["status"] != "waiting_receiver":
        raise HTTPException(status_code=400, detail="Bu oturum zaten onaylanmış veya süresi dolmuş")
    
    signature = body.get("signature")  # Base64 imza
    otp_code = body.get("otp_code")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    update_data = {
        "receiver_signed_at": turkey_now,
        "status": "waiting_manager",
        "receiver_login_at": turkey_now,  # Sisteme giriş zamanı
        "updated_at": turkey_now
    }
    
    if signature:
        update_data["receiver_signature"] = signature
    
    if otp_code:
        # OTP doğrulama
        from services.otp_service import verify_user_otp
        
        otp_secret = user.otp_secret if hasattr(user, 'otp_secret') else None
        if not otp_secret:
            user_doc = await users_collection.find_one({"_id": user.id})
            otp_secret = user_doc.get("otp_secret") if user_doc else None
        
        if otp_secret and verify_user_otp(otp_secret, otp_code):
            update_data["receiver_otp_verified"] = True
        else:
            raise HTTPException(status_code=400, detail="Geçersiz OTP kodu")
    
    await handover_sessions_collection.update_one(
        {"_id": session_id},
        {"$set": update_data}
    )
    
    logger.info(f"Devir teslim imzalandı: {session_id} - Devralan: {user.name}")
    
    # Baş şoförlere bildirim gönder
    try:
        from services.onesignal_service import onesignal_service, NotificationType
        
        managers = await users_collection.find({
            "role": {"$in": ["bas_sofor", "operasyon_muduru"]},
            "is_active": True
        }).to_list(50)
        
        manager_ids = [m["_id"] for m in managers]
        
        if manager_ids:
            await onesignal_service.send_notification(
                NotificationType.SYSTEM_ALERT,
                manager_ids,
                {
                    "message": f"Devir teslim onayı bekliyor: {session.get('giver_name')} → {user.name} ({session.get('vehicle_plate')})"
                }
            )
    except Exception as e:
        logger.warning(f"Bildirim gönderilemedi: {e}")
    
    return {"message": "Devir teslim imzalandı. Yönetici onayı bekleniyor."}


@router.post("/handover/{session_id}/approve")
async def approve_handover(session_id: str, request: Request):
    """
    Devir teslim oturumunu onayla (Baş Şoför/Yönetici)
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis"])(request)
    body = await request.json()
    
    session = await handover_sessions_collection.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    
    if session["status"] != "waiting_manager":
        raise HTTPException(status_code=400, detail="Bu oturum yönetici onayı beklemeiyor")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    approve = body.get("approve", True)
    rejection_reason = body.get("rejection_reason")
    
    if approve:
        # Onay
        await handover_sessions_collection.update_one(
            {"_id": session_id},
            {"$set": {
                "status": "approved",
                "manager_id": user.id,
                "manager_name": user.name,
                "manager_action_at": turkey_now,
                "updated_at": turkey_now
            }}
        )
        
        # Devreden şoförün vardiyasını bitir
        if session.get("giver_shift_id"):
            giver_shift = await shifts_collection.find_one({"_id": session["giver_shift_id"]})
            if giver_shift:
                start_time = giver_shift.get("start_time")
                duration = int((turkey_now - start_time).total_seconds() / 60) if start_time else 0
                
                await shifts_collection.update_one(
                    {"_id": session["giver_shift_id"]},
                    {"$set": {
                        "status": "completed",
                        "end_time": turkey_now,
                        "duration_minutes": duration,
                        "handover_session_id": session_id
                    }}
                )
        
        # Devreden kişinin assignment'ını tamamla
        if giver_shift and giver_shift.get("assignment_id"):
            await shift_assignments_collection.update_one(
                {"_id": giver_shift["assignment_id"]},
                {"$set": {"status": "completed"}}
            )
        
        logger.info(f"Devir teslim onaylandı: {session_id} - Onaylayan: {user.name}")
        
        return {"message": "Devir teslim onaylandı. Devralan artık vardiyasını başlatabilir."}
    else:
        # Red
        await handover_sessions_collection.update_one(
            {"_id": session_id},
            {"$set": {
                "status": "rejected",
                "manager_id": user.id,
                "manager_name": user.name,
                "manager_action_at": turkey_now,
                "rejection_reason": rejection_reason,
                "updated_at": turkey_now
            }}
        )
        
        logger.info(f"Devir teslim reddedildi: {session_id} - Reddeden: {user.name}")
        
        return {"message": "Devir teslim reddedildi."}


@router.get("/handover/pending-approvals")
async def get_pending_handover_approvals(request: Request, date: Optional[str] = None):
    """
    Bekleyen devir teslim onaylarını getir (Baş Şoför için)
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis"])(request)
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    query = {"status": "waiting_manager"}
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query["form_opened_at"] = {
                "$gte": target_date,
                "$lt": target_date + timedelta(days=1)
            }
        except ValueError:
            pass
    
    sessions = await handover_sessions_collection.find(query).sort("form_opened_at", -1).to_list(100)
    
    for session in sessions:
        session["id"] = session.pop("_id")
    
    return sessions


@router.get("/handover/logs")
async def get_handover_logs(request: Request, date: Optional[str] = None, vehicle_id: Optional[str] = None):
    """
    Devir teslim loglarını getir (Baş Şoför için)
    Tarih ve araç bazlı filtreleme
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis"])(request)
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    query = {}
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query["form_opened_at"] = {
                "$gte": target_date,
                "$lt": target_date + timedelta(days=1)
            }
        except ValueError:
            # Bugün
            today = turkey_now.date()
            query["form_opened_at"] = {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
            }
    else:
        # Bugün
        today = turkey_now.date()
        query["form_opened_at"] = {
            "$gte": datetime.combine(today, datetime.min.time()),
            "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
        }
    
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    sessions = await handover_sessions_collection.find(query).sort("form_opened_at", -1).to_list(100)
    
    result = []
    for session in sessions:
        session["id"] = session.pop("_id")
        
        # Log detayları
        log = {
            "session": session,
            "logs": []
        }
        
        # Form açılış
        if session.get("form_opened_at"):
            log["logs"].append({
                "event": "form_opened",
                "time": session["form_opened_at"],
                "user": session.get("giver_name"),
                "description": "Devir teslim formu açıldı"
            })
        
        # Devralan giriş
        if session.get("receiver_login_at"):
            log["logs"].append({
                "event": "receiver_login",
                "time": session["receiver_login_at"],
                "user": session.get("receiver_name"),
                "description": "Devralan sisteme giriş yaptı"
            })
        
        # İmza
        if session.get("receiver_signed_at"):
            log["logs"].append({
                "event": "receiver_signed",
                "time": session["receiver_signed_at"],
                "user": session.get("receiver_name"),
                "description": "Devralan imzaladı" + (" (OTP)" if session.get("receiver_otp_verified") else " (İmza)")
            })
        
        # Yönetici işlemi
        if session.get("manager_action_at"):
            log["logs"].append({
                "event": "manager_action",
                "time": session["manager_action_at"],
                "user": session.get("manager_name"),
                "description": f"Yönetici {'onayladı' if session.get('status') == 'approved' else 'reddetti'}"
            })
        
        # Vardiya başlatma
        if session.get("shift_started_at"):
            log["logs"].append({
                "event": "shift_started",
                "time": session["shift_started_at"],
                "user": session.get("receiver_name"),
                "description": "Vardiya başlatıldı"
            })
        
        result.append(log)
    
    return result


# ============================================================================
# EKİP GRUPLAMA
# ============================================================================

@router.get("/today-team/{vehicle_id}")
async def get_today_team(vehicle_id: str, request: Request):
    """
    Bugün bu araçta/lokasyonda çalışacak ekibi getir
    Şoför, ATT, Paramedik otomatik gruplanır
    """
    user = await get_current_user(request)
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    today = turkey_now.date()
    
    # Bu araç için bugünkü atamaları al
    assignments = await shift_assignments_collection.find({
        "vehicle_id": vehicle_id,
        "status": {"$in": ["pending", "started"]}
    }).to_list(100)
    
    # Bugün için geçerli atamaları filtrele
    today_assignments = []
    for assignment in assignments:
        shift_date = assignment.get("shift_date")
        end_date = assignment.get("end_date") or shift_date
        
        if isinstance(shift_date, str):
            shift_date = datetime.fromisoformat(shift_date.replace('Z', '+00:00'))
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        if isinstance(shift_date, datetime) and isinstance(end_date, datetime):
            if shift_date.date() <= today <= end_date.date():
                today_assignments.append(assignment)
    
    # Ekip üyelerini topla
    team = []
    for assignment in today_assignments:
        user_doc = await users_collection.find_one({"_id": assignment.get("user_id")})
        if user_doc:
            team.append({
                "user_id": user_doc["_id"],
                "name": user_doc.get("name"),
                "role": user_doc.get("role"),
                "phone": user_doc.get("phone"),
                "profile_photo": user_doc.get("profile_photo"),
                "assignment_id": assignment["_id"],
                "status": assignment.get("status")
            })
    
    # Araç bilgisi
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    
    return {
        "vehicle_id": vehicle_id,
        "vehicle_plate": vehicle.get("plate") if vehicle else None,
        "date": today.isoformat(),
        "team": team,
        "team_count": len(team)
    }


# ============================================================================
# VARDİYA BAŞLATMA ONAY SİSTEMİ (ATT/Paramedik ve Şoför için ayrı)
# ============================================================================

from database import db
shift_start_approvals_collection = db.shift_start_approvals


class ShiftStartApprovalCreate(BaseModel):
    vehicle_id: str
    role_type: str  # "medical" (ATT/Paramedik) veya "driver" (Şoför)
    daily_control_data: Optional[dict] = None
    photos: Optional[dict] = None


@router.post("/start-approval/request")
async def request_shift_start_approval(data: ShiftStartApprovalCreate, request: Request):
    """
    Vardiya başlatma onayı iste (ATT/Paramedik veya Şoför)
    Onay shift-approvals sayfasına düşer
    """
    user = await get_current_user(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Aynı gün için bekleyen onay var mı?
    today_start = turkey_now.replace(hour=0, minute=0, second=0, microsecond=0)
    existing = await shift_start_approvals_collection.find_one({
        "user_id": user.id,
        "vehicle_id": data.vehicle_id,
        "status": "pending",
        "created_at": {"$gte": today_start}
    })
    
    if existing:
        return {"id": existing["_id"], "message": "Zaten bekleyen onay mevcut", "status": "pending"}
    
    approval_id = str(uuid.uuid4())
    approval = {
        "_id": approval_id,
        "user_id": user.id,
        "user_name": user.name,
        "user_role": user.role,
        "vehicle_id": data.vehicle_id,
        "vehicle_plate": vehicle.get("plate"),
        "role_type": data.role_type,  # "medical" veya "driver"
        "daily_control_data": data.daily_control_data,
        "photos": data.photos,
        "status": "pending",  # pending, approved, rejected
        "created_at": turkey_now,
        "approved_by": None,
        "approved_by_name": None,
        "approved_at": None,
        "rejection_reason": None
    }
    
    await shift_start_approvals_collection.insert_one(approval)
    
    logger.info(f"Vardiya başlatma onayı istendi: {user.name} - {vehicle.get('plate')} - {data.role_type}")
    
    return {"id": approval_id, "message": "Onay talebi oluşturuldu", "status": "pending"}


@router.get("/start-approval/pending")
async def get_pending_shift_start_approvals(request: Request, role_type: Optional[str] = None):
    """
    Bekleyen vardiya başlatma onaylarını getir
    role_type: "medical" (ATT/Paramedik) veya "driver" (Şoför) veya None (tümü)
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    
    query = {"status": "pending"}
    
    if role_type:
        query["role_type"] = role_type
    
    approvals = await shift_start_approvals_collection.find(query).sort("created_at", -1).to_list(100)
    
    for approval in approvals:
        approval["id"] = approval.pop("_id")
    
    return approvals


@router.get("/start-approval/check/{approval_id}")
async def check_shift_start_approval(approval_id: str, request: Request):
    """
    Belirli bir onay talebinin durumunu kontrol et
    """
    user = await get_current_user(request)
    
    approval = await shift_start_approvals_collection.find_one({"_id": approval_id})
    
    if not approval:
        raise HTTPException(status_code=404, detail="Onay talebi bulunamadı")
    
    return {
        "id": approval["_id"],
        "status": approval["status"],
        "approved_by_name": approval.get("approved_by_name"),
        "approved_at": approval.get("approved_at"),
        "rejection_reason": approval.get("rejection_reason")
    }


@router.post("/start-approval/{approval_id}/approve")
async def approve_shift_start(approval_id: str, request: Request):
    """
    Vardiya başlatma onayı ver
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    approval = await shift_start_approvals_collection.find_one({"_id": approval_id})
    
    if not approval:
        raise HTTPException(status_code=404, detail="Onay talebi bulunamadı")
    
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await shift_start_approvals_collection.update_one(
        {"_id": approval_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": turkey_now
        }}
    )
    
    logger.info(f"Vardiya başlatma onaylandı: {approval['user_name']} - {approval['vehicle_plate']} - Onaylayan: {user.name}")
    
    return {"message": "Vardiya başlatma onaylandı", "status": "approved"}


@router.post("/start-approval/{approval_id}/reject")
async def reject_shift_start(approval_id: str, request: Request, reason: str = None):
    """
    Vardiya başlatma onayını reddet
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    approval = await shift_start_approvals_collection.find_one({"_id": approval_id})
    
    if not approval:
        raise HTTPException(status_code=404, detail="Onay talebi bulunamadı")
    
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await shift_start_approvals_collection.update_one(
        {"_id": approval_id},
        {"$set": {
            "status": "rejected",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": turkey_now,
            "rejection_reason": reason or "Belirtilmedi"
        }}
    )
    
    logger.info(f"Vardiya başlatma reddedildi: {approval['user_name']} - {approval['vehicle_plate']} - Reddeden: {user.name}")
    
    return {"message": "Vardiya başlatma reddedildi", "status": "rejected"}


# ===================== VARDİYA BİTİRME ONAY SİSTEMİ =====================

# Vardiya Bitirme Onayları Collection
shift_end_approvals_collection = db["shift_end_approvals"]


class EndApprovalRequest(BaseModel):
    shift_id: str
    vehicle_id: Optional[str] = None
    vehicle_plate: Optional[str] = None
    end_km: Optional[str] = None
    devralan_adi: Optional[str] = None
    form_opened_at: Optional[str] = None
    request_sent_at: Optional[str] = None


@router.post("/end-approval/request")
async def request_end_approval(data: EndApprovalRequest, request: Request):
    """
    Vardiya bitirme için yönetici onayı iste
    """
    user = await get_current_user(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Rol tipini belirle
    role_type = "driver" if user.role.lower() == "sofor" else "medical"
    
    approval_id = str(uuid.uuid4())
    approval_doc = {
        "_id": approval_id,
        "type": "end",
        "shift_id": data.shift_id,
        "vehicle_id": data.vehicle_id,
        "vehicle_plate": data.vehicle_plate,
        "user_id": user.id,
        "user_name": user.name,
        "user_role": user.role,
        "role_type": role_type,
        "end_km": data.end_km,
        "devralan_adi": data.devralan_adi,
        "form_opened_at": data.form_opened_at,
        "request_sent_at": data.request_sent_at or turkey_now.isoformat(),
        "status": "pending",
        "created_at": turkey_now
    }
    
    await shift_end_approvals_collection.insert_one(approval_doc)
    
    logger.info(f"Vardiya bitirme onayı istendi: {user.name} ({user.role}) - {data.vehicle_plate}")
    
    return {
        "message": "Vardiya bitirme onay talebi gönderildi",
        "request_id": approval_id
    }


@router.get("/shift-approvals/pending")
async def get_pending_shift_approvals(request: Request):
    """
    Tüm bekleyen vardiya onaylarını getir (başlatma + bitirme)
    """
    await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    
    # Başlatma onayları
    start_approvals = await shift_start_approvals_collection.find({"status": "pending"}).sort("created_at", -1).to_list(100)
    for a in start_approvals:
        a["id"] = a.pop("_id")
        a["type"] = "start"
    
    # Bitirme onayları
    end_approvals = await shift_end_approvals_collection.find({"status": "pending"}).sort("created_at", -1).to_list(100)
    for a in end_approvals:
        a["id"] = a.pop("_id")
        a["type"] = "end"
    
    return start_approvals + end_approvals


@router.post("/shift-approvals/{approval_id}/approve")
async def approve_shift_approval(approval_id: str, request: Request):
    """
    Vardiya onayı ver (başlatma veya bitirme)
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Önce başlatma onaylarına bak
    approval = await shift_start_approvals_collection.find_one({"_id": approval_id})
    collection = shift_start_approvals_collection
    approval_type = "başlatma"
    
    if not approval:
        # Bitirme onaylarına bak
        approval = await shift_end_approvals_collection.find_one({"_id": approval_id})
        collection = shift_end_approvals_collection
        approval_type = "bitirme"
    
    if not approval:
        raise HTTPException(status_code=404, detail="Onay talebi bulunamadı")
    
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await collection.update_one(
        {"_id": approval_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": turkey_now
        }}
    )
    
    logger.info(f"Vardiya {approval_type} onaylandı: {approval['user_name']} - {approval.get('vehicle_plate', 'N/A')} - Onaylayan: {user.name}")
    
    return {"message": f"Vardiya {approval_type} onaylandı", "status": "approved"}


@router.post("/shift-approvals/{approval_id}/reject")
async def reject_shift_approval(approval_id: str, request: Request, reason: str = None):
    """
    Vardiya onayını reddet (başlatma veya bitirme)
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Önce başlatma onaylarına bak
    approval = await shift_start_approvals_collection.find_one({"_id": approval_id})
    collection = shift_start_approvals_collection
    approval_type = "başlatma"
    
    if not approval:
        # Bitirme onaylarına bak
        approval = await shift_end_approvals_collection.find_one({"_id": approval_id})
        collection = shift_end_approvals_collection
        approval_type = "bitirme"
    
    if not approval:
        raise HTTPException(status_code=404, detail="Onay talebi bulunamadı")
    
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await collection.update_one(
        {"_id": approval_id},
        {"$set": {
            "status": "rejected",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": turkey_now,
            "rejection_reason": reason or "Belirtilmedi"
        }}
    )
    
    logger.info(f"Vardiya {approval_type} reddedildi: {approval['user_name']} - {approval.get('vehicle_plate', 'N/A')} - Reddeden: {user.name}")
    
    return {"message": f"Vardiya {approval_type} reddedildi", "status": "rejected"}


@router.get("/shift-approvals/logs")
async def get_shift_approval_logs(
    request: Request,
    date: str = None,
    limit: int = 50
):
    """
    Vardiya onay loglarını getir (başlatma + bitirme)
    """
    await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "mesul_mudur"])(request)
    
    query = {}
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query["created_at"] = {
                "$gte": target_date,
                "$lt": target_date + timedelta(days=1)
            }
        except ValueError:
            pass
    
    # Başlatma logları
    start_logs = await shift_start_approvals_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for log in start_logs:
        log["id"] = log.pop("_id")
        log["type"] = "start"
        log["type_label"] = "Vardiya Başlatma"
    
    # Bitirme logları
    end_logs = await shift_end_approvals_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    for log in end_logs:
        log["id"] = log.pop("_id")
        log["type"] = "end"
        log["type_label"] = "Vardiya Bitirme"
    
    # Birleştir ve sırala
    all_logs = start_logs + end_logs
    all_logs.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    
    return all_logs[:limit]
