"""
Bildirim API Endpoint'leri - OneSignal Entegrasyonu
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import string
import os

from database import notifications_collection, users_collection
from auth_utils import get_current_user
from services.onesignal_service import (
    onesignal_service, 
    NotificationType,
    send_master_code_notification
)

router = APIRouter()


# Models
class OneSignalSubscription(BaseModel):
    player_id: str  # OneSignal player_id


class NotificationPreferences(BaseModel):
    push: bool = True
    in_app: bool = True


class MasterCodeRequest(BaseModel):
    employee_id: str
    vehicle_id: str
    reason: str


class TestNotificationRequest(BaseModel):
    type: str
    message: Optional[str] = None


# Rol çevirisi
ROLE_LABELS = {
    "doktor": "Doktor",
    "hemsire": "Hemşire",
    "paramedik": "Paramedik",
    "att": "ATT",
    "sofor": "Şoför",
    "bas_sofor": "Baş Şoför",
    "merkez_ofis": "Merkez Ofis",
    "operasyon_muduru": "Operasyon Müdürü",
    "cagri_merkezi": "Çağrı Merkezi",
    "mesul_mudur": "Mesul Müdür"
}


# ==================== In-App Bildirimler ====================

@router.get("")
async def get_notifications(request: Request, limit: int = 50, unread_only: bool = False):
    """Kullanıcının in-app bildirimlerini getir"""
    user = await get_current_user(request)
    
    query = {"user_id": user.id}
    if unread_only:
        query["read"] = False
    
    notifications = await notifications_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for notif in notifications:
        notif["id"] = notif.pop("_id")
    
    return notifications


@router.get("/unread-count")
async def get_unread_count(request: Request):
    """Okunmamış bildirim sayısı"""
    user = await get_current_user(request)
    count = await notifications_collection.count_documents({"user_id": user.id, "read": False})
    return {"count": count}


@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, request: Request):
    """Bildirimi okundu olarak işaretle"""
    user = await get_current_user(request)
    
    result = await notifications_collection.update_one(
        {"_id": notification_id, "user_id": user.id},
        {"$set": {"read": True, "read_at": datetime.utcnow().isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    
    return {"message": "Bildirim okundu olarak işaretlendi"}


@router.put("/mark-all-read")
async def mark_all_read(request: Request):
    """Tüm bildirimleri okundu olarak işaretle"""
    user = await get_current_user(request)
    
    result = await notifications_collection.update_many(
        {"user_id": user.id, "read": False},
        {"$set": {"read": True, "read_at": datetime.utcnow().isoformat()}}
    )
    
    return {"message": f"{result.modified_count} bildirim okundu olarak işaretlendi"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, request: Request):
    """Bildirimi sil"""
    user = await get_current_user(request)
    
    result = await notifications_collection.delete_one(
        {"_id": notification_id, "user_id": user.id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    
    return {"message": "Bildirim silindi"}


# ==================== OneSignal Subscription ====================

@router.post("/subscribe")
async def subscribe_onesignal(subscription: OneSignalSubscription, request: Request):
    """OneSignal player_id kaydet ve kullanıcıyı external_user_id olarak eşle"""
    user = await get_current_user(request)
    
    # Player ID'yi kullanıcıya kaydet
    await users_collection.update_one(
        {"_id": user.id},
        {
            "$set": {
                "onesignal_player_id": subscription.player_id,
                "onesignal_subscribed_at": datetime.utcnow().isoformat()
            }
        }
    )
    
    return {"message": "OneSignal bildirimleri etkinleştirildi", "player_id": subscription.player_id}


@router.delete("/unsubscribe")
async def unsubscribe_onesignal(request: Request):
    """OneSignal subscription kaldır"""
    user = await get_current_user(request)
    
    await users_collection.update_one(
        {"_id": user.id},
        {
            "$unset": {
                "onesignal_player_id": "",
                "onesignal_subscribed_at": ""
            }
        }
    )
    
    return {"message": "OneSignal bildirimleri devre dışı bırakıldı"}


# ==================== Bildirim Tercihleri ====================

@router.get("/preferences")
async def get_preferences(request: Request):
    """Kullanıcı bildirim tercihlerini getir"""
    user = await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user.id})
    preferences = user_doc.get("notification_preferences", {})
    
    # Default değerleri ekle
    default_prefs = {
        "case_created": {"push": True, "in_app": True},
        "case_assigned": {"push": True, "in_app": True},
        "shift_reminder": {"push": True, "in_app": True},
        "handover_approval": {"push": True, "in_app": True},
        "stock_critical": {"push": True, "in_app": True},
        "emergency": {"push": True, "in_app": True}
    }
    
    for key, value in default_prefs.items():
        if key not in preferences:
            preferences[key] = value
    
    return preferences


@router.put("/preferences")
async def update_preferences(preferences: dict, request: Request):
    """Kullanıcı bildirim tercihlerini güncelle"""
    user = await get_current_user(request)
    
    await users_collection.update_one(
        {"_id": user.id},
        {"$set": {"notification_preferences": preferences}}
    )
    
    return {"message": "Bildirim tercihleri güncellendi"}


# ==================== Master Code Sistemi ====================

@router.post("/generate-master-code")
async def generate_master_code(data: MasterCodeRequest, request: Request, background_tasks: BackgroundTasks):
    """
    Acil vardiya başlatma için master code oluştur
    Sadece Operasyon Müdürü ve Merkez Ofis kullanabilir
    """
    user = await get_current_user(request)
    
    if user.role not in ["operasyon_muduru", "merkez_ofis"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    # Personel bilgilerini al
    employee = await users_collection.find_one({"_id": data.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Personel bulunamadı")
    
    # 6 haneli kod oluştur
    code = ''.join(secrets.choice(string.digits) for _ in range(6))
    
    # Kodu veritabanına kaydet (15 dakika geçerli)
    expiry = datetime.utcnow() + timedelta(minutes=15)
    
    await users_collection.update_one(
        {"_id": data.employee_id},
        {
            "$set": {
                "master_code": {
                    "code": code,
                    "generated_by": user.id,
                    "generated_at": datetime.utcnow().isoformat(),
                    "expires_at": expiry.isoformat(),
                    "vehicle_id": data.vehicle_id,
                    "reason": data.reason,
                    "used": False
                }
            }
        }
    )
    
    # Müdüre bildirim gönder (arka planda)
    background_tasks.add_task(
        send_master_code_notification,
        code,
        employee.get("name"),
        data.vehicle_id,
        user.id
    )
    
    return {
        "code": code,
        "expires_at": expiry.isoformat(),
        "employee_name": employee.get("name"),
        "message": "Master code oluşturuldu"
    }


@router.post("/verify-master-code")
async def verify_master_code(code: str, request: Request):
    """Master code doğrula"""
    user = await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user.id})
    master_code = user_doc.get("master_code", {})
    
    if not master_code:
        raise HTTPException(status_code=400, detail="Aktif master code bulunamadı")
    
    if master_code.get("used"):
        raise HTTPException(status_code=400, detail="Bu kod zaten kullanılmış")
    
    if datetime.fromisoformat(master_code.get("expires_at")) < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Kod süresi dolmuş")
    
    if master_code.get("code") != code:
        raise HTTPException(status_code=400, detail="Geçersiz kod")
    
    # Kodu kullanılmış olarak işaretle
    await users_collection.update_one(
        {"_id": user.id},
        {"$set": {"master_code.used": True, "master_code.used_at": datetime.utcnow().isoformat()}}
    )
    
    return {
        "valid": True,
        "vehicle_id": master_code.get("vehicle_id"),
        "message": "Kod doğrulandı. Vardiyayı başlatabilirsiniz."
    }


# ==================== Test & Broadcast ====================

@router.post("/test")
async def test_notification(data: TestNotificationRequest, request: Request):
    """Bildirim testi"""
    user = await get_current_user(request)
    
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    notification_type = NotificationType(data.type) if data.type else NotificationType.SYSTEM_ALERT
    
    result = await onesignal_service.send_notification(
        notification_type,
        [user.id],
        {
            "case_number": "TEST-001",
            "patient_name": "Test Hasta",
            "location": "Filyos",
            "priority": "Normal",
            "vehicle_plate": "67 ABC 001",
            "shift_date": datetime.now().strftime("%d.%m.%Y"),
            "shift_time": "08:00 - 16:00",
            "employee_name": "Test Personel",
            "master_code": "123456",
            "message": data.message or "Bu bir test bildirimidir",
            "item_name": "Test Ürün",
            "current_qty": "5",
            "min_qty": "10",
            "doctor_name": "Dr. Test"
        }
    )
    
    return result


@router.post("/broadcast")
async def broadcast_notification(
    request: Request,
    message: str,
    title: str = "HEALMEDY Duyuru",
    roles: List[str] = None
):
    """
    Toplu bildirim gönder
    Sadece Merkez Ofis ve Operasyon Müdürü kullanabilir
    """
    user = await get_current_user(request)
    
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    # Alıcıları bul
    query = {"is_active": True}
    if roles:
        query["role"] = {"$in": roles}
    
    recipients_cursor = users_collection.find(query)
    recipients = await recipients_cursor.to_list(500)
    
    user_ids = [r["_id"] for r in recipients]
    
    if not user_ids:
        return {"message": "Gönderilecek kullanıcı bulunamadı", "recipients": 0}
    
    # OneSignal ile gönder
    result = await onesignal_service.send_notification(
        NotificationType.SYSTEM_ALERT,
        user_ids,
        {"message": message, "title": title}
    )
    
    return {
        "message": f"{len(user_ids)} kişiye bildirim gönderildi",
        "details": result
    }


# ==================== OneSignal Config ====================

@router.get("/onesignal-config")
async def get_onesignal_config():
    """OneSignal yapılandırma bilgilerini döndür (frontend için)"""
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    
    if not app_id:
        raise HTTPException(status_code=503, detail="OneSignal yapılandırılmamış")
    
    return {
        "appId": app_id,
        "enabled": onesignal_service.enabled
    }


@router.get("/status")
async def get_notification_status(request: Request):
    """Bildirim sistemi durumunu kontrol et"""
    user = await get_current_user(request)
    user_doc = await users_collection.find_one({"_id": user.id})
    
    return {
        "onesignal_enabled": onesignal_service.enabled,
        "user_subscribed": bool(user_doc.get("onesignal_player_id")),
        "player_id": user_doc.get("onesignal_player_id"),
        "subscribed_at": user_doc.get("onesignal_subscribed_at")
    }


@router.get("/debug")
async def debug_notification_system(request: Request):
    """Bildirim sistemi debug bilgileri - Sadece yöneticiler"""
    user = await get_current_user(request)
    
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Debug için yetkiniz yok")
    
    # OneSignal yapılandırmasını kontrol et
    app_id = os.environ.get("ONESIGNAL_APP_ID", "")
    rest_api_key = os.environ.get("ONESIGNAL_REST_API_KEY", "")
    
    # Tüm subscribe olan kullanıcıları say
    subscribed_users = await users_collection.count_documents({
        "onesignal_player_id": {"$exists": True, "$ne": None}
    })
    
    # Son 5 subscribe olan kullanıcı
    recent_subscribers = await users_collection.find({
        "onesignal_player_id": {"$exists": True, "$ne": None}
    }).sort("onesignal_subscribed_at", -1).limit(5).to_list(5)
    
    subscriber_info = []
    for sub in recent_subscribers:
        subscriber_info.append({
            "name": sub.get("name"),
            "role": sub.get("role"),
            "player_id": sub.get("onesignal_player_id", "")[:20] + "..." if sub.get("onesignal_player_id") else None,
            "subscribed_at": sub.get("onesignal_subscribed_at")
        })
    
    return {
        "config": {
            "app_id_configured": bool(app_id),
            "app_id_preview": app_id[:8] + "..." if app_id else "NOT SET",
            "rest_api_key_configured": bool(rest_api_key),
            "rest_api_key_preview": "***" + rest_api_key[-8:] if rest_api_key else "NOT SET",
            "onesignal_enabled": onesignal_service.enabled
        },
        "subscribers": {
            "total_count": subscribed_users,
            "recent": subscriber_info
        },
        "current_user": {
            "id": user.id,
            "name": user.name,
            "role": user.role
        }
    }


@router.post("/debug-send")
async def debug_send_notification(request: Request, target_user_id: str = None):
    """Debug amaçlı bildirim gönder - Detaylı log ile"""
    user = await get_current_user(request)
    
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Debug için yetkiniz yok")
    
    target_id = target_user_id or user.id
    
    # Hedef kullanıcıyı kontrol et
    target_user = await users_collection.find_one({"_id": target_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Hedef kullanıcı bulunamadı")
    
    debug_info = {
        "target_user": {
            "id": target_id,
            "name": target_user.get("name"),
            "has_player_id": bool(target_user.get("onesignal_player_id")),
            "player_id": target_user.get("onesignal_player_id", "")[:20] + "..." if target_user.get("onesignal_player_id") else None
        },
        "onesignal_config": {
            "enabled": onesignal_service.enabled,
            "app_id_set": bool(os.environ.get("ONESIGNAL_APP_ID")),
            "api_key_set": bool(os.environ.get("ONESIGNAL_REST_API_KEY"))
        }
    }
    
    # Bildirim gönder
    result = await onesignal_service.send_notification(
        NotificationType.SYSTEM_ALERT,
        [target_id],
        {
            "message": f"Debug test bildirimi - {datetime.now().strftime('%H:%M:%S')}"
        }
    )
    
    debug_info["send_result"] = result
    
    return debug_info
