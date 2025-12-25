"""
HEALMEDY Bildirim Servisi
Tüm bildirimler Firebase Cloud Messaging (FCM) üzerinden yönetilir
"""

import logging
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime

logger = logging.getLogger(__name__)

# FCM servisini import et
try:
    from services.firebase_service import (
        send_fcm_to_multiple,
        send_fcm_notification,
        initialize_firebase,
        FIREBASE_AVAILABLE
    )
    FCM_ENABLED = FIREBASE_AVAILABLE and initialize_firebase()
except ImportError:
    FCM_ENABLED = False
    logger.warning("Firebase service not available")


class NotificationType(str, Enum):
    """Bildirim tipleri"""
    CASE_CREATED = "case_created"
    CASE_ASSIGNED = "case_assigned"
    CASE_DOCTOR_APPROVAL = "case_doctor_approval"
    CASE_CLOSED = "case_closed"
    CASE_FILE_ACCESS = "case_file_access"
    
    SHIFT_REMINDER = "shift_reminder"
    SHIFT_START_ALERT = "shift_start_alert"
    SHIFT_MASTER_CODE = "shift_master_code"
    
    HANDOVER_APPROVAL = "handover_approval"
    
    STOCK_CRITICAL = "stock_critical"
    
    SYSTEM_ALERT = "system_alert"
    EMERGENCY = "emergency"


# Bildirim Şablonları
NOTIFICATION_TEMPLATES = {
    NotificationType.CASE_CREATED: {
        "title": "🚑 Yeni Vaka Oluşturuldu",
        "body": "Vaka #{case_number} - {patient_name} | {location} | Aciliyet: {priority}",
        "icon": "ambulance",
        "priority": "high",
        "type": "new_case"
    },
    
    NotificationType.CASE_ASSIGNED: {
        "title": "📋 Vaka Atandı",
        "body": "Vaka #{case_number} size atandı. Araç: {vehicle_plate}",
        "icon": "clipboard",
        "priority": "high",
        "type": "new_case"
    },
    
    NotificationType.CASE_DOCTOR_APPROVAL: {
        "title": "✅ Doktor Onayı",
        "body": "Vaka #{case_number} için {doctor_name} tarafından onay verildi",
        "icon": "check",
        "priority": "normal",
        "type": "general"
    },
    
    NotificationType.SHIFT_REMINDER: {
        "title": "⏰ Vardiya Hatırlatması",
        "body": "Yarın {shift_date} tarihinde {shift_time} saatlerinde vardiyalısınız",
        "icon": "clock",
        "priority": "normal",
        "type": "general"
    },
    
    NotificationType.SHIFT_START_ALERT: {
        "title": "⚠️ Vardiya Başlatma Uyarısı",
        "body": "{employee_name} vardiyasını başlatamadı! Araç: {vehicle_plate}",
        "icon": "alert",
        "priority": "high",
        "type": "general"
    },
    
    NotificationType.SHIFT_MASTER_CODE: {
        "title": "🔐 Master Code",
        "body": "Kod: {master_code} | Personel: {employee_name} | 15 dk geçerli",
        "icon": "key",
        "priority": "high",
        "type": "general"
    },
    
    NotificationType.HANDOVER_APPROVAL: {
        "title": "🔄 Devir Teslim Onayı",
        "body": "Araç: {vehicle_plate} | Teslim Eden: {from_employee}",
        "icon": "refresh",
        "priority": "normal",
        "type": "general"
    },
    
    NotificationType.STOCK_CRITICAL: {
        "title": "📦 Kritik Stok Uyarısı",
        "body": "{item_name} - Mevcut: {current_qty} | Min: {min_qty}",
        "icon": "package",
        "priority": "high",
        "type": "general"
    },
    
    NotificationType.SYSTEM_ALERT: {
        "title": "📢 Sistem Bildirimi",
        "body": "{message}",
        "icon": "bell",
        "priority": "normal",
        "type": "general"
    },
    
    NotificationType.EMERGENCY: {
        "title": "🚨 ACİL DURUM",
        "body": "{message}",
        "icon": "alert-triangle",
        "priority": "urgent",
        "type": "emergency"
    }
}


