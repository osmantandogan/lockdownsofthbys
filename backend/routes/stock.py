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

@router.get("/all-grouped")
async def get_all_stock_grouped(
    request: Request,
    category: Optional[str] = None,  # 'ilac', 'itriyat', 'diger'
    search: Optional[str] = None
):
    """
    Tüm stokları (stock + barcode_stock) gruplandır ve kategorilere ayır
    Kategoriler: ilac (GTIN varsa), itriyat (isimde itriyat/iv/ivf geçiyorsa), diger
    """
    try:
        await get_current_user(request)
        
        from database import barcode_stock_collection
        
        # Kategori belirleme fonksiyonu
        def determine_category(item):
            name_lower = item.get("name", "").lower()
            gtin = item.get("gtin")
            
            # GTIN varsa ilaç
            if gtin:
                return "ilac"
            
            # İsimde itriyat/iv/ivf geçiyorsa itriyat
            if any(keyword in name_lower for keyword in ["itriyat", "iv", "ivf", "infüzyon", "serum"]):
                return "itriyat"
            
            # Diğer
            return "diger"
        
        # Tüm stokları al
        all_items = []
        
        # Normal stoklar
        stock_items = await stock_collection.find({}).to_list(1000)
        for item in stock_items:
            item["id"] = item.pop("_id")
            item["source"] = "stock"
            item["category"] = determine_category(item)
            all_items.append(item)
        
        # Karekod stoklar
        barcode_items = await barcode_stock_collection.find({"status": "available"}).to_list(1000)
        for item in barcode_items:
            item["id"] = item.pop("_id")
            item["source"] = "barcode"
            item["category"] = determine_category(item)
            all_items.append(item)
        
        # Kategori filtresi
        if category:
            all_items = [item for item in all_items if item.get("category") == category]
        
        # Arama filtresi
        if search:
            search_lower = search.lower()
            all_items = [item for item in all_items if search_lower in item.get("name", "").lower()]
        
        # İsme göre grupla
        grouped = {}
        for item in all_items:
            name = item.get("name", "Bilinmeyen")
            if name not in grouped:
                grouped[name] = {
                    "name": name,
                    "category": item.get("category", "diger"),
                    "total_quantity": 0,
                    "items": [],
                    "locations": set(),
                    "earliest_expiry": None,
                    "gtin": item.get("gtin"),
                    "manufacturer_name": item.get("manufacturer_name")
                }
            
            # Miktar hesapla
            if item.get("source") == "stock":
                quantity = item.get("quantity", 0)
            else:
                quantity = 1  # Karekod stok = 1 adet
            
            grouped[name]["total_quantity"] += quantity
            grouped[name]["items"].append(item)
            if item.get("location"):
                grouped[name]["locations"].add(item.get("location"))
            
            # En yakın SKT
            expiry = item.get("expiry_date")
            if expiry:
                if not grouped[name]["earliest_expiry"] or expiry < grouped[name]["earliest_expiry"]:
                    grouped[name]["earliest_expiry"] = expiry
        
        # Format sonuçları
        result = []
        for name, group in grouped.items():
            result.append({
                "name": name,
                "category": group["category"],
                "total_quantity": group["total_quantity"],
                "item_count": len(group["items"]),
                "locations": list(group["locations"]),
                "earliest_expiry": group["earliest_expiry"],
                "gtin": group["gtin"],
                "manufacturer_name": group["manufacturer_name"]
            })
        
        # Kategoriye göre sırala
        category_order = {"ilac": 0, "itriyat": 1, "diger": 2}
        result.sort(key=lambda x: (category_order.get(x["category"], 3), x["name"]))
        
        return {
            "groups": result,
            "total_groups": len(result),
            "total_items": sum(g["total_quantity"] for g in result)
        }
    except Exception as e:
        logger.error(f"Stok gruplandırma hatası: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Stok gruplandırılamadı: {str(e)}")

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
    
    # stock_locations_collection kullan (stock_barcode ile ayni)
    stock_locations_col = db["stock_locations"]
    
    # Tüm aktif lokasyonları al - ONCE stock_locations_collection kullan
    locations = await stock_locations_col.find({"is_active": True}).to_list(1000)
    
    # Eger hic lokasyon yoksa eski collection'dan dene
    if len(locations) == 0:
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
    
    # stock_locations_collection kullan (stock_barcode ile ayni)
    stock_locations_col = db["stock_locations"]
    barcode_stock_collection = db["barcode_stock"]
    
    # Lokasyonu bul - once stock_locations_collection'da ara
    location = await stock_locations_col.find_one({"_id": location_id})
    if not location:
        # Eski locations_collection'da dene
        location = await locations_collection.find_one({"_id": location_id})
        if not location:
            raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    location_name = location["name"]
    
    # Bu lokasyondaki stokları getir - hem stock_collection hem de barcode_stock_collection'dan
    # location_name ile eşleşen veya location_detail ile eşleşen kayıtları bul
    
    # 1. stock_collection'dan ara (location veya location_detail ile)
    stock_items = await stock_collection.find({
        "$or": [
            {"location": location_name},
            {"location_detail": location_name}
        ]
    }).to_list(1000)
    
    # 2. barcode_stock_collection'dan ara (location_detail ile - çünkü burada location genelde "ambulans" gibi genel bir değer)
    barcode_items = await barcode_stock_collection.find({
        "$or": [
            {"location_detail": location_name},
            {"location": location_name}
        ],
        "status": "available"  # Sadece mevcut stokları getir
    }).to_list(1000)
    
    # Barcode stock'u stock formatına çevir (gruplu görünüm için)
    barcode_grouped = {}
    for item in barcode_items:
        item_name = item.get("name", "Bilinmeyen")
        if item_name not in barcode_grouped:
            barcode_grouped[item_name] = {
                "id": f"barcode_{item_name}",
                "name": item_name,
                "code": item.get("gtin", "")[:8] if item.get("gtin") else "",
                "gtin": item.get("gtin"),
                "quantity": 0,
                "min_quantity": 0,
                "location": item.get("location", "ambulans"),
                "location_detail": item.get("location_detail"),
                "unit": "adet",
                "expiry_date": item.get("expiry_date"),
                "lot_number": item.get("lot_number"),
                "serial_number": item.get("serial_number"),
                "is_barcode_stock": True  # Barcode stock'tan geldiğini belirt
            }
        barcode_grouped[item_name]["quantity"] += 1
    
    # Stock items'ı formatla
    all_items = []
    for item in stock_items:
        item["id"] = item.pop("_id")
        item["is_barcode_stock"] = False
        all_items.append(item)
    
    # Barcode grouped items'ı ekle
    for item_name, item_data in barcode_grouped.items():
        all_items.append(item_data)
    
    return {
        "location": {
            "id": location_id,
            "name": location_name,
            "type": location.get("type")
        },
        "items": all_items,
        "count": len(all_items)
    }


