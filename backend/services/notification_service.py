"""
HEALMEDY Bildirim Servisi
Tüm bildirimler OneSignal üzerinden yönetilir
Legacy kod - onesignal_service.py'ye yönlendirir
"""

# OneSignal servisini kullan
from services.onesignal_service import (
    onesignal_service,
    NotificationType,
    NOTIFICATION_TEMPLATES,
    send_case_notification,
    send_case_assigned_notification,
    send_shift_reminder,
    send_master_code_notification,
    send_stock_alert,
    broadcast_to_roles
)

# Legacy uyumluluk için alias
notification_service = onesignal_service

# NotificationChannel artık kullanılmıyor, OneSignal her platformu destekliyor
class NotificationChannel:
    """Legacy - OneSignal tüm kanalları destekler"""
    SMS = "sms"  # OneSignal SMS eklentisi ile
    WHATSAPP = "whatsapp"  # OneSignal desteklemiyor
    WEB_PUSH = "web_push"
    MOBILE_PUSH = "mobile_push"
    IN_APP = "in_app"


# Legacy yardımcı fonksiyonlar
async def get_users_by_role(roles: list):
    """Rol bazlı kullanıcıları getir"""
    from database import users_collection
    users = await users_collection.find({
        "role": {"$in": roles},
        "is_active": True
    }).to_list(1000)
    
    result = []
    for user in users:
        user["id"] = user.pop("_id")
        result.append(user)
    
    return result


async def get_user_by_id(user_id: str):
    """Kullanıcı bilgilerini getir"""
    from database import users_collection
    user_doc = await users_collection.find_one({"_id": user_id})
    if user_doc:
        user_doc["id"] = user_doc.pop("_id")
    return user_doc


def get_role_label(role: str) -> str:
    """Rol etiketini döndür"""
    role_labels = {
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
    return role_labels.get(role, role)


# Legacy send_master_code alias
async def send_master_code(code: str, employee_name: str, vehicle_plate: str, manager: dict):
    """Master code bildirimi gönder (legacy format)"""
    manager_id = manager.get("user_id") or manager.get("id")
    return await send_master_code_notification(code, employee_name, vehicle_plate, manager_id)
