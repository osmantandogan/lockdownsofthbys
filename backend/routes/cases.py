from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import cases_collection, vehicles_collection, users_collection
from models import Case, CaseCreate, CaseAssignTeam, CaseUpdateStatus, CaseStatusUpdate
from auth_utils import get_current_user
from datetime import datetime
from email_service import send_case_notifications

router = APIRouter()

def generate_case_number() -> str:
    """Generate case number in format YYYYMMDD-XXXX"""
    now = datetime.utcnow()
    date_str = now.strftime("%Y%m%d")
    # This is simplified - in production, use atomic counter
    return f"{date_str}-{now.strftime('%H%M%S')}"

@router.post("/", response_model=Case)
async def create_case(data: CaseCreate, request: Request):
    """Create new case (Call Center)"""
    user = await get_current_user(request)
    
    # Generate case number
    case_number = generate_case_number()
    
    # Create case
    new_case = Case(
        case_number=case_number,
        caller=data.caller,
        patient=data.patient,
        location=data.location,
        priority=data.priority,
        created_by=user.id
    )
    
    # Add initial status to history
    initial_status = CaseStatusUpdate(
        status="acildi",
        note="Vaka oluşturuldu",
        updated_by=user.id
    )
    new_case.status_history.append(initial_status)
    
    case_dict = new_case.model_dump(by_alias=True)
    await cases_collection.insert_one(case_dict)
    
    return new_case

@router.get("/", response_model=List[Case])
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
    
    # Role-based filtering
    if user.role in ["paramedik", "att", "sofor"]:
        # Only see assigned cases
        query["$or"] = [
            {"assigned_team.driver_id": user.id},
            {"assigned_team.paramedic_id": user.id},
            {"assigned_team.att_id": user.id}
        ]
    
    if status:
        query["status"] = status
    
    if priority:
        query["priority"] = priority
    
    if search:
        query["$or"] = [
            {"case_number": {"$regex": search, "$options": "i"}},
            {"patient.name": {"$regex": search, "$options": "i"}},
            {"patient.surname": {"$regex": search, "$options": "i"}}
        ]
    
    cases = await cases_collection.find(query).sort("created_at", -1).to_list(1000)
    
    for case in cases:
        case["id"] = case.pop("_id")
    
    return cases

@router.get("/{case_id}", response_model=Case)
async def get_case(case_id: str, request: Request):
    """Get case by ID"""
    await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")
    
    case_doc["id"] = case_doc.pop("_id")
    return Case(**case_doc)

@router.post("/{case_id}/assign-team")
async def assign_team(case_id: str, data: CaseAssignTeam, request: Request):
    """Assign team to case (Operation Manager)"""
    user = await get_current_user(request)
    
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Only operation managers can assign teams")
    
    # Check if vehicle exists and is available
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if vehicle["status"] != "musait":
        raise HTTPException(status_code=400, detail="Vehicle is not available")
    
    # Update case
    assigned_team = data.model_dump()
    assigned_team["assigned_at"] = datetime.utcnow()
    
    status_update = CaseStatusUpdate(
        status="ekip_bilgilendirildi",
        note="Ekip görevlendirildi",
        updated_by=user.id
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
    
    return {"message": "Team assigned successfully"}

@router.patch("/{case_id}/status")
async def update_case_status(case_id: str, data: CaseUpdateStatus, request: Request):
    """Update case status"""
    user = await get_current_user(request)
    
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Create status update
    status_update = CaseStatusUpdate(
        status=data.status,
        note=data.note,
        updated_by=user.id
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
