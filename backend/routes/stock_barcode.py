"""
Karekod Bazlı Stok Yönetimi API
================================
Her karekod = 1 adet benzersiz stok girişi
Vaka bazlı ilaç kullanımı ve stoktan düşme
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

import json
import os

from database import (
    db,
    stock_collection,
    stock_usage_logs_collection,
    medication_usage_collection,
    cases_collection,
    vehicles_collection
)
from auth_utils import get_current_user, require_roles
from services.its_service import parse_datamatrix, get_its_service

# İlaç barkod veritabanını yükle
MEDICATIONS_BARCODE_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'medications_barcode.json')
_medications_cache = None

def get_medications_barcode_db():
    """İlaç barkod veritabanını lazy load et"""
    global _medications_cache
    if _medications_cache is None:
        try:
            with open(MEDICATIONS_BARCODE_FILE, 'r', encoding='utf-8') as f:
                _medications_cache = json.load(f)
            print(f"[INFO] Loaded {len(_medications_cache)} medications from barcode database")
        except Exception as e:
            print(f"[ERROR] Could not load medications barcode database: {e}")
            _medications_cache = {}
    return _medications_cache

router = APIRouter()

# MongoDB collections
barcode_stock_collection = db["barcode_stock"]  # Benzersiz karekod bazlı stok


# ============================================================================
# MODELS
# ============================================================================

class BarcodeStockItem(BaseModel):
    """Her karekod için benzersiz stok kaydı"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id")
    gtin: str
    serial_number: str  # Benzersiz seri numarası
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    expiry_date_str: Optional[str] = None  # Original format (YYMMDD)
    name: str
    manufacturer_name: Optional[str] = None
    
    # Lokasyon bilgileri
    location: str  # ambulans, saha_ofis, acil_canta, merkez_depo
    location_detail: Optional[str] = None  # Araç plakası veya detay
    
    # Durum
    status: str = "available"  # available, used, returned, expired
    
    # İzleme
    added_at: datetime = Field(default_factory=datetime.utcnow)
    added_by: Optional[str] = None
    added_by_name: Optional[str] = None
    
    # Kullanım bilgisi (eğer kullanıldıysa)
    used_at: Optional[datetime] = None
    used_in_case_id: Optional[str] = None
    used_by: Optional[str] = None
    used_by_name: Optional[str] = None
    
    # Ham karekod verisi
    raw_barcode: str


class AddStockByBarcodeRequest(BaseModel):
    """Karekod ile stok ekleme isteği"""
    barcode: str
    location: str
    location_detail: Optional[str] = None
    # Opsiyonel - ITS'de bulunamazsa kullanılır
    name: Optional[str] = None


class DeductStockByBarcodeRequest(BaseModel):
    """Karekod ile stoktan düşme isteği"""
    barcode: str
    case_id: str
    vehicle_plate: Optional[str] = None


class CaseMedicationByBarcodeRequest(BaseModel):
    """Vakaya karekod ile ilaç ekleme isteği"""
    gtin: Optional[str] = None
    serial_number: str
    lot_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    name: str
    quantity: int = 1
    vehicle_plate: Optional[str] = None


# ============================================================================
# KAREKOD İLE STOK GİRİŞİ
# ============================================================================

