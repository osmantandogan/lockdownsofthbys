"""
Approval Routes - Onay Kodu Yönetimi API
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

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
    user_name: Optional[str] = None


class RequestManagerApprovalRequest(BaseModel):
    vehicle_id: str
    action: str = "shift_start"
    user_name: Optional[str] = None


class VerifyManagerApprovalRequest(BaseModel):
    code: str
    approval_type: str = "shift_start"


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/verify")
async def verify_approval_code(data: VerifyCodeRequest, request: Request):
    """
    Onay kodunu doğrula
    Desteklenen yöntemler:
    1. Approval kaydındaki özel kod
    2. Yöneticilerin internal OTP'si (her zaman geçerli)
    """
    from datetime import timedelta
    from services.otp_service import verify_user_otp, generate_user_otp_secret
    
    user = await get_current_user(request)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    logger.info(f"Verifying code: {data.code} for user: {user.id}, type: {data.approval_type}")
    
    # Yöntem 1: Herhangi bir yöneticinin internal OTP'sini kontrol et (EN ÖNCELİKLİ)
    managers = await users_collection.find({
        "role": {"$in": ["bas_sofor", "operasyon_muduru"]}
    }).to_list(50)
    
    logger.info(f"Found {len(managers)} managers to check OTP")
    
    for manager in managers:
        otp_secret = manager.get("otp_secret")
        if not otp_secret:
            otp_secret = generate_user_otp_secret()
            await users_collection.update_one(
                {"_id": manager.get("_id")},
                {"$set": {"otp_secret": otp_secret}}
            )
            logger.info(f"Generated new OTP secret for manager: {manager.get('name')}")
        
        if verify_user_otp(otp_secret, data.code):
            logger.info(f"✅ OTP verified for manager: {manager.get('name')}")
            
            # Eğer pending approval varsa güncelle
            pending = await approvals_collection.find_one({
                "requester_id": user.id,
                "status": "pending"
            })
            if pending:
                await approvals_collection.update_one(
                    {"_id": pending["_id"]},
                    {"$set": {
                        "status": "approved", 
                        "approved_at": turkey_now, 
                        "approval_method": f"internal_otp_{manager.get('name')}"
                    }}
                )
            
            return {
                "valid": True, 
                "message": f"Onay kodu doğrulandı ({manager.get('name')} OTP)", 
                "method": "internal_otp",
                "approver": manager.get("name")
            }
    
    # Yöntem 2: Özel onay kodu kontrolü
    pending_approval = await approvals_collection.find_one({
        "requester_id": user.id,
        "status": "pending",
        "expires_at": {"$gt": turkey_now}
    })
    
    if pending_approval and pending_approval.get("code") == data.code:
        await approvals_collection.update_one(
            {"_id": pending_approval["_id"]},
            {"$set": {"status": "approved", "approved_at": turkey_now, "approval_method": "direct_code"}}
        )
        logger.info(f"✅ Direct code verified for user: {user.id}")
        return {"valid": True, "message": "Onay kodu doğrulandı", "method": "direct_code"}
    
    # Yöntem 3: Approval service (legacy)
    try:
        result = await approval_service.verify_code(
            code=data.code,
            approval_type=data.approval_type,
            verifier_id=user.id
        )
        if result.get("valid"):
            return result
    except Exception as e:
        logger.warning(f"Approval service error: {e}")
    
    logger.warning(f"❌ No valid code found for: {data.code}")
    raise HTTPException(
        status_code=400,
        detail="Onay kodu yanlış. Yöneticinin bildirim panelindeki (🔔) OTP kodunu kullanın."
    )


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


@router.post("/request-manager-approval")
async def request_manager_approval_for_shift(data: RequestManagerApprovalRequest, request: Request):
    """
    Vardiya başlatma için yönetici (Baş Şoför) onayı talep et
    SMS, Email ve Push bildirim gönderir
    Yönetici kendi internal OTP'sini de kullanabilir
    """
    from datetime import timedelta
    import random
    
    try:
        user = await get_current_user(request)
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Yetkilendirme hatası")
    
    # Araç bilgisini al
    vehicle = await vehicles_collection.find_one({"_id": data.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Baş Şoför ve Operasyon Müdürlerini bul
    managers = await users_collection.find({
        "role": {"$in": ["bas_sofor", "operasyon_muduru"]}
    }).to_list(50)
    
    if not managers:
        logger.warning("No managers found, approval will only work with internal OTP")
    
    # Onay kodu oluştur
    code = str(random.randint(100000, 999999))
    
    # Türkiye saati (UTC+3)
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Onay kaydı oluştur
    approval_doc = {
        "_id": f"shift_start_{user.id}_{data.vehicle_id}_{int(turkey_now.timestamp())}",
        "code": code,
        "approval_type": "shift_start",
        "requester_id": user.id,
        "requester_name": data.user_name or user.name,
        "vehicle_id": data.vehicle_id,
        "vehicle_plate": vehicle.get("plate", ""),
        "action": data.action,
        "status": "pending",
        "created_at": turkey_now,
        "expires_at": turkey_now + timedelta(minutes=30),
        # Yönetici internal OTP'lerini de kabul et
        "accept_internal_otp": True,
        "manager_ids": [m.get("_id") for m in managers]
    }
    
    try:
        await approvals_collection.insert_one(approval_doc)
    except Exception as e:
        logger.warning(f"Insert failed, updating: {e}")
        # Mevcut kaydı güncelle
        await approvals_collection.update_one(
            {"requester_id": user.id, "vehicle_id": data.vehicle_id, "approval_type": "shift_start", "status": "pending"},
            {"$set": {
                "code": code, 
                "created_at": turkey_now, 
                "expires_at": turkey_now + timedelta(minutes=30),
                "accept_internal_otp": True,
                "manager_ids": [m.get("_id") for m in managers]
            }},
            upsert=True
        )
    
    # Bildirim göndermeyi arka planda yap (ana isteği bekletme)
    notifications_sent = 0
    import asyncio
    
    async def send_notifications_background():
        """Bildirimleri arka planda gönder"""
        nonlocal notifications_sent
        for manager in managers:
            try:
                # Push bildirim dene (hızlı)
                try:
                    from services.onesignal_service import onesignal_service
                    await asyncio.wait_for(
                        onesignal_service.send_to_users(
                            user_ids=[manager.get("_id")],
                            title="🚑 Vardiya Başlatma Onayı",
                            message=f"{data.user_name or user.name} - {vehicle.get('plate', '')} için onay kodu: {code}",
                            data={"type": "shift_approval", "code": code}
                        ),
                        timeout=5.0  # 5 saniye timeout
                    )
                    notifications_sent += 1
                except asyncio.TimeoutError:
                    logger.warning("Push bildirim timeout")
                except Exception as e:
                    logger.warning(f"Push bildirim gönderilemedi: {e}")
            except Exception as e:
                logger.error(f"Manager notification error: {e}")
    
    # Bildirimleri arka planda başlat (beklemeden devam et)
    asyncio.create_task(send_notifications_background())
    
    logger.info(f"Vardiya başlatma onay kodu oluşturuldu: {code} - {len(managers)} yönetici, {notifications_sent} bildirim")
    
    return {
        "success": True,
        "message": f"Onay kodu {len(managers)} yöneticiye gönderildi. Alternatif: Yöneticiler kendi internal OTP'lerini (bildirim sekmesindeki kod) de kullanabilir.",
        "managers_notified": len(managers),
        "notifications_sent": notifications_sent,
        "code_hint": "Yönetici bildirim sekmesindeki (sağ üst) 30 sn'lik OTP kodunu da kullanabilir"
    }


@router.post("/verify-manager-approval")
async def verify_manager_approval_for_shift(data: VerifyManagerApprovalRequest, request: Request):
    """
    Vardiya başlatma için yönetici onay kodunu doğrula
    Desteklenen onay yöntemleri:
    1. SMS/Email ile gönderilen özel kod
    2. Yöneticinin kendi internal OTP'si (bildirim sekmesindeki 30 sn'lik kod)
    """
    from datetime import timedelta
    
    user = await get_current_user(request)
    
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Bu kullanıcının bekleyen onayını bul
    approval = await approvals_collection.find_one({
        "requester_id": user.id,
        "approval_type": "shift_start",
        "status": "pending",
        "expires_at": {"$gt": turkey_now}
    })
    
    if not approval:
        raise HTTPException(status_code=400, detail="Bekleyen onay talebi bulunamadı veya süresi dolmuş")
    
    code_valid = False
    approval_method = ""
    
    # Yöntem 1: Gönderilen özel kodu kontrol et
    if approval.get("code") == data.code:
        code_valid = True
        approval_method = "sms_email_code"
    
    # Yöntem 2: Yöneticilerin internal OTP'sini kontrol et
    if not code_valid and approval.get("accept_internal_otp"):
        manager_ids = approval.get("manager_ids", [])
        logger.info(f"Checking internal OTP for managers: {manager_ids}")
        
        # Tüm bas_sofor ve operasyon_muduru'larını kontrol et (manager_ids boş olabilir)
        if not manager_ids:
            managers = await users_collection.find({
                "role": {"$in": ["bas_sofor", "operasyon_muduru"]}
            }).to_list(50)
            manager_ids = [m.get("_id") for m in managers]
            logger.info(f"Found managers from DB: {manager_ids}")
        
        for manager_id in manager_ids:
            try:
                from services.otp_service import verify_user_otp, generate_user_otp_secret
                manager = await users_collection.find_one({"_id": manager_id})
                
                if not manager:
                    logger.warning(f"Manager not found: {manager_id}")
                    continue
                
                otp_secret = manager.get("otp_secret")
                
                # Secret yoksa oluştur ve kaydet
                if not otp_secret:
                    otp_secret = generate_user_otp_secret()
                    await users_collection.update_one(
                        {"_id": manager_id},
                        {"$set": {"otp_secret": otp_secret}}
                    )
                    logger.info(f"Generated OTP secret for manager: {manager_id}")
                
                logger.info(f"Verifying OTP for {manager.get('name', manager_id)}, code: {data.code}")
                
                if verify_user_otp(otp_secret, data.code):
                    code_valid = True
                    approval_method = f"internal_otp_{manager.get('name', manager_id)}"
                    logger.info(f"✅ Internal OTP verified for manager: {manager_id}")
                    break
                else:
                    logger.info(f"❌ OTP not matching for {manager.get('name', manager_id)}")
                    
            except Exception as e:
                logger.warning(f"OTP check failed for manager {manager_id}: {e}")
    
    if not code_valid:
        raise HTTPException(status_code=400, detail="Onay kodu yanlış. SMS/Email kodu veya yöneticinin internal OTP'sini kullanabilirsiniz.")
    
    # Onayı tamamla
    await approvals_collection.update_one(
        {"_id": approval["_id"]},
        {"$set": {
            "status": "approved", 
            "approved_at": turkey_now,
            "approval_method": approval_method
        }}
    )
    
    logger.info(f"Vardiya başlatma onaylandı: {user.id} - {approval.get('vehicle_plate', '')} - Method: {approval_method}")
    
    return {
        "valid": True,
        "message": "Onay kodu doğrulandı",
        "vehicle_plate": approval.get("vehicle_plate"),
        "method": approval_method
    }


@router.get("/next-shift-user/{vehicle_id}")
async def get_next_shift_user(vehicle_id: str, request: Request):
    """
    Belirtilen araç için sonraki vardiya görevlisini getir
    Devir teslim formunda "Teslim Alan" bilgisi için kullanılır
    """
    user = await get_current_user(request)
    
    from datetime import timedelta
    
    # Türkiye saati (UTC+3) kullan
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    today = turkey_now.date()
    today_str = today.isoformat()
    logger.info(f"Sonraki vardiya kontrolü - Bugün (TR): {today}")
    
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
    - Tarih ve saat (UTC+3)
    - Teslim eden (mevcut kullanıcı)
    - Teslim alan (sonraki vardiyalı)
    """
    user = await get_current_user(request)
    
    # Araç bilgisi
    vehicle = await vehicles_collection.find_one({"_id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı")
    
    # Türkiye saati (UTC+3)
    from datetime import timedelta
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    
    # Sonraki vardiya görevlisi
    next_shift_info = await get_next_shift_user(vehicle_id, request)
    
    return {
        "vehicle": {
            "id": vehicle.get("_id"),
            "plate": vehicle.get("plate"),
            "type": vehicle.get("type"),
            "km": vehicle.get("km")
        },
        "date": turkey_now.strftime("%d.%m.%Y"),
        "time": turkey_now.strftime("%H:%M"),
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

