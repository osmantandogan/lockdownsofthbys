"""
Merkez Depo Yönetimi (Warehouse Management)
==========================================
- İTS QR kodlu stok yönetimi
- Kutu bazlı takip
- Parçalama (split) işlemleri
- Transfer sistemi
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from database import db
from auth_utils import get_current_user, require_roles
from datetime import datetime, timedelta
from services.its_service import parse_datamatrix, get_drug_info_from_barcode
import uuid
import logging
import json
import os

logger = logging.getLogger(__name__)
router = APIRouter()

# GTIN → İlaç Adı mapping yükle
GTIN_DRUG_MAP = {}
try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    gtin_file = os.path.join(script_dir, '..', 'data', 'gtin_drug_mapping.json')
    with open(gtin_file, 'r', encoding='utf-8') as f:
        GTIN_DRUG_MAP = json.load(f)
    logger.info(f"GTIN drug mapping yüklendi: {len(GTIN_DRUG_MAP)} ilaç")
except Exception as e:
    logger.warning(f"GTIN mapping yüklenemedi: {e}")

# Koleksiyonlar
warehouse_stock = db.warehouse_stock              # Depo stoğu (kutular)
warehouse_splits = db.warehouse_splits            # Parçalama kayıtları
warehouse_transfers = db.warehouse_transfers      # Transfer kayıtları
internal_qr_codes = db.internal_qr_codes          # Internal QR'lar (araç stoğu için)

def get_turkey_time():
    return datetime.utcnow() + timedelta(hours=3)


# ============ MODELLER ============

class WarehouseStockItem(BaseModel):
    """Depo Stok Ürünü"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    qr_code: str                          # İTS QR kodu (GS1 DataMatrix)
    gtin: str                             # Ürün kodu
    item_name: str                        # İlaç adı
    lot_number: str                       # Lot numarası
    expiry_date: datetime                 # Son kullanma tarihi
    serial_number: Optional[str] = None   # Seri numarası
    box_quantity: int = 1                 # Kaç kutu
    items_per_box: int                    # Kutuda kaç adet
    total_items: int                      # Toplam adet (box_quantity * items_per_box)
    remaining_items: int                  # Kalan adet
    is_opened: bool = False               # Kutu açıldı mı
    unit: str = "KUTU"
    warehouse_location: Optional[str] = None  # Raf konumu (örn: "Raf-A-12")
    category: str = "ilac"                # ilac, sarf, serum
    status: Literal["active", "split", "empty", "expired"] = "active"
    added_by: str
    added_by_name: str
    added_at: datetime = Field(default_factory=get_turkey_time)
    updated_at: datetime = Field(default_factory=get_turkey_time)
    its_verified: bool = False            # İTS'den doğrulandı mı
    its_data: Optional[dict] = None       # İTS'den gelen tam data


class WarehouseSplitRecord(BaseModel):
    """Kutu Parçalama Kaydı"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    warehouse_stock_id: str               # Hangi deppo stok kaydı
    qr_code: str                          # Original QR
    item_name: str
    gtin: str
    lot_number: str
    expiry_date: datetime
    quantity_split: int                   # Kaç adet parçalandı
    destination_type: Literal["vehicle", "waiting_point"]
    destination_id: str
    destination_name: str
    split_by: str
    split_by_name: str
    split_at: datetime = Field(default_factory=get_turkey_time)
    transfer_id: Optional[str] = None     # İlgili transfer kaydı


class TransferRequest(BaseModel):
    """Transfer Talebi"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    from_location: Literal["warehouse"] = "warehouse"
    to_type: Literal["vehicle", "waiting_point"]
    to_id: str
    to_name: str
    items: List[dict]  # [{"name": "X", "quantity": 10}]
    reason: Optional[str] = None
    status: Literal["pending", "approved", "rejected", "delivered"] = "pending"
    requested_by: str
    requested_by_name: str
    requested_at: datetime = Field(default_factory=get_turkey_time)
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[str] = None
    rejected_reason: Optional[str] = None
    delivered_by: Optional[str] = None
    delivered_at: Optional[datetime] = None


