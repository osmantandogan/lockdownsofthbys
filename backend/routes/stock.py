from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import stock_collection, db
from models import StockItem, StockItemCreate, StockItemUpdate
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Stok Lokasyonları Collection
locations_collection = db.stock_locations


# ============ STOK LOKASYONLARI MODELLERİ ============

class StockLocationCreate(BaseModel):
    """Yeni stok lokasyonu oluşturma"""
    name: str
    type: str  # 'vehicle' veya 'waiting_point'
    vehicle_id: Optional[str] = None  # Araç lokasyonu ise
    parent_location_id: Optional[str] = None  # Bekleme noktası ana araç
    description: Optional[str] = None


class StockLocation(BaseModel):
    """Stok Lokasyonu modeli"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    name: str
    type: str  # 'vehicle', 'waiting_point', 'warehouse'
    vehicle_id: Optional[str] = None
    parent_location_id: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    
    class Config:
        populate_by_name = True

@router.post("", response_model=StockItem)
async def create_stock_item(data: StockItemCreate, request: Request):
    """Create new stock item"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire"])(request)
    
    new_item = StockItem(**data.model_dump())
    item_dict = new_item.model_dump(by_alias=True)
    
    await stock_collection.insert_one(item_dict)
    
    return new_item

@router.get("", response_model=List[StockItem])
async def get_stock_items(
    request: Request,
    location: Optional[str] = None,
    critical_only: bool = False,
    expired_only: bool = False
):
    """Get all stock items with filters"""
    await get_current_user(request)
    
    query = {}
    
    if location:
        query["location"] = location
    
    if critical_only:
        # Find items below minimum quantity
        query["$expr"] = {"$lt": ["$quantity", "$min_quantity"]}
    
    if expired_only:
        query["expiry_date"] = {"$lte": datetime.utcnow()}
    
    items = await stock_collection.find(query).to_list(1000)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    return items

@router.get("/{item_id}", response_model=StockItem)
async def get_stock_item(item_id: str, request: Request):
    """Get stock item by ID"""
    await get_current_user(request)
    
    item_doc = await stock_collection.find_one({"_id": item_id})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    item_doc["id"] = item_doc.pop("_id")
    return StockItem(**item_doc)

@router.get("/qr/{qr_code}", response_model=StockItem)
async def get_stock_item_by_qr(qr_code: str, request: Request):
    """Get stock item by QR code"""
    await get_current_user(request)
    
    item_doc = await stock_collection.find_one({"qr_code": qr_code})
    if not item_doc:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    item_doc["id"] = item_doc.pop("_id")
    return StockItem(**item_doc)

@router.patch("/{item_id}", response_model=StockItem)
async def update_stock_item(item_id: str, data: StockItemUpdate, request: Request):
    """Update stock item"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire"])(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await stock_collection.find_one_and_update(
        {"_id": item_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    result["id"] = result.pop("_id")
    return StockItem(**result)

@router.delete("/{item_id}")
async def delete_stock_item(item_id: str, request: Request):
    """Delete stock item"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    result = await stock_collection.delete_one({"_id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Stock item not found")
    
    return {"message": "Stock item deleted successfully"}

@router.get("/alerts/summary")
async def get_stock_alerts(request: Request):
    """Get stock alerts summary"""
    await get_current_user(request)
    
    # Critical stock (below minimum)
    critical = await stock_collection.count_documents({
        "$expr": {"$lt": ["$quantity", "$min_quantity"]}
    })
    
    # Expired items
    expired = await stock_collection.count_documents({
        "expiry_date": {"$lte": datetime.utcnow()}
    })
    
    # Expiring soon (within 30 days)
    expiring_soon = await stock_collection.count_documents({
        "expiry_date": {
            "$gt": datetime.utcnow(),
            "$lte": datetime.utcnow() + timedelta(days=30)
        }
    })
    
    return {
        "critical_stock": critical,
        "expired": expired,
        "expiring_soon": expiring_soon
    }


# ============ STOK LOKASYONLARI ENDPOINT'LERİ ============

