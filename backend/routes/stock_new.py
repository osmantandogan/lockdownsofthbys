"""
Yeni Temiz Stok Yönetim Sistemi
- Lokasyon bazlı stok (araç, bekleme noktası)
- Stok talepleri
- Otomatik standart stok ekleme
"""

from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import db
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import Literal
import uuid
import json
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ============ KOLEKSİYONLAR ============
location_stocks = db.location_stocks_v2  # Yeni koleksiyon
stock_requests = db.stock_requests_v2
stock_templates = db.stock_templates_v2


# ============ YARDIMCI FONKSİYONLAR ============

def get_turkey_time():
    from datetime import timedelta
    return datetime.utcnow() + timedelta(hours=3)


def load_standard_stock():
    """Standart stok listesini yükle"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(script_dir, '..', 'data', 'standard_stock_list.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None


# ============ MODELLER ============

class StockItem(BaseModel):
    name: str
    quantity: int = 0
    min_quantity: int = 1
    unit: str = "ADET"
    category: str = "sarf"  # ilac, sarf, serum, tibbi_cihaz, malzeme


class LocationStock(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_id: str  # Araç ID veya lokasyon ID
    location_type: str  # vehicle, waiting_point
    location_name: str
    items: List[dict] = []
    created_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)


class StockRequestItem(BaseModel):
    name: str
    quantity: int = 1
    unit: str = "ADET"
    source: str = ""  # Nereden kullanıldı


class StockRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    requester_id: str
    requester_name: str
    location_id: str
    location_name: str
    items: List[dict] = []
    case_id: Optional[str] = None
    case_no: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, delivered
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=get_turkey_time)
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None


# ============ ESKİ VERİLERİ TEMİZLE ============

async def cleanup_old_stock_data():
    """Eski stok koleksiyonlarını temizle"""
    try:
        # Eski koleksiyonları temizle
        await db.stock.delete_many({})
        await db.barcode_stock.delete_many({})
        await db.stock_locations.delete_many({})
        await db.stock_transfers.delete_many({})
        await db.stock_movements.delete_many({})
        await db.stock_templates.delete_many({})
        await db.unit_stock.delete_many({})
        
        logger.info("Eski stok verileri temizlendi")
        return True
    except Exception as e:
        logger.error(f"Eski veri temizleme hatası: {e}")
        return False


async def cleanup_duplicate_waiting_points():
    """Duplike bekleme noktalarını temizle - sadece doğru ID'li olanları tut"""
    
    # Doğru Healmedy lokasyon ID'leri
    VALID_HEALMEDY_IDS = [
        "osman_gazi_fpu",
        "green_zone_ronesans", 
        "bati_kuzey_isg",
        "red_zone_kara",
        "dogu_rihtimi",
        "filyos_saglik_merkezi"
    ]
    
    # Tüm bekleme noktalarını al
    all_waiting_points = await location_stocks.find({"location_type": "waiting_point"}).to_list(100)
    
    deleted_count = 0
    kept_count = 0
    
    for wp in all_waiting_points:
        loc_id = wp.get("location_id", "")
        
        # Eğer doğru ID listesinde değilse sil
        if loc_id not in VALID_HEALMEDY_IDS:
            await location_stocks.delete_one({"_id": wp["_id"]})
            deleted_count += 1
            logger.info(f"Duplike bekleme noktası silindi: {wp.get('location_name')} (ID: {loc_id})")
        else:
            kept_count += 1
    
    return {"deleted": deleted_count, "kept": kept_count}


# ============ STOK BAŞLATMA (SEED) ============

async def seed_location_stock(location_id: str, location_type: str, location_name: str):
    """Bir lokasyona standart stok listesi ekle"""
    
    # Zaten var mı kontrol et
    existing = await location_stocks.find_one({"location_id": location_id})
    if existing:
        return {"action": "exists", "location": location_name}
    
    # Standart listeyi yükle
    stock_data = load_standard_stock()
    if not stock_data:
        return {"action": "error", "message": "Standart liste yüklenemedi"}
    
    # Lokasyon tipine göre hangi listeyi kullan
    items = []
    
    if location_type == "vehicle":
        # Ambulans için
        for key in ["ambulans_stok", "canlandirma_cantasi", "ilac_cantasi"]:
            for item in stock_data.get(key, []):
                items.append({
                    "name": item["name"],
                    "quantity": item["quantity"],
                    "min_quantity": item["quantity"],
                    "unit": item.get("unit", "ADET"),
                    "category": item.get("category", "sarf")
                })
    else:
        # Bekleme noktası/Revir için
        # Filyos Sağlık Merkezi için özel liste
        if location_id == "filyos_saglik_merkezi":
            for key in ["saglik_merkezi_ilac", "saglik_merkezi_sarf"]:
                for item in stock_data.get(key, []):
                    items.append({
                        "name": item["name"],
                        "quantity": item["quantity"],
                        "min_quantity": item["quantity"],
                        "unit": item.get("unit", "ADET"),
                        "category": item.get("category", "sarf")
                    })
        else:
            # Diğer bekleme noktaları için standart liste
            for key in ["revir_stok", "revir_ilac"]:
                for item in stock_data.get(key, []):
                    items.append({
                        "name": item["name"],
                        "quantity": item["quantity"],
                        "min_quantity": item["quantity"],
                        "unit": item.get("unit", "ADET"),
                        "category": item.get("category", "sarf")
                    })
    
    # Aynı isimli ürünleri birleştir
    unique_items = {}
    for item in items:
        name = item["name"]
        if name in unique_items:
            unique_items[name]["quantity"] += item["quantity"]
            unique_items[name]["min_quantity"] += item["min_quantity"]
        else:
            unique_items[name] = item.copy()
    
    # Kaydet
    doc = {
        "_id": str(uuid.uuid4()),
        "location_id": location_id,
        "location_type": location_type,
        "location_name": location_name,
        "items": list(unique_items.values()),
        "created_at": get_turkey_time(),
        "updated_at": get_turkey_time()
    }
    
    await location_stocks.insert_one(doc)
    
    return {"action": "created", "location": location_name, "items_count": len(unique_items)}


async def seed_all_locations():
    """Tüm araç, bekleme noktaları ve sağlık merkezlerine stok ekle"""
    results = {"vehicles": [], "waiting_points": [], "health_centers": []}
    
    # Araçları al
    vehicles = await db.vehicles.find({"type": "ambulans"}).to_list(100)
    for v in vehicles:
        result = await seed_location_stock(
            location_id=v["_id"],
            location_type="vehicle",
            location_name=v.get("plate", "")
        )
        results["vehicles"].append(result)
    
    # Healmedy Bekleme Noktaları (Sabit liste)
    HEALMEDY_LOCATIONS = [
        {"id": "osman_gazi_fpu", "name": "Osman Gazi/FPU"},
        {"id": "green_zone_ronesans", "name": "Green Zone/Rönesans"},
        {"id": "bati_kuzey_isg", "name": "Batı-Kuzey/İSG BİNA"},
        {"id": "red_zone_kara", "name": "Red Zone/Kara Tesisleri"},
        {"id": "dogu_rihtimi", "name": "Doğu Rıhtımı"},
        {"id": "filyos_saglik_merkezi", "name": "Filyos Sağlık Merkezi"},
    ]
    
    for loc in HEALMEDY_LOCATIONS:
        result = await seed_location_stock(
            location_id=loc["id"],
            location_type="waiting_point",
            location_name=loc["name"]
        )
        results["waiting_points"].append(result)
    
    # Sağlık Merkezleri
    HEALTH_CENTERS = [
        {"id": "merkez_ofis", "name": "Merkez Ofis"},
    ]
    
    for hc in HEALTH_CENTERS:
        result = await seed_location_stock(
            location_id=hc["id"],
            location_type="saglik_merkezi",
            location_name=hc["name"]
        )
        results["health_centers"].append(result)
    
    return results


