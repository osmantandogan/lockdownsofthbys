from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import vehicles_collection
from models import Vehicle, VehicleCreate, VehicleUpdate
from auth_utils import get_current_user, require_roles
from datetime import datetime

router = APIRouter()

@router.post("/", response_model=Vehicle)
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
