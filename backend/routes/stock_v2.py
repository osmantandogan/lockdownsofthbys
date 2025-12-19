"""
Yeni Stok Yönetim Sistemi v2
- Şablon bazlı stok yönetimi
- Lokasyon stokları
- Stok talepleri
"""

from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import db
from models import (
    StockTemplate, StockTemplateItem,
    LocationStock, LocationStockItem,
    StockRequest, StockRequestCreate, StockRequestItem
)
from auth_utils import get_current_user, require_roles
from datetime import datetime
from utils.timezone import get_turkey_time
import uuid
import json
import os
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Collections
stock_templates_collection = db.stock_templates
location_stocks_collection = db.location_stocks
stock_requests_collection = db.stock_requests
vehicles_collection = db.vehicles

# Standart stok listesi dosyası
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
STANDARD_STOCK_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'standard_stock_list.json')


def load_standard_stock_list():
    """JSON'dan standart stok listesini yükle"""
    try:
        with open(STANDARD_STOCK_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Standart stok listesi yüklenemedi: {e}")
        return None


# ============ STOK ŞABLONLARI ============

@router.get("/templates")
async def get_stock_templates(request: Request):
    """Tüm stok şablonlarını getir"""
    await get_current_user(request)
    
    templates = await stock_templates_collection.find({"is_active": True}).to_list(100)
    for t in templates:
        t["id"] = t.pop("_id", t.get("id"))
    
    return {"templates": templates}


@router.post("/templates")
async def create_stock_template(request: Request):
    """Yeni stok şablonu oluştur"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    data = await request.json()
    
    template = StockTemplate(
        name=data["name"],
        location_type=data["location_type"],
        description=data.get("description"),
        items=[StockTemplateItem(**item) for item in data.get("items", [])]
    )
    
    template_dict = template.model_dump(by_alias=True)
    await stock_templates_collection.insert_one(template_dict)
    
    logger.info(f"Stok şablonu oluşturuldu: {template.name} by {user.name}")
    
    return {"success": True, "template_id": template.id}


@router.post("/templates/seed-defaults")
async def seed_default_templates(request: Request):
    """Varsayılan şablonları oluştur (ambulans ve bekleme noktası için)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    stock_data = load_standard_stock_list()
    if not stock_data:
        raise HTTPException(status_code=500, detail="Standart stok listesi yüklenemedi")
    
    templates_created = []
    
    # Ambulans Şablonu
    ambulans_items = []
    for key in ["ambulans_stok", "canlandirma_cantasi", "ilac_cantasi"]:
        for item in stock_data.get(key, []):
            ambulans_items.append(StockTemplateItem(
                name=item["name"],
                min_quantity=item["quantity"],
                unit=item.get("unit", "ADET"),
                category=item.get("category", "sarf")
            ))
    
    # Aynı isimli ürünleri birleştir
    unique_items = {}
    for item in ambulans_items:
        if item.name in unique_items:
            unique_items[item.name].min_quantity += item.min_quantity
        else:
            unique_items[item.name] = item
    
    ambulans_template = StockTemplate(
        name="Ambulans Standart Stok",
        location_type="vehicle",
        description="Tüm ambulanslar için standart malzeme listesi",
        items=list(unique_items.values())
    )
    
    # Mevcut şablonu güncelle veya yeni oluştur
    existing = await stock_templates_collection.find_one({"name": ambulans_template.name})
    if existing:
        await stock_templates_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "items": [i.model_dump() for i in ambulans_template.items],
                "updated_at": get_turkey_time()
            }}
        )
        templates_created.append({"name": ambulans_template.name, "action": "updated"})
    else:
        await stock_templates_collection.insert_one(ambulans_template.model_dump(by_alias=True))
        templates_created.append({"name": ambulans_template.name, "action": "created"})
    
    # Bekleme Noktası Şablonu
    revir_items = []
    for key in ["revir_stok", "revir_ilac"]:
        for item in stock_data.get(key, []):
            revir_items.append(StockTemplateItem(
                name=item["name"],
                min_quantity=item["quantity"],
                unit=item.get("unit", "ADET"),
                category=item.get("category", "sarf")
            ))
    
    unique_revir = {}
    for item in revir_items:
        if item.name in unique_revir:
            unique_revir[item.name].min_quantity += item.min_quantity
        else:
            unique_revir[item.name] = item
    
    revir_template = StockTemplate(
        name="Bekleme Noktası/Revir Standart Stok",
        location_type="waiting_point",
        description="Tüm bekleme noktaları ve revirler için standart malzeme listesi",
        items=list(unique_revir.values())
    )
    
    existing = await stock_templates_collection.find_one({"name": revir_template.name})
    if existing:
        await stock_templates_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "items": [i.model_dump() for i in revir_template.items],
                "updated_at": get_turkey_time()
            }}
        )
        templates_created.append({"name": revir_template.name, "action": "updated"})
    else:
        await stock_templates_collection.insert_one(revir_template.model_dump(by_alias=True))
        templates_created.append({"name": revir_template.name, "action": "created"})
    
    logger.info(f"Varsayılan şablonlar oluşturuldu by {user.name}")
    
    return {
        "success": True,
        "message": "Varsayılan şablonlar oluşturuldu",
        "templates": templates_created
    }