# ============ ENDPOINTS ============

# --- Genel ---

@router.get("/health")
async def health_check():
    """Stok sistemi sağlık kontrolü"""
    return {"status": "ok", "system": "stock_new"}


@router.post("/seed-all")
async def seed_all_endpoint(request: Request):
    """Tüm lokasyonlara standart stok ekle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    results = await seed_all_locations()
    
    vehicles_created = len([r for r in results["vehicles"] if r.get("action") == "created"])
    wp_created = len([r for r in results["waiting_points"] if r.get("action") == "created"])
    
    logger.info(f"Stok seed tamamlandı by {user.name}: {vehicles_created} araç, {wp_created} bekleme noktası")
    
    return {
        "success": True,
        "message": f"{vehicles_created} araç ve {wp_created} bekleme noktasına stok eklendi",
        "details": results
    }


@router.delete("/cleanup-duplicates")
async def cleanup_duplicates_endpoint(request: Request):
    """Duplike bekleme noktalarını temizle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    result = await cleanup_duplicate_waiting_points()
    
    logger.info(f"Duplike temizleme by {user.name}: {result['deleted']} silindi, {result['kept']} kaldı")
    
    return {
        "success": True,
        "message": f"{result['deleted']} duplike bekleme noktası silindi, {result['kept']} adet kaldı",
        "details": result
    }


# --- Lokasyon Stokları ---

@router.get("/locations")
async def get_all_locations(request: Request, location_type: Optional[str] = None):
    """Tüm lokasyonların stok durumunu getir"""
    await get_current_user(request)
    
    query = {}
    if location_type:
        query["location_type"] = location_type
    
    locations = await location_stocks.find(query).to_list(500)
    
    result = []
    for loc in locations:
        loc["id"] = loc.pop("_id", "")
        items = loc.get("items", [])
        
        # İstatistikler
        loc["total_items"] = len(items)
        loc["missing_count"] = sum(1 for i in items if i.get("quantity", 0) < i.get("min_quantity", 1))
        loc["critical_count"] = sum(1 for i in items if i.get("quantity", 0) == 0)
        
        result.append(loc)
    
    return {"locations": result}


@router.get("/locations/{location_id}")
async def get_location_stock(location_id: str, request: Request):
    """Bir lokasyonun stok detayını getir"""
    await get_current_user(request)
    
    loc = await location_stocks.find_one({"location_id": location_id})
    if not loc:
        loc = await location_stocks.find_one({"_id": location_id})
    
    if not loc:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    loc["id"] = loc.pop("_id", "")
    
    # Kategorilere göre grupla
    items = loc.get("items", [])
    by_category = {}
    for item in items:
        cat = item.get("category", "diger")
        if cat not in by_category:
            by_category[cat] = []
        
        item["is_critical"] = item.get("quantity", 0) == 0
        item["is_low"] = item.get("quantity", 0) < item.get("min_quantity", 1)
        by_category[cat].append(item)
    
    loc["items_by_category"] = by_category
    
    return loc


@router.patch("/locations/{location_id}/update")
async def update_location_stock(location_id: str, request: Request):
    """Lokasyon stoğunu güncelle (sayım) - Kullanıcı sadece erişebildiği lokasyonları güncelleyebilir"""
    user = await get_current_user(request)
    data = await request.json()
    
    # Yetki kontrolü - Merkez ofis her lokasyona erişebilir
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        # Kullanıcının bu lokasyona erişimi var mı kontrol et
        today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        assignment = await db.shift_assignments.find_one({
            "user_id": user.id,
            "status": {"$in": ["pending", "started"]},
            "$or": [
                {"shift_date": {"$gte": today, "$lt": tomorrow}},
                {"shift_date": {"$lte": today}, "end_date": {"$gte": today}}
            ]
        })
        
        if not assignment:
            raise HTTPException(status_code=403, detail="Aktif vardiya atamanız bulunmuyor")
        
        # Erişilebilir lokasyonları kontrol et
        accessible_location_ids = []
        
        # Kendi aracı
        if assignment.get("vehicle_id"):
            accessible_location_ids.append(assignment.get("vehicle_id"))
            
            # Aracın bulunduğu bekleme noktası
            vehicle_location = await db.vehicle_current_locations.find_one({"vehicle_id": assignment.get("vehicle_id")})
            if vehicle_location:
                wp_id = vehicle_location.get("current_location_id") or vehicle_location.get("assigned_location_id")
                if wp_id:
                    accessible_location_ids.append(wp_id)
        
        # Veya sağlık merkezi
        if assignment.get("location_type") == "saglik_merkezi":
            hc_id = assignment.get("healmedy_location_id", "filyos_saglik_merkezi")
            accessible_location_ids.append(hc_id)
        
        # Erişim kontrolü
        if location_id not in accessible_location_ids:
            raise HTTPException(status_code=403, detail="Bu lokasyona erişim yetkiniz yok")
    
    loc = await location_stocks.find_one({"location_id": location_id})
    if not loc:
        loc = await location_stocks.find_one({"_id": location_id})
    
    if not loc:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    # Güncellemeleri uygula
    updates = data.get("items", [])  # [{name, quantity}, ...]
    update_map = {u["name"]: u["quantity"] for u in updates}
    
    items = loc.get("items", [])
    for item in items:
        if item["name"] in update_map:
            item["quantity"] = update_map[item["name"]]
    
    await location_stocks.update_one(
        {"_id": loc["_id"]},
        {"$set": {"items": items, "updated_at": get_turkey_time()}}
    )
    
    logger.info(f"Stok güncellendi: {user.name} - {loc.get('location_name')} - {len(updates)} ürün")
    
    return {"success": True, "message": "Stok güncellendi"}


