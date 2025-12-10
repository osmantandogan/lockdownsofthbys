"""
Lokasyon Yönetimi API
- Healmedy Lokasyonları (sabit)
- Saha Lokasyonları (araç, carter, depo)
- Lokasyon değişikliği istekleri
- Araç güncel lokasyon takibi
"""

from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from database import (
    db, vehicles_collection, users_collection, 
    shift_assignments_collection, shifts_collection
)
from models import (
    FieldLocation, FieldLocationCreate,
    LocationChangeRequest, LocationChangeRequestCreate,
    VehicleCurrentLocation, HEALMEDY_LOCATIONS
)
from auth_utils import get_current_user, require_roles

router = APIRouter()
logger = logging.getLogger(__name__)

# Collections
field_locations_collection = db.field_locations
location_change_requests_collection = db.location_change_requests
vehicle_current_locations_collection = db.vehicle_current_locations


# ==================== HEALMEDY LOKASYONLARI ====================

@router.get("/healmedy")
async def get_healmedy_locations(request: Request):
    """Healmedy sabit lokasyonlarını getir"""
    await get_current_user(request)
    return HEALMEDY_LOCATIONS


# ==================== SAHA LOKASYONLARI ====================

@router.post("/field")
async def create_field_location(data: FieldLocationCreate, request: Request):
    """Yeni saha lokasyonu oluştur (araç, carter, depo)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor", "cagri_merkezi"])(request)
    
    # Healmedy lokasyonu adını al
    healmedy_name = None
    if data.healmedy_location_id:
        loc = next((l for l in HEALMEDY_LOCATIONS if l["id"] == data.healmedy_location_id), None)
        if loc:
            healmedy_name = loc["name"]
    
    # Araç bilgisini al
    vehicle_plate = None
    if data.vehicle_id:
        vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
        if vehicle:
            vehicle_plate = vehicle.get("plate")
    
    new_location = FieldLocation(
        name=data.name,
        location_type=data.location_type,
        healmedy_location_id=data.healmedy_location_id,
        healmedy_location_name=healmedy_name,
        vehicle_id=data.vehicle_id,
        vehicle_plate=vehicle_plate,
        created_by=user.id
    )
    
    location_dict = new_location.model_dump(by_alias=True)
    await field_locations_collection.insert_one(location_dict)
    
    logger.info(f"Yeni saha lokasyonu oluşturuldu: {new_location.name} - {new_location.location_type}")
    
    location_dict["id"] = location_dict.pop("_id")
    return location_dict


@router.get("/field")
async def get_field_locations(
    request: Request,
    location_type: Optional[str] = None,
    healmedy_location_id: Optional[str] = None,
    vehicle_id: Optional[str] = None
):
    """Saha lokasyonlarını getir"""
    await get_current_user(request)
    
    query = {"is_active": True}
    
    if location_type:
        query["location_type"] = location_type
    
    if healmedy_location_id:
        query["healmedy_location_id"] = healmedy_location_id
    
    if vehicle_id:
        query["vehicle_id"] = vehicle_id
    
    locations = await field_locations_collection.find(query).to_list(500)
    
    for loc in locations:
        loc["id"] = loc.pop("_id")
    
    return locations


@router.get("/field/{location_id}")
async def get_field_location(location_id: str, request: Request):
    """Tek saha lokasyonu getir"""
    await get_current_user(request)
    
    location = await field_locations_collection.find_one({"_id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    location["id"] = location.pop("_id")
    return location


@router.get("/field/qr/{qr_code}")
async def get_field_location_by_qr(qr_code: str, request: Request):
    """QR kod ile saha lokasyonu bul"""
    await get_current_user(request)
    
    location = await field_locations_collection.find_one({"qr_code": qr_code})
    if not location:
        raise HTTPException(status_code=404, detail="Bu QR koda ait lokasyon bulunamadı")
    
    location["id"] = location.pop("_id")
    return location


@router.delete("/field/{location_id}")
async def delete_field_location(location_id: str, request: Request):
    """Saha lokasyonunu sil (soft delete)"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    result = await field_locations_collection.update_one(
        {"_id": location_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    return {"message": "Lokasyon silindi"}


# ==================== LOKASYON DEĞİŞİKLİĞİ İSTEKLERİ ====================

@router.post("/change-request")
async def create_location_change_request(data: LocationChangeRequestCreate, request: Request):
    """Lokasyon değişikliği isteği oluştur (ATT/Paramedik)"""
    user = await get_current_user(request)
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Mevcut lokasyonu bul
    current_loc = await vehicle_current_locations_collection.find_one({"vehicle_id": data.vehicle_id})
    if not current_loc:
        raise HTTPException(status_code=400, detail="Araç için mevcut lokasyon bulunamadı")
    
    # Hedef lokasyonu bul
    to_location = next((l for l in HEALMEDY_LOCATIONS if l["id"] == data.to_location_id), None)
    if not to_location:
        raise HTTPException(status_code=404, detail="Hedef lokasyon bulunamadı")
    
    # Bekleyen istek var mı kontrol et
    existing = await location_change_requests_collection.find_one({
        "vehicle_id": data.vehicle_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Bu araç için bekleyen bir lokasyon değişikliği isteği var")
    
    new_request = LocationChangeRequest(
        requester_id=user.id,
        requester_name=user.name,
        requester_role=user.role,
        vehicle_id=data.vehicle_id,
        vehicle_plate=vehicle.get("plate"),
        from_location_id=current_loc.get("current_location_id"),
        from_location_name=current_loc.get("current_location_name"),
        to_location_id=data.to_location_id,
        to_location_name=to_location["name"],
        reason=data.reason
    )
    
    request_dict = new_request.model_dump(by_alias=True)
    await location_change_requests_collection.insert_one(request_dict)
    
    logger.info(f"Lokasyon değişikliği isteği: {user.name} - {vehicle.get('plate')} - {to_location['name']}")
    
    # Çağrı merkezi ve hemşirelere bildirim gönder
    try:
        from services.onesignal_service import onesignal_service, NotificationType
        
        approvers = await users_collection.find({
            "role": {"$in": ["cagri_merkezi", "hemsire", "operasyon_muduru"]},
            "is_active": True
        }).to_list(100)
        
        approver_ids = [a["_id"] for a in approvers]
        
        if approver_ids:
            await onesignal_service.send_notification(
                NotificationType.SYSTEM_ALERT,
                approver_ids,
                {
                    "message": f"Lokasyon değişikliği isteği: {vehicle.get('plate')} → {to_location['name']}"
                }
            )
    except Exception as e:
        logger.warning(f"Bildirim gönderilemedi: {e}")
    
    request_dict["id"] = request_dict.pop("_id")
    return request_dict


@router.get("/change-request/pending")
async def get_pending_change_requests(request: Request):
    """Bekleyen lokasyon değişikliği isteklerini getir"""
    await require_roles(["cagri_merkezi", "hemsire", "operasyon_muduru", "merkez_ofis"])(request)
    
    requests = await location_change_requests_collection.find({
        "status": "pending"
    }).sort("created_at", -1).to_list(100)
    
    for req in requests:
        req["id"] = req.pop("_id")
    
    return requests


@router.post("/change-request/{request_id}/approve")
async def approve_location_change(request_id: str, request: Request):
    """Lokasyon değişikliği isteğini onayla"""
    user = await require_roles(["cagri_merkezi", "hemsire", "operasyon_muduru", "merkez_ofis"])(request)
    
    change_req = await location_change_requests_collection.find_one({"_id": request_id})
    if not change_req:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    
    if change_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu istek zaten işlenmiş")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # İsteği onayla
    await location_change_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": turkey_now
        }}
    )
    
    # Araç güncel lokasyonunu güncelle
    await vehicle_current_locations_collection.update_one(
        {"vehicle_id": change_req["vehicle_id"]},
        {"$set": {
            "current_location_id": change_req["to_location_id"],
            "current_location_name": change_req["to_location_name"],
            "updated_by": user.id,
            "updated_at": turkey_now
        }},
        upsert=True
    )
    
    logger.info(f"Lokasyon değişikliği onaylandı: {change_req['vehicle_plate']} → {change_req['to_location_name']}")
    
    return {"message": "Lokasyon değişikliği onaylandı"}


