"""
İlaç Takip Sistemi (İTS) API Endpoints
======================================
GTIN-İlaç adı eşleştirme ve karekod parse işlemleri
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from auth_utils import get_current_user, require_roles
from services.its_service import (
    get_its_service, 
    configure_its_service,
    parse_datamatrix,
    get_drug_info_from_barcode
)
from database import db
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# MongoDB collection for ITS drug cache
its_drugs_collection = db["its_drugs"]


class ITSConfigRequest(BaseModel):
    """İTS yapılandırma isteği"""
    username: str  # GLN numarası
    password: str
    use_test: bool = True


class BarcodeParseRequest(BaseModel):
    """Karekod parse isteği"""
    barcode: str


class DrugSearchRequest(BaseModel):
    """İlaç arama isteği"""
    query: str
    limit: int = 20


# ============================================================================
# İTS YAPILANDIRMA
# ============================================================================

@router.post("/configure")
async def configure_its(data: ITSConfigRequest, request: Request):
    """
    İTS servisini yapılandır (Sadece müdür/merkez ofis)
    """
    await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    configure_its_service(
        username=data.username,
        password=data.password,
        use_test=data.use_test
    )
    
    # Yapılandırmayı veritabanına kaydet
    await db["settings"].update_one(
        {"key": "its_config"},
        {"$set": {
            "key": "its_config",
            "username": data.username,
            "password": data.password,  # Şifreyi de kaydet (MongoDB şifreli bağlantıda)
            "use_test": data.use_test,
            "configured": True
        }},
        upsert=True
    )
    
    return {"message": "İTS servisi yapılandırıldı", "test_mode": data.use_test}


@router.get("/status")
async def get_its_status(request: Request):
    """İTS servis durumunu getir"""
    await get_current_user(request)
    
    service = get_its_service()
    cache_stats = service.get_cache_stats()
    
    # Yapılandırma durumunu kontrol et
    config = await db["settings"].find_one({"key": "its_config"})
    
    return {
        "configured": config.get("configured", False) if config else False,
        "test_mode": config.get("use_test", True) if config else True,
        "cache": cache_stats,
        "has_token": service.access_token is not None
    }


# ============================================================================
# İLAÇ LİSTESİ
# ============================================================================

@router.post("/sync-drugs")
async def sync_drug_list(request: Request, background_tasks: BackgroundTasks):
    """
    İTS'den ilaç listesini senkronize et (arka planda)
    """
    await require_roles(["operasyon_muduru", "merkez_ofis", "bas_sofor"])(request)
    
    service = get_its_service()
    
    if not service.username:
        raise HTTPException(status_code=400, detail="İTS servisi yapılandırılmamış")
    
    # Arka planda senkronize et
    background_tasks.add_task(_sync_drugs_task)
    
    return {"message": "İlaç listesi senkronizasyonu başlatıldı"}


async def _sync_drugs_task():
    """İlaç senkronizasyon görevi"""
    try:
        service = get_its_service()
        drugs = await service.fetch_drug_list(get_all=False)
        
        if drugs:
            # MongoDB'ye kaydet
            for drug in drugs:
                gtin = drug.get("gtin")
                if gtin:
                    await its_drugs_collection.update_one(
                        {"gtin": gtin},
                        {"$set": {
                            "gtin": gtin,
                            "name": drug.get("drugName", ""),
                            "manufacturer_gln": drug.get("manufacturerGLN", ""),
                            "manufacturer_name": drug.get("manufacturerName", ""),
                            "is_imported": drug.get("isImported", False),
                            "is_active": drug.get("isActive", True)
                        }},
                        upsert=True
                    )
            
            logger.info("İTS ilaç senkronizasyonu tamamlandı: %d ilaç", len(drugs))
            
    except Exception as e:
        logger.error("İTS senkronizasyon hatası: %s", str(e))


@router.get("/drugs")
async def get_cached_drugs(
    request: Request, 
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """
    Cache'deki ilaç listesini getir
    """
    await get_current_user(request)
    
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    drugs = await its_drugs_collection.find(query).skip(offset).limit(limit).to_list(limit)
    total = await its_drugs_collection.count_documents(query)
    
    for drug in drugs:
        drug["id"] = str(drug.pop("_id"))
    
    return {
        "drugs": drugs,
        "total": total,
        "offset": offset,
        "limit": limit
    }


@router.get("/drugs/{gtin}")
async def get_drug_by_gtin(gtin: str, request: Request):
    """
    GTIN ile ilaç bilgisi getir
    """
    await get_current_user(request)
    
    # Önce veritabanından ara
    drug = await its_drugs_collection.find_one({"gtin": gtin})
    
    if drug:
        drug["id"] = str(drug.pop("_id"))
        return drug
    
    # Cache'den ara
    service = get_its_service()
    cached_drug = service.get_drug_by_gtin(gtin)
    
    if cached_drug:
        return cached_drug
    
    raise HTTPException(status_code=404, detail="İlaç bulunamadı")


# ============================================================================
# KAREKOD İŞLEMLERİ
# ============================================================================

@router.post("/parse-barcode")
async def parse_barcode(data: BarcodeParseRequest, request: Request):
    """
    Karekodu parse et ve ilaç bilgisini getir
    """
    await get_current_user(request)
    
    # Parse et
    parsed = parse_datamatrix(data.barcode)
    
    result = {
        "parsed": parsed,
        "drug": None
    }
    
    # GTIN varsa ilaç bilgisi getir
    if parsed.get("gtin"):
        # Önce veritabanından
        drug = await its_drugs_collection.find_one({"gtin": parsed["gtin"]})
        if drug:
            drug["id"] = str(drug.pop("_id"))
            result["drug"] = drug
        else:
            # Cache'den
            service = get_its_service()
            result["drug"] = service.get_drug_by_gtin(parsed["gtin"])
    
    return result


@router.post("/search-drugs")
async def search_drugs(data: DrugSearchRequest, request: Request):
    """
    İlaç adına göre arama yap
    """
    await get_current_user(request)
    
    # Veritabanından ara
    drugs = await its_drugs_collection.find({
        "name": {"$regex": data.query, "$options": "i"}
    }).limit(data.limit).to_list(data.limit)
    
    for drug in drugs:
        drug["id"] = str(drug.pop("_id"))
    
    return {"drugs": drugs, "count": len(drugs)}


# ============================================================================
# MANUEL İLAÇ EKLEMESİ (İTS bağlantısı yoksa)
# ============================================================================

class ManualDrugRequest(BaseModel):
    """Manuel ilaç ekleme"""
    gtin: str
    name: str
    manufacturer_name: Optional[str] = None


@router.post("/drugs/manual")
async def add_manual_drug(data: ManualDrugRequest, request: Request):
    """
    Manuel ilaç ekle (İTS bağlantısı olmadan)
    """
    await require_roles(["operasyon_muduru", "merkez_ofis", "bas_sofor"])(request)
    
    # GTIN formatını kontrol et
    gtin = data.gtin.zfill(14)
    
    # Zaten var mı kontrol et
    existing = await its_drugs_collection.find_one({"gtin": gtin})
    if existing:
        raise HTTPException(status_code=400, detail="Bu GTIN zaten kayıtlı")
    
    drug = {
        "gtin": gtin,
        "name": data.name,
        "manufacturer_name": data.manufacturer_name or "",
        "manufacturer_gln": "",
        "is_imported": False,
        "is_active": True,
        "is_manual": True  # Manuel eklendi işareti
    }
    
    await its_drugs_collection.insert_one(drug)
    
    return {"message": "İlaç eklendi", "gtin": gtin, "name": data.name}


@router.delete("/drugs/{gtin}")
async def delete_drug(gtin: str, request: Request):
    """
    Manuel eklenen ilacı sil
    """
    await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    result = await its_drugs_collection.delete_one({"gtin": gtin, "is_manual": True})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="İlaç bulunamadı veya manuel değil")
    
    return {"message": "İlaç silindi"}

