"""
Firma (Company) Yönetim Router'ı
Çağrı merkezi formu için firma listesi yönetimi
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import logging

from database import db
from routes.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

def get_firms_collection():
    """Firms collection getter"""
    return db.firms


class FirmCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    is_active: bool = True


class FirmUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class FirmResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None


@router.get("", response_model=List[FirmResponse])
async def get_all_firms(
    include_inactive: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Tüm firmaları listele"""
    try:
        firms_collection = get_firms_collection()
        query = {}
        if not include_inactive:
            query["is_active"] = True
        
        firms = await firms_collection.find(query).sort("name", 1).to_list(1000)
    
        result = []
        for firm in firms:
            result.append(FirmResponse(
                id=str(firm.get("_id", firm.get("id", ""))),
                name=firm.get("name", ""),
                description=firm.get("description"),
                is_active=firm.get("is_active", True),
                created_at=firm.get("created_at", datetime.utcnow()),
                updated_at=firm.get("updated_at")
            ))
        
        return result
    except Exception as e:
        logger.error(f"Firmalar yüklenirken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Firmalar yüklenemedi: {str(e)}")


@router.post("", response_model=FirmResponse)
async def create_firm(
    firm_data: FirmCreate,
    current_user: dict = Depends(get_current_user)
):
    """Yeni firma ekle"""
    try:
        firms_collection = get_firms_collection()
        
        # Aynı isimde firma var mı kontrol et
        existing = await firms_collection.find_one({"name": firm_data.name})
        if existing:
            raise HTTPException(status_code=400, detail="Bu isimde bir firma zaten mevcut")
        
        firm_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        new_firm = {
            "_id": firm_id,
            "name": firm_data.name,
            "description": firm_data.description,
            "is_active": firm_data.is_active,
            "created_at": now,
            "updated_at": None,
            "created_by": current_user.get("_id")
        }
        
        await firms_collection.insert_one(new_firm)
        
        logger.info(f"Yeni firma oluşturuldu: {firm_data.name}")
        
        return FirmResponse(
            id=firm_id,
            name=firm_data.name,
            description=firm_data.description,
            is_active=firm_data.is_active,
            created_at=now,
            updated_at=None
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firma oluşturulurken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Firma oluşturulamadı: {str(e)}")


@router.put("/{firm_id}", response_model=FirmResponse)
async def update_firm(
    firm_id: str,
    firm_data: FirmUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Firma bilgilerini güncelle"""
    try:
        firms_collection = get_firms_collection()
        
        firm = await firms_collection.find_one({"_id": firm_id})
        if not firm:
            raise HTTPException(status_code=404, detail="Firma bulunamadı")
        
        update_data = {"updated_at": datetime.utcnow()}
        
        if firm_data.name is not None:
            # Aynı isimde başka firma var mı kontrol et
            existing = await firms_collection.find_one({
                "name": firm_data.name,
                "_id": {"$ne": firm_id}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Bu isimde bir firma zaten mevcut")
            update_data["name"] = firm_data.name
        
        if firm_data.description is not None:
            update_data["description"] = firm_data.description
        
        if firm_data.is_active is not None:
            update_data["is_active"] = firm_data.is_active
        
        await firms_collection.update_one(
            {"_id": firm_id},
            {"$set": update_data}
        )
        
        updated_firm = await firms_collection.find_one({"_id": firm_id})
        
        return FirmResponse(
            id=firm_id,
            name=updated_firm.get("name", ""),
            description=updated_firm.get("description"),
            is_active=updated_firm.get("is_active", True),
            created_at=updated_firm.get("created_at", datetime.utcnow()),
            updated_at=updated_firm.get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Firma güncellenirken hata: {e}")
        raise HTTPException(status_code=500, detail=f"Firma güncellenemedi: {str(e)}")


@router.delete("/{firm_id}")
async def delete_firm(
    firm_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Firmayı sil"""
    try:
        firms_collection = get_firms_collection()
        
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