class InternalQRCode(BaseModel):
    """Internal QR (Araç stoğu için)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    qr_code: str                          # Bizim generate ettiğimiz QR
    location_id: str                      # vehicle_id veya waiting_point_id
    location_name: str
    location_type: Literal["vehicle", "waiting_point"]
    item_name: str
    quantity: int = 1
    unit: str = "ADET"
    category: str = "ilac"
    expiry_date: Optional[datetime] = None  # Ekip manuel girecek
    lot_number: Optional[str] = None
    source_warehouse_qr: Optional[str] = None  # Nereden geldi (depo QR)
    created_at: datetime = Field(default_factory=get_turkey_time)
    last_scan: Optional[datetime] = None
    status: Literal["active", "used", "expired"] = "active"


# ============ HELPER FONKSİYONLAR ============

async def parse_its_qr(qr_code: str) -> dict:
    """
    İTS QR kodunu parse et ve ilaç bilgilerini getir
    """
    try:
        # GS1 DataMatrix parse
        parsed = parse_datamatrix(qr_code)
        
        if not parsed or "gtin" not in parsed:
            raise ValueError("QR kod parse edilemedi")
        
        # İTS'den ilaç bilgisi al (opsiyonel - hata olsa da devam et)
        drug_info = None
        drug_name = None
        its_verified = False
        
        try:
            drug_info = get_drug_info_from_barcode(qr_code)
            if drug_info:
                drug_name = drug_info.get("name")
                its_verified = True
        except Exception as e:
            logger.warning(f"İTS ilaç bilgisi alınamadı (devam ediliyor): {str(e)}")
        
        # İTS'den gelmediyse local GTIN mapping'den bak
        if not drug_name and parsed.get("gtin"):
            gtin = parsed.get("gtin")
            
            # GTIN'i farklı formatlarda dene
            # 1. Olduğu gibi
            drug_name = GTIN_DRUG_MAP.get(gtin)
            
            # 2. Başındaki 0'ları kaldır
            if not drug_name:
                gtin_no_leading_zero = gtin.lstrip('0')
                drug_name = GTIN_DRUG_MAP.get(gtin_no_leading_zero)
            
            # 3. 14 haneye doldur
            if not drug_name:
                gtin_14 = gtin.zfill(14)
                drug_name = GTIN_DRUG_MAP.get(gtin_14)
            
            # 4. 13 haneye indir (EAN-13)
            if not drug_name and len(gtin) == 14:
                gtin_13 = gtin[1:]  # İlk rakamı at
                drug_name = GTIN_DRUG_MAP.get(gtin_13)
            
            if drug_name:
                logger.info(f"İlaç adı local mapping'den bulundu: {drug_name}")
            else:
                logger.warning(f"İlaç adı bulunamadı: GTIN {gtin} (denenen: {gtin}, {gtin.lstrip('0')}, {gtin.zfill(14)})")
        
        return {
            "gtin": parsed.get("gtin"),
            "lot_number": parsed.get("lot_number"),
            "expiry_date": parsed.get("expiry_date"),
            "serial_number": parsed.get("serial_number"),
            "quantity": parsed.get("quantity"),  # AI (30) - Kutudaki adet
            "drug_name": drug_name,
            "drug_info": drug_info,
            "parsed": parsed,
            "its_verified": its_verified
        }
    except Exception as e:
        logger.error(f"QR parse hatası: {str(e)}")
        raise HTTPException(status_code=400, detail=f"QR kod okunamadı: {str(e)}")


def generate_internal_qr(location_id: str, item_name: str, sequence: int = 1) -> str:
    """
    Internal QR kodu generate et (araç stoğu için)
    Format: LOC-{location_id}-{item_hash}-{sequence}-{timestamp}
    """
    import hashlib
    item_hash = hashlib.md5(item_name.encode()).hexdigest()[:8]
    timestamp = int(datetime.now().timestamp())
    return f"INT-{location_id[:8]}-{item_hash}-{sequence:04d}-{timestamp}"


# ============ ENDPOINTS ============

@router.get("/health")
async def health_check():
    """Depo sistemi sağlık kontrolü"""
    return {"status": "ok", "system": "warehouse"}


# --- Depo Stok Yönetimi ---

@router.post("/stock/add")
async def add_warehouse_stock(request: Request):
    """
    Depoya yeni stok ekle (QR okutarak)
    - QR okut
    - İTS'ye sorgula
    - Manuel bilgi ekle (kutu sayısı, raf konumu)
    - Kaydet
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    data = await request.json()
    
    qr_code = data.get("qr_code", "").strip()
    if not qr_code:
        raise HTTPException(status_code=400, detail="QR kod gerekli")
    
    # Daha önce eklenmiş mi kontrol et
    existing = await warehouse_stock.find_one({"qr_code": qr_code})
    if existing:
        raise HTTPException(status_code=400, detail="Bu QR kod zaten depoda kayıtlı")
    
    # İTS'den parse et
    its_data = await parse_its_qr(qr_code)
    
    # Manuel bilgileri al
    box_quantity = data.get("box_quantity", 1)
    # Eğer QR'dan adet bilgisi gelmişse onu kullan, yoksa manuel girişi kullan
    items_per_box = its_data.get("quantity") or data.get("items_per_box", 1)
    warehouse_location = data.get("warehouse_location", "")  # Raf konumu
    
    # İlaç adı - manuel veya İTS'den
    item_name = data.get("item_name") or its_data.get("drug_name") or "Bilinmeyen"
    
    # Kaydet
    doc = {
        "_id": str(uuid.uuid4()),
        "qr_code": qr_code,
        "gtin": its_data.get("gtin", ""),
        "item_name": item_name,
        "lot_number": its_data.get("lot_number", ""),
        "expiry_date": its_data.get("expiry_date"),
        "serial_number": its_data.get("serial_number"),
        "box_quantity": box_quantity,
        "items_per_box": items_per_box,
        "total_items": box_quantity * items_per_box,
        "remaining_items": box_quantity * items_per_box,
        "is_opened": False,
        "unit": "KUTU",
        "warehouse_location": warehouse_location or "",
        "category": data.get("category", "ilac"),
        "status": "active",
        "added_by": user.id,
        "added_by_name": user.name,
        "added_at": get_turkey_time(),
        "updated_at": get_turkey_time(),
        "its_verified": its_data.get("its_verified", False),
        "its_data": its_data.get("drug_info")
    }
    
    await warehouse_stock.insert_one(doc)
    
    logger.info(f"Depo stok eklendi: {its_data.get('drug_name')} x{box_quantity} kutu - {user.name}")
    
    return {
        "success": True,
        "message": f"{box_quantity} kutu eklendi",
        "item": {
            "id": doc["_id"],
            "name": doc["item_name"],
            "total_items": doc["total_items"]
        }
    }