@router.post("/add")
async def add_stock_by_barcode(request: Request):
    """
    Karekod okutarak stoğa ekle
    Her karekod benzersiz bir stok kaydı oluşturur (1 adet)
    """
    await require_roles(["operasyon_muduru", "merkez_ofis", "att", "paramedik", "hemsire", "bas_sofor"])(request)
    user = await get_current_user(request)
    
    body = await request.json()
    barcode = body.get("barcode", "")
    location = body.get("location", "merkez_depo")
    location_detail = body.get("location_detail")
    manual_name = body.get("name")
    
    if not barcode:
        raise HTTPException(status_code=400, detail="Karekod verisi gerekli")
    
    # Karekodu parse et
    parsed = parse_datamatrix(barcode)
    
    # Log parsed data for debugging
    import logging
    logging.info(f"Parsed barcode: {parsed}")
    
    # Eğer hiçbir şey parse edilemezse, ham veriyi seri numarası olarak kullan
    if not parsed.get("serial_number") and not parsed.get("gtin"):
        # Ham veriyi seri numarası olarak ata (benzersiz olması için)
        parsed["serial_number"] = f"RAW-{barcode[:20] if len(barcode) > 20 else barcode}"
        logging.warning(f"Could not parse barcode, using raw as serial: {parsed['serial_number']}")
    
    # Bu seri numarası zaten kayıtlı mı kontrol et
    serial = parsed.get("serial_number") or f"UNKNOWN-{uuid.uuid4().hex[:8]}"
    existing = await barcode_stock_collection.find_one({
        "serial_number": serial,
        "gtin": parsed.get("gtin")
    })
    
    if existing:
        # Durum kontrolü
        if existing.get("status") == "available":
            raise HTTPException(
                status_code=400, 
                detail=f"Bu ilaç zaten stokta mevcut. Lokasyon: {existing.get('location')} - {existing.get('location_detail', '')}"
            )
        elif existing.get("status") == "used":
            raise HTTPException(
                status_code=400, 
                detail=f"Bu ilaç daha önce kullanılmış. Vaka: {existing.get('used_in_case_id')}"
            )
    
    # İlaç adını bul
    drug_name = manual_name
    manufacturer_name = None
    
    if parsed.get("gtin"):
        gtin = parsed["gtin"]
        
        # 1. Veritabanından ilaç bilgisi al
        its_drug = await db["its_drugs"].find_one({"gtin": gtin})
        if its_drug:
            drug_name = its_drug.get("name", drug_name)
            manufacturer_name = its_drug.get("manufacturer_name")
            logging.info(f"Drug found in DB: {drug_name}")
        
        # 2. Veritabanında yoksa ITS cache'den dene
        if not drug_name:
            service = get_its_service()
            cached = service.get_drug_by_gtin(gtin)
            if cached:
                drug_name = cached.get("name", drug_name)
                manufacturer_name = cached.get("manufacturer_name")
                logging.info(f"Drug found in ITS cache: {drug_name}")
        
        # 3. Hala bulamadıysak, ITS API'dan çekmeyi dene
        if not drug_name and service.username:
            try:
                # Token al ve API'dan ilaç listesini çek
                token = await service.get_token()
                if token:
                    drugs = await service.fetch_drug_list(get_all=False)
                    # Yeni çekilen listede GTIN'i ara
                    for drug in drugs:
                        if drug.get("gtin") == gtin:
                            drug_name = drug.get("drugName") or drug.get("name")
                            manufacturer_name = drug.get("manufacturerName")
                            
                            # Veritabanına kaydet
                            await db["its_drugs"].update_one(
                                {"gtin": gtin},
                                {"$set": {
                                    "gtin": gtin,
                                    "name": drug_name,
                                    "manufacturer_name": manufacturer_name,
                                    "manufacturer_gln": drug.get("manufacturerGLN", ""),
                                    "is_active": True
                                }},
                                upsert=True
                            )
                            logging.info(f"Drug fetched from ITS API: {drug_name}")
                            break
            except Exception as e:
                logging.warning(f"Could not fetch drug from ITS API: {e}")
    
    if not drug_name:
        # İlaç adı bulunamadıysa GTIN veya varsayılan ad kullan
        if parsed.get("gtin"):
            # GTIN'den okunabilir bir ad oluştur
            gtin = parsed["gtin"]
            drug_name = f"İlaç #{gtin[-6:]}"  # Son 6 hane
        else:
            drug_name = f"Ürün #{serial[-8:]}"  # Son 8 karakter
        logging.warning(f"Drug name not found, using default: {drug_name}")
    
    # Expiry date parse - artık YYYY-MM-DD formatında geliyor
    expiry_date = None
    if parsed.get("expiry_date"):
        try:
            exp_str = parsed["expiry_date"]
            # Eğer YYYY-MM-DD formatındaysa
            if '-' in exp_str:
                parts = exp_str.split('-')
                expiry_date = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
            # Eğer YYMMDD formatındaysa (eski format)
            elif len(exp_str) == 6:
                year = int(exp_str[0:2])
                month = int(exp_str[2:4])
                day = int(exp_str[4:6])
                
                if year < 70:
                    year += 2000
                else:
                    year += 1900
                
                if day == 0:
                    day = 28
                
                expiry_date = datetime(year, month, day)
        except Exception as e:
            logging.warning(f"Could not parse expiry date: {parsed.get('expiry_date')} - {e}")
    
    # Yeni karekod stok kaydı oluştur
    stock_item = BarcodeStockItem(
        gtin=parsed.get("gtin", ""),
        serial_number=serial,
        lot_number=parsed.get("lot_number"),
        expiry_date=expiry_date,
        expiry_date_str=parsed.get("expiry_date"),
        name=drug_name,
        manufacturer_name=manufacturer_name,
        location=location,
        location_detail=location_detail,
        status="available",
        added_by=user.id,
        added_by_name=user.name,
        raw_barcode=barcode
    )
    
    await barcode_stock_collection.insert_one(stock_item.model_dump(by_alias=True))
    
    # ANA STOK COLLECTION'INA DA EKLE (Stok Yönetimi sayfasında görünmesi için)
    main_stock_item = {
        "_id": str(uuid.uuid4()),
        "name": drug_name,
        "code": parsed.get("gtin", "")[:8] if parsed.get("gtin") else serial[:8],
        "gtin": parsed.get("gtin"),
        "quantity": 1,  # Her karekod 1 adet
        "min_quantity": 1,
        "location": location,
        "location_detail": location_detail,
        "lot_number": parsed.get("lot_number"),
        "serial_number": serial,
        "expiry_date": expiry_date,
        "qr_code": stock_item.id,  # Karekod stok ID'si ile bağla
        "unit": "adet",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "barcode_stock_id": stock_item.id  # Karekod stoğu ile ilişkilendir
    }
    
    await stock_collection.insert_one(main_stock_item)
    logging.info(f"Stock item added to main collection: {main_stock_item['_id']}")
    
    return {
        "message": f"{drug_name} stoğa eklendi",
        "stock_item": stock_item.model_dump(),
        "main_stock_id": main_stock_item["_id"],
        "parsed": parsed
    }


@router.get("/details/{barcode}")
async def get_barcode_details(barcode: str, request: Request):
    """
    Karekod bilgilerini getir
    """
    await get_current_user(request)
    
    # Parse et
    parsed = parse_datamatrix(barcode)
    
    result = {
        "parsed": parsed,
        "drug": None,
        "stock_item": None,
        "in_stock": False
    }
    
    # İlaç bilgisi
    if parsed.get("gtin"):
        drug = await db["its_drugs"].find_one({"gtin": parsed["gtin"]})
        if drug:
            drug["id"] = str(drug.pop("_id"))
            result["drug"] = drug
    
    # Stokta var mı?
    if parsed.get("serial_number"):
        stock = await barcode_stock_collection.find_one({
            "serial_number": parsed["serial_number"],
            "status": "available"
        })
        if stock:
            stock["id"] = stock.pop("_id")
            result["stock_item"] = stock
            result["in_stock"] = True
    
    return result


# ============================================================================
# KAREKOD İLE STOKTAN DÜŞME (VAKA İÇİN)
# ============================================================================

