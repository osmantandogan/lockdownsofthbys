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
    try:
        user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor", "cagri_merkezi", "hemsire", "att", "paramedik", "sofor"])(request)
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
        
        # Update document directly instead of using model to avoid validation issues
        update_data = {
            "vehicle_id": vehicle_id,
            "vehicle_plate": vehicle.get("plate", ""),
            "assigned_location_id": location_id,
            "assigned_location_name": location["name"],
            "current_location_id": location_id,
            "current_location_name": location["name"],
            "updated_by": user.id,
            "updated_at": turkey_now
        }
        
        await vehicle_current_locations_collection.update_one(
            {"vehicle_id": vehicle_id},
            {"$set": update_data},
            upsert=True
        )
        
        logger.info(f"Araç lokasyonu ayarlandı: {vehicle.get('plate')} → {location['name']}")
        
        return {"message": f"Araç lokasyonu ayarlandı: {location['name']}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Araç lokasyonu ayarlanırken hata: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lokasyon ayarlanamadı: {str(e)}")


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


# ==================== GPS TRACKING ====================

# GPS konum geçmişi collection
vehicle_gps_history_collection = db.vehicle_gps_history


@router.post("/vehicle/{vehicle_id}/gps")
async def update_vehicle_gps(vehicle_id: str, request: Request):
    """Araç GPS konumunu güncelle (gerçek zamanlı tracking)"""
    user = await get_current_user(request)
    body = await request.json()
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # GPS verisi
    gps_data = {
        "_id": f"gps_{vehicle_id}_{int(turkey_now.timestamp())}",
        "vehicle_id": vehicle_id,
        "vehicle_plate": vehicle.get("plate"),
        "user_id": body.get("userId") or user.id,
        "latitude": body.get("latitude"),
        "longitude": body.get("longitude"),
        "accuracy": body.get("accuracy"),
        "altitude": body.get("altitude"),
        "heading": body.get("heading"),
        "speed": body.get("speed"),
        "timestamp": body.get("timestamp") or turkey_now.isoformat(),
        "created_at": turkey_now
    }
    
    # GPS geçmişine kaydet
    await vehicle_gps_history_collection.insert_one(gps_data)
    
    # Araç güncel konumunu güncelle
    await vehicle_current_locations_collection.update_one(
        {"vehicle_id": vehicle_id},
        {"$set": {
            "last_gps_latitude": body.get("latitude"),
            "last_gps_longitude": body.get("longitude"),
            "last_gps_accuracy": body.get("accuracy"),
            "last_gps_speed": body.get("speed"),
            "last_gps_heading": body.get("heading"),
            "last_gps_update": turkey_now
        }},
        upsert=True
    )
    
    logger.debug(f"GPS güncellendi: {vehicle.get('plate')} - {body.get('latitude')}, {body.get('longitude')}")
    
    return {"success": True, "message": "GPS konumu güncellendi"}