# NotificationChannel - FCM tüm kanalları destekler
class NotificationChannel:
    """FCM tüm platformları destekler"""
    SMS = "sms"
    WHATSAPP = "whatsapp"
    WEB_PUSH = "web_push"
    MOBILE_PUSH = "mobile_push"
    IN_APP = "in_app"


class NotificationService:
    """FCM tabanlı bildirim servisi"""
    
    def __init__(self):
        self.enabled = FCM_ENABLED
        if self.enabled:
            logger.info("[NotificationService] FCM notifications enabled")
        else:
            logger.warning("[NotificationService] FCM not available, notifications disabled")
    
    def _format_template(self, template: str, data: Dict[str, Any]) -> str:
        """Şablonu verilerle doldur"""
        try:
            return template.format(**data)
        except KeyError as e:
            logger.warning(f"Missing template variable: {e}")
            return template
    
    async def _get_user_fcm_tokens(self, user_ids: List[str]) -> List[str]:
        """Kullanıcıların FCM token'larını getir"""
        from database import users_collection
        
        tokens = []
        for user_id in user_ids:
            user = await users_collection.find_one({"_id": user_id})
            if user and user.get("fcm_token"):
                tokens.append(user["fcm_token"])
        
        return tokens
    
    async def send_to_users(
        self,
        notification_type: NotificationType,
        user_ids: List[str],
        data: Dict[str, Any],
        url: str = None
    ) -> Dict[str, Any]:
        """
        Belirli kullanıcılara FCM bildirimi gönder
        
        Args:
            notification_type: Bildirim tipi
            user_ids: Kullanıcı ID listesi
            data: Şablon değişkenleri
            url: Tıklandığında açılacak URL
        
        Returns:
            Gönderim sonuçları
        """
        logger.info(f"[FCM] send_to_users called: type={notification_type}, users={user_ids}")
        
        if not self.enabled:
            logger.warning("[FCM] Service not enabled")
            return {"success": False, "error": "FCM not configured"}
        
        if not user_ids:
            logger.warning("[FCM] No user IDs provided")
            return {"success": False, "error": "No user IDs provided"}
        
        template = NOTIFICATION_TEMPLATES.get(notification_type)
        if not template:
            logger.warning(f"[FCM] Template not found: {notification_type}")
            return {"success": False, "error": f"Template not found for {notification_type}"}
        
        title = self._format_template(template.get("title", ""), data)
        body = self._format_template(template.get("body", ""), data)
        
        # FCM token'ları al
        tokens = await self._get_user_fcm_tokens(user_ids)
        
        if not tokens:
            logger.warning(f"[FCM] No FCM tokens found for users: {user_ids}")
            # Token yoksa sadece in-app bildirim kaydet
            return {"success": False, "error": "No FCM tokens found", "in_app_saved": True}
        
        # Data payload
        fcm_data = {
            "type": template.get("type", "general"),
            "notification_type": notification_type.value,
            **{k: str(v) for k, v in data.items()}  # FCM data string olmalı
        }
        
        if url:
            fcm_data["navigate_to"] = url
        
        # FCM gönder
        result = await send_fcm_to_multiple(
            tokens=tokens,
            title=title,
            body=body,
            data=fcm_data,
            notification_type=template.get("type", "general"),
            priority=template.get("priority", "normal")
        )
        
        logger.info(f"[FCM] Sent to {result.get('success_count', 0)} devices")
        
        return {
            "success": result.get("success_count", 0) > 0,
            "sent_count": result.get("success_count", 0),
            "failed_count": result.get("failure_count", 0)
        }
    
    async def save_in_app_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """In-app bildirim kaydet (veritabanına)"""
        from database import notifications_collection
        import uuid
        
        template = NOTIFICATION_TEMPLATES.get(notification_type, {})
        title = self._format_template(template.get("title", "Bildirim"), data)
        body = self._format_template(template.get("body", ""), data)
        
        notification = {
            "_id": f"notif-{uuid.uuid4()}",
            "user_id": user_id,
            "type": notification_type.value,
            "title": title,
            "body": body,
            "data": data,
            "read": False,
            "created_at": datetime.utcnow().isoformat()
        }
        
        try:
            await notifications_collection.insert_one(notification)
            return {"success": True, "notification_id": notification["_id"]}
        except Exception as e:
            logger.error(f"In-app notification error: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_notification(
        self,
        notification_type: NotificationType,
        recipients: List[Dict[str, Any]],
        data: Dict[str, Any],
        url: str = None,
        save_in_app: bool = True
    ) -> Dict[str, Any]:
        """
        Birleşik bildirim gönderme (push + in-app)
        
        Args:
            notification_type: Bildirim tipi
            recipients: Alıcı listesi (user_id, fcm_token içeren dict'ler)
            data: Şablon değişkenleri
            url: Tıklandığında açılacak URL
            save_in_app: In-app bildirim olarak da kaydet
        """
        results = {
            "push": None,
            "in_app": []
        }
        
        # User ID ve token'ları ayıkla
        user_ids = []
        tokens = []
        
        for recipient in recipients:
            user_id = recipient.get("user_id") or recipient.get("id")
            if user_id:
                user_ids.append(user_id)
            
            fcm_token = recipient.get("fcm_token")
            if fcm_token:
                tokens.append(fcm_token)
        
        # FCM Push bildirimi gönder
        if tokens and self.enabled:
            template = NOTIFICATION_TEMPLATES.get(notification_type, {})
            title = self._format_template(template.get("title", ""), data)
            body = self._format_template(template.get("body", ""), data)
            
            fcm_data = {
                "type": template.get("type", "general"),
                "notification_type": notification_type.value,
                **{k: str(v) for k, v in data.items()}
            }
            
            if url:
                fcm_data["navigate_to"] = url
            
            push_result = await send_fcm_to_multiple(
                tokens=tokens,
                title=title,
                body=body,
                data=fcm_data,
                notification_type=template.get("type", "general"),
                priority=template.get("priority", "normal")
            )
            results["push"] = push_result
            logger.info(f"[FCM] Push sent: {push_result.get('success_count', 0)} success")
        else:
            # Token yoksa user_ids üzerinden dene
            if user_ids:
                push_result = await self.send_to_users(notification_type, user_ids, data, url)
                results["push"] = push_result
        
        # In-app bildirimleri kaydet
        if save_in_app:
            for user_id in user_ids:
                in_app_result = await self.save_in_app_notification(user_id, notification_type, data)
                results["in_app"].append(in_app_result)
        
        push_success = results.get("push", {}).get("success_count", 0) > 0 if results.get("push") else False
        in_app_success = len([r for r in results["in_app"] if r.get("success")]) > 0
        
        return {
            "success": push_success or in_app_success,
            "results": results
        }