@router.post("/deduct")
async def deduct_stock_by_barcode(request: Request):
    """
    Karekod okutarak stoktan düş
    Vaka için ilaç kullanımı kaydeder
    """
    await require_roles(["att", "paramedik", "hemsire", "doktor"])(request)
    user = await get_current_user(request)
    
    body = await request.json()
    barcode = body.get("barcode", "")
    case_id = body.get("case_id")
    vehicle_plate = body.get("vehicle_plate")
    
    if not barcode:
        raise HTTPException(status_code=400, detail="Karekod verisi gerekli")
    
    if not case_id:
        raise HTTPException(status_code=400, detail="Vaka ID gerekli")
    
    # Vaka kontrolü
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Karekodu parse et
    parsed = parse_datamatrix(barcode)
    
    if not parsed.get("serial_number"):
        raise HTTPException(
            status_code=400, 
            detail="Karekodda seri numarası bulunamadı"
        )
    
    # Stokta bu ilacı bul
    query = {
        "serial_number": parsed["serial_number"],
        "status": "available"
    }
    
    if parsed.get("gtin"):
        query["gtin"] = parsed["gtin"]
    
    # Lokasyon filtresi (önce araç stoğuna bak)
    if vehicle_plate:
        query_with_vehicle = {**query, "location": "ambulans", "location_detail": vehicle_plate}
        stock_item = await barcode_stock_collection.find_one(query_with_vehicle)
        
        if not stock_item:
            # Araçta yoksa tüm stokta ara
            stock_item = await barcode_stock_collection.find_one(query)
    else:
        stock_item = await barcode_stock_collection.find_one(query)
    
    if not stock_item:
        raise HTTPException(
            status_code=404, 
            detail="Bu ilaç stokta bulunamadı veya zaten kullanılmış"
        )
    
    # Stok kaydını güncelle
    await barcode_stock_collection.update_one(
        {"_id": stock_item["_id"]},
        {"$set": {
            "status": "used",
            "used_at": datetime.utcnow(),
            "used_in_case_id": case_id,
            "used_by": user.id,
            "used_by_name": user.name
        }}
    )
    
    # Medication usage kaydı oluştur
    medication_record = {
        "_id": str(uuid.uuid4()),
        "case_id": case_id,
        "barcode_stock_id": stock_item["_id"],
        "gtin": stock_item.get("gtin"),
        "serial_number": stock_item.get("serial_number"),
        "lot_number": stock_item.get("lot_number"),
        "expiry_date": stock_item.get("expiry_date"),
        "name": stock_item.get("name"),
        "quantity": 1,  # Her karekod = 1 adet
        "unit": "adet",
        "added_by": user.id,
        "added_by_name": user.name,
        "added_at": datetime.utcnow(),
        "vehicle_plate": vehicle_plate or stock_item.get("location_detail"),
        "stock_deducted": True,
        "raw_barcode": barcode
    }
    
    await medication_usage_collection.insert_one(medication_record)
    
    # Log kaydı
    log = {
        "_id": str(uuid.uuid4()),
        "barcode_stock_id": stock_item["_id"],
        "case_id": case_id,
        "action": "kullanim",
        "quantity_change": -1,
        "reason": f"Vaka kullanımı: {case_doc.get('case_number', case_id)}",
        "performed_by": user.id,
        "performed_by_name": user.name,
        "created_at": datetime.utcnow()
    }
    await stock_usage_logs_collection.insert_one(log)
    
    return {
        "message": f"{stock_item.get('name')} stoktan düşüldü ve vakaya eklendi",
        "medication": medication_record,
        "stock_item_id": stock_item["_id"]
    }


# ============================================================================
# VAKADAN İLAÇ ÇIKARMA (STOK İADESİ)
# ============================================================================

@router.post("/return")
async def return_stock_by_barcode(request: Request):
    """
    Vakadan ilaç çıkar ve stoğa iade et
    """
    await require_roles(["att", "paramedik", "hemsire", "doktor"])(request)
    user = await get_current_user(request)
    
    body = await request.json()
    case_id = body.get("case_id")
    serial_number = body.get("serial_number")
    medication_id = body.get("medication_id")
    
    if not case_id:
        raise HTTPException(status_code=400, detail="Vaka ID gerekli")
    
    if not serial_number and not medication_id:
        raise HTTPException(status_code=400, detail="Seri numarası veya ilaç ID gerekli")
    
    # Medication kaydını bul
    query = {"case_id": case_id}
    if medication_id:
        query["_id"] = medication_id
    if serial_number:
        query["serial_number"] = serial_number
    
    medication = await medication_usage_collection.find_one(query)
    
    if not medication:
        raise HTTPException(status_code=404, detail="İlaç kaydı bulunamadı")
    
    # Barcode stok kaydını güncelle (eğer varsa)
    if medication.get("barcode_stock_id"):
        await barcode_stock_collection.update_one(
            {"_id": medication["barcode_stock_id"]},
            {"$set": {
                "status": "available",
                "used_at": None,
                "used_in_case_id": None,
                "used_by": None,
                "used_by_name": None
            }}
        )
        
        # Log kaydı
        log = {
            "_id": str(uuid.uuid4()),
            "barcode_stock_id": medication["barcode_stock_id"],
            "case_id": case_id,
            "action": "iade",
            "quantity_change": 1,
            "reason": f"Vaka iadesi - {user.name}",
            "performed_by": user.id,
            "performed_by_name": user.name,
            "created_at": datetime.utcnow()
        }
        await stock_usage_logs_collection.insert_one(log)
    
    # Medication kaydını sil
    await medication_usage_collection.delete_one({"_id": medication["_id"]})
    
    return {
        "message": "İlaç vakadan çıkarıldı ve stoğa iade edildi",
        "returned_item": medication.get("name")
    }


# ============================================================================
# STOK SORGULAMA
# ============================================================================