@router.post("/locations/{location_id}/use")
async def use_from_location(location_id: str, request: Request):
    """Lokasyondan stok kullan (düş) - Kullanıcı sadece erişebildiği lokasyonlardan stok kullanabilir"""
    user = await get_current_user(request)
    data = await request.json()
    
    # Yetki kontrolü - Merkez ofis her lokasyona erişebilir
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        # Kullanıcının bu lokasyona erişimi var mı kontrol et
        today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        
        assignment = await db.shift_assignments.find_one({
            "user_id": user.id,
            "status": {"$in": ["pending", "started"]},
            "$or": [
                {"shift_date": {"$gte": today, "$lt": tomorrow}},
                {"shift_date": {"$lte": today}, "end_date": {"$gte": today}}
            ]
        })
        
        if not assignment:
            raise HTTPException(status_code=403, detail="Aktif vardiya atamanız bulunmuyor")
        
        # Erişilebilir lokasyonları kontrol et
        accessible_location_ids = []
        
        # Kendi aracı
        if assignment.get("vehicle_id"):
            accessible_location_ids.append(assignment.get("vehicle_id"))
            
            # Aracın bulunduğu bekleme noktası
            vehicle_location = await db.vehicle_current_locations.find_one({"vehicle_id": assignment.get("vehicle_id")})
            if vehicle_location:
                wp_id = vehicle_location.get("current_location_id") or vehicle_location.get("assigned_location_id")
                if wp_id:
                    accessible_location_ids.append(wp_id)
        
        # Veya sağlık merkezi
        if assignment.get("location_type") == "saglik_merkezi":
            hc_id = assignment.get("healmedy_location_id", "filyos_saglik_merkezi")
            accessible_location_ids.append(hc_id)
        
        # Erişim kontrolü
        if location_id not in accessible_location_ids:
            raise HTTPException(status_code=403, detail="Bu lokasyona erişim yetkiniz yok")
    
    loc = await location_stocks.find_one({"location_id": location_id})
    if not loc:
        loc = await location_stocks.find_one({"_id": location_id})
    
    if not loc:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    # Kullanımları uygula
    usages = data.get("items", [])  # [{name, quantity}, ...]
    usage_map = {u["name"]: u["quantity"] for u in usages}
    
    items = loc.get("items", [])
    for item in items:
        if item["name"] in usage_map:
            new_qty = item["quantity"] - usage_map[item["name"]]
            item["quantity"] = max(0, new_qty)
    
    await location_stocks.update_one(
        {"_id": loc["_id"]},
        {"$set": {"items": items, "updated_at": get_turkey_time()}}
    )
    
    logger.info(f"Stok kullanımı: {user.name} - {loc.get('location_name')} - {len(usages)} ürün")
    
    return {"success": True, "message": "Stok kullanımı kaydedildi"}


@router.get("/my-location")
async def get_my_location_stock(request: Request):
    """Kullanıcının atandığı lokasyonun stoğu"""
    user = await get_current_user(request)
    
    # Bugünkü vardiya atamasını bul (shift_assignments_collection)
    today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Aktif veya bekleyen vardiya ataması ara
    assignment = await db.shift_assignments.find_one({
        "user_id": user.id,
        "status": {"$in": ["pending", "started"]},
        "$or": [
            # Bugün başlayan
            {"shift_date": {"$gte": today, "$lt": tomorrow}},
            # Veya bugünü kapsayan (çok günlük vardiya)
            {"shift_date": {"$lte": today}, "end_date": {"$gte": today}}
        ]
    })
    
    if not assignment:
        return {"location": None, "items": [], "message": "Bugün için aktif bir araç atamanız bulunmuyor"}
    
    # Araç veya lokasyon ID'sini al
    target_id = assignment.get("vehicle_id")
    target_name = assignment.get("vehicle_plate", "")
    target_type = "vehicle"
    
    # Eğer araç yoksa sağlık merkezi olabilir
    if not target_id and assignment.get("location_type") == "saglik_merkezi":
        # Önce healmedy_location_id'yi kontrol et, yoksa health_center_name kullan
        target_id = assignment.get("healmedy_location_id") or assignment.get("health_center_name") or "filyos_saglik_merkezi"
        target_name = assignment.get("health_center_name") or assignment.get("location_name") or "Sağlık Merkezi"
        target_type = "waiting_point"
    
    if not target_id:
        return {"location": None, "items": [], "message": "Atamada lokasyon bilgisi yok"}
    
    # Stok getir
    loc = await location_stocks.find_one({"location_id": target_id})
    if not loc:
        return {
            "location": {
                "id": target_id,
                "name": target_name,
                "type": target_type
            },
            "items": [],
            "message": "Bu lokasyon için henüz stok tanımlanmamış"
        }
    
    loc["id"] = loc.pop("_id", "")
    
    return {
        "location": {
            "id": loc["id"],
            "name": loc.get("location_name", target_name),
            "type": loc.get("location_type", target_type)
        },
        "items": loc.get("items", [])
    }


@router.get("/my-accessible-locations")
async def get_my_accessible_locations(request: Request):
    """
    Kullanıcının erişebileceği TÜM lokasyonları getir
    - Kendi vardiyasında atandığı araç/lokasyon
    - Eğer araca atanmışsa, aracın bulunduğu bekleme noktası
    """
    user = await get_current_user(request)
    
    # Bugünkü vardiya atamasını bul
    today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    assignment = await db.shift_assignments.find_one({
        "user_id": user.id,
        "status": {"$in": ["pending", "started"]},
        "$or": [
            {"shift_date": {"$gte": today, "$lt": tomorrow}},
            {"shift_date": {"$lte": today}, "end_date": {"$gte": today}}
        ]
    })
    
    if not assignment:
        return {
            "locations": [],
            "message": "Bugün için aktif bir vardiya atamanız bulunmuyor"
        }
    
    accessible_locations = []
    
    # 1. Kendi atandığı lokasyonu ekle
    vehicle_id = assignment.get("vehicle_id")
    location_type = assignment.get("location_type", "arac")
    
    if vehicle_id:
        # Araca atanmış - aracın stoğunu ekle
        vehicle_stock = await location_stocks.find_one({"location_id": vehicle_id})
        if vehicle_stock:
            vehicle_stock["id"] = vehicle_stock.pop("_id", "")
            accessible_locations.append({
                "location_id": vehicle_stock.get("location_id"),
                "location_name": vehicle_stock.get("location_name"),
                "location_type": "vehicle",
                "items": vehicle_stock.get("items", []),
                "source": "atanmis_arac"
            })
        
        # 2. Aracın bulunduğu bekleme noktasını kontrol et
        vehicle_location = await db.vehicle_current_locations.find_one({"vehicle_id": vehicle_id})
        if vehicle_location:
            waiting_point_id = vehicle_location.get("current_location_id") or vehicle_location.get("assigned_location_id")
            
            if waiting_point_id:
                # Bekleme noktasının stoğunu getir
                waiting_point_stock = await location_stocks.find_one({"location_id": waiting_point_id})
                if waiting_point_stock:
                    waiting_point_stock["id"] = waiting_point_stock.pop("_id", "")
                    accessible_locations.append({
                        "location_id": waiting_point_stock.get("location_id"),
                        "location_name": waiting_point_stock.get("location_name"),
                        "location_type": "waiting_point",
                        "items": waiting_point_stock.get("items", []),
                        "source": "arac_bekleme_noktasi"
                    })
    
    elif location_type == "saglik_merkezi":
        # Sağlık merkezine atanmış (hemşire/doktor)
        health_center_id = assignment.get("healmedy_location_id")
        health_center_name = assignment.get("health_center_name", "Sağlık Merkezi")
        
        logger.info(f"Hemşire sağlık merkezi araması - healmedy_location_id: {health_center_id}, health_center_name: {health_center_name}")
        
        # Önce healmedy_location_id ile ara, yoksa health_center_name ile ara
        health_center_stock = None
        if health_center_id:
            health_center_stock = await location_stocks.find_one({"location_id": health_center_id})
        
        # Eğer bulunamadıysa, isme göre ara
        if not health_center_stock and health_center_name:
            health_center_stock = await location_stocks.find_one({
                "location_name": {"$regex": health_center_name, "$options": "i"}
            })
        
        # Hala bulunamadıysa "saglik" içeren herhangi bir lokasyonu bul
        if not health_center_stock:
            health_center_stock = await location_stocks.find_one({
                "location_name": {"$regex": "sağlık|saglik|merkez", "$options": "i"}
            })
            logger.warning(f"Sağlık merkezi stoğu varsayılan arama ile bulundu: {health_center_stock.get('location_name') if health_center_stock else 'Bulunamadı'}")
        
        if health_center_stock:
            health_center_stock["id"] = health_center_stock.pop("_id", "")
            accessible_locations.append({
                "location_id": health_center_stock.get("location_id"),
                "location_name": health_center_stock.get("location_name"),
                "location_type": "waiting_point",
                "items": health_center_stock.get("items", []),
                "source": "atanmis_saglik_merkezi"
            })
            logger.info(f"Hemşire için sağlık merkezi stoğu eklendi: {health_center_stock.get('location_name')}")
        else:
            logger.warning(f"Hemşire için sağlık merkezi stoğu bulunamadı! User: {user.name}, Assignment: {assignment.get('_id')}")
    
    return {
        "locations": accessible_locations,
        "total": len(accessible_locations),
        "message": f"{len(accessible_locations)} lokasyona erişiminiz var"
    }


