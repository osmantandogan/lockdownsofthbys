"""
Medication Usage API - Vakada kullanılan ilaçlar ve karekod işlemleri
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime
import re

from database import (
    cases_collection, 
    stock_collection, 
    medication_usage_collection,
    stock_usage_logs_collection,
    vehicles_collection
)
from models import (
    MedicationUsage, 
    MedicationUsageCreate, 
    StockUsageLog,
    ParsedBarcodeData,
    StockItem,
    StockItemCreate
)
from auth_utils import get_current_user, require_roles

router = APIRouter()


# ============================================================================
# GS1 DATAMATRIX BARCODE PARSER (Türkiye ITS Standardı)
# ============================================================================

def parse_gs1_barcode(raw_data: str) -> ParsedBarcodeData:
    """
    Parse GS1 DataMatrix barcode (Türkiye ITS standardı)
    
    Format: (01)GTIN(17)YYMMDD(10)LOT(21)SERIAL
    
    Application Identifiers (AI):
    - (01) GTIN - 14 haneli ürün kodu
    - (17) Son Kullanma Tarihi - YYMMDD
    - (10) Parti/Lot Numarası
    - (21) Seri Numarası
    
    Örnek: 010869954321012317251231 10ABC123 21SN123456
    """
    result = ParsedBarcodeData(raw_data=raw_data)
    
    # Clean the input - remove spaces and special chars
    clean_data = raw_data.strip()
    
    # Try different parsing methods
    
    # Method 1: With parentheses format (01)xxx(17)xxx...
    if '(' in clean_data:
        # Extract using regex with parentheses
        gtin_match = re.search(r'\(01\)(\d{14})', clean_data)
        expiry_match = re.search(r'\(17\)(\d{6})', clean_data)
        lot_match = re.search(r'\(10\)([^\(]+)', clean_data)
        serial_match = re.search(r'\(21\)([^\(]+)', clean_data)
        
        if gtin_match:
            result.gtin = gtin_match.group(1)
        if expiry_match:
            result.expiry_date = expiry_match.group(1)
        if lot_match:
            result.lot_number = lot_match.group(1).strip()
        if serial_match:
            result.serial_number = serial_match.group(1).strip()
    
    # Method 2: Without parentheses - position based
    # Format: 01XXXXXXXXXXXXXX17YYMMDD10LOT21SERIAL
    else:
        # GS1 uses FNC1 (Group Separator) character, often represented as ]d2 or GS (ASCII 29)
        # Remove any control characters
        clean_data = re.sub(r'[\x00-\x1f]', '', clean_data)
        
        # Try to find AI codes by position
        pos = 0
        while pos < len(clean_data):
            # Check for known AIs
            if clean_data[pos:pos+2] == '01' and pos + 16 <= len(clean_data):
                result.gtin = clean_data[pos+2:pos+16]
                pos += 16
            elif clean_data[pos:pos+2] == '17' and pos + 8 <= len(clean_data):
                result.expiry_date = clean_data[pos+2:pos+8]
                pos += 8
            elif clean_data[pos:pos+2] == '10':
                # Lot number - variable length, ends at next AI or end
                lot_end = len(clean_data)
                for ai in ['17', '21', '01']:
                    ai_pos = clean_data.find(ai, pos+2)
                    if ai_pos != -1 and ai_pos < lot_end:
                        lot_end = ai_pos
                result.lot_number = clean_data[pos+2:lot_end].strip()
                pos = lot_end
            elif clean_data[pos:pos+2] == '21':
                # Serial number - variable length
                serial_end = len(clean_data)
                for ai in ['17', '10', '01']:
                    ai_pos = clean_data.find(ai, pos+2)
                    if ai_pos != -1 and ai_pos < serial_end:
                        serial_end = ai_pos
                result.serial_number = clean_data[pos+2:serial_end].strip()
                pos = serial_end
            else:
                pos += 1
    
    # Parse expiry date if found
    if result.expiry_date and len(result.expiry_date) == 6:
        try:
            year = int(result.expiry_date[0:2])
            month = int(result.expiry_date[2:4])
            day = int(result.expiry_date[4:6])
            
            # Handle century (00-69 = 2000s, 70-99 = 1900s)
            if year < 70:
                year += 2000
            else:
                year += 1900
            
            # Handle day = 00 (means last day of month)
            if day == 0:
                day = 28  # Safe default
            
            result.expiry_date_parsed = datetime(year, month, day)
        except (ValueError, TypeError):
            pass
    
    return result


@router.post("/parse-barcode")
async def parse_barcode(request: Request):
    """
    Parse GS1 DataMatrix barcode and find matching stock item
    Returns parsed data and matching stock item if found
    """
    await get_current_user(request)
    
    body = await request.json()
    raw_data = body.get("barcode", "")
    vehicle_plate = body.get("vehicle_plate")  # Optional: filter by vehicle
    
    if not raw_data:
        raise HTTPException(status_code=400, detail="Barkod verisi gerekli")
    
    # Parse the barcode
    parsed = parse_gs1_barcode(raw_data)
    
    # Try to find matching stock item
    stock_item = None
    query = {}
    
    if parsed.gtin:
        # First try exact GTIN match
        query["gtin"] = parsed.gtin
        if vehicle_plate:
            query["location"] = "ambulans"
            query["location_detail"] = vehicle_plate
        
        stock_doc = await stock_collection.find_one(query)
        
        if stock_doc:
            stock_doc["id"] = stock_doc.pop("_id")
            stock_item = stock_doc
    
    # If no GTIN match, try lot number
    if not stock_item and parsed.lot_number:
        query = {"lot_number": parsed.lot_number}
        if vehicle_plate:
            query["location"] = "ambulans"
            query["location_detail"] = vehicle_plate
        
        stock_doc = await stock_collection.find_one(query)
        if stock_doc:
            stock_doc["id"] = stock_doc.pop("_id")
            stock_item = stock_doc
    
    return {
        "parsed": parsed.model_dump(),
        "stock_item": stock_item,
        "found": stock_item is not None
    }


# ============================================================================
# MEDICATION USAGE ENDPOINTS
# ============================================================================

@router.post("/cases/{case_id}/medications")
async def add_medication_to_case(case_id: str, data: MedicationUsageCreate, request: Request):
    """
    Vakaya ilaç/malzeme ekle ve stoktan düş
    """
    user = await get_current_user(request)
    
    # Check case exists
    case_doc = await cases_collection.find_one({"_id": case_id})
    if not case_doc:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Get vehicle plate from assigned team
    vehicle_plate = None
    if case_doc.get("assigned_team"):
        vehicle_id = case_doc["assigned_team"].get("vehicle_id")
        if vehicle_id:
            vehicle_doc = await vehicles_collection.find_one({"_id": vehicle_id})
            if vehicle_doc:
                vehicle_plate = vehicle_doc.get("plate")
    
    # Create medication usage record
    medication = MedicationUsage(
        case_id=case_id,
        stock_item_id=data.stock_item_id,
        name=data.name,
        gtin=data.gtin,
        lot_number=data.lot_number,
        serial_number=data.serial_number,
        expiry_date=data.expiry_date,
        quantity=data.quantity,
        unit=data.unit,
        dosage=data.dosage,
        route=data.route,
        added_by=user.id,
        added_by_name=user.name,
        vehicle_plate=vehicle_plate
    )
    
    # If we have a stock_item_id, deduct from stock (lokasyon bazlı)
    stock_deducted = False
    deducted_from_location = None
    
    if data.stock_item_id:
        stock_item = await stock_collection.find_one({"_id": data.stock_item_id})
        if stock_item:
            previous_qty = stock_item.get("quantity", 0)
            new_qty = max(0, previous_qty - data.quantity)
            deducted_from_location = stock_item.get("location")
            
            # Update stock
            await stock_collection.update_one(
                {"_id": data.stock_item_id},
                {
                    "$set": {
                        "quantity": new_qty,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Log the stock usage
            log = StockUsageLog(
                stock_item_id=data.stock_item_id,
                case_id=case_id,
                medication_usage_id=medication.id,
                action="kullanim",
                quantity_change=-data.quantity,
                previous_quantity=previous_qty,
                new_quantity=new_qty,
                reason=f"Vaka kullanımı: {case_doc.get('case_number', case_id)} - Lokasyon: {deducted_from_location}",
                performed_by=user.id,
                performed_by_name=user.name
            )
            await stock_usage_logs_collection.insert_one(log.model_dump(by_alias=True))
            
            stock_deducted = True
            
            # Check if stock is critical now
            if new_qty <= stock_item.get("min_quantity", 0):
                # TODO: Send notification for critical stock
                pass
    else:
        # Eğer stock_item_id yoksa, araç lokasyonundaki stoktan düşmeyi dene
        if vehicle_plate:
            # Araç lokasyonu adını oluştur (örn: "34 ABC 123" → araç lokasyonu)
            possible_locations = [
                vehicle_plate,  # Araç plakası
                f"{vehicle_plate} Aracı",  # "34 ABC 123 Aracı"
                f"{vehicle_plate} Bekleme Noktası"  # "34 ABC 123 Bekleme Noktası"
            ]
            
            # İlacı bu lokasyonlardan birinde bul
            for loc in possible_locations:
                stock_item = await stock_collection.find_one({
                    "location": loc,
                    "name": {"$regex": data.name, "$options": "i"},
                    "quantity": {"$gt": 0}
                })
                
                if stock_item:
                    previous_qty = stock_item.get("quantity", 0)
                    new_qty = max(0, previous_qty - data.quantity)
                    deducted_from_location = loc
                    
                    await stock_collection.update_one(
                        {"_id": stock_item["_id"]},
                        {
                            "$set": {
                                "quantity": new_qty,
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    
                    # Log
                    log = StockUsageLog(
                        stock_item_id=stock_item["_id"],
                        case_id=case_id,
                        medication_usage_id=medication.id,
                        action="kullanim",
                        quantity_change=-data.quantity,
                        previous_quantity=previous_qty,
                        new_quantity=new_qty,
                        reason=f"Vaka kullanımı: {case_doc.get('case_number', case_id)} - Araç: {vehicle_plate} - Lokasyon: {loc}",
                        performed_by=user.id,
                        performed_by_name=user.name
                    )
                    await stock_usage_logs_collection.insert_one(log.model_dump(by_alias=True))
                    
                    stock_deducted = True
                    break
    
    medication.stock_deducted = stock_deducted
    
    # Save medication usage
    await medication_usage_collection.insert_one(medication.model_dump(by_alias=True))
    
    return {
        "message": "İlaç/malzeme eklendi",
        "medication": medication.model_dump(),
        "stock_deducted": stock_deducted,
        "deducted_from_location": deducted_from_location
    }


@router.get("/cases/{case_id}/medications")
async def get_case_medications(case_id: str, request: Request):
    """Vakada kullanılan tüm ilaç/malzemeleri getir"""
    await get_current_user(request)
    
    medications = await medication_usage_collection.find(
        {"case_id": case_id}
    ).sort("added_at", -1).to_list(100)
    
    for med in medications:
        med["id"] = med.pop("_id")
    
    return medications


@router.delete("/cases/{case_id}/medications/{medication_id}")
async def remove_medication_from_case(case_id: str, medication_id: str, request: Request):
    """
    Vakadan ilaç/malzeme sil ve stoğa geri ekle
    """
    user = await get_current_user(request)
    
    # Find the medication record
    medication = await medication_usage_collection.find_one({
        "_id": medication_id,
        "case_id": case_id
    })
    
    if not medication:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")
    
    # If stock was deducted, return it
    if medication.get("stock_deducted") and medication.get("stock_item_id"):
        stock_item = await stock_collection.find_one({"_id": medication["stock_item_id"]})
        if stock_item:
            previous_qty = stock_item.get("quantity", 0)
            new_qty = previous_qty + medication.get("quantity", 1)
            
            # Update stock
            await stock_collection.update_one(
                {"_id": medication["stock_item_id"]},
                {
                    "$set": {
                        "quantity": new_qty,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Log the return
            log = StockUsageLog(
                stock_item_id=medication["stock_item_id"],
                case_id=case_id,
                medication_usage_id=medication_id,
                action="iade",
                quantity_change=medication.get("quantity", 1),
                previous_quantity=previous_qty,
                new_quantity=new_qty,
                reason="Vaka ilaç kaydı silindi - iade",
                performed_by=user.id,
                performed_by_name=user.name
            )
            await stock_usage_logs_collection.insert_one(log.model_dump(by_alias=True))
    
    # Delete the medication record
    await medication_usage_collection.delete_one({"_id": medication_id})
    
    return {"message": "İlaç/malzeme kaydı silindi ve stok güncellendi"}


# ============================================================================
# STOCK ITEM FROM BARCODE (New item creation)
# ============================================================================

@router.post("/stock/from-barcode")
async def create_stock_from_barcode(request: Request):
    """
    Karekoddan yeni stok ürünü oluştur
    (GTIN eşleşmesi bulunamadığında kullanılır)
    """
    await require_roles(["merkez_ofis", "operasyon_muduru", "hemsire", "paramedik", "att"])(request)
    user = await get_current_user(request)
    
    body = await request.json()
    
    barcode = body.get("barcode", "")
    name = body.get("name", "")
    quantity = body.get("quantity", 1)
    min_quantity = body.get("min_quantity", 5)
    location = body.get("location", "ambulans")
    location_detail = body.get("location_detail")  # Vehicle plate
    unit = body.get("unit", "adet")
    
    if not name:
        raise HTTPException(status_code=400, detail="Ürün adı gerekli")
    
    # Parse barcode
    parsed = parse_gs1_barcode(barcode) if barcode else None
    
    # Create stock item
    from models import StockItem
    import uuid
    
    new_item = StockItem(
        name=name,
        code=parsed.gtin[:8] if parsed and parsed.gtin else str(uuid.uuid4())[:8],
        gtin=parsed.gtin if parsed else None,
        quantity=quantity,
        min_quantity=min_quantity,
        location=location,
        location_detail=location_detail,
        lot_number=parsed.lot_number if parsed else None,
        serial_number=parsed.serial_number if parsed else None,
        expiry_date=parsed.expiry_date_parsed if parsed else None,
        unit=unit
    )
    
    await stock_collection.insert_one(new_item.model_dump(by_alias=True))
    
    return {
        "message": "Yeni stok ürünü oluşturuldu",
        "stock_item": new_item.model_dump()
    }


# ============================================================================
# AMBULANCE STOCK (Vehicle-specific)
# ============================================================================

@router.get("/vehicles/{vehicle_id}/stock")
async def get_vehicle_stock(vehicle_id: str, request: Request):
    """Araçtaki stok listesini getir"""
    await get_current_user(request)
    
    # Get vehicle plate
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    plate = vehicle.get("plate")
    
    # Get stock items for this vehicle
    items = await stock_collection.find({
        "location": "ambulans",
        "location_detail": plate
    }).to_list(500)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    return {
        "vehicle_id": vehicle_id,
        "vehicle_plate": plate,
        "stock_items": items,
        "total_items": len(items)
    }


@router.get("/stock/search")
async def search_stock(
    request: Request,
    q: str = "",
    location: Optional[str] = None,
    location_detail: Optional[str] = None
):
    """Stok ara (isme veya koda göre)"""
    await get_current_user(request)
    
    query = {}
    
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"code": {"$regex": q, "$options": "i"}},
            {"gtin": {"$regex": q, "$options": "i"}}
        ]
    
    if location:
        query["location"] = location
    
    if location_detail:
        query["location_detail"] = location_detail
    
    items = await stock_collection.find(query).limit(50).to_list(50)
    
    for item in items:
        item["id"] = item.pop("_id")
    
    return items