@router.post("/change-request/{request_id}/reject")
async def reject_location_change(request_id: str, request: Request):
    """Lokasyon değişikliği isteğini reddet"""
    user = await require_roles(["cagri_merkezi", "hemsire", "operasyon_muduru", "merkez_ofis"])(request)
    body = await request.json()
    
    change_req = await location_change_requests_collection.find_one({"_id": request_id})
    if not change_req:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    
    if change_req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu istek zaten işlenmiş")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    await location_change_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "rejected",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": turkey_now,
            "rejection_reason": body.get("reason", "")
        }}
    )
    
    logger.info(f"Lokasyon değişikliği reddedildi: {change_req['vehicle_plate']}")
    
    return {"message": "Lokasyon değişikliği reddedildi"}


# ==================== ARAÇ GÜNCEL LOKASYON ====================

@router.get("/vehicle/{vehicle_id}/current")
async def get_vehicle_current_location(vehicle_id: str, request: Request):
    """Aracın güncel lokasyonunu getir"""
    await get_current_user(request)
    
    current = await vehicle_current_locations_collection.find_one({"vehicle_id": vehicle_id})
    
    if not current:
        # Varsayılan olarak araç bilgisinden al
        vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Araç bulunamadı")
        
        return {
            "vehicle_id": vehicle_id,
            "vehicle_plate": vehicle.get("plate"),
            "assigned_location_id": None,
            "assigned_location_name": None,
            "current_location_id": None,
            "current_location_name": None
        }
    
    current["id"] = current.pop("_id")
    return current


@router.post("/vehicle/{vehicle_id}/set-location")
async def set_vehicle_location(vehicle_id: str, request: Request):
    """Araç lokasyonunu ayarla (vardiya atamasında)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor", "cagri_merkezi"])(request)
    body = await request.json()
    
    location_id = body.get("location_id")
    if not location_id:
        raise HTTPException(status_code=400, detail="location_id gerekli")
    
    # Lokasyon bilgisini al
    location = next((l for l in HEALMEDY_LOCATIONS if l["id"] == location_id), None)
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    location_data = VehicleCurrentLocation(
        vehicle_id=vehicle_id,
        vehicle_plate=vehicle.get("plate"),
        assigned_location_id=location_id,
        assigned_location_name=location["name"],
        current_location_id=location_id,
        current_location_name=location["name"],
        updated_by=user.id,
        updated_at=turkey_now
    )
    
    await vehicle_current_locations_collection.update_one(
        {"vehicle_id": vehicle_id},
        {"$set": location_data.model_dump(by_alias=True)},
        upsert=True
    )
    
    logger.info(f"Araç lokasyonu ayarlandı: {vehicle.get('plate')} → {location['name']}")
    
    return {"message": f"Araç lokasyonu ayarlandı: {location['name']}"}


@router.get("/vehicles/by-location/{location_id}")
async def get_vehicles_by_location(location_id: str, request: Request):
    """Belirli lokasyondaki araçları getir"""
    await get_current_user(request)
    
    vehicles = await vehicle_current_locations_collection.find({
        "current_location_id": location_id
    }).to_list(100)
    
    for v in vehicles:
        v["id"] = v.pop("_id")
    
    return vehicles