# --- Stok Talepleri ---

@router.get("/requests")
async def get_requests(request: Request, status: Optional[str] = None):
    """Stok taleplerini listele"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    reqs = await stock_requests.find(query).sort("created_at", -1).to_list(500)
    
    for r in reqs:
        r["id"] = r.pop("_id", "")
    
    return {"requests": reqs}


@router.post("/requests")
async def create_request(request: Request):
    """Yeni stok talebi oluştur"""
    user = await get_current_user(request)
    data = await request.json()
    
    doc = {
        "_id": str(uuid.uuid4()),
        "requester_id": user.id,
        "requester_name": user.name,
        "location_id": data.get("location_id", ""),
        "location_name": data.get("location_name", ""),
        "items": data.get("items", []),
        "case_id": data.get("case_id"),
        "case_no": data.get("case_no"),
        "status": "pending",
        "note": data.get("note"),
        "created_at": get_turkey_time()
    }
    
    await stock_requests.insert_one(doc)
    
    return {"success": True, "request_id": doc["_id"]}


@router.post("/requests/from-case/{case_id}")
async def create_request_from_case(case_id: str, request: Request):
    """Vakadan otomatik talep oluştur"""
    user = await get_current_user(request)
    
    # Vaka bilgisi
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Kullanılan ilaçları al
    usages = await db.medication_usage.find({"case_id": case_id}).to_list(100)
    
    if not usages:
        raise HTTPException(status_code=400, detail="Bu vakada kullanılan malzeme yok")
    
    # Araç bilgisi
    assigned_team = case.get("assigned_team") or {}
    vehicle_id = assigned_team.get("vehicle_id") if isinstance(assigned_team, dict) else None
    vehicle = await db.vehicles.find_one({"_id": vehicle_id}) if vehicle_id else None
    
    location_id = vehicle_id or case_id
    location_name = vehicle.get("plate", "Bilinmeyen") if vehicle else "Bilinmeyen"
    
    # Talep öğeleri
    items = []
    for u in usages:
        items.append({
            "name": u.get("name", ""),
            "quantity": u.get("quantity", 1),
            "unit": u.get("unit", "ADET"),
            "source": u.get("source_type", "vehicle")
        })
    
    doc = {
        "_id": str(uuid.uuid4()),
        "requester_id": user.id,
        "requester_name": user.name,
        "location_id": location_id,
        "location_name": location_name,
        "items": items,
        "case_id": case_id,
        "case_no": case.get("case_number"),
        "status": "pending",
        "note": f"Vaka #{case.get('case_number')} için otomatik talep",
        "created_at": get_turkey_time()
    }
    
    await stock_requests.insert_one(doc)
    
    return {"success": True, "message": f"{len(items)} ürün için talep oluşturuldu", "request_id": doc["_id"]}


@router.patch("/requests/{request_id}/approve")
async def approve_request(request_id: str, request: Request):
    """Talebi onayla"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    req = await stock_requests.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await stock_requests.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "approved",
            "processed_at": get_turkey_time(),
            "processed_by": user.name
        }}
    )
    
    return {"success": True, "message": "Talep onaylandı"}


@router.patch("/requests/{request_id}/reject")
async def reject_request(request_id: str, request: Request):
    """Talebi reddet"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    data = await request.json()
    
    req = await stock_requests.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    await stock_requests.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "rejected",
            "processed_at": get_turkey_time(),
            "processed_by": user.name,
            "note": data.get("note", req.get("note"))
        }}
    )
    
    return {"success": True, "message": "Talep reddedildi"}


@router.patch("/requests/{request_id}/deliver")
async def deliver_request(request_id: str, request: Request):
    """Talebi teslim et ve stoğu güncelle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire"])(request)
    
    req = await stock_requests.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "approved":
        raise HTTPException(status_code=400, detail="Sadece onaylanmış talepler teslim edilebilir")
    
    # Talebi güncelle
    await stock_requests.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "delivered",
            "processed_at": get_turkey_time(),
            "processed_by": user.name
        }}
    )
    
    # Lokasyon stoğunu güncelle
    loc = await location_stocks.find_one({"location_id": req["location_id"]})
    if loc:
        items = loc.get("items", [])
        item_map = {i["name"]: i for i in items}
        
        for req_item in req.get("items", []):
            name = req_item["name"]
            qty = req_item["quantity"]
            
            if name in item_map:
                item_map[name]["quantity"] += qty
        
        await location_stocks.update_one(
            {"_id": loc["_id"]},
            {"$set": {"items": items, "updated_at": get_turkey_time()}}
        )
    
    return {"success": True, "message": "Talep teslim edildi"}


# --- Eski Sistem Uyumluluğu ---

@router.get("")
async def get_stock_list(request: Request):
    """Eski frontend uyumluluğu için tüm stokları getir"""
    await get_current_user(request)
    
    # Tüm lokasyonlardan stokları birleştir
    locations = await location_stocks.find({}).to_list(500)
    
    all_items = []
    for loc in locations:
        for item in loc.get("items", []):
            all_items.append({
                "id": f"{loc['_id']}_{item['name'][:10]}",
                "name": item["name"],
                "code": "",
                "quantity": item.get("quantity", 0),
                "min_quantity": item.get("min_quantity", 1),
                "location": loc.get("location_name", ""),
                "location_detail": loc.get("location_type", ""),
                "unit": item.get("unit", "ADET"),
                "category": item.get("category", "sarf")
            })
    
    return all_items


