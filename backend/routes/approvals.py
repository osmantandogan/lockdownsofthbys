"""
Approval Routes - Onay Kodu Yönetimi API
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from auth_utils import get_current_user, require_roles
from services.approval_service import (
    approval_service,
    create_shift_handover_approval,
    create_manager_shift_approval
)
from database import approvals_collection, users_collection, vehicles_collection, shift_assignments_collection

router = APIRouter()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class VerifyCodeRequest(BaseModel):
    code: str
    approval_type: Optional[str] = None


class CreateHandoverApprovalRequest(BaseModel):
    receiver_id: str
    vehicle_id: str


class CreateManagerApprovalRequest(BaseModel):
    vehicle_id: str
    action: str = "Vardiya Başlatma"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/verify")
async def verify_approval_code(data: VerifyCodeRequest, request: Request):
    """Onay kodunu doğrula"""
    user = await get_current_user(request)
    
    result = await approval_service.verify_code(
        code=data.code,
        approval_type=data.approval_type,
        verifier_id=user.id
    )
    
    if not result.get("valid"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Geçersiz onay kodu")
        )
    
    return result


@router.get("/pending")
async def get_my_pending_approvals(
    request: Request,
    approval_type: Optional[str] = None
):
    """Bekleyen onaylarımı getir"""
    user = await get_current_user(request)
    
    approvals = await approval_service.get_pending_approvals(
        user_id=user.id,
        approval_type=approval_type
    )
    
    return approvals


@router.post("/shift-handover")
async def create_shift_handover(data: CreateHandoverApprovalRequest, request: Request):
    """
    Vardiya devir teslim onayı oluştur
    Teslim alacak kişiye SMS, Email ve Push bildirim gönderir
    """
    user = await get_current_user(request)
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Alıcı bilgisini al
    receiver = await users_collection.find_one({"_id": data.receiver_id})
    if not receiver:
        raise HTTPException(status_code=404, detail="Teslim alacak kişi bulunamadı")
    
    # Onay oluştur
    result = await create_shift_handover_approval(
        giver_id=user.id,
        giver_name=user.name,
        receiver_id=data.receiver_id,
        vehicle_plate=vehicle.get("plate", ""),
        vehicle_id=data.vehicle_id
    )
    
    return {
        "success": True,
        "message": f"Onay kodu {receiver.get('name', 'alıcıya')} gönderildi",
        **result
    }


@router.post("/manager-approval")
async def request_manager_approval(data: CreateManagerApprovalRequest, request: Request):
    """
    Yönetici onayı talep et (Baş Şoför ve Operasyon Müdürü)
    """
    user = await get_current_user(request)
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Onay oluştur
    result = await create_manager_shift_approval(
        requester_id=user.id,
        requester_name=user.name,
        vehicle_plate=vehicle.get("plate", ""),
        vehicle_id=data.vehicle_id,
        action=data.action
    )
    
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    
    return {
        "success": True,
        "message": "Onay talebi yöneticilere gönderildi",
        **result
    }


@router.get("/next-shift-user/{vehicle_id}")
async def get_next_shift_user(vehicle_id: str, request: Request):
    """
    Belirtilen araç için sonraki vardiya görevlisini getir
    Devir teslim formunda "Teslim Alan" bilgisi için kullanılır
    """
    user = await get_current_user(request)
    
    from datetime import timedelta
    
    # Bugünün tarihi
    today = datetime.utcnow().date()
    today_str = today.isoformat()
    
    # Bu araç için tüm pending atamaları al
    all_assignments = await shift_assignments_collection.find({
        "vehicle_id": vehicle_id,
        "user_id": {"$ne": user.id},  # Kendisi değil
        "status": "pending"
    }).to_list(100)
    
    # Bugün veya yarın için geçerli atamayı bul
    next_assignment = None
    for assignment in all_assignments:
        shift_date_str = assignment.get("shift_date", "")
        end_date_str = assignment.get("end_date", "")
        
        # Parse shift date
        if isinstance(shift_date_str, datetime):
            shift_date = shift_date_str.date()
        elif isinstance(shift_date_str, str):
            try:
                if 'T' in shift_date_str:
                    shift_date = datetime.fromisoformat(shift_date_str.replace('Z', '+00:00')).date()
                else:
                    shift_date = datetime.strptime(shift_date_str, "%Y-%m-%d").date()
            except:
                continue
        else:
            continue
        
        # Parse end date
        end_date = shift_date
        if end_date_str:
            if isinstance(end_date_str, datetime):
                end_date = end_date_str.date()
            elif isinstance(end_date_str, str):
                try:
                    if 'T' in end_date_str:
                        end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                    else:
                        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
                except:
                    pass
        
        # Bugün veya yarın için geçerli mi?
        tomorrow = today + timedelta(days=1)
        if shift_date <= tomorrow and end_date >= today:
            next_assignment = assignment
            break
    
    if not next_assignment:
        return {
            "found": False,
            "message": "Sonraki vardiya görevlisi bulunamadı"
        }
    
    # Kullanıcı bilgisini al
    next_user = await users_collection.find_one({"_id": next_assignment.get("user_id")})
    
    if not next_user:
        return {
            "found": False,
            "message": "Sonraki vardiya görevlisi bulunamadı"
        }
    
    return {
        "found": True,
        "user": {
            "id": next_user.get("_id"),
            "name": next_user.get("name"),
            "role": next_user.get("role"),
            "phone": next_user.get("phone"),
            "email": next_user.get("email"),
            "profile_photo": next_user.get("profile_photo")
        },
        "assignment": {
            "shift_date": next_assignment.get("shift_date"),
            "start_time": next_assignment.get("start_time"),
            "end_time": next_assignment.get("end_time")
        }
    }


@router.get("/handover-info/{vehicle_id}")
async def get_handover_info(vehicle_id: str, request: Request):
    """
    Devir teslim formu için tüm otomatik bilgileri getir
    - Araç plakası
    - Tarih ve saat
    - Teslim eden (mevcut kullanıcı)
    - Teslim alan (sonraki vardiyalı)
    """
    user = await get_current_user(request)
    
    # Araç bilgisi
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    now = datetime.utcnow()
    
    # Sonraki vardiya görevlisi
    next_shift_info = await get_next_shift_user(vehicle_id, request)
    
    return {
        "vehicle": {
            "id": vehicle.get("_id"),
            "plate": vehicle.get("plate"),
            "type": vehicle.get("type"),
            "km": vehicle.get("km")
        },
        "date": now.strftime("%d.%m.%Y"),
        "time": now.strftime("%H:%M"),
        "giver": {
            "id": user.id,
            "name": user.name,
            "role": user.role,
            "phone": getattr(user, 'phone', None),
            "signature": getattr(user, 'signature', None)
        },
        "receiver": next_shift_info.get("user") if next_shift_info.get("found") else None,
        "next_assignment": next_shift_info.get("assignment") if next_shift_info.get("found") else None
    }

