from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Body, Depends
from typing import List, Optional
from database import shifts_collection, vehicles_collection, shift_assignments_collection, users_collection
from models import Shift, ShiftStart, ShiftEnd, ShiftAssignment
from auth_utils import get_current_user, require_roles
from datetime import datetime
from pydantic import BaseModel, validator
import base64
import uuid
import logging

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
        end_date=end_date
    )
    
    assignment_dict = assignment.model_dump(by_alias=True)
    result = await shift_assignments_collection.insert_one(assignment_dict)
    
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