@router.get("/inventory")
async def get_barcode_inventory(
    request: Request,
    location: Optional[str] = None,
    location_detail: Optional[str] = None,
    status: str = "available",
    search: Optional[str] = None
):
    """
    Karekod bazlı stok envanterini getir
    """
    await get_current_user(request)
    
    query = {"status": status}
    
    if location:
        query["location"] = location
    
    if location_detail:
        query["location_detail"] = location_detail
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"gtin": {"$regex": search, "$options": "i"}},
            {"serial_number": {"$regex": search, "$options": "i"}}
        ]
    
    items = await barcode_stock_collection.find(query).sort("added_at", -1).to_list(500)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    # Özet bilgiler
    summary = await barcode_stock_collection.aggregate([
        {"$match": {"status": "available"}},
        {"$group": {
            "_id": "$name",
            "count": {"$sum": 1},
            "earliest_expiry": {"$min": "$expiry_date"}
        }},
        {"$sort": {"count": -1}}
    ]).to_list(100)
    
    return {
        "items": items,
        "total": len(items),
        "summary": summary
    }


@router.get("/inventory/by-location")
async def get_inventory_by_location(request: Request):
    """
    Lokasyon bazlı stok özeti
    """
    await get_current_user(request)
    
    pipeline = [
        {"$match": {"status": "available"}},
        {"$group": {
            "_id": {
                "location": "$location",
                "location_detail": "$location_detail"
            },
            "count": {"$sum": 1},
            "items": {"$push": "$name"}
        }},
        {"$sort": {"count": -1}}
    ]
    
    results = await barcode_stock_collection.aggregate(pipeline).to_list(100)
    
    return {"locations": results}


@router.get("/inventory/grouped")
async def get_grouped_inventory(
    request: Request,
    location: Optional[str] = None,
    search: Optional[str] = None
):
    """
    İlaç adına göre gruplandırılmış stok envanteri
    Her ilaç için toplam adet ve detaylı QR kodları döndürür
    """
    await get_current_user(request)
    
    match_query = {"status": "available"}
    
    if location:
        match_query["location"] = location
    
    if search:
        match_query["name"] = {"$regex": search, "$options": "i"}
    
    # İlaçları grupla
    pipeline = [
        {"$match": match_query},
        {"$sort": {"expiry_date": 1}},  # En yakın SKT önce
        {"$group": {
            "_id": "$name",
            "count": {"$sum": 1},
            "gtin": {"$first": "$gtin"},
            "manufacturer_name": {"$first": "$manufacturer_name"},
            "earliest_expiry": {"$min": "$expiry_date"},
            "latest_expiry": {"$max": "$expiry_date"},
            "locations": {"$addToSet": "$location"},
            "items": {"$push": {
                "id": "$_id",
                "serial_number": "$serial_number",
                "lot_number": "$lot_number",
                "expiry_date": "$expiry_date",
                "expiry_date_str": "$expiry_date_str",
                "location": "$location",
                "location_detail": "$location_detail",
                "added_at": "$added_at",
                "raw_barcode": "$raw_barcode"
            }}
        }},
        {"$sort": {"count": -1, "_id": 1}}
    ]
    
    groups = await barcode_stock_collection.aggregate(pipeline).to_list(500)
    
    # Format sonuçları
    result = []
    total_items = 0
    
    for group in groups:
        total_items += group["count"]
        result.append({
            "name": group["_id"],
            "count": group["count"],
            "gtin": group.get("gtin"),
            "manufacturer_name": group.get("manufacturer_name"),
            "earliest_expiry": group.get("earliest_expiry"),
            "latest_expiry": group.get("latest_expiry"),
            "locations": group.get("locations", []),
            "items": group.get("items", [])
        })
    
    return {
        "groups": result,
        "total_groups": len(result),
        "total_items": total_items
    }


@router.get("/inventory/item-details/{item_name}")
async def get_item_qr_details(
    item_name: str,
    request: Request,
    location: Optional[str] = None
):
    """
    Belirli bir ilacın tüm QR kodlarını ve detaylarını getir
    """
    await get_current_user(request)
    
    from urllib.parse import unquote
    decoded_name = unquote(item_name)
    
    query = {
        "name": decoded_name,
        "status": "available"
    }
    
    if location:
        query["location"] = location
    
    items = await barcode_stock_collection.find(query).sort("expiry_date", 1).to_list(500)
    
    for item in items:
        item["id"] = item.pop("_id")
        if item.get("expiry_date"):
            days_left = (item["expiry_date"] - datetime.utcnow()).days
            item["days_until_expiry"] = days_left
            item["is_expired"] = days_left < 0
            item["is_expiring_soon"] = 0 <= days_left <= 30
    
    return {
        "item_name": decoded_name,
        "count": len(items),
        "items": items
    }


@router.get("/expiring")
async def get_expiring_items(request: Request, days: int = 30):
    """
    Yakında son kullanma tarihi geçecek ilaçları getir
    """
    await get_current_user(request)
    
    from datetime import timedelta
    
    cutoff_date = datetime.utcnow() + timedelta(days=days)
    
    items = await barcode_stock_collection.find({
        "status": "available",
        "expiry_date": {"$lte": cutoff_date, "$ne": None}
    }).sort("expiry_date", 1).to_list(100)
    
    for item in items:
        item["id"] = item.pop("_id")
        if item.get("expiry_date"):
            days_left = (item["expiry_date"] - datetime.utcnow()).days
            item["days_until_expiry"] = max(0, days_left)
    
    return {"expiring_items": items, "count": len(items)}


# ============================================================================
# BARKOD İLE İLAÇ ADI SORGULAMA (TİTCK VERİTABANI)
# ============================================================================