@router.get("/locations/{location_id}/items/{item_name}/details")
async def get_item_barcode_details(location_id: str, item_name: str, request: Request):
    """
    Belirli bir lokasyondaki belirli bir ilacın karekod detaylarını getir
    Her karekod için ayrı expiry date göster
    """
    await get_current_user(request)
    
    # stock_locations_collection kullan
    stock_locations_col = db["stock_locations"]
    barcode_stock_collection = db["barcode_stock"]
    
    # Lokasyonu bul - once stock_locations_collection'da ara
    location = await stock_locations_col.find_one({"_id": location_id})
    if not location:
        location = await locations_collection.find_one({"_id": location_id})
        if not location:
            raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    location_name = location["name"]
    
    # Bu lokasyondaki bu isimdeki stokları getir - hem stock_collection hem de barcode_stock_collection'dan
    # 1. stock_collection'dan ara
    stock_items = await stock_collection.find({
        "$or": [
            {"location": location_name},
            {"location_detail": location_name}
        ],
        "name": {"$regex": item_name, "$options": "i"}
    }).to_list(1000)
    
    # 2. barcode_stock_collection'dan ara
    barcode_items = await barcode_stock_collection.find({
        "$or": [
            {"location_detail": location_name},
            {"location": location_name}
        ],
        "name": {"$regex": item_name, "$options": "i"},
        "status": "available"
    }).to_list(1000)
    
    # Karekod detaylarını düzenle
    barcode_details = []
    
    # Stock collection items
    for item in stock_items:
        barcode_details.append({
            "id": str(item.get("_id", "")),
            "name": item.get("name"),
            "qr_code": item.get("qr_code") or item.get("barcode"),
            "barcode": item.get("barcode"),
            "lot_number": item.get("lot_number"),
            "expiry_date": item.get("expiry_date"),
            "quantity": item.get("quantity", 1),
            "unit": item.get("unit", "adet")
        })
    
    # Barcode stock items
    for item in barcode_items:
        barcode_details.append({
            "id": str(item.get("_id", "")),
            "name": item.get("name"),
            "qr_code": item.get("raw_barcode") or item.get("serial_number"),
            "barcode": item.get("raw_barcode") or item.get("serial_number"),
            "lot_number": item.get("lot_number"),
            "expiry_date": item.get("expiry_date"),
            "quantity": 1,  # Her barcode item = 1 adet
            "unit": "adet"
        })
    
    return {
        "location_name": location_name,
        "item_name": item_name,
        "total_quantity": sum(d.get("quantity", 1) for d in barcode_details),
        "details": barcode_details
    }