@router.get("/alerts/summary")
async def get_alerts_summary(request: Request):
    """Stok uyarı özeti"""
    await get_current_user(request)
    
    locations = await location_stocks.find({}).to_list(500)
    
    critical = 0
    low = 0
    
    for loc in locations:
        for item in loc.get("items", []):
            qty = item.get("quantity", 0)
            min_qty = item.get("min_quantity", 1)
            
            if qty == 0:
                critical += 1
            elif qty < min_qty:
                low += 1
    
    return {
        "critical_stock": critical,
        "expired": 0,
        "expiring_soon": 0,
        "low_stock": low
    }


@router.get("/all-grouped")
async def get_all_grouped(request: Request, category: Optional[str] = None, search: Optional[str] = None):
    """Tüm stokları gruplandırılmış olarak getir (eski frontend uyumluluğu)"""
    await get_current_user(request)
    
    locations = await location_stocks.find({}).to_list(500)
    
    # Tüm ürünleri topla ve grupla
    grouped = {}
    
    for loc in locations:
        for item in loc.get("items", []):
            name = item.get("name", "")
            
            # Arama filtresi
            if search and search.lower() not in name.lower():
                continue
            
            # Kategori filtresi
            item_cat = item.get("category", "diger")
            if category and item_cat != category:
                continue
            
            if name not in grouped:
                grouped[name] = {
                    "name": name,
                    "category": item_cat,
                    "total_quantity": 0,
                    "locations": [],
                    "earliest_expiry": None
                }
            
            grouped[name]["total_quantity"] += item.get("quantity", 0)
            grouped[name]["locations"].append({
                "location_name": loc.get("location_name", ""),
                "location_type": loc.get("location_type", ""),
                "quantity": item.get("quantity", 0),
                "min_quantity": item.get("min_quantity", 1)
            })
    
    # Listeye çevir (frontend dizi bekliyor)
    groups_list = list(grouped.values())
    
    return {
        "groups": groups_list,
        "total_items": len(groups_list)
    }


@router.get("/locations/summary")
async def get_locations_summary(request: Request):
    """Lokasyon bazlı stok özeti"""
    await get_current_user(request)
    
    locations = await location_stocks.find({}).to_list(500)
    
    result = []
    for loc in locations:
        items = loc.get("items", [])
        
        result.append({
            "id": loc.get("_id", ""),
            "location_id": loc.get("location_id", ""),
            "location_name": loc.get("location_name", ""),
            "location_type": loc.get("location_type", ""),
            "total_items": len(items),
            "critical_count": sum(1 for i in items if i.get("quantity", 0) == 0),
            "low_count": sum(1 for i in items if 0 < i.get("quantity", 0) < i.get("min_quantity", 1)),
            "ok_count": sum(1 for i in items if i.get("quantity", 0) >= i.get("min_quantity", 1))
        })
    
    return {"locations": result}


# ============ VAKA İÇİN STOK ============

