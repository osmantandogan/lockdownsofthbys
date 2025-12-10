from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import vehicles_collection, cases_collection, users_collection, shifts_collection, forms_collection, vehicle_current_locations_collection
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

@router.get("")
async def get_vehicles(
    request: Request,
    status: Optional[str] = None,
    type: Optional[str] = None
):
    """Get all vehicles with current location info"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    
    vehicles = await vehicles_collection.find(query).to_list(1000)
    
    # Tüm araçların güncel lokasyonlarını getir
    vehicle_ids = [v["_id"] for v in vehicles]
    current_locations = await vehicle_current_locations_collection.find({
        "vehicle_id": {"$in": vehicle_ids}
    }).to_list(1000)
    
    # Lokasyon map oluştur
    location_map = {loc["vehicle_id"]: loc for loc in current_locations}
    
    for vehicle in vehicles:
        vehicle["id"] = vehicle.pop("_id")
        
        # Güncel lokasyon bilgisini ekle
        loc = location_map.get(vehicle["id"])
        if loc:
            vehicle["current_location"] = loc.get("current_location_name")
            vehicle["current_location_id"] = loc.get("current_location_id")
            vehicle["healmedy_location_name"] = loc.get("assigned_location_name")
            vehicle["healmedy_location_id"] = loc.get("assigned_location_id")
    
    return vehicles

@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str, request: Request):
    """Get vehicle by ID"""
    await get_current_user(request)
    
    vehicle_doc = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle_doc:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle_doc["id"] = vehicle_doc.pop("_id")
    return vehicle_doc

@router.get("/qr/{qr_code}", response_model=Vehicle)
async def get_vehicle_by_qr(qr_code: str, request: Request):
    """Get vehicle by QR code"""
    await get_current_user(request)
    
    vehicle_doc = await vehicles_collection.find_one({"qr_code": qr_code})
    if not vehicle_doc:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    vehicle_doc["id"] = vehicle_doc.pop("_id")
    return Vehicle(**vehicle_doc)

@router.patch("/{vehicle_id}")
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
    return result

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

@router.get("/km-report/{vehicle_id}")
async def get_vehicle_km_report(
    vehicle_id: str,
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get detailed KM report for a vehicle"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Query filters
    query = {}
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date)}
    
    # Get all forms (ambulance_case) for this vehicle
    from database import forms_collection
    case_forms = await forms_collection.find({
        "form_type": "ambulance_case",
        "vehicle_plate": vehicle["plate"],
        **query
    }).to_list(1000)
    
    # Get all shifts for this vehicle
    shifts = await shifts_collection.find({
        "vehicle_id": vehicle_id,
        "end_time": {"$ne": None},
        **query
    }).to_list(1000)
    
    # Process case KM
    case_km_data = []
    total_case_km = 0
    
    for form in case_forms:
        form_data = form.get("form_data", {})
        if form_data.get("startKm") and form_data.get("endKm"):
            start_km = int(form_data["startKm"])
            end_km = int(form_data["endKm"])
            km_diff = end_km - start_km
            
            # Get driver info
            submitted_by = form.get("submitted_by")
            user = await users_collection.find_one({"_id": submitted_by})
            
            case_km_data.append({
                "case_id": form.get("case_id"),
                "case_number": form_data.get("healmedyProtocol", "N/A"),
                "driver_name": user.get("name") if user else "Unknown",
                "driver_id": submitted_by,
                "start_km": start_km,
                "end_km": end_km,
                "km_used": km_diff,
                "date": form.get("created_at").isoformat() if form.get("created_at") else None
            })
            total_case_km += km_diff
    
    # Process shift KM
    shift_km_data = []
    total_shift_km = 0
    
    for shift in shifts:
        shift_data = shift.get("handover_form", {})
        if shift_data.get("teslimAlinanKm") and shift_data.get("currentKm"):
            start_km = int(shift_data["teslimAlinanKm"])
            end_km = int(shift_data.get("currentKm", start_km))
            km_diff = end_km - start_km
            
            # Get user info
            user = await users_collection.find_one({"_id": shift["user_id"]})
            
            shift_km_data.append({
                "shift_id": shift["_id"],
                "driver_name": user.get("name") if user else "Unknown",
                "driver_id": shift["user_id"],
                "start_km": start_km,
                "end_km": end_km,
                "km_used": km_diff,
                "start_time": shift.get("start_time").isoformat() if shift.get("start_time") else None,
                "end_time": shift.get("end_time").isoformat() if shift.get("end_time") else None
            })
            total_shift_km += km_diff
    
    non_case_km = total_shift_km - total_case_km if total_shift_km > total_case_km else 0
    
    return {
        "vehicle": {
            "id": vehicle["_id"],
            "plate": vehicle["plate"],
            "current_km": vehicle.get("km", 0)
        },
        "summary": {
            "total_shift_km": total_shift_km,
            "total_case_km": total_case_km,
            "non_case_km": non_case_km,
            "efficiency_rate": round((total_case_km / total_shift_km * 100) if total_shift_km > 0 else 0, 2)
        },
        "case_details": case_km_data,
        "shift_details": shift_km_data
    }
