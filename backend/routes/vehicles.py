from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import vehicles_collection, cases_collection, users_collection, shifts_collection, forms_collection, vehicle_current_locations_collection
from models import Vehicle, VehicleCreate, VehicleUpdate
from auth_utils import get_current_user, require_roles
from datetime import datetime

router = APIRouter()

@router.post("", response_model=Vehicle)
async def create_vehicle(request: Request):
    """Create new vehicle (admin only)"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    from pydantic import ValidationError
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        body = await request.json()
        logger.info(f"Received vehicle creation request: {body}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    
    # Boş string'leri None'a çevir ve temizle
    cleaned_body = {}
    for key, value in body.items():
        if value == "" or value is None:
            if key in ["last_inspection_date", "station_code", "fuel_level"]:
                cleaned_body[key] = None
            else:
                # Diğer alanlar için varsayılan değerleri kullan
                continue
        else:
            cleaned_body[key] = value
    
    # Parse last_inspection_date if it's a string
    if cleaned_body.get("last_inspection_date") and isinstance(cleaned_body["last_inspection_date"], str):
        try:
            from datetime import datetime as dt
            cleaned_body["last_inspection_date"] = dt.fromisoformat(cleaned_body["last_inspection_date"].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            # If parsing fails, try date format
            try:
                cleaned_body["last_inspection_date"] = dt.strptime(cleaned_body["last_inspection_date"], "%Y-%m-%d")
            except (ValueError, AttributeError):
                cleaned_body["last_inspection_date"] = None
    
    # Sayısal değerleri kontrol et
    if "km" in cleaned_body:
        try:
            cleaned_body["km"] = int(cleaned_body["km"])
        except (ValueError, TypeError):
            cleaned_body["km"] = 0
    
    if "next_maintenance_km" in cleaned_body:
        try:
            cleaned_body["next_maintenance_km"] = int(cleaned_body["next_maintenance_km"]) if cleaned_body["next_maintenance_km"] else 0
        except (ValueError, TypeError):
            cleaned_body["next_maintenance_km"] = 0
    
    if "fuel_level" in cleaned_body and cleaned_body["fuel_level"] is not None:
        try:
            cleaned_body["fuel_level"] = int(cleaned_body["fuel_level"])
        except (ValueError, TypeError):
            cleaned_body["fuel_level"] = None
    
    logger.info(f"Cleaned vehicle data: {cleaned_body}")
    
    # Validate with Pydantic
    try:
        vehicle_create = VehicleCreate(**cleaned_body)
    except ValidationError as e:
        error_messages = []
        for error in e.errors():
            field = ".".join(str(loc) for loc in error["loc"])
            error_messages.append(f"{field}: {error['msg']}")
        logger.error(f"Validation error: {error_messages}")
        raise HTTPException(
            status_code=422,
            detail=f"Validation error: {', '.join(error_messages)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error creating vehicle: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Vehicle creation failed: {str(e)}")
    
    # Create vehicle
    try:
        new_vehicle = Vehicle(**vehicle_create.model_dump())
        vehicle_dict = new_vehicle.model_dump(by_alias=True)
        
        await vehicles_collection.insert_one(vehicle_dict)
        
        logger.info(f"Vehicle created successfully: {new_vehicle.id}")
        return new_vehicle
    except Exception as e:
        logger.error(f"Database error creating vehicle: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Vehicle creation failed: {str(e)}")

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
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    # Önce aracın aktif vardiyası var mı kontrol et
    active_shift = await shifts_collection.find_one({
        "vehicle_id": vehicle_id,
        "end_time": None
    })
    
    if active_shift:
        raise HTTPException(
            status_code=400, 
            detail="Bu araçta aktif vardiya var. Önce vardiyayı bitirin."
        )
    
    result = await vehicles_collection.delete_one({"_id": vehicle_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    return {"message": "Araç başarıyla silindi"}

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
    
    vehicle_plate = vehicle.get("plate", "")
    
    # Query filters for date range
    date_query = {}
    if start_date:
        try:
            date_query["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except:
            pass
    if end_date:
        try:
            date_query["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        except:
            pass
    
    # Get all forms (ambulance_case) for this vehicle
    from database import forms_collection, cases_collection
    
    # Try multiple queries to find case data
    case_forms = []
    
    # Method 1: forms_collection with vehicle_plate
    forms_query = {"form_type": "ambulance_case", "vehicle_plate": vehicle_plate}
    if date_query:
        forms_query["created_at"] = date_query
    case_forms = await forms_collection.find(forms_query).to_list(1000)
    
    # Method 2: If no forms found, try cases_collection
    if not case_forms:
        cases_query = {
            "$or": [
                {"vehicle_info.plate": vehicle_plate},
                {"vehicle_plate": vehicle_plate},
                {"vehicle_id": vehicle_id}
            ]
        }
        if date_query:
            cases_query["created_at"] = date_query
        cases = await cases_collection.find(cases_query).to_list(1000)
        
        for case in cases:
            medical_form = case.get("medical_form", {})
            extended = medical_form.get("extended_form", {})
            if extended.get("startKm") or extended.get("endKm"):
                case_forms.append({
                    "case_id": case.get("_id"),
                    "form_data": extended,
                    "created_at": case.get("created_at"),
                    "submitted_by": case.get("team", [{}])[0].get("id") if case.get("team") else None
                })
    
    # Get all shifts for this vehicle - multiple approaches
    shifts_query = {
        "$or": [
            {"vehicle_id": vehicle_id},
            {"vehicle_plate": vehicle_plate}
        ],
        "end_time": {"$ne": None}
    }
    if date_query:
        shifts_query["created_at"] = date_query
    
    shifts = await shifts_collection.find(shifts_query).to_list(1000)
    
    # Process case KM
    case_km_data = []
    total_case_km = 0
    
    for form in case_forms:
        form_data = form.get("form_data", {})
        start_km_val = form_data.get("startKm") or form_data.get("start_km") or form_data.get("vakaBaslangicKm")
        end_km_val = form_data.get("endKm") or form_data.get("end_km") or form_data.get("vakaBitisKm")
        
        if start_km_val and end_km_val:
            try:
                start_km = int(float(str(start_km_val).replace(",", ".")))
                end_km = int(float(str(end_km_val).replace(",", ".")))
                km_diff = abs(end_km - start_km)
                
                if km_diff > 0 and km_diff < 1000:
                    submitted_by = form.get("submitted_by")
                    user = await users_collection.find_one({"_id": submitted_by}) if submitted_by else None
                    
                    case_km_data.append({
                        "case_id": form.get("case_id"),
                        "case_number": form_data.get("healmedyProtocol") or form_data.get("protocol_number") or "N/A",
                        "driver_name": user.get("name") if user else "Bilinmiyor",
                        "driver_id": submitted_by,
                        "start_km": start_km,
                        "end_km": end_km,
                        "km_used": km_diff,
                        "date": form.get("created_at").isoformat() if form.get("created_at") else None
                    })
                    total_case_km += km_diff
            except (ValueError, TypeError) as e:
                logger.warning(f"KM parse error for case: {e}")
                continue
    
    # Process shift KM
    shift_km_data = []
    total_shift_km = 0
    
    for shift in shifts:
        # Try multiple sources for km data
        shift_data = shift.get("handover_form", {}) or {}
        
        start_km_val = (
            shift_data.get("teslimAlinanKm") or 
            shift_data.get("start_km") or 
            shift.get("start_km") or
            shift_data.get("baslangicKm")
        )
        end_km_val = (
            shift_data.get("currentKm") or 
            shift_data.get("end_km") or 
            shift.get("end_km") or
            shift_data.get("bitisKm")
        )
        
        if start_km_val and end_km_val:
            try:
                start_km = int(float(str(start_km_val).replace(",", ".")))
                end_km = int(float(str(end_km_val).replace(",", ".")))
                km_diff = abs(end_km - start_km)
                
                if km_diff >= 0 and km_diff < 2000:  # Reasonable daily km check
                    user = await users_collection.find_one({"_id": shift.get("user_id")}) if shift.get("user_id") else None
                    
                    shift_km_data.append({
                        "shift_id": shift["_id"],
                        "driver_name": user.get("name") if user else "Bilinmiyor",
                        "driver_id": shift.get("user_id"),
                        "start_km": start_km,
                        "end_km": end_km,
                        "km_used": km_diff,
                        "start_time": shift.get("start_time").isoformat() if shift.get("start_time") else None,
                        "end_time": shift.get("end_time").isoformat() if shift.get("end_time") else None
                    })
                    total_shift_km += km_diff
            except (ValueError, TypeError) as e:
                logger.warning(f"KM parse error for shift: {e}")
                continue
    
    non_case_km = max(0, total_shift_km - total_case_km)
    
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


@router.post("/update-station-codes")
async def update_station_codes(request: Request):
    """İstasyon kodlarını araçlara ekle (tek seferlik)"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    import uuid
    
    # İstasyon kodları - plaka: istasyon kodu
    STATION_CODES = {
        "06 CHZ 142": "9365",
        "06 CHZ 146": "9370", 
        "06 CHZ 149": "9375",
        "34 FTU 336": "9360",
        "34 KMP 224": "9355",
        "34 MHA 112": "9356"
    }
    
    results = {"updated": [], "created": [], "errors": []}
    
    for plate, station_code in STATION_CODES.items():
        try:
            # Önce güncellemeyi dene
            result = await vehicles_collection.find_one_and_update(
                {"plate": plate},
                {"$set": {"station_code": station_code}},
                return_document=True
            )
            
            if result:
                results["updated"].append(f"{plate} -> {station_code}")
            else:
                # Araç yoksa oluştur
                new_vehicle = {
                    "_id": str(uuid.uuid4()),
                    "plate": plate,
                    "type": "ambulans",
                    "status": "musait",
                    "km": 0,
                    "station_code": station_code,
                    "qr_code": str(uuid.uuid4()),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                await vehicles_collection.insert_one(new_vehicle)
                results["created"].append(f"{plate} ({station_code})")
        except Exception as e:
            results["errors"].append(f"{plate}: {str(e)}")
    
    return {
        "message": "İstasyon kodları güncellendi",
        "results": results
    }