# ============ LOKASYON STOKLARI ============

@router.get("/locations")
async def get_all_location_stocks(request: Request, location_type: Optional[str] = None):
    """Tüm lokasyonların stok durumunu getir"""
    await get_current_user(request)
    
    query = {}
    if location_type:
        query["location_type"] = location_type
    
    locations = await location_stocks_collection.find(query).to_list(500)
    
    result = []
    for loc in locations:
        loc["id"] = loc.pop("_id", loc.get("id"))
        
        # Eksik ve kritik ürün sayısını hesapla
        items = loc.get("items", [])
        missing_count = sum(1 for i in items if i.get("current_quantity", 0) < i.get("min_quantity", 1))
        critical_count = sum(1 for i in items if i.get("current_quantity", 0) == 0)
        
        loc["missing_count"] = missing_count
        loc["critical_count"] = critical_count
        loc["total_items"] = len(items)
        
        result.append(loc)
    
    return {"locations": result}


@router.get("/locations/{location_id}")
async def get_location_stock(location_id: str, request: Request):
    """Belirli bir lokasyonun stok detayını getir"""
    await get_current_user(request)
    
    location = await location_stocks_collection.find_one({"_id": location_id})
    if not location:
        # Araç ID'si ile de dene
        location = await location_stocks_collection.find_one({"location_id": location_id})
    
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon stoğu bulunamadı")
    
    location["id"] = location.pop("_id", location.get("id"))
    
    # Kategorilere göre grupla
    items = location.get("items", [])
    by_category = {}
    for item in items:
        cat = item.get("category", "diger")
        if cat not in by_category:
            by_category[cat] = []
        
        item["is_critical"] = item.get("current_quantity", 0) == 0
        item["is_low"] = item.get("current_quantity", 0) < item.get("min_quantity", 1)
        by_category[cat].append(item)
    
    location["items_by_category"] = by_category
    
    return location