# ============================================================================
# STOK TRANSFER SİSTEMİ
# Depodan Araç/Carter'a kutu→adet transfer
# ============================================================================

from models import StockTransfer, StockTransferCreate, FieldLocation, HEALMEDY_LOCATIONS

# Collections
stock_transfers_collection = db.stock_transfers
field_locations_collection = db.field_locations


class TransferRequest(BaseModel):
    """Transfer isteği"""
    from_location_id: str
    to_location_id: str
    stock_item_id: str
    quantity_boxes: int = 1
    units_per_box: int = 1  # Karekoddan veya manuel
    notes: Optional[str] = None


@router.post("/transfer")
async def transfer_stock(data: TransferRequest, request: Request):
    """
    Stok transferi yap
    - Merkez depodan araç/carter'a kutu gönder
    - Kutu adetsel olarak parçalanır
    - Transfer yetkisi: Çağrı Merkezi, Baş Şoför, Operasyon Müdürü
    """
    user = await require_roles(["cagri_merkezi", "bas_sofor", "operasyon_muduru", "merkez_ofis"])(request)
    
    # Kaynak lokasyonu al
    from_location = await field_locations_collection.find_one({"_id": data.from_location_id})
    if not from_location:
        # Eski sistem uyumluluğu - lokasyon adıyla ara
        from_location = await locations_collection.find_one({"_id": data.from_location_id})
        if not from_location:
            raise HTTPException(status_code=404, detail="Kaynak lokasyon bulunamadı")
    
    # Hedef lokasyonu al
    to_location = await field_locations_collection.find_one({"_id": data.to_location_id})
    if not to_location:
        to_location = await locations_collection.find_one({"_id": data.to_location_id})
        if not to_location:
            raise HTTPException(status_code=404, detail="Hedef lokasyon bulunamadı")
    
    # Stok ürününü al
    stock_item = await stock_collection.find_one({"_id": data.stock_item_id})
    if not stock_item:
        raise HTTPException(status_code=404, detail="Stok ürünü bulunamadı")
    
    # Yeterli stok kontrolü (kutu bazında)
    if stock_item.get("quantity", 0) < data.quantity_boxes:
        raise HTTPException(
            status_code=400, 
            detail=f"Yetersiz stok. Mevcut: {stock_item.get('quantity', 0)} kutu, İstenen: {data.quantity_boxes} kutu"
        )
    
    total_units = data.quantity_boxes * data.units_per_box
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Transfer kaydı oluştur
    transfer = StockTransfer(
        from_location_id=data.from_location_id,
        from_location_name=from_location.get("name"),
        from_location_type=from_location.get("location_type", "merkez_depo"),
        to_location_id=data.to_location_id,
        to_location_name=to_location.get("name"),
        to_location_type=to_location.get("location_type", "arac"),
        stock_item_id=data.stock_item_id,
        stock_item_name=stock_item.get("name"),
        gtin=stock_item.get("gtin"),
        lot_number=stock_item.get("lot_number"),
        quantity_boxes=data.quantity_boxes,
        units_per_box=data.units_per_box,
        total_units=total_units,
        transfer_type="box_to_units",
        transferred_by=user.id,
        transferred_by_name=user.name,
        notes=data.notes,
        created_at=turkey_now
    )
    
    transfer_dict = transfer.model_dump(by_alias=True)
    await stock_transfers_collection.insert_one(transfer_dict)
    
    # Kaynak stoktan düş (kutu bazında)
    await stock_collection.update_one(
        {"_id": data.stock_item_id},
        {"$inc": {"quantity": -data.quantity_boxes}, "$set": {"updated_at": turkey_now}}
    )
    
    # Hedef lokasyona adet bazında ekle
    # Aynı ürün var mı kontrol et
    existing_target = await stock_collection.find_one({
        "location": to_location.get("name"),
        "name": stock_item.get("name"),
        "gtin": stock_item.get("gtin"),
        "lot_number": stock_item.get("lot_number")
    })
    
    if existing_target:
        # Varsa miktarı artır
        await stock_collection.update_one(
            {"_id": existing_target["_id"]},
            {"$inc": {"quantity": total_units}, "$set": {"updated_at": turkey_now}}
        )
    else:
        # Yoksa yeni stok oluştur (adet olarak)
        new_stock = StockItem(
            name=stock_item.get("name"),
            code=stock_item.get("code"),
            gtin=stock_item.get("gtin"),
            quantity=total_units,
            min_quantity=stock_item.get("min_quantity", 1),
            location=to_location.get("name"),
            location_detail=to_location.get("vehicle_plate"),
            lot_number=stock_item.get("lot_number"),
            serial_number=stock_item.get("serial_number"),
            expiry_date=stock_item.get("expiry_date"),
            unit="adet",
            unit_type="adet",
            box_quantity=data.units_per_box,
            original_box_id=data.stock_item_id,
            field_location_id=data.to_location_id,
            source_transfer_id=transfer.id
        )
        new_stock_dict = new_stock.model_dump(by_alias=True)
        await stock_collection.insert_one(new_stock_dict)
    
    logger.info(f"Stok transferi: {stock_item.get('name')} - {data.quantity_boxes} kutu ({total_units} adet) - {from_location.get('name')} → {to_location.get('name')}")
    
    transfer_dict["id"] = transfer_dict.pop("_id")
    return {
        "message": f"{data.quantity_boxes} kutu ({total_units} adet) transfer edildi",
        "transfer": transfer_dict
    }