@router.get("/lookup-barcode/{barcode}")
async def lookup_medication_by_barcode(barcode: str, request: Request):
    """
    Barkod ile ilaç adını TİTCK veritabanından sorgula
    22,000+ ruhsatlı beşeri tıbbi ürün
    """
    await get_current_user(request)
    
    # Barkodu temizle (boşluk, tire vb. kaldır)
    barcode = barcode.strip().replace("-", "").replace(" ", "")
    
    # Veritabanından ara
    medications_db = get_medications_barcode_db()
    
    # Direkt eşleşme
    if barcode in medications_db:
        return {
            "found": True,
            "barcode": barcode,
            "name": medications_db[barcode],
            "source": "titck_database"
        }
    
    # GTIN formatında olabilir (01 prefix'i ile başlıyorsa)
    if barcode.startswith("01") and len(barcode) >= 16:
        gtin = barcode[2:16]  # 01 + 14 haneli GTIN
        if gtin in medications_db:
            return {
                "found": True,
                "barcode": gtin,
                "name": medications_db[gtin],
                "source": "titck_database"
            }
    
    # Son 13 haneyi dene (EAN-13 formatı)
    if len(barcode) > 13:
        ean13 = barcode[-13:]
        if ean13 in medications_db:
            return {
                "found": True,
                "barcode": ean13,
                "name": medications_db[ean13],
                "source": "titck_database"
            }
    
    return {
        "found": False,
        "barcode": barcode,
        "name": None,
        "source": "titck_database",
        "message": "Barkod veritabanında bulunamadı. Manuel isim girişi yapabilirsiniz."
    }


@router.post("/lookup-barcode")
async def lookup_medication_by_barcode_post(request: Request):
    """
    Barkod ile ilaç adını TİTCK veritabanından sorgula (POST)
    Datamatrix karekodları için tam veriyi parse eder
    """
    await get_current_user(request)
    
    body = await request.json()
    barcode = body.get("barcode", "").strip()
    
    if not barcode:
        raise HTTPException(status_code=400, detail="Barkod verisi gerekli")
    
    # Datamatrix ise parse et
    parsed = parse_datamatrix(barcode)
    
    # GTIN'i bul
    gtin = parsed.get("gtin", "")
    
    medications_db = get_medications_barcode_db()
    
    # GTIN ile ara
    name = None
    if gtin and gtin in medications_db:
        name = medications_db[gtin]
    
    # Bulunamazsa ham barkodu dene
    if not name:
        clean_barcode = barcode.strip().replace("-", "").replace(" ", "")
        
        # EAN-13 formatı (13 haneli barkod içinde arama)
        for potential_barcode in [clean_barcode, clean_barcode[-13:] if len(clean_barcode) > 13 else None]:
            if potential_barcode and potential_barcode in medications_db:
                name = medications_db[potential_barcode]
                gtin = potential_barcode
                break
    
    return {
        "found": name is not None,
        "barcode": barcode,
        "gtin": gtin,
        "name": name,
        "parsed": parsed,
        "source": "titck_database",
        "message": "Manuel isim girişi yapabilirsiniz." if not name else None
    }


@router.get("/search-medications")
async def search_medications(request: Request, q: str = ""):
    """
    İlaç adı ile arama (autocomplete için)
    """
    await get_current_user(request)
    
    if len(q) < 2:
        return {"results": [], "count": 0}
    
    medications_db = get_medications_barcode_db()
    q_lower = q.lower()
    
    results = []
    for barcode, name in medications_db.items():
        if q_lower in name.lower():
            results.append({"barcode": barcode, "name": name})
            if len(results) >= 20:  # Limit sonuç sayısı
                break
    
    return {"results": results, "count": len(results)}


# ============================================================================
# OTOMATİK STOK LOKASYONU SENKRONİZASYONU
# ============================================================================

stock_locations_collection = db["stock_locations"]

@router.post("/sync-vehicle-locations")
async def sync_vehicle_stock_locations(request: Request):
    """
    Tüm araçlar ve HEALMEDY lokasyonları için otomatik stok lokasyonu oluştur
    - Her araç için bir lokasyon (plaka bazlı)
    - Her HEALMEDY lokasyonu için bir bekleme noktası (Osman Gazi/FPU, Green Zone/Rönesans vb.)
    - Merkez Depo lokasyonu
    """
    from models import HEALMEDY_LOCATIONS
    
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi"])(request)
    
    created_count = 0
    existing_count = 0
    
    # 1. HEALMEDY Lokasyonları (bekleme noktaları)
    for loc in HEALMEDY_LOCATIONS:
        loc_id = loc["id"]
        loc_name = loc["name"]
        
        existing_loc = await stock_locations_collection.find_one({
            "healmedy_location_id": loc_id,
            "type": "waiting_point"
        })
        
        if not existing_loc:
            new_loc = {
                "_id": str(uuid.uuid4()),
                "name": loc_name,
                "type": "waiting_point",
                "healmedy_location_id": loc_id,
                "description": f"{loc_name} bekleme noktası stoğu",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "created_by": user.id,
                "auto_created": True
            }
            await stock_locations_collection.insert_one(new_loc)
            created_count += 1
        else:
            # Eğer varsa ismi güncelle
            if existing_loc.get("name") != loc_name:
                await stock_locations_collection.update_one(
                    {"_id": existing_loc["_id"]},
                    {"$set": {"name": loc_name}}
                )
            existing_count += 1
    
    # 2. Araç lokasyonları
    vehicles = await vehicles_collection.find({"status": {"$ne": "pasif"}}).to_list(100)
    
    for vehicle in vehicles:
        plate = vehicle.get("plate")
        vehicle_id = vehicle.get("_id")
        
        # Araç lokasyonu
        existing_vehicle_loc = await stock_locations_collection.find_one({
            "vehicle_id": vehicle_id,
            "type": "vehicle"
        })
        
        if not existing_vehicle_loc:
            new_loc = {
                "_id": str(uuid.uuid4()),
                "name": plate,
                "type": "vehicle",
                "vehicle_id": vehicle_id,
                "vehicle_plate": plate,
                "description": f"{plate} plakalı araç stoğu",
                "is_active": True,
                "created_at": datetime.utcnow(),
                "created_by": user.id,
                "auto_created": True
            }
            await stock_locations_collection.insert_one(new_loc)
            created_count += 1
        else:
            existing_count += 1
    
    # 3. Merkez Depo lokasyonu
    merkez_depo = await stock_locations_collection.find_one({
        "name": "Merkez Depo",
        "type": "warehouse"
    })
    
    if not merkez_depo:
        new_loc = {
            "_id": str(uuid.uuid4()),
            "name": "Merkez Depo",
            "type": "warehouse",
            "description": "Ana stok deposu",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "created_by": user.id,
            "auto_created": True
        }
        await stock_locations_collection.insert_one(new_loc)
        created_count += 1
    else:
        existing_count += 1
    
    # 4. Acil Çanta lokasyonu
    acil_canta = await stock_locations_collection.find_one({
        "name": "Acil Çanta",
        "type": "emergency_bag"
    })
    
    if not acil_canta:
        new_loc = {
            "_id": str(uuid.uuid4()),
            "name": "Acil Çanta",
            "type": "emergency_bag",
            "description": "Portatif acil çanta stoğu",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "created_by": user.id,
            "auto_created": True
        }
        await stock_locations_collection.insert_one(new_loc)
        created_count += 1
    else:
        existing_count += 1
    
    import logging
    logging.info(f"Stock locations synced: {created_count} created, {existing_count} existing")
    
    return {
        "message": f"{created_count} yeni lokasyon oluşturuldu, {existing_count} lokasyon zaten mevcut",
        "created": created_count,
        "existing": existing_count,
        "total_vehicles": len(vehicles),
        "healmedy_locations": [loc["name"] for loc in HEALMEDY_LOCATIONS]
    }