@router.get("/vehicle/{vehicle_id}/gps/history")
async def get_vehicle_gps_history(
    vehicle_id: str, 
    request: Request,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
):
    """Araç GPS geçmişini getir"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi"])(request)
    
    query = {"vehicle_id": vehicle_id}
    
    # Tarih filtreleri
    if start_date or end_date:
        query["created_at"] = {}
        if start_date:
            query["created_at"]["$gte"] = datetime.fromisoformat(start_date)
        if end_date:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date)
    
    history = await vehicle_gps_history_collection.find(query)\
        .sort("created_at", -1)\
        .limit(limit)\
        .to_list(limit)
    
    for h in history:
        h["id"] = h.pop("_id")
    
    return history


@router.get("/vehicle/{vehicle_id}/gps/latest")
async def get_vehicle_latest_gps(vehicle_id: str, request: Request):
    """Araç son GPS konumunu getir"""
    await get_current_user(request)
    
    # Önce güncel lokasyon tablosundan kontrol et
    current = await vehicle_current_locations_collection.find_one({"vehicle_id": vehicle_id})
    
    if current and current.get("last_gps_latitude"):
        return {
            "vehicle_id": vehicle_id,
            "latitude": current.get("last_gps_latitude"),
            "longitude": current.get("last_gps_longitude"),
            "accuracy": current.get("last_gps_accuracy"),
            "speed": current.get("last_gps_speed"),
            "heading": current.get("last_gps_heading"),
            "last_update": current.get("last_gps_update")
        }
    
    # GPS geçmişinden son kaydı al
    latest = await vehicle_gps_history_collection.find_one(
        {"vehicle_id": vehicle_id},
        sort=[("created_at", -1)]
    )
    
    if latest:
        return {
            "vehicle_id": vehicle_id,
            "latitude": latest.get("latitude"),
            "longitude": latest.get("longitude"),
            "accuracy": latest.get("accuracy"),
            "speed": latest.get("speed"),
            "heading": latest.get("heading"),
            "last_update": latest.get("created_at")
        }
    
    return {"vehicle_id": vehicle_id, "latitude": None, "longitude": None}


@router.post("/batch")
async def save_batch_locations(request: Request):
    """Toplu GPS konumu kaydet (offline sync için)"""
    user = await get_current_user(request)
    body = await request.json()
    
    locations = body.get("locations", [])
    if not locations:
        raise HTTPException(status_code=400, detail="Konum verisi bulunamadı")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    saved_count = 0
    
    for loc in locations:
        vehicle_id = loc.get("vehicleId")
        if not vehicle_id:
            continue
        
        # Araç kontrolü
        vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        if not vehicle:
            continue
        
        gps_data = {
            "_id": f"gps_{vehicle_id}_{loc.get('timestamp', turkey_now.isoformat())}",
            "vehicle_id": vehicle_id,
            "vehicle_plate": vehicle.get("plate"),
            "user_id": loc.get("userId") or user.id,
            "latitude": loc.get("latitude"),
            "longitude": loc.get("longitude"),
            "accuracy": loc.get("accuracy"),
            "altitude": loc.get("altitude"),
            "heading": loc.get("heading"),
            "speed": loc.get("speed"),
            "timestamp": loc.get("timestamp"),
            "created_at": turkey_now,
            "synced_from_offline": True
        }
        
        try:
            await vehicle_gps_history_collection.insert_one(gps_data)
            saved_count += 1
        except Exception as e:
            # Duplicate key hatası olabilir, devam et
            logger.warning(f"GPS kayıt hatası: {e}")
    
    logger.info(f"Toplu GPS kaydı: {saved_count}/{len(locations)} konum kaydedildi")
    
    return {"success": True, "saved_count": saved_count, "total": len(locations)}


# ==================== MERKEZİ LOKASYON API ====================

@router.get("/all")
async def get_all_locations(request: Request, include_inactive: bool = False):
    """
    TÜM LOKASYONLARI tek endpoint'ten getir.
    Lokasyon tipleri:
    - healmedy: Bekleme noktaları (Osman Gazi, Green Zone vb.)
    - vehicle: Ambulanslar (plaka bazlı)
    - warehouse: Depo (Merkez Depo)
    - carter: Carter/Dolap
    - health_center: Sağlık merkezi
    - custom: Kullanıcı tanımlı lokasyonlar
    """
    await get_current_user(request)
    
    all_locations = []
    
    # 1. HEALMEDY LOKASYONLARI (Bekleme Noktaları)
    for loc in HEALMEDY_LOCATIONS:
        all_locations.append({
            "id": loc["id"],
            "name": loc["name"],
            "type": "healmedy",
            "icon": "map-pin",
            "is_active": True,
            "source": "healmedy_static"
        })
    
    # 2. ARAÇLAR (Ambulanslar)
    vehicles = await vehicles_collection.find({"type": "ambulans"}).to_list(100)
    for v in vehicles:
        plate = v.get("plate", "")
        station_code = v.get("station_code", "")
        display_name = f"{plate} ({station_code})" if station_code else plate
        
        all_locations.append({
            "id": f"vehicle_{v.get('_id')}",
            "name": display_name,
            "type": "vehicle",
            "icon": "truck",
            "vehicle_id": v.get("_id"),
            "vehicle_plate": plate,
            "station_code": station_code,
            "is_active": v.get("status") != "kullanim_disi",
            "source": "vehicles"
        })
    
    # 3. STOK LOKASYONLARI (stock_locations collection)
    stock_locations_col = db["stock_locations"]
    query = {} if include_inactive else {"is_active": True}
    stock_locs = await stock_locations_col.find(query).to_list(500)
    
    # Araç lokasyonlarını atla (zaten yukarıda eklendi)
    seen_vehicle_plates = {v.get("plate") for v in vehicles}
    
    for loc in stock_locs:
        loc_type = loc.get("type", "custom")
        loc_name = loc.get("name", "")
        
        # Araç lokasyonunu tekrar ekleme
        if loc_type == "vehicle" and loc.get("vehicle_plate") in seen_vehicle_plates:
            continue
        
        # Healmedy lokasyonunu tekrar ekleme
        if loc_type == "waiting_point" and any(h["name"] == loc_name for h in HEALMEDY_LOCATIONS):
            continue
        
        all_locations.append({
            "id": loc.get("_id"),
            "name": loc_name,
            "type": loc_type,  # vehicle, waiting_point, warehouse, emergency_bag
            "icon": "warehouse" if loc_type == "warehouse" else "briefcase" if loc_type == "emergency_bag" else "map-pin",
            "vehicle_id": loc.get("vehicle_id"),
            "vehicle_plate": loc.get("vehicle_plate"),
            "healmedy_location_id": loc.get("healmedy_location_id"),
            "is_active": loc.get("is_active", True),
            "source": "stock_locations"
        })
    
    # 4. SAHA LOKASYONLARI (field_locations collection)
    field_locs = await field_locations_collection.find({"is_active": True}).to_list(500)
    
    for loc in field_locs:
        loc_name = loc.get("name", "")
        loc_type = loc.get("location_type", "custom")
        
        # Zaten eklenmiş mi kontrol et
        if any(l["name"] == loc_name for l in all_locations):
            continue
        
        all_locations.append({
            "id": loc.get("_id"),
            "name": loc_name,
            "type": loc_type,  # merkez_depo, arac, carter
            "icon": "warehouse" if loc_type == "merkez_depo" else "truck" if loc_type == "arac" else "box",
            "vehicle_id": loc.get("vehicle_id"),
            "vehicle_plate": loc.get("vehicle_plate"),
            "healmedy_location_id": loc.get("healmedy_location_id"),
            "qr_code": loc.get("qr_code"),
            "is_active": loc.get("is_active", True),
            "source": "field_locations"
        })
    
    # Merkez Depo yoksa ekle
    if not any(l["name"] == "Merkez Depo" for l in all_locations):
        all_locations.insert(0, {
            "id": "merkez_depo",
            "name": "Merkez Depo",
            "type": "warehouse",
            "icon": "warehouse",
            "is_active": True,
            "source": "default"
        })
    
    # Acil Çanta yoksa ekle
    if not any(l["name"] == "Acil Çanta" for l in all_locations):
        all_locations.append({
            "id": "acil_canta",
            "name": "Acil Çanta",
            "type": "emergency_bag",
            "icon": "briefcase",
            "is_active": True,
            "source": "default"
        })
    
    # İsme göre sırala (Merkez Depo her zaman en üstte)
    def sort_key(loc):
        if loc["name"] == "Merkez Depo":
            return (0, "")
        elif loc["type"] == "healmedy":
            return (1, loc["name"])
        elif loc["type"] == "vehicle":
            return (2, loc["name"])
        else:
            return (3, loc["name"])
    
    all_locations.sort(key=sort_key)
    
    return {
        "locations": all_locations,
        "total": len(all_locations),
        "by_type": {
            "healmedy": len([l for l in all_locations if l["type"] == "healmedy"]),
            "vehicle": len([l for l in all_locations if l["type"] == "vehicle"]),
            "warehouse": len([l for l in all_locations if l["type"] == "warehouse"]),
            "other": len([l for l in all_locations if l["type"] not in ["healmedy", "vehicle", "warehouse"]])
        }
    }


@router.post("/create")
async def create_location(request: Request):
    """
    Yeni lokasyon oluştur (dinamik)
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi"])(request)
    body = await request.json()
    
    name = body.get("name")
    loc_type = body.get("type", "custom")
    
    if not name:
        raise HTTPException(status_code=400, detail="Lokasyon adı gerekli")
    
    # stock_locations collection'a ekle
    stock_locations_col = db["stock_locations"]
    
    # Aynı isimde lokasyon var mı kontrol et
    existing = await stock_locations_col.find_one({"name": name, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail=f"'{name}' adında bir lokasyon zaten mevcut")
    
    import uuid
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    new_location = {
        "_id": str(uuid.uuid4()),
        "name": name,
        "type": loc_type,
        "description": body.get("description", ""),
        "healmedy_location_id": body.get("healmedy_location_id"),
        "vehicle_id": body.get("vehicle_id"),
        "vehicle_plate": body.get("vehicle_plate"),
        "is_active": True,
        "created_at": turkey_now,
        "created_by": user.id,
        "created_by_name": user.name
    }
    
    await stock_locations_col.insert_one(new_location)
    
    logger.info(f"Yeni lokasyon oluşturuldu: {name} ({loc_type}) - {user.name}")
    
    new_location["id"] = new_location.pop("_id")
    return new_location


@router.patch("/update/{location_id}")
async def update_location(location_id: str, request: Request):
    """Lokasyonu güncelle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    body = await request.json()
    
    stock_locations_col = db["stock_locations"]
    
    update_data = {}
    if "name" in body:
        update_data["name"] = body["name"]
    if "type" in body:
        update_data["type"] = body["type"]
    if "description" in body:
        update_data["description"] = body["description"]
    if "is_active" in body:
        update_data["is_active"] = body["is_active"]
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek veri yok")
    
    update_data["updated_at"] = datetime.utcnow() + timedelta(hours=3)
    update_data["updated_by"] = user.id
    
    result = await stock_locations_col.update_one(
        {"_id": location_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    logger.info(f"Lokasyon güncellendi: {location_id} - {user.name}")
    
    return {"message": "Lokasyon güncellendi"}


@router.delete("/delete/{location_id}")
async def delete_location(location_id: str, request: Request):
    """Lokasyonu sil (soft delete)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    stock_locations_col = db["stock_locations"]
    
    result = await stock_locations_col.update_one(
        {"_id": location_id},
        {"$set": {
            "is_active": False,
            "deleted_at": datetime.utcnow() + timedelta(hours=3),
            "deleted_by": user.id
        }}
    )
    
    if result.modified_count == 0:
        # Belki healmedy veya araç lokasyonudur, onları silemeyiz
        raise HTTPException(status_code=400, detail="Bu lokasyon silinemez veya bulunamadı")
    
    logger.info(f"Lokasyon silindi: {location_id} - {user.name}")
    
    return {"message": "Lokasyon silindi"}


@router.post("/sync")
async def sync_all_locations(request: Request):
    """
    Tüm lokasyonları senkronize et:
    - Araçları stock_locations'a ekle
    - Healmedy lokasyonlarını stock_locations'a ekle
    - Eksik varsayılan lokasyonları ekle
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi"])(request)
    
    import uuid
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    stock_locations_col = db["stock_locations"]
    
    created_count = 0
    updated_count = 0
    
    # 1. Merkez Depo
    merkez = await stock_locations_col.find_one({"name": "Merkez Depo"})
    if not merkez:
        await stock_locations_col.insert_one({
            "_id": "merkez_depo",
            "name": "Merkez Depo",
            "type": "warehouse",
            "is_active": True,
            "created_at": turkey_now,
            "created_by": user.id
        })
        created_count += 1
    
    # 2. Acil Çanta
    acil = await stock_locations_col.find_one({"name": "Acil Çanta"})
    if not acil:
        await stock_locations_col.insert_one({
            "_id": "acil_canta",
            "name": "Acil Çanta",
            "type": "emergency_bag",
            "is_active": True,
            "created_at": turkey_now,
            "created_by": user.id
        })
        created_count += 1
    
    # 3. Healmedy Lokasyonları
    for loc in HEALMEDY_LOCATIONS:
        existing = await stock_locations_col.find_one({"healmedy_location_id": loc["id"]})
        if not existing:
            await stock_locations_col.insert_one({
                "_id": str(uuid.uuid4()),
                "name": loc["name"],
                "type": "waiting_point",
                "healmedy_location_id": loc["id"],
                "is_active": True,
                "created_at": turkey_now,
                "created_by": user.id
            })
            created_count += 1
        elif existing.get("name") != loc["name"]:
            await stock_locations_col.update_one(
                {"_id": existing["_id"]},
                {"$set": {"name": loc["name"]}}
            )
            updated_count += 1
    
    # 4. Araçlar
    vehicles = await vehicles_collection.find({"type": "ambulans"}).to_list(100)
    for v in vehicles:
        plate = v.get("plate", "")
        station_code = v.get("station_code", "")
        display_name = f"{plate} ({station_code})" if station_code else plate
        vehicle_id = v.get("_id")
        
        existing = await stock_locations_col.find_one({
            "$or": [
                {"vehicle_id": vehicle_id},
                {"vehicle_plate": plate}
            ]
        })
        
        if not existing:
            await stock_locations_col.insert_one({
                "_id": str(uuid.uuid4()),
                "name": display_name,
                "type": "vehicle",
                "vehicle_id": vehicle_id,
                "vehicle_plate": plate,
                "station_code": station_code,
                "is_active": True,
                "created_at": turkey_now,
                "created_by": user.id
            })
            created_count += 1
        elif existing.get("name") != display_name:
            await stock_locations_col.update_one(
                {"_id": existing["_id"]},
                {"$set": {
                    "name": display_name,
                    "station_code": station_code,
                    "vehicle_id": vehicle_id
                }}
            )
            updated_count += 1
    
    logger.info(f"Lokasyon senkronizasyonu: {created_count} oluşturuldu, {updated_count} güncellendi - {user.name}")
    
    return {
        "message": f"Senkronizasyon tamamlandı",
        "created": created_count,
        "updated": updated_count,
        "total_vehicles": len(vehicles),
        "total_healmedy": len(HEALMEDY_LOCATIONS)
    }


@router.get("/vehicles/all-gps")
async def get_all_vehicles_gps(request: Request):
    """Tüm araçların güncel GPS konumlarını getir (harita için)"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi"])(request)
    
    # GPS verisi olan araçları getir
    vehicles_with_gps = await vehicle_current_locations_collection.find({
        "last_gps_latitude": {"$exists": True, "$ne": None}
    }).to_list(500)
    
    result = []
    for v in vehicles_with_gps:
        result.append({
            "vehicle_id": v.get("vehicle_id"),
            "vehicle_plate": v.get("vehicle_plate"),
            "latitude": v.get("last_gps_latitude"),
            "longitude": v.get("last_gps_longitude"),
            "accuracy": v.get("last_gps_accuracy"),
            "speed": v.get("last_gps_speed"),
            "heading": v.get("last_gps_heading"),
            "last_update": v.get("last_gps_update"),
            "current_location_name": v.get("current_location_name")
        })
    
    return result