@router.get("/stock")
async def get_warehouse_stock(
    request: Request, 
    status: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None
):
    """
    Depo stoğunu listele
    """
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    if location:
        query["warehouse_location"] = {"$regex": location, "$options": "i"}
    
    items = await warehouse_stock.find(query).sort("added_at", -1).to_list(1000)
    
    for item in items:
        item["id"] = item.pop("_id", "")
    
    return {"items": items, "total": len(items)}


@router.get("/stock/{stock_id}")
async def get_warehouse_stock_detail(stock_id: str, request: Request):
    """Depo stok detayı"""
    await get_current_user(request)
    
    item = await warehouse_stock.find_one({"_id": stock_id})
    if not item:
        raise HTTPException(status_code=404, detail="Stok kaydı bulunamadı")
    
    item["id"] = item.pop("_id", "")
    
    # Parçalama geçmişini de getir
    splits = await warehouse_splits.find({"warehouse_stock_id": stock_id}).to_list(100)
    for s in splits:
        s["id"] = s.pop("_id", "")
    
    item["split_history"] = splits
    
    return item


@router.delete("/stock/{stock_id}")
async def delete_warehouse_stock(stock_id: str, request: Request):
    """Depo stok kaydını sil"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    item = await warehouse_stock.find_one({"_id": stock_id})
    if not item:
        raise HTTPException(status_code=404, detail="Stok kaydı bulunamadı")
    
    # Parçalanmış veya boş olsa bile silebilir (force delete)
    await warehouse_stock.delete_one({"_id": stock_id})
    
    logger.info(f"Depo stok silindi: {item.get('item_name')} (Kalan: {item.get('remaining_items')}) - {user.name}")
    
    return {"success": True, "message": "Stok kaydı silindi"}


@router.patch("/stock/{stock_id}/location")
async def update_warehouse_location(stock_id: str, request: Request):
    """Depo içi konumu güncelle (raf)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi"])(request)
    data = await request.json()
    
    location = data.get("warehouse_location", "")
    
    result = await warehouse_stock.update_one(
        {"_id": stock_id},
        {"$set": {
            "warehouse_location": location,
            "updated_at": get_turkey_time()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Stok kaydı bulunamadı")
    
    return {"success": True, "message": "Konum güncellendi"}


# --- İTS QR Parse ---

@router.post("/parse-qr")
async def parse_its_qr_endpoint(request: Request):
    """
    İTS QR kodunu parse et ve bilgileri döndür
    """
    await get_current_user(request)
    data = await request.json()
    
    qr_code = data.get("qr_code", "").strip()
    if not qr_code:
        raise HTTPException(status_code=400, detail="QR kod gerekli")
    
    result = await parse_its_qr(qr_code)
    
    return result


# --- İstatistikler ---

@router.get("/stats")
async def get_warehouse_stats(request: Request):
    """Depo istatistikleri"""
    await get_current_user(request)
    
    # Toplam ürün sayısı
    total_boxes = await warehouse_stock.count_documents({"status": "active"})
    
    # Toplam adet
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": None,
            "total_items": {"$sum": "$remaining_items"}
        }}
    ]
    agg = await warehouse_stock.aggregate(pipeline).to_list(1)
    total_items = agg[0]["total_items"] if agg else 0
    
    # Yakında dolacaklar (30 gün)
    thirty_days = get_turkey_time() + timedelta(days=30)
    expiring_soon = await warehouse_stock.count_documents({
        "status": "active",
        "expiry_date": {"$lte": thirty_days, "$gte": get_turkey_time()}
    })
    
    # Süresi dolmuş
    expired = await warehouse_stock.count_documents({
        "status": "active",
        "expiry_date": {"$lt": get_turkey_time()}
    })
    
    return {
        "total_boxes": total_boxes,
        "total_items": total_items,
        "expiring_soon": expiring_soon,
        "expired": expired
    }