@router.get("/stock-locations")
async def get_stock_locations(request: Request, type: Optional[str] = None):
    """Tüm stok lokasyonlarını getir"""
    await get_current_user(request)
    
    query = {"is_active": True}
    if type:
        query["type"] = type
    
    locations = await stock_locations_collection.find(query).sort("name", 1).to_list(500)
    
    for loc in locations:
        loc["id"] = loc.pop("_id")
    
    return {"locations": locations, "count": len(locations)}


@router.delete("/stock-locations/cleanup-old")
async def cleanup_old_stock_locations(request: Request):
    """
    Eski 'PLAKA Bekleme Noktası' formatındaki lokasyonları temizle
    Sadece içinde stok olmayan lokasyonları siler
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    import logging
    
    # Eski format lokasyonları bul (Bekleme Noktası içeren)
    old_locations = await stock_locations_collection.find({
        "name": {"$regex": "Bekleme Noktası", "$options": "i"}
    }).to_list(500)
    
    deleted_count = 0
    skipped_count = 0
    
    for loc in old_locations:
        loc_id = loc["_id"]
        loc_name = loc["name"]
        
        # Bu lokasyonda stok var mı kontrol et
        stock_in_location = await stock_collection.find_one({
            "$or": [
                {"location": loc_name},
                {"location": loc_id}
            ]
        })
        
        barcode_stock_in_location = await barcode_stock_collection.find_one({
            "$or": [
                {"location": loc_name},
                {"location": loc_id}
            ],
            "status": "available"
        })
        
        if stock_in_location or barcode_stock_in_location:
            # Stok var, silme
            skipped_count += 1
            logging.info(f"Skipped location {loc_name} - has stock")
        else:
            # Stok yok, sil
            await stock_locations_collection.delete_one({"_id": loc_id})
            deleted_count += 1
            logging.info(f"Deleted old location: {loc_name}")
    
    return {
        "message": f"{deleted_count} eski lokasyon silindi, {skipped_count} lokasyon stok içerdiği için atlandı",
        "deleted": deleted_count,
        "skipped": skipped_count
    }


# ============================================================================
# STOK PARÇALAMA (QR -> Adet Dönüşümü)
# ============================================================================

class SplitStockRequest(BaseModel):
    """Stok parçalama isteği"""
    barcode_stock_id: str  # Parçalanacak karekod stok ID'si
    target_location: str  # Hedef lokasyon adı
    quantity_in_package: int  # Paketteki adet sayısı
    notes: Optional[str] = None


@router.post("/split")
async def split_barcode_stock(request: Request):
    """
    Karekod bazlı stoğu parçala ve adet bazlı stoğa dönüştür
    - QR kodlu tek kutu → Adet bazlı stok
    - Orijinal QR kodu sistemden düşer
    - Kutu içindeki adet sayısı belirtilir
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi", "hemsire"])(request)
    
    body = await request.json()
    barcode_stock_id = body.get("barcode_stock_id")
    target_location = body.get("target_location")
    quantity_in_package = body.get("quantity_in_package", 1)
    notes = body.get("notes", "")
    
    if not barcode_stock_id or not target_location:
        raise HTTPException(status_code=400, detail="barcode_stock_id ve target_location gerekli")
    
    if quantity_in_package < 1:
        raise HTTPException(status_code=400, detail="Adet sayısı en az 1 olmalı")
    
    # Karekod stoğu bul
    barcode_item = await barcode_stock_collection.find_one({
        "_id": barcode_stock_id,
        "status": "available"
    })
    
    if not barcode_item:
        raise HTTPException(status_code=404, detail="Karekod stok bulunamadı veya zaten kullanılmış")
    
    import logging
    turkey_now = datetime.utcnow()
    
    # 1. Karekod stoğu "split" olarak işaretle (artık kullanılamaz)
    await barcode_stock_collection.update_one(
        {"_id": barcode_stock_id},
        {"$set": {
            "status": "split",
            "split_at": turkey_now,
            "split_by": user.id,
            "split_by_name": user.name,
            "split_quantity": quantity_in_package,
            "split_to_location": target_location,
            "split_notes": notes
        }}
    )
    
    # 2. Ana stok koleksiyonundaki ilişkili kaydı da güncelle
    await stock_collection.update_one(
        {"barcode_stock_id": barcode_stock_id},
        {"$set": {
            "status": "split",
            "split_at": turkey_now
        }}
    )
    
    # 3. Hedef lokasyonda adet bazlı stok oluştur veya artır
    existing_target = await stock_collection.find_one({
        "location": target_location,
        "name": barcode_item.get("name"),
        "lot_number": barcode_item.get("lot_number"),
        "is_split_stock": True  # Parçalanmış stok olarak işaretle
    })
    
    if existing_target:
        # Varsa miktarı artır
        await stock_collection.update_one(
            {"_id": existing_target["_id"]},
            {
                "$inc": {"quantity": quantity_in_package},
                "$set": {"updated_at": turkey_now}
            }
        )
        new_stock_id = existing_target["_id"]
    else:
        # Yoksa yeni adet bazlı stok oluştur
        new_stock_id = str(uuid.uuid4())
        new_stock = {
            "_id": new_stock_id,
            "name": barcode_item.get("name"),
            "code": barcode_item.get("gtin", "")[:8] if barcode_item.get("gtin") else "",
            "gtin": barcode_item.get("gtin"),
            "quantity": quantity_in_package,
            "min_quantity": 1,
            "location": target_location,
            "lot_number": barcode_item.get("lot_number"),
            "expiry_date": barcode_item.get("expiry_date"),
            "unit": "adet",
            "is_split_stock": True,  # Parçalanmış stok işareti
            "original_barcode_ids": [barcode_stock_id],
            "manufacturer_name": barcode_item.get("manufacturer_name"),
            "created_at": turkey_now,
            "updated_at": turkey_now,
            "created_by": user.id
        }
        await stock_collection.insert_one(new_stock)
    
    # 4. Stok hareketi kaydı oluştur
    movement = {
        "_id": str(uuid.uuid4()),
        "type": "split",
        "barcode_stock_id": barcode_stock_id,
        "from_location": barcode_item.get("location"),
        "to_location": target_location,
        "item_name": barcode_item.get("name"),
        "gtin": barcode_item.get("gtin"),
        "lot_number": barcode_item.get("lot_number"),
        "quantity": quantity_in_package,
        "unit": "adet",
        "serial_number": barcode_item.get("serial_number"),
        "performed_by": user.id,
        "performed_by_name": user.name,
        "notes": notes,
        "created_at": turkey_now
    }
    await db["stock_movements"].insert_one(movement)
    
    logging.info(f"Stock split: {barcode_item.get('name')} - {quantity_in_package} adet -> {target_location} by {user.name}")
    
    return {
        "message": f"Stok parçalandı: {quantity_in_package} adet {target_location} lokasyonuna eklendi",
        "split_details": {
            "original_barcode_id": barcode_stock_id,
            "item_name": barcode_item.get("name"),
            "serial_number": barcode_item.get("serial_number"),
            "quantity_split": quantity_in_package,
            "target_location": target_location,
            "new_stock_id": new_stock_id
        }
    }