@router.post("/locations/{location_id}/seed")
async def seed_location_stock(location_id: str, request: Request):
    """Bir lokasyona şablon stoğu ekle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    data = await request.json()
    
    location_type = data.get("location_type", "vehicle")
    location_name = data.get("location_name", "")
    
    # Şablonu bul
    if location_type == "vehicle":
        template = await stock_templates_collection.find_one({"location_type": "vehicle", "is_active": True})
    else:
        template = await stock_templates_collection.find_one({"location_type": "waiting_point", "is_active": True})
    
    if not template:
        raise HTTPException(status_code=404, detail="Bu lokasyon tipi için şablon bulunamadı")
    
    # Mevcut stok var mı?
    existing = await location_stocks_collection.find_one({"location_id": location_id})
    
    if existing:
        # Güncelle - eksik ürünleri ekle
        existing_names = {i["name"] for i in existing.get("items", [])}
        new_items = existing.get("items", [])
        
        for template_item in template.get("items", []):
            if template_item["name"] not in existing_names:
                new_items.append({
                    "name": template_item["name"],
                    "current_quantity": template_item["min_quantity"],
                    "min_quantity": template_item["min_quantity"],
                    "unit": template_item.get("unit", "ADET"),
                    "category": template_item.get("category", "sarf")
                })
        
        await location_stocks_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "items": new_items,
                "updated_at": get_turkey_time()
            }}
        )
        
        return {"success": True, "message": "Lokasyon stoğu güncellendi", "action": "updated"}
    else:
        # Yeni oluştur
        items = []
        for template_item in template.get("items", []):
            items.append(LocationStockItem(
                name=template_item["name"],
                current_quantity=template_item["min_quantity"],
                min_quantity=template_item["min_quantity"],
                unit=template_item.get("unit", "ADET"),
                category=template_item.get("category", "sarf")
            ))
        
        location_stock = LocationStock(
            location_id=location_id,
            location_type=location_type,
            location_name=location_name,
            items=items
        )
        
        await location_stocks_collection.insert_one(location_stock.model_dump(by_alias=True))
        
        logger.info(f"Lokasyon stoğu oluşturuldu: {location_name} by {user.name}")
        
        return {"success": True, "message": "Lokasyon stoğu oluşturuldu", "action": "created"}


@router.post("/locations/seed-all")
async def seed_all_location_stocks(request: Request):
    """Tüm araç ve bekleme noktalarına şablon stoğu ekle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    results = {
        "vehicles_processed": 0,
        "waiting_points_processed": 0,
        "errors": []
    }
    
    # Önce şablonları kontrol et
    vehicle_template = await stock_templates_collection.find_one({"location_type": "vehicle", "is_active": True})
    wp_template = await stock_templates_collection.find_one({"location_type": "waiting_point", "is_active": True})
    
    if not vehicle_template or not wp_template:
        raise HTTPException(
            status_code=400, 
            detail="Önce varsayılan şablonları oluşturun (POST /stock-v2/templates/seed-defaults)"
        )
    
    # Araçları al
    vehicles = await vehicles_collection.find({"type": "ambulans"}).to_list(100)
    for vehicle in vehicles:
        vehicle_id = vehicle.get("_id")
        vehicle_plate = vehicle.get("plate", "")
        
        try:
            existing = await location_stocks_collection.find_one({"location_id": vehicle_id})
            
            if not existing:
                items = []
                for ti in vehicle_template.get("items", []):
                    items.append({
                        "name": ti["name"],
                        "current_quantity": ti["min_quantity"],
                        "min_quantity": ti["min_quantity"],
                        "unit": ti.get("unit", "ADET"),
                        "category": ti.get("category", "sarf")
                    })
                
                location_stock = LocationStock(
                    location_id=vehicle_id,
                    location_type="vehicle",
                    location_name=vehicle_plate,
                    items=[LocationStockItem(**i) for i in items]
                )
                await location_stocks_collection.insert_one(location_stock.model_dump(by_alias=True))
            
            results["vehicles_processed"] += 1
        except Exception as e:
            results["errors"].append(f"Araç {vehicle_plate}: {str(e)}")
    
    # Bekleme noktalarını al (stock_locations'tan)
    stock_locations = db.stock_locations
    waiting_points = await stock_locations.find({
        "is_active": True,
        "type": {"$in": ["waiting_point", "healmedy"]}
    }).to_list(100)
    
    for wp in waiting_points:
        wp_id = wp.get("_id")
        wp_name = wp.get("name", "")
        
        try:
            existing = await location_stocks_collection.find_one({"location_id": wp_id})
            
            if not existing:
                items = []
                for ti in wp_template.get("items", []):
                    items.append({
                        "name": ti["name"],
                        "current_quantity": ti["min_quantity"],
                        "min_quantity": ti["min_quantity"],
                        "unit": ti.get("unit", "ADET"),
                        "category": ti.get("category", "sarf")
                    })
                
                location_stock = LocationStock(
                    location_id=wp_id,
                    location_type="waiting_point",
                    location_name=wp_name,
                    items=[LocationStockItem(**i) for i in items]
                )
                await location_stocks_collection.insert_one(location_stock.model_dump(by_alias=True))
            
            results["waiting_points_processed"] += 1
        except Exception as e:
            results["errors"].append(f"Bekleme noktası {wp_name}: {str(e)}")
    
    logger.info(f"Tüm lokasyon stokları oluşturuldu by {user.name}: {results}")
    
    return {
        "success": True,
        "message": f"{results['vehicles_processed']} araç, {results['waiting_points_processed']} bekleme noktası işlendi",
        **results
    }


