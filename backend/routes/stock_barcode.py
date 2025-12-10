"""
Karekod Bazlı Stok Yönetimi API
================================
Her karekod = 1 adet benzersiz stok girişi
Vaka bazlı ilaç kullanımı ve stoktan düşme
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
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
