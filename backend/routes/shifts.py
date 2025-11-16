from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from typing import List, Optional
from database import shifts_collection, vehicles_collection, shift_assignments_collection
from models import Shift, ShiftStart, ShiftEnd, ShiftAssignment
from auth_utils import get_current_user, require_roles
from datetime import datetime
import base64
import uuid

router = APIRouter()

# Shift Assignment Endpoints
@router.post("/assignments")
async def create_shift_assignment(
    user_id: str,
    vehicle_id: str,
    shift_date: str,
    request: Request
):
    """Create shift assignment (Admin only)"""
    current_user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    # Check if user and vehicle exist
    from database import users_collection
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check if assignment already exists
    existing = await shift_assignments_collection.find_one({
        "user_id": user_id,
        "shift_date": datetime.fromisoformat(shift_date),
        "status": {"$in": ["pending", "started"]}
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="User already has an active assignment for this date")
    
    # Create assignment
    assignment = ShiftAssignment(
        user_id=user_id,
        vehicle_id=vehicle_id,
        assigned_by=current_user.id,
        shift_date=datetime.fromisoformat(shift_date)
    )
    
    assignment_dict = assignment.model_dump(by_alias=True)
    await shift_assignments_collection.insert_one(assignment_dict)
    
    return assignment

@router.get("/assignments/my")
async def get_my_assignments(request: Request):
    """Get user's shift assignments"""
    user = await get_current_user(request)
    
    assignments = await shift_assignments_collection.find({
        "user_id": user.id,
        "status": {"$in": ["pending", "started"]}
    }).sort("shift_date", -1).to_list(100)
    
    for assignment in assignments:
        assignment["id"] = assignment.pop("_id")
    
    return assignments

@router.get("/assignments")
async def get_all_assignments(request: Request):
    """Get all shift assignments (Admin only)"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    assignments = await shift_assignments_collection.find({}).sort("shift_date", -1).to_list(1000)
    
    for assignment in assignments:
        assignment["id"] = assignment.pop("_id")
    
    return assignments

@router.delete("/assignments/{assignment_id}")
async def delete_assignment(assignment_id: str, request: Request):
    """Delete shift assignment (Admin only)"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    result = await shift_assignments_collection.delete_one({"_id": assignment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    return {"message": "Assignment deleted successfully"}

@router.post("/start", response_model=Shift)
async def start_shift(data: ShiftStart, request: Request):
    """Start shift by scanning vehicle QR code"""
    user = await get_current_user(request)
    
    # Find vehicle by QR code
    vehicle = await vehicles_collection.find_one({"qr_code": data.vehicle_qr})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check if user already has an active shift
    active_shift = await shifts_collection.find_one({
        "user_id": user.id,
        "end_time": None
    })
    
    if active_shift:
        raise HTTPException(status_code=400, detail="You already have an active shift")
    
    # Create new shift
    new_shift = Shift(
        user_id=user.id,
        vehicle_id=vehicle["_id"],
        start_time=datetime.utcnow()
    )
    
    shift_dict = new_shift.model_dump(by_alias=True)
    await shifts_collection.insert_one(shift_dict)
    
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