@router.get("/split-info/{barcode_stock_id}")
async def get_split_info(barcode_stock_id: str, request: Request):
    """
    Karekod stoğunun parçalama bilgisini getir
    Popup'ta gösterilecek: ilaç adı, lot no, SKT, önerilen adet
    """
    await get_current_user(request)
    
    item = await barcode_stock_collection.find_one({"_id": barcode_stock_id})
    
    if not item:
        raise HTTPException(status_code=404, detail="Karekod stok bulunamadı")
    
    # Varsayılan kutu içi adet önerisi (ilaç türüne göre)
    default_quantity = 1
    name_lower = (item.get("name") or "").lower()
    
    # Bazı varsayılan tahminler
    if "tablet" in name_lower or "kapsül" in name_lower:
        if "10" in name_lower:
            default_quantity = 10
        elif "20" in name_lower:
            default_quantity = 20
        elif "30" in name_lower:
            default_quantity = 30
        else:
            default_quantity = 10
    elif "ampul" in name_lower or "ampül" in name_lower:
        if "5 adet" in name_lower or "5 ampul" in name_lower:
            default_quantity = 5
        elif "10 adet" in name_lower:
            default_quantity = 10
        else:
            default_quantity = 5
    elif "flakon" in name_lower:
        default_quantity = 1
    elif "merhem" in name_lower or "krem" in name_lower:
        default_quantity = 1
    elif "sprey" in name_lower:
        default_quantity = 1
    
    return {
        "id": item.get("_id"),
        "name": item.get("name"),
        "gtin": item.get("gtin"),
        "serial_number": item.get("serial_number"),
        "lot_number": item.get("lot_number"),
        "expiry_date": item.get("expiry_date"),
        "current_location": item.get("location"),
        "status": item.get("status"),
        "suggested_quantity": default_quantity,
        "can_split": item.get("status") == "available"
    }


# ============================================================================
# STOK HAREKETLERİ
# ============================================================================

stock_movements_collection = db["stock_movements"]

class StockMovementRequest(BaseModel):
    """Stok hareketi isteği"""
    movement_type: str  # 'transfer', 'send', 'receive', 'use', 'return'
    from_location: Optional[str] = None
    to_location: str
    items: List[dict]  # [{"stock_id": "...", "quantity": 5}, ...]
    notes: Optional[str] = None
    vehicle_plate: Optional[str] = None