# Singleton instance
notification_service = NotificationService()


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


# Yardımcı fonksiyonlar
async def send_case_notification(case_data: Dict, user_ids: List[str]):
    """Vaka bildirimi gönder"""
    return await notification_service.send_to_users(
        NotificationType.CASE_CREATED,
        user_ids,
        {
            "case_number": case_data.get("case_number"),
            "patient_name": case_data.get("patient_name"),
            "location": case_data.get("location"),
            "priority": case_data.get("priority", "Normal"),
            "case_id": case_data.get("id")
        },
        url=f"/dashboard/cases/{case_data.get('id')}"
    )


async def send_case_assigned_notification(case_data: Dict, vehicle_plate: str, user_ids: List[str]):
    """Vaka atama bildirimi gönder"""
    return await notification_service.send_to_users(
        NotificationType.CASE_ASSIGNED,
        user_ids,
        {
            "case_number": case_data.get("case_number"),
            "patient_name": case_data.get("patient_name"),
            "vehicle_plate": vehicle_plate,
            "case_id": case_data.get("id")
        },
        url=f"/dashboard/cases/{case_data.get('id')}"
    )


async def send_shift_reminder(shift_data: Dict, user_id: str):
    """Vardiya hatırlatması gönder"""
    return await notification_service.send_to_users(
        NotificationType.SHIFT_REMINDER,
        [user_id],
        {
            "shift_date": shift_data.get("shift_date"),
            "shift_time": shift_data.get("shift_time"),
            "vehicle_plate": shift_data.get("vehicle_plate", "-")
        },
        url="/dashboard/shifts"
    )