@router.get("/case/{case_id}/available")
async def get_case_available_stock(case_id: str, request: Request):
    """Vakaya atanan aracın ve lokasyonun stoklarını getir - basitleştirilmiş versiyon"""
    user = await get_current_user(request)
    
    result = {
        "vehicle": None,
        "location": None
    }
    
    try:
        # ========== HEMŞİRE İÇİN SAĞLIK MERKEZİ STOĞU ==========
        # Hemşire sağlık merkezine atanmışsa, o merkezdeki stoğu göster
        if user.role == "hemsire":
            today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow = today + timedelta(days=1)
            
            # Hemşirenin tüm aktif atamalarını bul
            nurse_assignments = await db.shift_assignments.find({
                "user_id": user.id,
                "status": {"$in": ["pending", "started"]},
                "$or": [
                    {"shift_date": {"$gte": today, "$lt": tomorrow}},
                    {"shift_date": {"$lte": today}, "end_date": {"$gte": today}}
                ]
            }).to_list(10)
            
            logger.info(f"[STOCK DEBUG] Nurse {user.name} (id={user.id}) found {len(nurse_assignments)} assignments")
            
            # Sağlık merkezine atama var mı kontrol et
            hc_assignment = None
            for assignment in nurse_assignments:
                loc_type = assignment.get("location_type", "")
                hc_name = assignment.get("health_center_name", "")
                logger.info(f"[STOCK DEBUG] Assignment: location_type={loc_type}, health_center_name={hc_name}, vehicle_id={assignment.get('vehicle_id')}")
                
                # Sağlık merkezi ataması mı?
                if loc_type == "saglik_merkezi" or hc_name:
                    hc_assignment = assignment
                    break
            
            if hc_assignment:
                # Sağlık merkezi ID ve adını al
                health_center_id = hc_assignment.get("healmedy_location_id") or hc_assignment.get("location_id")
                health_center_name = hc_assignment.get("health_center_name") or hc_assignment.get("location_name")
                
                logger.info(f"[STOCK DEBUG] Nurse health center: id={health_center_id}, name={health_center_name}")
                
                if health_center_id or health_center_name:
                    # Sağlık merkezi stoğunu bul - birden fazla yöntemle ara
                    hc_stock = None
                    
                    # 1. location_id ile ara
                    if health_center_id:
                        hc_stock = await location_stocks.find_one({"location_id": health_center_id})
                        logger.info(f"[STOCK DEBUG] Search by location_id={health_center_id}: found={hc_stock is not None}")
                    
                    # 2. location_name ile ara
                    if not hc_stock and health_center_name:
                        hc_stock = await location_stocks.find_one({"location_name": health_center_name})
                        logger.info(f"[STOCK DEBUG] Search by location_name={health_center_name}: found={hc_stock is not None}")
                    
                    # 3. location_type = saglik_merkezi olan stokları ara
                    if not hc_stock:
                        hc_stock = await location_stocks.find_one({
                            "location_type": "saglik_merkezi",
                            "$or": [
                                {"location_name": {"$regex": health_center_name or "merkez", "$options": "i"}},
                                {"location_id": {"$regex": "merkez|office|saglik", "$options": "i"}}
                            ]
                        })
                        logger.info(f"[STOCK DEBUG] Search by regex/type: found={hc_stock is not None}")
                    
                    # 4. Tüm saglik_merkezi stoklarını listele
                    if not hc_stock:
                        all_hc_stocks = await location_stocks.find({"location_type": "saglik_merkezi"}).to_list(10)
                        logger.info(f"[STOCK DEBUG] All saglik_merkezi stocks: {[s.get('location_name') for s in all_hc_stocks]}")
                        if all_hc_stocks:
                            hc_stock = all_hc_stocks[0]  # İlkini kullan
                    
                    if hc_stock:
                        hc_items = []
                        for item in hc_stock.get("items", []):
                            if isinstance(item, dict) and item.get("quantity", 0) > 0:
                                hc_items.append({
                                    "name": item.get("name", ""),
                                    "quantity": item.get("quantity", 0),
                                    "category": item.get("category", "sarf"),
                                    "source": "location",
                                    "source_name": hc_stock.get("location_name", health_center_name)
                                })
                        
                        result["location"] = {
                            "id": health_center_id or hc_stock.get("location_id"),
                            "name": hc_stock.get("location_name", health_center_name),
                            "type": "saglik_merkezi",
                            "items": hc_items
                        }
                        
                        # Hemşire için sadece sağlık merkezi stoğu göster, araç yok
                        logger.info(f"[STOCK DEBUG] Returning health center stock for nurse: {len(hc_items)} items from {hc_stock.get('location_name')}")
                        return result
                    else:
                        # Sağlık merkezi stoğu yok - boş döndür, araç stoğuna düşme!
                        logger.warning(f"[STOCK DEBUG] No health center stock found for nurse {user.name} - returning empty (NOT falling back to vehicle)")
                        result["location"] = {
                            "id": health_center_id,
                            "name": health_center_name or "Sağlık Merkezi",
                            "type": "saglik_merkezi",
                            "items": [],
                            "message": "Bu lokasyon için stok kaydı henüz oluşturulmamış. Lütfen yöneticinize bildirin."
                        }
                        return result
            else:
                logger.info(f"[STOCK DEBUG] Nurse {user.name} has no health center assignment, checking vehicle assignments")
        
        # ========== NORMAL AKIŞ (ATT, PARAMEDİK, ŞOFÖR) ==========
        # 1. Önce vakadan araç ID'sini almayı dene
        vehicle_id = None
        case = await db.cases.find_one({"_id": case_id})
        if case and case.get("assigned_team"):
            assigned_team = case.get("assigned_team") or {}
            vehicle_id = assigned_team.get("vehicle_id") if isinstance(assigned_team, dict) else None
        
        # 2. Vakada araç yoksa, kullanıcının bugünkü vardiyasındaki aracı bul
        if not vehicle_id:
            today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
            tomorrow = today + timedelta(days=1)
            
            assignment = await db.shift_assignments.find_one({
                "user_id": user.id,
                "status": {"$in": ["pending", "started"]},
                "$or": [
                    {"shift_date": {"$gte": today, "$lt": tomorrow}},
                    {"shift_date": {"$lte": today}, "end_date": {"$gte": today}}
                ]
            })
            
            if assignment:
                vehicle_id = assignment.get("vehicle_id")
        
        # 3. Araç stoğunu getir
        if vehicle_id:
            vehicle = await db.vehicles.find_one({"_id": vehicle_id})
            vehicle_stock = await location_stocks.find_one({"location_id": vehicle_id})
            
            if vehicle_stock:
                vehicle_items = []
                for item in vehicle_stock.get("items", []):
                    if isinstance(item, dict) and item.get("quantity", 0) > 0:
                        vehicle_items.append({
                            "name": item.get("name", ""),
                            "quantity": item.get("quantity", 0),
                            "category": item.get("category", "sarf"),
                            "source": "vehicle",
                            "source_name": vehicle.get("plate", "") if vehicle else ""
                        })
                
                result["vehicle"] = {
                    "id": vehicle_id,
                    "name": vehicle.get("plate", "") if vehicle else "",
                    "type": "vehicle",
                    "items": vehicle_items
                }
            
            # 4. Aracın bulunduğu bekleme noktası stoğu
            vehicle_current_loc = await db.vehicle_current_locations.find_one({"vehicle_id": vehicle_id})
            logger.info(f"[STOCK DEBUG] vehicle_id={vehicle_id}, vehicle_current_loc={vehicle_current_loc}")
            
            if vehicle_current_loc:
                # current_location_id veya assigned_location_id kullan
                loc_id = vehicle_current_loc.get("current_location_id") or vehicle_current_loc.get("assigned_location_id")
                loc_name = vehicle_current_loc.get("current_location_name") or vehicle_current_loc.get("assigned_location_name")
                logger.info(f"[STOCK DEBUG] loc_id={loc_id}, loc_name={loc_name}")
                
                if loc_id:
                    loc_stock = await location_stocks.find_one({"location_id": loc_id})
                    logger.info(f"[STOCK DEBUG] loc_stock found={loc_stock is not None}, location_id query={loc_id}")
                    
                    # Eğer location_id ile bulunamazsa, location_name ile dene
                    if not loc_stock and loc_name:
                        loc_stock = await location_stocks.find_one({"location_name": loc_name})
                        logger.info(f"[STOCK DEBUG] loc_stock by name found={loc_stock is not None}")
                    
                    if loc_stock:
                        loc_items = []
                        for item in loc_stock.get("items", []):
                            if isinstance(item, dict) and item.get("quantity", 0) > 0:
                                loc_items.append({
                                    "name": item.get("name", ""),
                                    "quantity": item.get("quantity", 0),
                                    "category": item.get("category", "sarf"),
                                    "source": "location",
                                    "source_name": loc_stock.get("location_name", "")
                                })
                        
                        result["location"] = {
                            "id": loc_id,
                            "name": loc_stock.get("location_name", ""),
                            "type": "waiting_point",
                            "items": loc_items
                        }
        
        # 5. Hala stok bulunamadıysa, tüm araç stoklarından ilkini göster (fallback)
        if not result["vehicle"] and not result["location"]:
            all_stocks = await location_stocks.find({"location_type": "vehicle"}).limit(1).to_list(1)
            if all_stocks:
                stock = all_stocks[0]
                items = []
                for item in stock.get("items", []):
                    if isinstance(item, dict) and item.get("quantity", 0) > 0:
                        items.append({
                            "name": item.get("name", ""),
                            "quantity": item.get("quantity", 0),
                            "category": item.get("category", "sarf"),
                            "source": "vehicle",
                            "source_name": stock.get("location_name", "")
                        })
                
                result["vehicle"] = {
                    "id": stock.get("location_id"),
                    "name": stock.get("location_name", ""),
                    "type": "vehicle",
                    "items": items
                }
                
    except Exception as e:
        logger.error(f"Error loading case available stock: {e}")
    
    return result


