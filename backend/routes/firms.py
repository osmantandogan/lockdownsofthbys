"""
Firma (Company) Yönetim Router'ı
Çağrı merkezi formu için firma listesi yönetimi
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import logging

from database import firms_collection
from auth_utils import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


class FirmCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class FirmResponse(BaseModel):
    id: str
    name: str
    is_active: bool = True
    created_at: datetime


@router.get("")
async def get_all_firms(request: Request):
    """Tüm firmaları listele"""
    try:
        await get_current_user(request)
        
        firms = await firms_collection.find({"is_active": True}).sort("name", 1).to_list(1000)
    
        result = []
        for firm in firms:
            result.append({
                "id": str(firm.get("_id", "")),
                "_id": str(firm.get("_id", "")),
                "name": firm.get("name", ""),
                "is_active": firm.get("is_active", True),
                "created_at": firm.get("created_at", datetime.utcnow())
            })
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firmalar yüklenirken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Firmalar yüklenemedi: {str(e)}")


@router.post("")
async def create_firm(request: Request, firm_data: FirmCreate):
    """Yeni firma ekle"""
    try:
        user = await get_current_user(request)
        
        # Aynı isimde firma var mı kontrol et
        existing = await firms_collection.find_one({"name": firm_data.name})
        if existing:
            raise HTTPException(status_code=400, detail="Bu isimde bir firma zaten mevcut")
        
        firm_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        new_firm = {
            "_id": firm_id,
            "name": firm_data.name,
            "is_active": True,
            "created_at": now,
            "created_by": user.id
        }
        
        await firms_collection.insert_one(new_firm)
        
        logger.info(f"Yeni firma oluşturuldu: {firm_data.name}")
        
        return {
            "id": firm_id,
            "_id": firm_id,
            "name": firm_data.name,
            "is_active": True,
            "created_at": now
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firma oluşturulurken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Firma oluşturulamadı: {str(e)}")


@router.delete("/{firm_id}")
async def delete_firm(request: Request, firm_id: str):
    """Firmayı sil"""
    try:
        await get_current_user(request)
        
        firm = await firms_collection.find_one({"_id": firm_id})
        if not firm:
            raise HTTPException(status_code=404, detail="Firma bulunamadı")
        
        await firms_collection.delete_one({"_id": firm_id})
        
        logger.info(f"Firma silindi: {firm.get('name')}")
        
        return {"message": "Firma başarıyla silindi", "id": firm_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firma silinirken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Firma silinemedi: {str(e)}")
