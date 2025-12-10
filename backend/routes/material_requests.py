"""
Malzeme Talepleri API
- Şoförler malzeme talebi oluşturabilir
- Çağrı Merkezi, Baş Şoför, Merkez Ofis görüntüleyebilir ve onaylayabilir
"""

from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from database import db, vehicles_collection, users_collection
from models import MaterialRequest, MaterialRequestCreate, MaterialRequestItem
from auth_utils import get_current_user, require_roles

router = APIRouter()
logger = logging.getLogger(__name__)

# Collection
material_requests_collection = db.material_requests


@router.post("")
async def create_material_request(data: MaterialRequestCreate, request: Request):
    """
    Yeni malzeme talebi oluştur
    Şoförler ve saha personeli kullanabilir
    """
    user = await get_current_user(request)
    
    # Araç bilgisini al
    vehicle_plate = data.vehicle_plate
    if data.vehicle_id and not vehicle_plate:
        vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
        if vehicle:
            vehicle_plate = vehicle.get("plate")
    
    # Talep oluştur
    new_request = MaterialRequest(
        requester_id=user.id,
        requester_name=user.name,
        requester_role=user.role,
        vehicle_id=data.vehicle_id,
        vehicle_plate=vehicle_plate,
        location=data.location,
        items=[item.model_dump() for item in data.items],
        priority=data.priority,
        notes=data.notes
    )
    
    request_dict = new_request.model_dump(by_alias=True)
    await material_requests_collection.insert_one(request_dict)
    
    logger.info(f"Malzeme talebi oluşturuldu: {new_request.id} - {user.name}")
    
    # Yöneticilere bildirim gönder
    try:
        from services.onesignal_service import onesignal_service, NotificationType
        
        managers = await users_collection.find({
            "role": {"$in": ["bas_sofor", "operasyon_muduru", "merkez_ofis", "cagri_merkezi"]},
            "is_active": True
        }).to_list(100)
        
        manager_ids = [m["_id"] for m in managers]
        
        if manager_ids:
            item_names = ", ".join([item.name for item in data.items[:3]])
            if len(data.items) > 3:
                item_names += f" +{len(data.items) - 3} diğer"
            
            await onesignal_service.send_notification(
                NotificationType.SYSTEM_ALERT,
                manager_ids,
                {
                    "message": f"Yeni malzeme talebi: {user.name} - {item_names}"
                }
            )
    except Exception as e:
        logger.warning(f"Bildirim gönderilemedi: {e}")
    
    request_dict["id"] = request_dict.pop("_id")
    return request_dict


@router.get("")
async def get_material_requests(
    request: Request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    my_only: bool = False
):
    """
    Malzeme taleplerini getir
    - Şoförler: Sadece kendi talepleri (my_only=true)
    - Yöneticiler: Tüm talepler
    """
    user = await get_current_user(request)
    
    query = {}
    
    # Şoför ise sadece kendi taleplerini görsün
    if user.role == "sofor" or my_only:
        query["requester_id"] = user.id
    
    if status:
        query["status"] = status
    
    if priority:
        query["priority"] = priority
    
    requests = await material_requests_collection.find(query).sort("created_at", -1).to_list(500)
    
    for req in requests:
        req["id"] = req.pop("_id")
    
    return requests


@router.get("/pending")
async def get_pending_requests(request: Request):
    """
    Bekleyen malzeme taleplerini getir (Yöneticiler için)
    """
    await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "cagri_merkezi"])(request)
    
    requests = await material_requests_collection.find({
        "status": "pending"
    }).sort("created_at", -1).to_list(500)
    
    for req in requests:
        req["id"] = req.pop("_id")
    
    return requests