@router.post("/movements/send")
async def send_stock_to_location(request: Request):
    """
    Lokasyona stok gönder
    - Merkez depodan araç/bekleme noktasına
    - Hem QR bazlı hem adet bazlı ürünler
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi", "hemsire"])(request)
    
    body = await request.json()
    from_location = body.get("from_location", "merkez_depo")
    to_location = body.get("to_location")
    items = body.get("items", [])
    notes = body.get("notes", "")
    vehicle_plate = body.get("vehicle_plate")
    
    if not to_location:
        raise HTTPException(status_code=400, detail="Hedef lokasyon gerekli")
    
    if not items:
        raise HTTPException(status_code=400, detail="En az bir ürün seçilmeli")
    
    import logging
    turkey_now = datetime.utcnow()
    
    results = []
    
    for item_data in items:
        stock_id = item_data.get("stock_id")
        quantity = item_data.get("quantity", 1)
        is_barcode = item_data.get("is_barcode", False)
        
        if is_barcode:
            # QR kodlu ürün - direkt transfer et
            barcode_item = await barcode_stock_collection.find_one({
                "_id": stock_id,
                "status": "available"
            })
            
            if not barcode_item:
                results.append({"stock_id": stock_id, "success": False, "error": "Karekod bulunamadı"})
                continue
            
            # Lokasyonu güncelle
            await barcode_stock_collection.update_one(
                {"_id": stock_id},
                {"$set": {
                    "location": to_location,
                    "location_detail": vehicle_plate,
                    "transferred_at": turkey_now,
                    "transferred_by": user.id
                }}
            )
            
            # Ana stok koleksiyonunu da güncelle
            await stock_collection.update_one(
                {"barcode_stock_id": stock_id},
                {"$set": {
                    "location": to_location,
                    "location_detail": vehicle_plate,
                    "updated_at": turkey_now
                }}
            )
            
            # Hareket kaydı
            movement = {
                "_id": str(uuid.uuid4()),
                "type": "transfer",
                "is_barcode": True,
                "barcode_stock_id": stock_id,
                "from_location": barcode_item.get("location"),
                "to_location": to_location,
                "item_name": barcode_item.get("name"),
                "gtin": barcode_item.get("gtin"),
                "serial_number": barcode_item.get("serial_number"),
                "quantity": 1,
                "unit": "adet",
                "performed_by": user.id,
                "performed_by_name": user.name,
                "vehicle_plate": vehicle_plate,
                "notes": notes,
                "created_at": turkey_now
            }
            await stock_movements_collection.insert_one(movement)
            
            results.append({
                "stock_id": stock_id,
                "success": True,
                "item_name": barcode_item.get("name"),
                "quantity": 1
            })
        
        else:
            # Adet bazlı ürün
            stock_item = await stock_collection.find_one({"_id": stock_id})
            
            if not stock_item:
                results.append({"stock_id": stock_id, "success": False, "error": "Stok bulunamadı"})
                continue
            
            current_qty = stock_item.get("quantity", 0)
            if current_qty < quantity:
                results.append({
                    "stock_id": stock_id, 
                    "success": False, 
                    "error": f"Yetersiz stok. Mevcut: {current_qty}, İstenen: {quantity}"
                })
                continue
            
            # Kaynaktan düş
            await stock_collection.update_one(
                {"_id": stock_id},
                {
                    "$inc": {"quantity": -quantity},
                    "$set": {"updated_at": turkey_now}
                }
            )
            
            # Hedefte var mı kontrol et
            existing_target = await stock_collection.find_one({
                "location": to_location,
                "name": stock_item.get("name"),
                "lot_number": stock_item.get("lot_number"),
                "is_split_stock": stock_item.get("is_split_stock", False)
            })
            
            if existing_target:
                await stock_collection.update_one(
                    {"_id": existing_target["_id"]},
                    {
                        "$inc": {"quantity": quantity},
                        "$set": {"updated_at": turkey_now}
                    }
                )
            else:
                # Yeni kayıt oluştur
                new_stock = {
                    "_id": str(uuid.uuid4()),
                    "name": stock_item.get("name"),
                    "code": stock_item.get("code"),
                    "gtin": stock_item.get("gtin"),
                    "quantity": quantity,
                    "min_quantity": 1,
                    "location": to_location,
                    "location_detail": vehicle_plate,
                    "lot_number": stock_item.get("lot_number"),
                    "expiry_date": stock_item.get("expiry_date"),
                    "unit": stock_item.get("unit", "adet"),
                    "is_split_stock": stock_item.get("is_split_stock", False),
                    "created_at": turkey_now,
                    "updated_at": turkey_now
                }
                await stock_collection.insert_one(new_stock)
            
            # Hareket kaydı
            movement = {
                "_id": str(uuid.uuid4()),
                "type": "transfer",
                "is_barcode": False,
                "stock_id": stock_id,
                "from_location": stock_item.get("location"),
                "to_location": to_location,
                "item_name": stock_item.get("name"),
                "gtin": stock_item.get("gtin"),
                "quantity": quantity,
                "unit": stock_item.get("unit", "adet"),
                "performed_by": user.id,
                "performed_by_name": user.name,
                "vehicle_plate": vehicle_plate,
                "notes": notes,
                "created_at": turkey_now
            }
            await stock_movements_collection.insert_one(movement)
            
            results.append({
                "stock_id": stock_id,
                "success": True,
                "item_name": stock_item.get("name"),
                "quantity": quantity
            })
    
    success_count = sum(1 for r in results if r.get("success"))
    
    logging.info(f"Stock movement: {success_count}/{len(items)} items sent to {to_location} by {user.name}")
    
    return {
        "message": f"{success_count} ürün {to_location} lokasyonuna gönderildi",
        "results": results,
        "success_count": success_count,
        "failed_count": len(items) - success_count
    }


@router.get("/movements")
async def get_stock_movements(
    request: Request,
    location: Optional[str] = None,
    movement_type: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 100
):
    """Stok hareketlerini getir"""
    await get_current_user(request)
    
    query = {}
    
    if location:
        query["$or"] = [
            {"from_location": location},
            {"to_location": location}
        ]
    
    if movement_type:
        query["type"] = movement_type
    
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d")
            query["created_at"] = {
                "$gte": target_date,
                "$lt": target_date + timedelta(days=1)
            }
        except ValueError:
            pass
    
    movements = await stock_movements_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for m in movements:
        m["id"] = m.pop("_id")
    
    return {"movements": movements, "count": len(movements)}