@router.get("/transfers")
async def get_transfers(
    request: Request,
    from_location_id: Optional[str] = None,
    to_location_id: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 100
):
    """Transfer geçmişini getir"""
    await require_roles(["cagri_merkezi", "bas_sofor", "operasyon_muduru", "merkez_ofis"])(request)
    
    query = {}
    
    if from_location_id:
        query["from_location_id"] = from_location_id
    
    if to_location_id:
        query["to_location_id"] = to_location_id
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query["created_at"] = {
                "$gte": target_date,
                "$lt": target_date + timedelta(days=1)
            }
        except ValueError:
            pass
    
    transfers = await stock_transfers_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for t in transfers:
        t["id"] = t.pop("_id")
    
    return transfers


@router.get("/location/{location_id}/stock")
async def get_location_stock(location_id: str, request: Request):
    """
    Belirli lokasyondaki stokları getir
    - Araç stoğu
    - Carter (dolap) stoğu
    """
    await get_current_user(request)
    
    # Lokasyonu bul
    location = await field_locations_collection.find_one({"_id": location_id})
    if not location:
        # Eski sistemdeki lokasyonu dene
        location = await locations_collection.find_one({"_id": location_id})
        if not location:
            raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    location_name = location.get("name")
    
    # Bu lokasyondaki stokları getir
    items = await stock_collection.find({
        "$or": [
            {"location": location_name},
            {"field_location_id": location_id}
        ]
    }).to_list(1000)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    return {
        "location_id": location_id,
        "location_name": location_name,
        "location_type": location.get("location_type", "unknown"),
        "items": items,
        "total_items": len(items)
    }