@router.get("/stats")
async def get_request_stats(request: Request):
    """
    Malzeme talebi istatistikleri
    """
    await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "cagri_merkezi"])(request)
    
    pending = await material_requests_collection.count_documents({"status": "pending"})
    approved = await material_requests_collection.count_documents({"status": "approved"})
    rejected = await material_requests_collection.count_documents({"status": "rejected"})
    completed = await material_requests_collection.count_documents({"status": "completed"})
    
    # Bugünkü talepler
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    today_start = datetime.combine(turkey_now.date(), datetime.min.time())
    
    today_count = await material_requests_collection.count_documents({
        "created_at": {"$gte": today_start}
    })
    
    return {
        "pending": pending,
        "approved": approved,
        "rejected": rejected,
        "completed": completed,
        "today": today_count
    }


@router.get("/{request_id}")
async def get_material_request(request_id: str, request: Request):
    """
    Tek bir malzeme talebini getir
    """
    user = await get_current_user(request)
    
    req = await material_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    # Şoför ise sadece kendi talebini görebilir
    if user.role == "sofor" and req["requester_id"] != user.id:
        raise HTTPException(status_code=403, detail="Bu talebi görme yetkiniz yok")
    
    req["id"] = req.pop("_id")
    return req


@router.patch("/{request_id}/review")
async def review_material_request(request_id: str, request: Request):
    """
    Malzeme talebini onayla veya reddet
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis", "cagri_merkezi"])(request)
    body = await request.json()
    
    req = await material_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Bu talep zaten işlenmiş")
    
    approve = body.get("approve", True)
    notes = body.get("notes", "")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    new_status = "approved" if approve else "rejected"
    
    await material_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": user.id,
            "reviewed_by_name": user.name,
            "reviewed_at": turkey_now,
            "review_notes": notes,
            "updated_at": turkey_now
        }}
    )
    
    logger.info(f"Malzeme talebi {new_status}: {request_id} - İşleyen: {user.name}")
    
    # Talep edene bildirim gönder
    try:
        from services.onesignal_service import onesignal_service, NotificationType
        
        await onesignal_service.send_notification(
            NotificationType.SYSTEM_ALERT,
            [req["requester_id"]],
            {
                "message": f"Malzeme talebiniz {'onaylandı' if approve else 'reddedildi'}: {notes if notes else ''}"
            }
        )
    except Exception as e:
        logger.warning(f"Bildirim gönderilemedi: {e}")
    
    return {"message": f"Talep {'onaylandı' if approve else 'reddedildi'}"}


@router.patch("/{request_id}/complete")
async def complete_material_request(request_id: str, request: Request):
    """
    Malzeme talebini tamamlandı olarak işaretle
    """
    user = await require_roles(["bas_sofor", "operasyon_muduru", "merkez_ofis"])(request)
    
    req = await material_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    if req["status"] != "approved":
        raise HTTPException(status_code=400, detail="Sadece onaylanmış talepler tamamlanabilir")
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    await material_requests_collection.update_one(
        {"_id": request_id},
        {"$set": {
            "status": "completed",
            "completed_by": user.id,
            "completed_at": turkey_now,
            "updated_at": turkey_now
        }}
    )
    
    logger.info(f"Malzeme talebi tamamlandı: {request_id} - Tamamlayan: {user.name}")
    
    return {"message": "Talep tamamlandı olarak işaretlendi"}


@router.delete("/{request_id}")
async def delete_material_request(request_id: str, request: Request):
    """
    Malzeme talebini sil (sadece bekleyen talepler silinebilir)
    """
    user = await get_current_user(request)
    
    req = await material_requests_collection.find_one({"_id": request_id})
    if not req:
        raise HTTPException(status_code=404, detail="Talep bulunamadı")
    
    # Sadece talep eden veya yönetici silebilir
    if req["requester_id"] != user.id and user.role not in ["bas_sofor", "operasyon_muduru", "merkez_ofis"]:
        raise HTTPException(status_code=403, detail="Bu talebi silme yetkiniz yok")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Sadece bekleyen talepler silinebilir")
    
    await material_requests_collection.delete_one({"_id": request_id})
    
    logger.info(f"Malzeme talebi silindi: {request_id} - Silen: {user.name}")
    
    return {"message": "Talep silindi"}

