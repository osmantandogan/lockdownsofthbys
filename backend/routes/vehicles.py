from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import vehicles_collection
from models import Vehicle, VehicleCreate, VehicleUpdate
from auth_utils import get_current_user, require_roles
from datetime import datetime

router = APIRouter()

@router.post("", response_model=Vehicle)
async def create_vehicle(data: VehicleCreate, request: Request):
    """Create new vehicle (admin only)"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    new_vehicle = Vehicle(**data.model_dump())
    vehicle_dict = new_vehicle.model_dump(by_alias=True)
    
    await vehicles_collection.insert_one(vehicle_dict)
    
    return new_vehicle

@router.get("/", response_model=List[Vehicle])
async def get_vehicles(
    request: Request,
    status: Optional[str] = None,
    type: Optional[str] = None
):
    """Get all vehicles"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    vehicles = await vehicles_collection.find(query).to_list(1000)
    
    for vehicle in vehicles:
        vehicle["id"] = vehicle.pop("_id")
    
    return vehicles

@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, request: Request):
    """Get vehicle by ID"""
    await get_current_user(request)
    
    vehicle_doc = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle_doc:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle_doc["id"] = vehicle_doc.pop("_id")
    return Vehicle(**vehicle_doc)

@router.get("/qr/{qr_code}", response_model=Vehicle)
async def get_vehicle_by_qr(qr_code: str, request: Request):
    """Get vehicle by QR code"""
    await get_current_user(request)
    
    vehicle_doc = await vehicles_collection.find_one({"qr_code": qr_code})
    if not vehicle_doc:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle_doc["id"] = vehicle_doc.pop("_id")
    return Vehicle(**vehicle_doc)

@router.patch("/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, data: VehicleUpdate, request: Request):
    """Update vehicle"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await vehicles_collection.find_one_and_update(
        {"_id": vehicle_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    result["id"] = result.pop("_id")
    return Vehicle(**result)

@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, request: Request):
    """Delete vehicle (admin only)"""
    await require_roles(["merkez_ofis"])(request)
    
    result = await vehicles_collection.delete_one({"_id": vehicle_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    return {"message": "Vehicle deleted successfully"}

@router.get("/stats/summary")
async def get_vehicle_stats(request: Request):
    """Get vehicle statistics"""
    await get_current_user(request)
    
    total = await vehicles_collection.count_documents({})
    available = await vehicles_collection.count_documents({"status": "musait"})
    on_duty = await vehicles_collection.count_documents({"status": "gorevde"})
    maintenance = await vehicles_collection.count_documents({"status": "bakimda"})
    faulty = await vehicles_collection.count_documents({"status": "arizali"})
    
    return {
        "total": total,
        "available": available,
        "on_duty": on_duty,
        "maintenance": maintenance,
        "faulty": faulty
    }

@router.get("/daily-assignments")
async def get_daily_assignments(request: Request, date: Optional[str] = None):
    """Get daily shift assignments for all vehicles"""
    await get_current_user(request)
    
    from database import shift_assignments_collection, users_collection
    from datetime import datetime as dt
    
    # Use today if no date provided
    if not date:
        target_date = dt.utcnow().date()
    else:
        target_date = dt.fromisoformat(date).date()
    
    # Get all assignments for the date
    assignments = await shift_assignments_collection.find({
        "shift_date": {
            "$gte": dt.combine(target_date, dt.min.time()),
            "$lt": dt.combine(target_date, dt.max.time())
        }
    }).to_list(1000)
    
    # Enrich with user and vehicle data
    result = []
    for assignment in assignments:
        user_doc = await users_collection.find_one({"_id": assignment["user_id"]})
        vehicle_doc = await vehicles_collection.find_one({"_id": assignment["vehicle_id"]})
        
        result.append({
            "assignment_id": assignment["_id"],
            "user_id": assignment["user_id"],
            "user_name": user_doc.get("name") if user_doc else "Unknown",
            "user_role": user_doc.get("role") if user_doc else "Unknown",
            "vehicle_id": assignment["vehicle_id"],
            "vehicle_plate": vehicle_doc.get("plate") if vehicle_doc else "Unknown",
            "status": assignment["status"],
            "shift_date": assignment["shift_date"]
        })
    
    return result

@router.get("/monthly-calendar")
async def get_monthly_calendar(request: Request, year: int, month: int):
    """Get monthly shift calendar for all vehicles"""
    await get_current_user(request)
    
    from database import shift_assignments_collection, users_collection
    from datetime import datetime as dt
    import calendar
    
    # Get first and last day of month
    first_day = dt(year, month, 1)
    last_day = dt(year, month, calendar.monthrange(year, month)[1], 23, 59, 59)
    
    # Get all assignments for the month
    assignments = await shift_assignments_collection.find({
        "shift_date": {
            "$gte": first_day,
            "$lte": last_day
        }
    }).to_list(10000)
    
    # Enrich with user and vehicle data
    result = []
    for assignment in assignments:
        user_doc = await users_collection.find_one({"_id": assignment["user_id"]})
        vehicle_doc = await vehicles_collection.find_one({"_id": assignment["vehicle_id"]})
        
        result.append({
            "assignment_id": assignment["_id"],
            "date": assignment["shift_date"].isoformat(),
            "user_id": assignment["user_id"],
            "user_name": user_doc.get("name") if user_doc else "Unknown",
            "user_role": user_doc.get("role") if user_doc else "Unknown",
            "vehicle_id": assignment["vehicle_id"],
            "vehicle_plate": vehicle_doc.get("plate") if vehicle_doc else "Unknown",
            "status": assignment["status"]
        })
    
    return result

# Maintenance Endpoints
@router.post("/maintenance")
async def create_maintenance(data: dict, request: Request):
    """Record vehicle maintenance"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    from database import db
    from datetime import datetime
    import uuid
    
    maintenance = {
        "_id": str(uuid.uuid4()),
        "vehicle_id": data["vehicle_id"],
        "maintenance_type": data["maintenance_type"],
        "description": data["description"],
        "km_at_maintenance": data["km_at_maintenance"],
        "cost": data.get("cost"),
        "performed_by": user.id,
        "notes": data.get("notes"),
        "created_at": datetime.utcnow()
    }
    
    await db.vehicle_maintenance.insert_one(maintenance)
    return maintenance

@router.get("/maintenance/{vehicle_id}")
async def get_maintenance_history(vehicle_id: str, request: Request):
    """Get maintenance history for vehicle"""
    await get_current_user(request)
    
    from database import db
    
    history = await db.vehicle_maintenance.find(
        {"vehicle_id": vehicle_id}
    ).sort("created_at", -1).to_list(100)
    
    for item in history:
        item["id"] = item.pop("_id")
    
    return history