@router.post("/locations")
async def create_stock_location(data: StockLocationCreate, request: Request):
    """Yeni stok lokasyonu oluştur (sadece yetkili roller)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor", "cagri_merkezi"])(request)
    
    new_location = StockLocation(
        name=data.name,
        type=data.type,
        vehicle_id=data.vehicle_id,
        parent_location_id=data.parent_location_id,
        description=data.description,
        created_by=user.id
    )
    
    location_dict = new_location.model_dump(by_alias=True)
    await locations_collection.insert_one(location_dict)
    
    logger.info(f"Stock location created: {new_location.name} by {user.id}")
    
    location_dict["id"] = location_dict.pop("_id")
    return location_dict


@router.get("/locations")
async def get_stock_locations(request: Request, type: Optional[str] = None):
    """Tüm stok lokasyonlarını getir"""
    await get_current_user(request)
    
    query = {"is_active": True}
    if type:
        query["type"] = type
    
    locations = await locations_collection.find(query).to_list(1000)
    
    for loc in locations:
        loc["id"] = loc.pop("_id")
    
    return locations


@router.delete("/locations/{location_id}")
async def delete_stock_location(location_id: str, request: Request):
    """Stok lokasyonunu sil (pasife al)"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    result = await locations_collection.update_one(
        {"_id": location_id},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    return {"message": "Lokasyon silindi"}


@router.get("/locations/summary")
async def get_locations_stock_summary(request: Request):
    """
    Tüm lokasyonların stok özetini getir
    Her lokasyon için: kritik stok, tarihi geçmiş, yakında dolacak sayıları
    """
    await get_current_user(request)
    
    # Tüm aktif lokasyonları al
    locations = await locations_collection.find({"is_active": True}).to_list(1000)
    
    result = []
    now = datetime.utcnow()
    thirty_days_later = now + timedelta(days=30)
    
    for loc in locations:
        location_id = loc["_id"]
        location_name = loc["name"]
        location_type = loc.get("type", "unknown")
        
        # Bu lokasyondaki stokları say
        critical = await stock_collection.count_documents({
            "location": location_name,
            "$expr": {"$lt": ["$quantity", "$min_quantity"]}
        })
        
        expired = await stock_collection.count_documents({
            "location": location_name,
            "expiry_date": {"$lte": now}
        })
        
        expiring_soon = await stock_collection.count_documents({
            "location": location_name,
            "expiry_date": {"$gt": now, "$lte": thirty_days_later}
        })
        
        result.append({
            "id": location_id,
            "name": location_name,
            "type": location_type,
            "vehicle_id": loc.get("vehicle_id"),
            "critical_stock": critical,
            "expired": expired,
            "expiring_soon": expiring_soon,
            "has_issues": critical > 0 or expired > 0 or expiring_soon > 0
        })
    
    return result


@router.get("/locations/{location_id}/items")
async def get_location_stock_items(location_id: str, request: Request):
    """Belirli bir lokasyondaki stok kalemlerini getir"""
    await get_current_user(request)
    
    # Lokasyonu bul
    location = await locations_collection.find_one({"_id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    location_name = location["name"]
    
    # Bu lokasyondaki stokları getir
    items = await stock_collection.find({"location": location_name}).to_list(1000)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    return {
        "location": {
            "id": location_id,
            "name": location_name,
            "type": location.get("type")
        },
        "items": items
    }


@router.get("/locations/{location_id}/items/{item_name}/details")
async def get_item_barcode_details(location_id: str, item_name: str, request: Request):
    """
    Belirli bir lokasyondaki belirli bir ilacın karekod detaylarını getir
    Her karekod için ayrı expiry date göster
    """
    await get_current_user(request)
    
    # Lokasyonu bul
    location = await locations_collection.find_one({"_id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    location_name = location["name"]
    
    # Bu lokasyondaki bu isimdeki stokları getir
    items = await stock_collection.find({
        "location": location_name,
        "name": {"$regex": item_name, "$options": "i"}
    }).to_list(1000)
    
    # Karekod detaylarını düzenle
    barcode_details = []
    for item in items:
        barcode_details.append({
            "id": item["_id"],
            "name": item.get("name"),
            "qr_code": item.get("qr_code") or item.get("barcode"),
            "barcode": item.get("barcode"),
            "lot_number": item.get("lot_number"),
            "expiry_date": item.get("expiry_date"),
            "quantity": item.get("quantity", 1),
            "unit": item.get("unit", "adet")
        })
    
    return {
        "location_name": location_name,
        "item_name": item_name,
        "total_quantity": sum(d.get("quantity", 1) for d in barcode_details),
        "details": barcode_details
    }