@router.post("/case/{case_id}/use")
async def use_stock_in_case(case_id: str, request: Request):
    """Vakada stok kullan - stoktan düş ve kullanım kaydı oluştur"""
    user = await get_current_user(request)
    data = await request.json()
    
    item_name = data.get("item_name")
    quantity = data.get("quantity", 1)
    source = data.get("source")  # "vehicle" veya "location"
    source_id = data.get("source_id")
    source_name = data.get("source_name", "")
    
    if not item_name or not source or not source_id:
        raise HTTPException(status_code=400, detail="Eksik parametreler")
    
    # Vaka kontrolü
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Stok kontrolü ve düşme
    stock_loc = await location_stocks.find_one({"location_id": source_id})
    if not stock_loc:
        raise HTTPException(status_code=404, detail="Stok lokasyonu bulunamadı")
    
    items = stock_loc.get("items", [])
    item_found = False
    
    for item in items:
        if item["name"] == item_name:
            if item["quantity"] < quantity:
                raise HTTPException(status_code=400, detail=f"Yetersiz stok: {item['quantity']} adet mevcut")
            
            item["quantity"] -= quantity
            item_found = True
            break
    
    if not item_found:
        raise HTTPException(status_code=404, detail="Ürün stokta bulunamadı")
    
    # Stoku güncelle
    await location_stocks.update_one(
        {"_id": stock_loc["_id"]},
        {"$set": {"items": items, "updated_at": get_turkey_time()}}
    )
    
    # Kullanım kaydı oluştur (medication_usage koleksiyonuna)
    usage_doc = {
        "_id": str(uuid.uuid4()),
        "case_id": case_id,
        "name": item_name,
        "quantity": quantity,
        "unit": "ADET",
        "source_type": source,
        "source_location_id": source_id,
        "source_location_name": source_name,
        "added_by": user.id,
        "added_by_name": user.name,
        "added_at": get_turkey_time(),
        "stock_deducted": True
    }
    
    await db.medication_usage.insert_one(usage_doc)
    
    logger.info(f"Stok kullanıldı: {item_name} x{quantity} from {source_name} by {user.name}")
    
    return {
        "success": True,
        "message": f"{item_name} x{quantity} kullanıldı",
        "usage": usage_doc
    }


@router.get("/case/{case_id}/usage")
async def get_case_stock_usage(case_id: str, request: Request):
    """Vakada kullanılan stokları getir"""
    await get_current_user(request)
    
    usages = await db.medication_usage.find({"case_id": case_id}).to_list(100)
    
    for u in usages:
        u["id"] = u.pop("_id", "")
    
    return {"usages": usages}


@router.delete("/case/{case_id}/usage/{usage_id}")
async def remove_case_stock_usage(case_id: str, usage_id: str, request: Request):
    """Vakadaki stok kullanımını iptal et ve stoğa geri ekle"""
    user = await get_current_user(request)
    
    # Kullanım kaydını bul
    usage = await db.medication_usage.find_one({"_id": usage_id, "case_id": case_id})
    if not usage:
        raise HTTPException(status_code=404, detail="Kullanım kaydı bulunamadı")
    
    # Stoğa geri ekle
    source_id = usage.get("source_location_id")
    if source_id:
        stock_loc = await location_stocks.find_one({"location_id": source_id})
        if stock_loc:
            items = stock_loc.get("items", [])
            for item in items:
                if item["name"] == usage["name"]:
                    item["quantity"] += usage.get("quantity", 1)
                    break
            
            await location_stocks.update_one(
                {"_id": stock_loc["_id"]},
                {"$set": {"items": items, "updated_at": get_turkey_time()}}
            )
    
    # Kullanım kaydını sil
    await db.medication_usage.delete_one({"_id": usage_id})
    
    logger.info(f"Stok kullanımı iptal edildi: {usage['name']} by {user.name}")
    
    return {"success": True, "message": "Kullanım iptal edildi, stok geri eklendi"}


@router.get("/item/search")
async def search_stock_item(request: Request, q: str = "", location_id: Optional[str] = None):
    """Stok içinde ürün ara"""
    await get_current_user(request)
    
    if not q or len(q) < 2:
        return {"items": []}
    
    query = {}
    if location_id:
        query["location_id"] = location_id
    
    locations = await location_stocks.find(query).to_list(100)
    
    results = []
    seen = set()
    
    for loc in locations:
        for item in loc.get("items", []):
            if q.lower() in item["name"].lower() and item.get("quantity", 0) > 0:
                key = f"{loc['location_id']}_{item['name']}"
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "name": item["name"],
                        "quantity": item["quantity"],
                        "category": item.get("category", "sarf"),
                        "location_id": loc["location_id"],
                        "location_name": loc["location_name"],
                        "location_type": loc["location_type"],
                        "source": loc["location_type"],
                        "source_name": loc["location_name"]
                    })
    
    return {"items": results[:20]}


# --- Vaka İçin Stok İşlemleri ---

@router.get("/case/{case_id}/available")
async def get_case_available_stock(case_id: str, request: Request):
    """Vakadaki ekibin erişebileceği tüm stokları getir (araç + bekleme noktası)"""
    user = await get_current_user(request)
    
    # Vakayı getir
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Vakanın aracını bul
    vehicle_id = case.get("vehicle_id")
    if not vehicle_id:
        return {"items": [], "message": "Vakada araç ataması yok"}
    
    all_items = []
    
    # 1. Aracın stoğu
    vehicle_stock = await location_stocks.find_one({"location_id": vehicle_id})
    if vehicle_stock:
        for item in vehicle_stock.get("items", []):
            if item.get("quantity", 0) > 0:
                all_items.append({
                    **item,
                    "source": "vehicle",
                    "source_id": vehicle_id,
                    "source_name": vehicle_stock.get("location_name", "Araç")
                })
    
    # 2. Aracın bulunduğu bekleme noktasının stoğu
    vehicle_location = await db.vehicle_current_locations.find_one({"vehicle_id": vehicle_id})
    if vehicle_location:
        wp_id = vehicle_location.get("current_location_id") or vehicle_location.get("assigned_location_id")
        if wp_id:
            wp_stock = await location_stocks.find_one({"location_id": wp_id})
            if wp_stock:
                for item in wp_stock.get("items", []):
                    if item.get("quantity", 0) > 0:
                        all_items.append({
                            **item,
                            "source": "waiting_point",
                            "source_id": wp_id,
                            "source_name": wp_stock.get("location_name", "Bekleme Noktası")
                        })
    
    return {"items": all_items}


@router.get("/case/{case_id}/usage")
async def get_case_stock_usage(case_id: str, request: Request):
    """Vakada kullanılan stokları getir"""
    await get_current_user(request)
    
    # Case collection'dan kullanılan stokları al
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Vakadaki medications ve stock_usage alanlarını birleştir
    used_items = []
    
    # Medications alanından
    for med in case.get("medications", []):
        used_items.append({
            "id": med.get("id", ""),
            "name": med.get("name", ""),
            "quantity": med.get("quantity", 0),
            "unit": med.get("unit", "ADET"),
            "category": med.get("category", "ilac"),
            "used_at": med.get("added_at"),
            "used_by": med.get("added_by", "")
        })
    
    return {"items": used_items}