@router.get("/vehicle/{vehicle_id}/all-stock")
async def get_vehicle_all_stock(vehicle_id: str, request: Request):
    """
    Araç için hem araç stoğunu hem de carter (dolap) stoğunu getir
    ATT/Paramedik vaka formunda kullanır
    """
    await get_current_user(request)
    
    from database import vehicles_collection, vehicle_current_locations_collection
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    vehicle_plate = vehicle.get("plate")
    
    # Aracın güncel lokasyonunu al
    current_loc = await vehicle_current_locations_collection.find_one({"vehicle_id": vehicle_id})
    current_location_id = current_loc.get("current_location_id") if current_loc else None
    current_location_name = current_loc.get("current_location_name") if current_loc else None
    
    # Araç stoğu (plakayla veya field_location_id ile)
    vehicle_locations = await field_locations_collection.find({
        "vehicle_id": vehicle_id,
        "location_type": "arac"
    }).to_list(10)
    
    vehicle_stock = []
    for loc in vehicle_locations:
        items = await stock_collection.find({
            "$or": [
                {"location": loc.get("name")},
                {"field_location_id": loc.get("_id")}
            ]
        }).to_list(500)
        for item in items:
            item["id"] = item.pop("_id")
            item["source_type"] = "arac"
            item["source_name"] = f"Araç: {vehicle_plate}"
        vehicle_stock.extend(items)
    
    # Ayrıca plaka ile kayıtlı stokları da al
    plate_items = await stock_collection.find({
        "location": vehicle_plate
    }).to_list(500)
    for item in plate_items:
        item["id"] = item.pop("_id")
        item["source_type"] = "arac"
        item["source_name"] = f"Araç: {vehicle_plate}"
    vehicle_stock.extend(plate_items)
    
    # Carter stoğu (güncel lokasyondaki dolap)
    carter_stock = []
    carter_location_id = None
    carter_name = None
    
    if current_location_id:
        # Bu lokasyondaki carter'ları bul
        carters = await field_locations_collection.find({
            "healmedy_location_id": current_location_id,
            "location_type": "carter"
        }).to_list(10)
        
        for carter in carters:
            if not carter_location_id:
                carter_location_id = carter.get("_id")
                carter_name = carter.get("name", f"{current_location_name} Carter")
            
            items = await stock_collection.find({
                "$or": [
                    {"location": carter.get("name")},
                    {"field_location_id": carter.get("_id")}
                ]
            }).to_list(500)
            for item in items:
                item["id"] = item.pop("_id")
                item["source_type"] = "carter"
                item["source_name"] = f"Lokasyon: {current_location_name}"
                item["carter_name"] = carter.get("name")
            carter_stock.extend(items)
    
    # Tekrar edenleri kaldır (id bazlı)
    seen_ids = set()
    unique_vehicle_stock = []
    for item in vehicle_stock:
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            unique_vehicle_stock.append(item)
    
    unique_carter_stock = []
    for item in carter_stock:
        if item["id"] not in seen_ids:
            seen_ids.add(item["id"])
            unique_carter_stock.append(item)
    
    return {
        "vehicle_id": vehicle_id,
        "vehicle_plate": vehicle_plate,
        "current_location_id": current_location_id,
        "current_location_name": current_location_name,
        "carter_location_id": carter_location_id,
        "carter_name": carter_name or f"{current_location_name} Carter" if current_location_name else None,
        "vehicle_stock": unique_vehicle_stock,
        "carter_stock": unique_carter_stock,
        "total_vehicle_items": len(unique_vehicle_stock),
        "total_carter_items": len(unique_carter_stock)
    }


