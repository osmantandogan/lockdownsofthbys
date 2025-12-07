"""
Bildirim API Endpoint'leri
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import string

from database import notifications_collection, users_collection, cases_collection, shift_assignments_collection
from auth_utils import get_current_user
from services.notification_service import (
    notification_service, 
    NotificationType, 
    NotificationChannel,
    send_case_notification,
    send_master_code
)

router = APIRouter()


# Models
class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


class NotificationPreferences(BaseModel):
    sms: bool = True
    whatsapp: bool = True
    web_push: bool = True
    mobile_push: bool = True
    email: bool = True


class MasterCodeRequest(BaseModel):
    employee_id: str
    vehicle_id: str
    reason: str


class TestNotificationRequest(BaseModel):
    type: str
    channel: str
    phone: Optional[str] = None


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


@router.get("/")
async def get_notifications(request: Request, limit: int = 50, unread_only: bool = False):
    """Kullanıcının bildirimlerini getir"""
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


# Push Subscription Yönetimi
@router.post("/subscribe-push")
async def subscribe_push(subscription: PushSubscription, request: Request):
    """Web Push subscription kaydet"""
    user = await get_current_user(request)
    
    subscription_data = subscription.model_dump()
    
    # Mevcut subscription'ları güncelle veya ekle
    await users_collection.update_one(
        {"_id": user.id},
        {
            "$addToSet": {
                "push_subscriptions": subscription_data
            }
        }
    )
    
    return {"message": "Push bildirimleri aktif edildi"}


@router.delete("/unsubscribe-push")
async def unsubscribe_push(subscription: PushSubscription, request: Request):
    """Web Push subscription kaldır"""
    user = await get_current_user(request)
    
    await users_collection.update_one(
        {"_id": user.id},
        {
            "$pull": {
                "push_subscriptions": {"endpoint": subscription.endpoint}
            }
        }
    )
    
    return {"message": "Push bildirimleri devre dışı bırakıldı"}


@router.post("/subscribe-fcm")
async def subscribe_fcm(data: dict, request: Request):
    """FCM token kaydet"""
    user = await get_current_user(request)
    
    fcm_token = data.get("fcm_token")
    if not fcm_token:
        raise HTTPException(status_code=400, detail="FCM token gerekli")
    
    # FCM token'ı kullanıcıya kaydet
    await users_collection.update_one(
        {"_id": user.id},
        {
            "$set": {
                "fcm_token": fcm_token,
                "fcm_token_updated_at": datetime.utcnow().isoformat()
            }
        }
    )
    
    return {"message": "FCM token kaydedildi", "fcm_token": fcm_token}


# Bildirim Tercihleri
@router.get("/preferences")
async def get_preferences(request: Request):
    """Kullanıcı bildirim tercihlerini getir"""
    user = await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user.id})
    preferences = user_doc.get("notification_preferences", {})
    
    # Default değerleri ekle
    default_prefs = {
        "case_created": {"sms": True, "whatsapp": True, "web_push": True, "mobile_push": True},
        "case_assigned": {"sms": True, "whatsapp": True, "web_push": True, "mobile_push": True},
        "shift_reminder": {"sms": True, "whatsapp": True, "web_push": True, "mobile_push": True},
        "handover_approval": {"sms": True, "whatsapp": True, "web_push": True, "mobile_push": True},
        "stock_critical": {"sms": True, "whatsapp": True, "web_push": True, "mobile_push": True},
        "emergency": {"sms": True, "whatsapp": True, "web_push": True, "mobile_push": True}
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


# Master Code Sistemi
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
    manager_phone = (await users_collection.find_one({"_id": user.id})).get("phone")
    
    if manager_phone:
        background_tasks.add_task(
            send_master_code,
            code,
            employee.get("name"),
            data.vehicle_id,  # TODO: araç plakasını al
            {"user_id": user.id, "phone": manager_phone}
        )
    
    return {
        "code": code,
        "expires_at": expiry.isoformat(),
        "employee_name": employee.get("name"),
        "message": "Master code oluşturuldu ve size bildirildi"
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


# Test endpoint'i
@router.post("/test")
async def test_notification(data: TestNotificationRequest, request: Request):
    """Bildirim testi (sadece development için)"""
    user = await get_current_user(request)
    
    if user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    user_doc = await users_collection.find_one({"_id": user.id})
    phone = data.phone or user_doc.get("phone")
    
    channels = [NotificationChannel(data.channel)] if data.channel else None
    
    result = await notification_service.send_notification(
        NotificationType(data.type),
        [{
            "user_id": user.id,
            "phone": phone,
            "push_subscriptions": user_doc.get("push_subscriptions", [])
        }],
        {
            "case_number": "TEST-001",
            "patient_name": "Test Hasta",
            "location": "Filyos",
            "priority": "Normal",
            "created_at": datetime.now().strftime("%d.%m.%Y %H:%M"),
            "vehicle_plate": "67 ABC 001",
            "shift_date": datetime.now().strftime("%d.%m.%Y"),
            "shift_time": "08:00 - 16:00",
            "employee_name": user_doc.get("name", "Test Personel"),
            "master_code": "123456"
        },
        channels=channels
    )
    
    return result


# Toplu bildirim gönderme (Admin)
@router.post("/broadcast")
async def broadcast_notification(
    request: Request,
    message: str,
    title: str = "HEALMEDY Duyuru",
    roles: List[str] = None,
    channels: List[str] = None
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
    
    recipient_list = []
    for r in recipients:
        recipient_list.append({
            "user_id": r["_id"],
            "phone": r.get("phone"),
            "push_subscriptions": r.get("push_subscriptions", []),
            "fcm_token": r.get("fcm_token")
        })
    
    # Kanalları belirle
    channel_list = [NotificationChannel(c) for c in channels] if channels else None
    
    result = await notification_service.send_notification(
        NotificationType.SYSTEM_ALERT,
        recipient_list,
        {"message": message, "title": title},
        channels=channel_list
    )
    
    return {
        "message": f"{len(recipient_list)} kişiye bildirim gönderildi",
        "details": result
    }


# VAPID Public Key (Web Push için)
@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Web Push için VAPID public key döndür"""
    import os
    key = os.environ.get("VAPID_PUBLIC_KEY", "")
    
    if not key:
        raise HTTPException(status_code=503, detail="Web Push yapılandırılmamış")
    
    return {"publicKey": key}


# FCM Status Check
@router.get("/fcm-status")
async def get_fcm_status(request: Request):
    """FCM yapılandırma durumunu kontrol et"""
    from services.notification_service import notification_service
    
    return {
        "fcm_enabled": notification_service.fcm_enabled,
        "fcm_initialized": notification_service.fcm_app is not None,
        "project_id": os.environ.get("FIREBASE_PROJECT_ID", ""),
        "credentials_path": os.environ.get("FIREBASE_CREDENTIALS_PATH", ""),
        "credentials_exists": os.path.exists(os.environ.get("FIREBASE_CREDENTIALS_PATH", "")) if os.environ.get("FIREBASE_CREDENTIALS_PATH") else False
    }

