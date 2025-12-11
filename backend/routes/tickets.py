"""
Ticket (Bildirim ve Talepler) Routes
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from utils.timezone import get_turkey_time
import uuid
import logging

from auth_utils import get_current_user, require_roles
from database import db, users_collection

router = APIRouter()
logger = logging.getLogger(__name__)

# MongoDB collection
tickets_collection = db.tickets

# Ticket'ları görebilecek roller
TICKET_ADMIN_ROLES = ["operasyon_muduru", "merkez_ofis", "bas_sofor"]


class TicketItem(BaseModel):
    name: str
    quantity: int = 1
    unit: str = "adet"
    barcode: Optional[str] = None


class TicketCreate(BaseModel):
    type: str  # bildirim, malzeme_talep, ilac_talep
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: str = "normal"
    vehicle_id: Optional[str] = None
    case_id: Optional[str] = None
    shift_id: Optional[str] = None
    photos: Optional[List[dict]] = []
    items: Optional[List[TicketItem]] = []
    notes: Optional[str] = None
    urgency: str = "normal"


@router.post("")
async def create_ticket(data: TicketCreate, request: Request):
    """Yeni ticket oluştur"""
    user = await get_current_user(request)
    
    ticket_id = str(uuid.uuid4())
    ticket = {
        "_id": ticket_id,
        "type": data.type,
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "priority": data.priority,
        "urgency": data.urgency,
        "vehicle_id": data.vehicle_id if data.vehicle_id != "none" else None,
        "case_id": data.case_id if data.case_id != "none" else None,
        "shift_id": data.shift_id,
        "photos": data.photos or [],
        "items": [item.dict() for item in (data.items or [])],
        "notes": data.notes,
        "status": "pending",  # pending, in_progress, completed, rejected
        "created_by": user.id,
        "created_by_name": user.name,
        "created_at": get_turkey_time(),
        "updated_at": get_turkey_time(),
        "resolved_by": None,
        "resolved_at": None,
        "resolution_notes": None
    }
    
    await tickets_collection.insert_one(ticket)
    
    logger.info(f"Ticket oluşturuldu: {ticket['_id']} by {user.name}")
    
    # Bildirim: Yöneticiler /dashboard/tickets-approvals sayfasından görecek
    # OneSignal yerine sayfa bazlı sistem kullanılıyor
    
    ticket["id"] = ticket.pop("_id")
    return ticket


@router.get("")
async def get_tickets(
    request: Request,
    type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Ticketları listele"""
    user = await get_current_user(request)
    
    query = {}
    
    # Admin rolleri tüm ticketları görür
    if user.role not in ["operasyon_muduru", "merkez_ofis", "bas_sofor"]:
        query["created_by"] = user.id
    
    if type:
        query["type"] = type
    
    if status:
        query["status"] = status
    
    tickets = await tickets_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for t in tickets:
        t["id"] = t.pop("_id")
    
    return tickets


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, request: Request):
    """Ticket detayı"""
    await get_current_user(request)
    
    ticket = await tickets_collection.find_one({"_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı")
    
    ticket["id"] = ticket.pop("_id")
    return ticket


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None


@router.patch("/{ticket_id}")
async def update_ticket(ticket_id: str, data: TicketUpdate, request: Request):
    """Ticket güncelle (durum, notlar)"""
    user = await get_current_user(request)
    
    if user.role not in TICKET_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    update_data = {"updated_at": datetime.utcnow()}
    
    if data.status:
        update_data["status"] = data.status
    
    if data.status in ["completed", "rejected"]:
        update_data["resolved_by"] = user.id
        update_data["resolved_by_name"] = user.name
        update_data["resolved_at"] = get_turkey_time()
        
    if data.resolution_notes:
        update_data["resolution_notes"] = data.resolution_notes
    
    result = await tickets_collection.update_one(
        {"_id": ticket_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı")
    
    logger.info(f"Ticket güncellendi: {ticket_id} - {data.status} by {user.name}")
    
    return {"message": "Ticket güncellendi"}


@router.patch("/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    request: Request,
    status: str,
    notes: Optional[str] = None
):
    """Ticket durumunu güncelle (eski API uyumluluğu için)"""
    user = await get_current_user(request)
    
    if user.role not in TICKET_ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    update_data = {
        "status": status,
        "updated_at": get_turkey_time()
    }
    
    if status in ["completed", "rejected"]:
        update_data["resolved_by"] = user.id
        update_data["resolved_by_name"] = user.name
        update_data["resolved_at"] = get_turkey_time()
        update_data["resolution_notes"] = notes
    
    result = await tickets_collection.update_one(
        {"_id": ticket_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı")
    
    return {"message": "Durum güncellendi"}


@router.get("/pending/count")
async def get_pending_count(request: Request):
    """Bekleyen ticket sayısı"""
    await get_current_user(request)
    
    count = await tickets_collection.count_documents({"status": "pending"})
    return {"count": count}