@router.post("/case/{case_id}/use")
async def use_stock_for_case(case_id: str, request: Request):
    """Vakada stok kullan - hem lokasyon stoğundan düş hem vakaya ekle"""
    user = await get_current_user(request)
    data = await request.json()
    
    item_name = data.get("item_name")
    quantity = data.get("quantity", 1)
    source_id = data.get("source_id")  # location_id (araç veya bekleme noktası)
    source = data.get("source", "vehicle")  # vehicle veya waiting_point
    
    if not item_name or not source_id:
        raise HTTPException(status_code=400, detail="item_name ve source_id gerekli")
    
    # Lokasyon stoğundan düş
    loc = await location_stocks.find_one({"location_id": source_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    items = loc.get("items", [])
    item_found = False
    
    for item in items:
        if item["name"] == item_name:
            item_found = True
            if item["quantity"] < quantity:
                raise HTTPException(status_code=400, detail=f"Yetersiz stok. Mevcut: {item['quantity']}")
            item["quantity"] -= quantity
            break
    
    if not item_found:
        raise HTTPException(status_code=404, detail="Ürün bu lokasyonda bulunamadı")
    
    # Lokasyon stoğunu güncelle
    await location_stocks.update_one(
        {"_id": loc["_id"]},
        {"$set": {"items": items, "updated_at": get_turkey_time()}}
    )
    
    # Vakaya ekle (medications alanına)
    case = await db.cases.find_one({"_id": case_id})
    if case:
        medications = case.get("medications", [])
        medications.append({
            "id": str(uuid.uuid4()),
            "name": item_name,
            "quantity": quantity,
            "unit": data.get("unit", "ADET"),
            "category": data.get("category", "ilac"),
            "added_at": get_turkey_time(),
            "added_by": user.name,
            "source": source,
            "source_id": source_id
        })
        
        await db.cases.update_one(
            {"_id": case_id},
            {"$set": {"medications": medications}}
        )
    
    logger.info(f"Vaka stok kullanımı: {user.name} - {case_id} - {item_name} x{quantity}")
    
    return {"success": True, "message": f"{item_name} x{quantity} vakaya eklendi"}


@router.post("/case/{case_id}/remove-usage")
async def remove_case_stock_usage(case_id: str, request: Request):
    """Vakadan stok kullanımını kaldır - stoğa iade et"""
    user = await get_current_user(request)
    data = await request.json()
    
    usage_id = data.get("usage_id")
    if not usage_id:
        raise HTTPException(status_code=400, detail="usage_id gerekli")
    
    # Vakadan medication'ı bul ve kaldır
    case = await db.cases.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    medications = case.get("medications", [])
    med_to_remove = None
    
    for med in medications:
        if med.get("id") == usage_id:
            med_to_remove = med
            break
    
    if not med_to_remove:
        raise HTTPException(status_code=404, detail="Kullanım kaydı bulunamadı")
    
    # Stoğa iade et
    source_id = med_to_remove.get("source_id")
    if source_id:
        loc = await location_stocks.find_one({"location_id": source_id})
        if loc:
            items = loc.get("items", [])
            for item in items:
                if item["name"] == med_to_remove["name"]:
                    item["quantity"] += med_to_remove.get("quantity", 1)
                    break
            
            await location_stocks.update_one(
                {"_id": loc["_id"]},
                {"$set": {"items": items, "updated_at": get_turkey_time()}}
            )
    
    # Vakadan kaldır
    medications = [m for m in medications if m.get("id") != usage_id]
    await db.cases.update_one(
        {"_id": case_id},
        {"$set": {"medications": medications}}
    )
    
    logger.info(f"Vaka stok iadesi: {user.name} - {case_id} - {med_to_remove['name']}")
    
    return {"success": True, "message": "Kullanım iptal edildi ve stoğa iade edildi"}


# ============ SAĞLIK MERKEZİ STOK OLUŞTURMA ============
@router.post("/seed-health-centers")
async def seed_health_centers_endpoint(request: Request):
    """Sağlık merkezleri için stok oluştur - tek seferlik"""
    user = await get_current_user(request)
    if user.role not in ["operasyon_muduru", "merkez_ofis", "admin"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    results = []
    HEALTH_CENTERS = [
        {"id": "merkez_ofis", "name": "Merkez Ofis"},
    ]
    
    for hc in HEALTH_CENTERS:
        result = await seed_location_stock(
            location_id=hc["id"],
            location_type="saglik_merkezi",
            location_name=hc["name"]
        )
        results.append({"location": hc["name"], "result": result})
    
    return {"success": True, "message": "Sağlık merkezi stokları oluşturuldu", "results": results}


@router.post("/create-health-center-stock")
async def create_health_center_stock(request: Request):
    """Sağlık merkezi için boş stok kaydı oluştur"""
    user = await get_current_user(request)
    if user.role not in ["operasyon_muduru", "merkez_ofis", "admin"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    body = await request.json()
    location_name = body.get("location_name", "Merkez Ofis")
    location_id = body.get("location_id", f"hc_{location_name.lower().replace(' ', '_')}")
    
    # Zaten var mı kontrol et
    existing = await location_stocks.find_one({
        "$or": [
            {"location_id": location_id},
            {"location_name": location_name}
        ]
    })
    
    if existing:
        return {
            "success": False,
            "message": f"Bu lokasyon için zaten stok kaydı var: {existing.get('location_name')}",
            "stock_id": existing.get("_id")
        }
    
    # Yeni stok oluştur
    new_stock = {
        "_id": str(uuid.uuid4()),
        "location_id": location_id,
        "location_name": location_name,
        "location_type": "saglik_merkezi",
        "items": [],
        "created_at": datetime.utcnow(),
        "created_by": user.id
    }
    
    await location_stocks.insert_one(new_stock)
    logger.info(f"Sağlık merkezi stoğu oluşturuldu: {location_name} by {user.name}")
    
    return {
        "success": True,
        "message": f"Sağlık merkezi stoğu oluşturuldu: {location_name}",
        "stock_id": new_stock["_id"]
    }


# ============ DEBUG ENDPOINT ============
@router.get("/debug/nurse-stock")
async def debug_nurse_stock(request: Request):
    """Hemşire stok debug - atama ve stok verilerini göster"""
    user = await get_current_user(request)
    
    today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    # Kullanıcının atamaları
    assignments = await db.shift_assignments.find({
        "user_id": user.id,
        "status": {"$in": ["pending", "started"]}
    }).to_list(20)
    
    # Tüm sağlık merkezi stokları
    hc_stocks = await location_stocks.find({"location_type": "saglik_merkezi"}).to_list(20)
    
    # Tüm stok lokasyonları
    all_stocks = await location_stocks.find({}).to_list(50)
    
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "role": user.role
        },
        "today": today.isoformat(),
        "assignments": [
            {
                "id": a.get("_id"),
                "shift_date": str(a.get("shift_date")),
                "end_date": str(a.get("end_date")),
                "status": a.get("status"),
                "location_type": a.get("location_type"),
                "health_center_name": a.get("health_center_name"),
                "vehicle_id": a.get("vehicle_id"),
                "vehicle_plate": a.get("vehicle_plate"),
                "healmedy_location_id": a.get("healmedy_location_id")
            }
            for a in assignments
        ],
        "health_center_stocks": [
            {
                "location_id": s.get("location_id"),
                "location_name": s.get("location_name"),
                "location_type": s.get("location_type"),
                "item_count": len(s.get("items", []))
            }
            for s in hc_stocks
        ],
        "all_stock_locations": [
            {
                "location_id": s.get("location_id"),
                "location_name": s.get("location_name"),
                "location_type": s.get("location_type"),
                "item_count": len(s.get("items", []))
            }
            for s in all_stocks
        ]
    }

