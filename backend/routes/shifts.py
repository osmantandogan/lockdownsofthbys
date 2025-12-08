from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Body, Depends
from typing import List, Optional
from database import shifts_collection, vehicles_collection, shift_assignments_collection
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
    
    # Get today's date range
    today = datetime.utcnow().date()
    today_str = today.isoformat()
    
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
    
    result = [serialize_assignment(a) for a in assignments]
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
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check if user has assignment for this vehicle
    assignment = await shift_assignments_collection.find_one({
        "user_id": user.id,
        "vehicle_id": vehicle["_id"],
        "status": "pending"
    })
    
    if not assignment:
        raise HTTPException(
            status_code=403, 
            detail="Bu araç için vardiya atamanız yok. Lütfen yöneticinizle iletişime geçin."
        )
    
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
    
    result["id"] = result.pop("_id")
    return Shift(**result)

@router.get("/active", response_model=Optional[Shift])
async def get_active_shift(request: Request):
    """Get user's active shift"""
    user = await get_current_user(request)
    
    shift_doc = await shifts_collection.find_one({
        "user_id": user.id,
        "end_time": None
    })
    
    if not shift_doc:
        return None
    
    shift_doc["id"] = shift_doc.pop("_id")
    return Shift(**shift_doc)

@router.get("/history", response_model=List[Shift])
async def get_shift_history(
    request: Request,
    user_id: Optional[str] = None,
    limit: int = 50
):
    """Get shift history"""
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
    
    for shift in shifts:
        shift["id"] = shift.pop("_id")
    
    return shifts

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