# ============ TRANSFER TALEPLERİ ============

@router.post("/transfers/request")
async def create_transfer_request(request: Request):
    """
    Transfer talebi oluştur (araç/bekleme noktası → depoya)
    Paramedik, ATT, vb. talep oluşturabilir
    """
    user = await get_current_user(request)
    data = await request.json()
    
    doc = {
        "_id": str(uuid.uuid4()),
        "from_location": "warehouse",
        "to_type": data.get("to_type"),
        "to_id": data.get("to_id"),
        "to_name": data.get("to_name"),
        "items": data.get("items", []),
        "reason": data.get("reason"),
        "status": "pending",
        "requested_by": user.id,
        "requested_by_name": user.name,
        "requested_at": get_turkey_time()
    }
    
    await warehouse_transfers.insert_one(doc)
    
    logger.info(f"Transfer talebi oluşturuldu: {user.name} → {data.get('to_name')}")
    
    return {"success": True, "transfer_id": doc["_id"], "message": "Transfer talebi oluşturuldu"}


@router.get("/transfers")
async def get_transfer_requests(
    request: Request,
    status: Optional[str] = None
):
    """Transfer taleplerini listele"""
    await get_current_user(request)
    
    query = {}
    if status:
        query["status"] = status
    
    transfers = await warehouse_transfers.find(query).sort("requested_at", -1).to_list(500)
    
    for t in transfers:
        t["id"] = t.pop("_id", "")
    
    return {"transfers": transfers}