@router.patch("/locations/{location_id}/count")
async def update_location_stock_count(location_id: str, request: Request):
    """Lokasyon stok sayımını güncelle"""
    user = await get_current_user(request)
    data = await request.json()
    
    location = await location_stocks_collection.find_one({"location_id": location_id})
    if not location:
        location = await location_stocks_collection.find_one({"_id": location_id})
    
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    # Gelen güncellemeleri uygula
    updates = data.get("items", [])  # [{name, current_quantity}, ...]
    
    items = location.get("items", [])
    update_map = {u["name"]: u["current_quantity"] for u in updates}
    
    for item in items:
        if item["name"] in update_map:
            item["current_quantity"] = update_map[item["name"]]
            item["last_counted_at"] = get_turkey_time().isoformat()
            item["last_counted_by"] = user.name
    
    await location_stocks_collection.update_one(
        {"_id": location["_id"]},
        {"$set": {
            "items": items,
            "updated_at": get_turkey_time()
        }}
    )
    
    return {"success": True, "message": "Stok sayımı güncellendi"}


@router.post("/locations/{location_id}/deduct")
async def deduct_from_location_stock(location_id: str, request: Request):
    """Lokasyon stoğundan düş (vaka kullanımı için)"""
    user = await get_current_user(request)
    data = await request.json()
    
    location = await location_stocks_collection.find_one({"location_id": location_id})
    if not location:
        location = await location_stocks_collection.find_one({"_id": location_id})
    
    if not location:
        raise HTTPException(status_code=404, detail="Lokasyon bulunamadı")
    
    # Düşülecek ürünler
    deductions = data.get("items", [])  # [{name, quantity}, ...]
    
    items = location.get("items", [])
    deduction_map = {d["name"]: d["quantity"] for d in deductions}
    
    for item in items:
        if item["name"] in deduction_map:
            new_qty = item["current_quantity"] - deduction_map[item["name"]]
            item["current_quantity"] = max(0, new_qty)  # Negatife düşmesin
    
    await location_stocks_collection.update_one(
        {"_id": location["_id"]},
        {"$set": {
            "items": items,
            "updated_at": get_turkey_time()
        }}
    )
    
    logger.info(f"Stok düşüldü: {location['location_name']} - {deductions} by {user.name}")
    
    return {"success": True, "message": "Stok güncellendi"}


# ============ STOK TALEPLERİ ============