@router.post("/seed-sample-stock")
async def seed_sample_stock_endpoint(request: Request):
    """Tum lokasyonlara ornek stok ekle - Test icin"""
    import random
    from database import vehicles_collection
    from models import HEALMEDY_LOCATIONS
    
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    # stock_locations_collection kullan (stock_barcode ile ayni)
    stock_locations_col = db["stock_locations"]
    
    SAMPLE_ITEMS = [
        {"name": "Parasetamol 500mg", "code": "PAR500", "min_quantity": 10, "category": "ilac"},
        {"name": "Ibuprofen 400mg", "code": "IBU400", "min_quantity": 10, "category": "ilac"},
        {"name": "Adrenalin 1mg/ml", "code": "ADR001", "min_quantity": 5, "category": "ilac"},
        {"name": "Serum Fizyolojik 500ml", "code": "SF500", "min_quantity": 20, "category": "ilac"},
        {"name": "Midazolam 5mg/ml", "code": "MID005", "min_quantity": 3, "category": "ilac"},
        {"name": "Aspirin 100mg", "code": "ASP100", "min_quantity": 15, "category": "ilac"},
        {"name": "Atropin 0.5mg/ml", "code": "ATR05", "min_quantity": 5, "category": "ilac"},
        {"name": "Dopamin 200mg/5ml", "code": "DOP200", "min_quantity": 3, "category": "ilac"},
        {"name": "Diazepam 10mg/2ml", "code": "DIA10", "min_quantity": 5, "category": "ilac"},
        {"name": "Morfin 10mg/ml", "code": "MOR10", "min_quantity": 2, "category": "ilac"},
        {"name": "Eldiven (M)", "code": "ELD-M", "min_quantity": 50, "category": "itriyat"},
        {"name": "Eldiven (L)", "code": "ELD-L", "min_quantity": 50, "category": "itriyat"},
        {"name": "Eldiven (S)", "code": "ELD-S", "min_quantity": 30, "category": "itriyat"},
        {"name": "Maske N95", "code": "MSK-N95", "min_quantity": 30, "category": "itriyat"},
        {"name": "Cerrahi Maske", "code": "MSK-CRH", "min_quantity": 100, "category": "itriyat"},
        {"name": "Dezenfektan 500ml", "code": "DEZ500", "min_quantity": 10, "category": "itriyat"},
        {"name": "El Antiseptigi 100ml", "code": "ELA100", "min_quantity": 20, "category": "itriyat"},
        {"name": "Gazli Bez 10x10", "code": "GZB-10", "min_quantity": 100, "category": "diger"},
        {"name": "Flaster 2.5cm", "code": "FLS-25", "min_quantity": 20, "category": "diger"},
        {"name": "IV Kateter 18G", "code": "IVK-18", "min_quantity": 50, "category": "diger"},
        {"name": "IV Kateter 20G", "code": "IVK-20", "min_quantity": 50, "category": "diger"},
        {"name": "Enjektör 5ml", "code": "ENJ-05", "min_quantity": 100, "category": "diger"},
        {"name": "Enjektör 10ml", "code": "ENJ-10", "min_quantity": 50, "category": "diger"},
        {"name": "Serum Seti", "code": "SRM-SET", "min_quantity": 30, "category": "diger"},
        {"name": "Oksijen Maskesi", "code": "OKS-MSK", "min_quantity": 10, "category": "diger"},
        {"name": "Ambu Balon", "code": "AMB-BLN", "min_quantity": 2, "category": "diger"},
    ]
    
    # Onceki stoklari temizle
    await stock_collection.delete_many({})
    
    # 1. Lokasyonlari senkronize et (stock_locations_collection kullan)
    # Ilk once Merkez Depo ekle
    merkez = await stock_locations_col.find_one({"name": "Merkez Depo"})
    if not merkez:
        await stock_locations_col.insert_one({
            "_id": str(uuid.uuid4()),
            "name": "Merkez Depo",
            "type": "warehouse",
            "is_active": True,
            "created_at": datetime.utcnow()
        })
    
    # HEALMEDY lokasyonlari
    for loc in HEALMEDY_LOCATIONS:
        existing = await stock_locations_col.find_one({"healmedy_location_id": loc["id"]})
        if not existing:
            await stock_locations_col.insert_one({
                "_id": str(uuid.uuid4()),
                "name": loc["name"],
                "type": "waiting_point",
                "healmedy_location_id": loc["id"],
                "is_active": True,
                "created_at": datetime.utcnow()
            })
    
    # Araclar
    vehicles = await vehicles_collection.find({}).to_list(100)
    for v in vehicles:
        plate = v.get("plate")
        station_code = v.get("station_code", "")
        display_name = f"{plate} ({station_code})" if station_code else plate
        
        existing = await stock_locations_col.find_one({"vehicle_id": v.get("_id")})
        if not existing:
            await stock_locations_col.insert_one({
                "_id": str(uuid.uuid4()),
                "name": display_name,
                "type": "vehicle",
                "vehicle_id": v.get("_id"),
                "vehicle_plate": plate,
                "is_active": True,
                "created_at": datetime.utcnow()
            })
        elif existing.get("name") != display_name:
            # Ismi guncelle
            await stock_locations_col.update_one(
                {"_id": existing["_id"]},
                {"$set": {"name": display_name}}
            )
    
    # 2. Simdi lokasyonlari al ve stok ekle
    locations = await stock_locations_col.find({"is_active": True}).to_list(100)
    
    total_stock = 0
    loc_names = []
    
    for loc in locations:
        loc_name = loc.get("name")
        loc_type = loc.get("type", "unknown")
        loc_names.append(loc_name)
        
        # Merkez depoya tum urunleri, digerlerine rastgele
        if loc_type == "warehouse":
            items = SAMPLE_ITEMS
            qty_mult = 5
        else:
            items = random.sample(SAMPLE_ITEMS, min(random.randint(8, 12), len(SAMPLE_ITEMS)))
            qty_mult = 1
        
        for item in items:
            quantity = random.randint(item["min_quantity"], item["min_quantity"] * 3) * qty_mult
            expiry_days = random.randint(60, 365)
            
            await stock_collection.insert_one({
                "_id": str(uuid.uuid4()),
                "name": item["name"],
                "code": item["code"],
                "quantity": quantity,
                "min_quantity": item["min_quantity"],
                "location": loc_name,  # Lokasyon ismiyle eslestir
                "category": item["category"],
                "lot_number": f"LOT{random.randint(10000, 99999)}",
                "expiry_date": datetime.utcnow() + timedelta(days=expiry_days),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
            total_stock += 1
    
    logger.info(f"Sample stock seeded: {total_stock} items for {len(locations)} locations")
    
    return {
        "message": f"{len(locations)} lokasyona toplam {total_stock} ornek stok eklendi",
        "locations": len(locations),
        "total_stock": total_stock,
        "location_names": loc_names
    }