@router.get("/transfers/{transfer_id}")
async def get_transfer_detail(transfer_id: str, request: Request):
    """Transfer detayı"""
    await get_current_user(request)
    
    transfer = await warehouse_transfers.find_one({"_id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer kaydı bulunamadı")
    
    transfer["id"] = transfer.pop("_id", "")
    
    return transfer


@router.post("/transfers/{transfer_id}/approve")
async def approve_transfer_request(transfer_id: str, request: Request):
    """
    Transfer talebini onayla (Sadece operasyon müdürü)
    """
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    transfer = await warehouse_transfers.find_one({"_id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer kaydı bulunamadı")
    
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Sadece bekleyen talepler onaylanabilir")
    
    await warehouse_transfers.update_one(
        {"_id": transfer_id},
        {"$set": {
            "status": "approved",
            "approved_by": user.id,
            "approved_by_name": user.name,
            "approved_at": get_turkey_time()
        }}
    )
    
    logger.info(f"Transfer onaylandı: {transfer_id} - {user.name}")
    
    return {"success": True, "message": "Transfer talebi onaylandı"}


@router.post("/transfers/{transfer_id}/reject")
async def reject_transfer_request(transfer_id: str, request: Request):
    """Transfer talebini reddet"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    data = await request.json()
    
    transfer = await warehouse_transfers.find_one({"_id": transfer_id})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer kaydı bulunamadı")
    
    if transfer["status"] != "pending":
        raise HTTPException(status_code=400, detail="Sadece bekleyen talepler reddedilebilir")
    
    await warehouse_transfers.update_one(
        {"_id": transfer_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": user.id,
            "rejected_reason": data.get("reason", ""),
            "updated_at": get_turkey_time()
        }}
    )
    
    logger.info(f"Transfer reddedildi: {transfer_id} - {user.name}")
    
    return {"success": True, "message": "Transfer talebi reddedildi"}


# ============ KUTU PARÇALAMA (SPLIT) ============

@router.post("/stock/{stock_id}/split")
async def split_warehouse_box(stock_id: str, request: Request):
    """
    Depo kutusu parçala ve hedefe gönder
    - Kutudan N adet çıkar
    - Hedefe internal QR ile ekle
    - Split kaydı oluştur
    
    Yetki: Merkez ofis, operasyon müdürü, çağrı merkezi, baş şoför
    """
    user = await require_roles(["merkez_ofis", "operasyon_muduru", "cagri_merkezi", "bas_sofor"])(request)
    data = await request.json()
    
    quantity_to_split = data.get("quantity", 0)
    destination_id = data.get("destination_id")
    destination_name = data.get("destination_name")
    destination_type = data.get("destination_type")  # vehicle, waiting_point
    transfer_id = data.get("transfer_id")  # Opsiyonel - hangi talebe bağlı
    
    if quantity_to_split <= 0:
        raise HTTPException(status_code=400, detail="Geçerli bir miktar girin")
    
    if not destination_id or not destination_type:
        raise HTTPException(status_code=400, detail="Hedef lokasyon gerekli")
    
    # Depo stoğunu bul
    item = await warehouse_stock.find_one({"_id": stock_id})
    if not item:
        raise HTTPException(status_code=404, detail="Depo stok kaydı bulunamadı")
    
    # Yeterli stok var mı kontrol et
    if item["remaining_items"] < quantity_to_split:
        raise HTTPException(
            status_code=400, 
            detail=f"Yetersiz stok. Kalan: {item['remaining_items']} adet"
        )
    
    # 1. Depo stoğundan düş
    new_remaining = item["remaining_items"] - quantity_to_split
    new_status = "empty" if new_remaining == 0 else ("split" if item["total_items"] != new_remaining else "active")
    
    await warehouse_stock.update_one(
        {"_id": stock_id},
        {"$set": {
            "remaining_items": new_remaining,
            "is_opened": True,
            "status": new_status,
            "updated_at": get_turkey_time()
        }}
    )
    
    # 2. Hedef lokasyona ekle (stock_new sistemine)
    from routes.stock_new import location_stocks
    
    target_stock = await location_stocks.find_one({"location_id": destination_id})
    if not target_stock:
        # Yoksa oluştur
        target_stock = {
            "_id": str(uuid.uuid4()),
            "location_id": destination_id,
            "location_type": destination_type,
            "location_name": destination_name,
            "items": [],
            "created_at": get_turkey_time(),
            "updated_at": get_turkey_time()
        }
        await location_stocks.insert_one(target_stock)
    
    # İlacı ekle veya güncelle
    items = target_stock.get("items", [])
    found = False
    for existing_item in items:
        if existing_item["name"] == item["item_name"]:
            existing_item["quantity"] += quantity_to_split
            found = True
            break
    
    if not found:
        items.append({
            "name": item["item_name"],
            "quantity": quantity_to_split,
            "min_quantity": 1,
            "unit": "ADET",
            "category": item.get("category", "ilac")
        })
    
    await location_stocks.update_one(
        {"location_id": destination_id},
        {"$set": {"items": items, "updated_at": get_turkey_time()}}
    )
    
    # 3. Internal QR generate et
    internal_qr = generate_internal_qr(destination_id, item["item_name"])
    
    internal_qr_doc = {
        "_id": str(uuid.uuid4()),
        "qr_code": internal_qr,
        "location_id": destination_id,
        "location_name": destination_name,
        "location_type": destination_type,
        "item_name": item["item_name"],
        "quantity": quantity_to_split,
        "unit": "ADET",
        "category": item.get("category", "ilac"),
        "expiry_date": item.get("expiry_date"),
        "lot_number": item.get("lot_number"),
        "source_warehouse_qr": item["qr_code"],
        "created_at": get_turkey_time(),
        "status": "active"
    }
    
    await internal_qr_codes.insert_one(internal_qr_doc)
    
    # 4. Split kaydı oluştur
    split_doc = {
        "_id": str(uuid.uuid4()),
        "warehouse_stock_id": stock_id,
        "qr_code": item["qr_code"],
        "item_name": item["item_name"],
        "gtin": item["gtin"],
        "lot_number": item.get("lot_number", ""),
        "expiry_date": item.get("expiry_date"),
        "quantity_split": quantity_to_split,
        "destination_type": destination_type,
        "destination_id": destination_id,
        "destination_name": destination_name,
        "split_by": user.id,
        "split_by_name": user.name,
        "split_at": get_turkey_time(),
        "transfer_id": transfer_id,
        "internal_qr": internal_qr
    }
    
    await warehouse_splits.insert_one(split_doc)
    
    # 5. Eğer transfer talebi varsa durumunu güncelle
    if transfer_id:
        await warehouse_transfers.update_one(
            {"_id": transfer_id},
            {"$set": {
                "status": "delivered",
                "delivered_by": user.id,
                "delivered_at": get_turkey_time()
            }}
        )
    
    logger.info(f"Kutu parçalandı: {item['item_name']} x{quantity_to_split} → {destination_name} - {user.name}")
    
    return {
        "success": True,
        "message": f"{quantity_to_split} adet {destination_name} lokasyonuna gönderildi",
        "internal_qr": internal_qr,
        "remaining_in_warehouse": new_remaining
    }


@router.get("/splits")
async def get_split_history(request: Request, destination_id: Optional[str] = None):
    """Parçalama geçmişini listele"""
    await get_current_user(request)
    
    query = {}
    if destination_id:
        query["destination_id"] = destination_id
    
    splits = await warehouse_splits.find(query).sort("split_at", -1).to_list(500)
    
    for s in splits:
        s["id"] = s.pop("_id", "")
    
    return {"splits": splits}


# ============ INTERNAL QR SİSTEMİ ============

@router.get("/internal-qr/{location_id}")
async def get_internal_qr_codes(location_id: str, request: Request):
    """Bir lokasyondaki internal QR'ları listele"""
    await get_current_user(request)
    
    qr_codes = await internal_qr_codes.find({
        "location_id": location_id,
        "status": "active"
    }).to_list(500)
    
    for qr in qr_codes:
        qr["id"] = qr.pop("_id", "")
    
    return {"qr_codes": qr_codes}


@router.post("/internal-qr/scan")
async def scan_internal_qr(request: Request):
    """
    Internal QR okut - ürün bilgilerini getir
    """
    user = await get_current_user(request)
    data = await request.json()
    
    qr_code = data.get("qr_code", "").strip()
    if not qr_code:
        raise HTTPException(status_code=400, detail="QR kod gerekli")
    
    # QR'ı bul
    qr_item = await internal_qr_codes.find_one({"qr_code": qr_code})
    if not qr_item:
        raise HTTPException(status_code=404, detail="QR kod bulunamadı")
    
    # Son tarama zamanını güncelle
    await internal_qr_codes.update_one(
        {"_id": qr_item["_id"]},
        {"$set": {"last_scan": get_turkey_time()}}
    )
    
    qr_item["id"] = qr_item.pop("_id", "")
    
    return qr_item


@router.get("/supplies/list")
async def get_supplies_list(request: Request):
    """Sarf malzemeleri ve itriyat listesi"""
    import json
    import os
    
    try:
        # JSON dosyasını oku
        json_path = os.path.join(os.path.dirname(__file__), "..", "data", "non_drug_supplies.json")
        with open(json_path, "r", encoding="utf-8") as f:
            supplies_data = json.load(f)
        
        # Tüm kategorileri birleştir
        all_supplies = []
        for category, items in supplies_data.items():
            for item in items:
                item["category"] = category
                all_supplies.append(item)
        
        return {
            "success": True,
            "supplies": all_supplies,
            "categories": list(supplies_data.keys()),
            "total": len(all_supplies)
        }
    except Exception as e:
        logger.error(f"Sarf malzemeleri listesi yüklenemedi: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Liste yüklenemedi: {str(e)}")


@router.post("/internal-qr/{qr_id}/use")
async def use_internal_qr_stock(qr_id: str, request: Request):
    """
    Internal QR ile stok kullan (vakada)
    """
    user = await get_current_user(request)
    data = await request.json()
    
    quantity = data.get("quantity", 1)
    case_id = data.get("case_id")  # Opsiyonel
    
    qr_item = await internal_qr_codes.find_one({"_id": qr_id})
    if not qr_item:
        raise HTTPException(status_code=404, detail="QR kod bulunamadı")
    
    if qr_item["quantity"] < quantity:
        raise HTTPException(status_code=400, detail=f"Yetersiz stok. Kalan: {qr_item['quantity']}")
    
    # Miktarı azalt
    new_quantity = qr_item["quantity"] - quantity
    new_status = "used" if new_quantity == 0 else "active"
    
    await internal_qr_codes.update_one(
        {"_id": qr_id},
        {"$set": {
            "quantity": new_quantity,
            "status": new_status,
            "last_scan": get_turkey_time()
        }}
    )
    
    # Lokasyon stoğundan da düş
    from routes.stock_new import location_stocks
    
    loc = await location_stocks.find_one({"location_id": qr_item["location_id"]})
    if loc:
        items = loc.get("items", [])
        for item in items:
            if item["name"] == qr_item["item_name"]:
                item["quantity"] = max(0, item["quantity"] - quantity)
                break
        
        await location_stocks.update_one(
            {"_id": loc["_id"]},
            {"$set": {"items": items, "updated_at": get_turkey_time()}}
        )
    
    logger.info(f"Internal QR kullanıldı: {qr_item['item_name']} x{quantity} - {user.name}")
    
    return {
        "success": True,
        "message": f"{quantity} adet kullanıldı",
        "remaining": new_quantity
    }