@router.get("/requests")
async def get_stock_requests(
    request: Request,
    status: Optional[str] = None,
    target_location_id: Optional[str] = None
):
    """Stok taleplerini listele"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if target_location_id:
        query["target_location_id"] = target_location_id
    
    requests_list = await stock_requests_collection.find(query).sort("created_at", -1).to_list(500)
    
    for r in requests_list:
        r["id"] = r.pop("_id", r.get("id"))
    
    return {"requests": requests_list}


@router.get("/requests/{request_id}")
async def get_stock_request(request_id: str, request: Request):
    """Tek bir stok talebini getir"""
    await get_current_user(request)
    
    req = await stock_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    req["id"] = req.pop("_id", req.get("id"))
    return req


@router.post("/requests")
async def create_stock_request(data: StockRequestCreate, request: Request):
    """Yeni stok talebi oluştur"""
    user = await get_current_user(request)
    
    stock_request = StockRequest(
        requester_id=user.id,
        requester_name=user.name,
        target_location_id=data.target_location_id,
        target_location_type=data.target_location_type,
        target_location_name=data.target_location_name,
        items=data.items,
        related_case_id=data.related_case_id,
        related_case_no=data.related_case_no,
        requester_note=data.requester_note
    )
    
    await stock_requests_collection.insert_one(stock_request.model_dump(by_alias=True))
    
    logger.info(f"Stok talebi oluşturuldu: {stock_request.id} by {user.name}")
    
    return {
        "success": True,
        "message": "Stok talebi oluşturuldu",
        "request_id": stock_request.id
    }


@router.post("/requests/from-case/{case_id}")
async def create_request_from_case(case_id: str, request: Request):
    """Vakada kullanılan malzemelerden otomatik talep oluştur"""
    try:
        user = await get_current_user(request)
        
        # Request body'yi güvenli şekilde al
        try:
            data = await request.json()
        except:
            data = {}
        
        # Vaka bilgisini al
        cases_collection = db.cases
        case = await cases_collection.find_one({"_id": case_id})
        if not case:
            raise HTTPException(status_code=404, detail="Vaka bulunamadı")
        
        # Kullanılan ilaçları al
        medication_usage_collection = db.medication_usage
        usages = await medication_usage_collection.find({"case_id": case_id}).to_list(100)
        
        if not usages:
            raise HTTPException(status_code=400, detail="Bu vakada kullanılan malzeme bulunamadı")
        
        logger.info(f"Vakadan {len(usages)} kullanım kaydı bulundu: {case_id}")
        
        # Araç bilgisi
        vehicle_id = case.get("assigned_team", {}).get("vehicle_id") if case.get("assigned_team") else None
        vehicle = None
        if vehicle_id:
            vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
        
        target_location_id = vehicle_id or case_id
        target_location_type: str = "vehicle" if vehicle else "waiting_point"
        target_location_name = (vehicle.get("plate", "") if vehicle else "Bilinmeyen") or "Bilinmeyen"
        
        # Talep öğelerini oluştur
        items = []
        for usage in usages:
            try:
                item_name = usage.get("name") or usage.get("item_name") or "Bilinmeyen Malzeme"
                if not item_name or item_name.strip() == "":
                    logger.warning(f"İsimsiz kullanım kaydı atlandı: {usage}")
                    continue
                
                quantity = usage.get("quantity", 1)
                if isinstance(quantity, str):
                    quantity = int(quantity) if quantity.isdigit() else 1
                quantity = int(quantity) or 1
                
                items.append(StockRequestItem(
                    name=item_name,
                    quantity=quantity,
                    unit=usage.get("unit", "ADET"),
                    used_from=usage.get("source_type", "vehicle"),
                    used_from_name=usage.get("source_location_name") or usage.get("vehicle_plate") or ""
                ))
            except Exception as e:
                logger.error(f"Kullanım kaydı parse edilemedi: {usage}, hata: {str(e)}")
                continue
        
        if not items:
            raise HTTPException(status_code=400, detail="Geçerli malzeme bulunamadı")
        
        # Case number güvenli al
        case_number = case.get("case_number") or "Bilinmeyen"
        requester_note = data.get("note") or f"Vaka #{case_number} için otomatik talep"
        
        # StockRequest oluştur
        try:
            stock_request = StockRequest(
                requester_id=user.id,
                requester_name=user.name or "Bilinmeyen",
                target_location_id=target_location_id,
                target_location_type=target_location_type,  # type: ignore
                target_location_name=target_location_name,
                items=items,
                related_case_id=case_id,
                related_case_no=case_number,
                requester_note=requester_note
            )
        except Exception as e:
            logger.error(f"StockRequest oluşturulamadı: {str(e)}")
            logger.error(f"Data: target_location_id={target_location_id}, target_location_type={target_location_type}, target_location_name={target_location_name}")
            raise HTTPException(status_code=500, detail=f"Talep oluşturulamadı: {str(e)}")
        
        # MongoDB'ye kaydet
        try:
            request_dict = stock_request.model_dump(by_alias=True)
            await stock_requests_collection.insert_one(request_dict)
        except Exception as e:
            logger.error(f"MongoDB insert hatası: {str(e)}")
            logger.error(f"Request dict: {request_dict}")
            raise HTTPException(status_code=500, detail=f"Veritabanı hatası: {str(e)}")
        
        logger.info(f"Vakadan otomatik talep oluşturuldu: {case_id} by {user.name} ({len(items)} malzeme)")
        
        return {
            "success": True,
            "message": f"{len(items)} malzeme için talep oluşturuldu",
            "request_id": stock_request.id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vakadan talep oluşturma hatası: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Beklenmeyen hata: {str(e)}")


@router.patch("/requests/{request_id}/approve")
async def approve_stock_request(request_id: str, request: Request):
    """Stok talebini onayla"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    data = await request.json()
    
    req = await stock_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await stock_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "approved",
            "approved_at": get_turkey_time(),
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approver_note": data.get("note", "")
        }}
    )
    
    logger.info(f"Stok talebi onaylandı: {request_id} by {user.name}")
    
    return {"success": True, "message": "Talep onaylandı"}