async def send_master_code_notification(code: str, employee_name: str, vehicle_plate: str, manager_id: str):
    """Master code bildirimi gönder"""
    return await notification_service.send_to_users(
        NotificationType.SHIFT_MASTER_CODE,
        [manager_id],
        {
            "master_code": code,
            "employee_name": employee_name,
            "vehicle_plate": vehicle_plate
        }
    )


async def send_stock_alert(item_data: Dict, manager_ids: List[str]):
    """Kritik stok uyarısı gönder"""
    return await notification_service.send_to_users(
        NotificationType.STOCK_CRITICAL,
        manager_ids,
        {
            "item_name": item_data.get("name"),
            "current_qty": item_data.get("current_quantity"),
            "min_qty": item_data.get("min_quantity")
        },
        url="/dashboard/stock"
    )


async def broadcast_to_roles(notification_type: NotificationType, roles: List[str], data: Dict[str, Any], url: str = None):
    """Belirli rollere broadcast bildirim gönder"""
    from database import users_collection
    
    # Bu rollerdeki tüm aktif kullanıcıları bul
    user_ids = []
    async for user in users_collection.find({"role": {"$in": roles}, "is_active": True}):
        user_ids.append(user["_id"])
    
    if not user_ids:
        logger.warning(f"No active users found for roles: {roles}")
        return {"success": False, "error": "No users found"}
    
    return await notification_service.send_to_users(notification_type, user_ids, data, url)


async def send_notification_to_roles(roles: List[str], title: str, message: str, data: Dict[str, Any] = None, url: str = None):
    """
    Belirli rollere özel bildirim gönder (şablon kullanmadan)
    Ticket, talep gibi dinamik bildirimler için kullanılır
    """
    from database import users_collection
    
    # Bu rollerdeki kullanıcıları bul
    tokens = []
    user_ids = []
    async for user in users_collection.find({"role": {"$in": roles}, "is_active": True}):
        user_ids.append(user["_id"])
        if user.get("fcm_token"):
            tokens.append(user["fcm_token"])
    
    if not tokens:
        logger.warning(f"No FCM tokens found for roles: {roles}")
        return {"success": False, "error": "No FCM tokens found"}
    
    # FCM gönder
    fcm_data = data or {}
    if url:
        fcm_data["navigate_to"] = url
    
    fcm_data = {k: str(v) for k, v in fcm_data.items()}
    
    result = await send_fcm_to_multiple(
        tokens=tokens,
        title=title,
        body=message,
        data=fcm_data,
        notification_type="general",
        priority="high"
    )
    
    logger.info(f"[FCM] Role notification sent to {result.get('success_count', 0)} devices")
    
    return {
        "success": result.get("success_count", 0) > 0,
        "sent_count": result.get("success_count", 0)
    }


# Legacy send_master_code alias
async def send_master_code(code: str, employee_name: str, vehicle_plate: str, manager: dict):
    """Master code bildirimi gönder (legacy format)"""
    manager_id = manager.get("user_id") or manager.get("id")
    return await send_master_code_notification(code, employee_name, vehicle_plate, manager_id)