@router.patch("/requests/{request_id}/reject")
async def reject_stock_request(request_id: str, request: Request):
    """Stok talebini reddet"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    data = await request.json()
    
    req = await stock_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    await stock_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "rejected",
            "rejected_at": get_turkey_time(),
            "rejected_by": user.id,
            "rejected_by_name": user.name,
            "approver_note": data.get("note", "")
        }}
    )
    
    logger.info(f"Stok talebi reddedildi: {request_id} by {user.name}")
    
    return {"success": True, "message": "Talep reddedildi"}


@router.patch("/requests/{request_id}/deliver")
async def deliver_stock_request(request_id: str, request: Request):
    """Stok talebini teslim edildi olarak işaretle ve lokasyon stoğunu güncelle"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire"])(request)
    
    req = await stock_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "approved":
        raise HTTPException(status_code=400, detail="Sadece onaylanmış talepler teslim edilebilir")
    
    # Talep durumunu güncelle
    await stock_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "delivered",
            "delivered_at": get_turkey_time(),
            "delivered_by": user.id,
            "delivered_by_name": user.name
        }}
    )
    
    # Lokasyon stoğunu güncelle (ürünleri ekle)
    target_id = req["target_location_id"]
    location = await location_stocks_collection.find_one({"location_id": target_id})
    
    if location:
        items = location.get("items", [])
        item_map = {i["name"]: i for i in items}
        
        for req_item in req.get("items", []):
            name = req_item["name"]
            qty = req_item["quantity"]
            
            if name in item_map:
                # Mevcut ürünü güncelle - item_map referansı items listesindeki objeyi gösteriyor
                item_map[name]["current_quantity"] += qty
            else:
                # Yeni ürün ekle
                new_item = {
                    "name": name,
                    "current_quantity": qty,
                    "min_quantity": qty,
                    "unit": req_item.get("unit", "ADET"),
                    "category": req_item.get("category", "sarf")
                }
                items.append(new_item)
                item_map[name] = new_item  # Map'e de ekle
        
        # Items listesi zaten güncellenmiş (item_map referansları sayesinde)
        await location_stocks_collection.update_one(
            {"_id": location["_id"]},
            {"$set": {"items": items, "updated_at": get_turkey_time()}}
        )
    
    logger.info(f"Stok talebi teslim edildi: {request_id} by {user.name}")
    
    return {"success": True, "message": "Talep teslim edildi ve stok güncellendi"}


# ============ MY STOCK (Kendi Lokasyonumun Stoğu) ============

@router.get("/my-stock")
async def get_my_location_stock(request: Request):
    """Kullanıcının atanmış olduğu lokasyonun stoğunu getir"""
    user = await get_current_user(request)
    
    # Bugünkü vardiya atamasını bul
    shifts_collection = db.shifts
    today = get_turkey_time().replace(hour=0, minute=0, second=0, microsecond=0)
    
    shift = await shifts_collection.find_one({
        "date": {"$gte": today},
        "assignments": {
            "$elemMatch": {"user_id": user.id}
        }
    })
    
    if not shift:
        return {"location": None, "items": [], "message": "Bugün için atama bulunamadı"}
    
    # Kullanıcının atamasını bul
    assignment = None
    for a in shift.get("assignments", []):
        if a.get("user_id") == user.id:
            assignment = a
            break
    
    if not assignment:
        return {"location": None, "items": [], "message": "Atama bulunamadı"}
    
    vehicle_id = assignment.get("vehicle_id")
    location_id = assignment.get("location_id")
    
    target_id = vehicle_id or location_id
    if not target_id:
        return {"location": None, "items": [], "message": "Lokasyon bilgisi yok"}
    
    # Lokasyon stoğunu getir
    location = await location_stocks_collection.find_one({"location_id": target_id})
    if not location:
        location = await location_stocks_collection.find_one({"_id": target_id})
    
    if not location:
        return {"location": None, "items": [], "message": "Bu lokasyon için stok kaydı yok"}
    
    location["id"] = location.pop("_id", location.get("id"))
    
    return {
        "location": {
            "id": location["id"],
            "name": location.get("location_name"),
            "type": location.get("location_type")
        },
        "items": location.get("items", []),
        "last_sync": location.get("last_sync_at")
    }

