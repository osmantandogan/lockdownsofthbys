"""
HEALMEDY OneSignal Bildirim Servisi
Tüm push bildirimleri OneSignal üzerinden yönetilir
"""

import os
import httpx
import json
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Ensure console handler
if not logger.handlers:
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# OneSignal Configuration
ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "")
ONESIGNAL_REST_API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "")
ONESIGNAL_API_URL = "https://onesignal.com/api/v1"

print(f"[OneSignalService] App ID: {'***' + ONESIGNAL_APP_ID[-8:] if ONESIGNAL_APP_ID else 'NOT SET'}")
print(f"[OneSignalService] REST API Key: {'***' + ONESIGNAL_REST_API_KEY[-8:] if ONESIGNAL_REST_API_KEY else 'NOT SET'}")


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
        "priority": "high"
    },
    
    NotificationType.CASE_ASSIGNED: {
        "title": "📋 Vaka Atandı",
        "body": "Vaka #{case_number} size atandı. Araç: {vehicle_plate}",
        "icon": "clipboard",
        "priority": "high"
    },
    
    NotificationType.CASE_DOCTOR_APPROVAL: {
        "title": "✅ Doktor Onayı",
        "body": "Vaka #{case_number} için {doctor_name} tarafından onay verildi",
        "icon": "check",
        "priority": "normal"
    },
    
    NotificationType.SHIFT_REMINDER: {
        "title": "⏰ Vardiya Hatırlatması",
        "body": "Yarın {shift_date} tarihinde {shift_time} saatlerinde vardiyalısınız",
        "icon": "clock",
        "priority": "normal"
    },
    
    NotificationType.SHIFT_START_ALERT: {
        "title": "⚠️ Vardiya Başlatma Uyarısı",
        "body": "{employee_name} vardiyasını başlatamadı! Araç: {vehicle_plate}",
        "icon": "alert",
        "priority": "high"
    },
    
    NotificationType.SHIFT_MASTER_CODE: {
        "title": "🔐 Master Code",
        "body": "Kod: {master_code} | Personel: {employee_name} | 15 dk geçerli",
        "icon": "key",
        "priority": "high"
    },
    
    NotificationType.HANDOVER_APPROVAL: {
        "title": "🔄 Devir Teslim Onayı",
        "body": "Araç: {vehicle_plate} | Teslim Eden: {from_employee}",
        "icon": "refresh",
        "priority": "normal"
    },
    
    NotificationType.STOCK_CRITICAL: {
        "title": "📦 Kritik Stok Uyarısı",
        "body": "{item_name} - Mevcut: {current_qty} | Min: {min_qty}",
        "icon": "package",
        "priority": "high"
    },
    
    NotificationType.SYSTEM_ALERT: {
        "title": "📢 Sistem Bildirimi",
        "body": "{message}",
        "icon": "bell",
        "priority": "normal"
    },
    
    NotificationType.EMERGENCY: {
        "title": "🚨 ACİL DURUM",
        "body": "{message}",
        "icon": "alert-triangle",
        "priority": "urgent"
    }
}


class OneSignalService:
    """OneSignal bildirim servisi"""
    
    def __init__(self):
        self.enabled = bool(ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY)
        
        if not self.enabled:
            print("[OneSignalService] WARNING: OneSignal credentials not found. Push notifications disabled.")
        else:
            print("[OneSignalService] OneSignal push notifications enabled.")
    
    def _format_template(self, template: str, data: Dict[str, Any]) -> str:
        """Şablonu verilerle doldur"""
        try:
            return template.format(**data)
        except KeyError as e:
            logger.warning(f"Missing template variable: {e}")
            return template
    
    async def send_to_users(
        self,
        notification_type: NotificationType,
        user_ids: List[str],
        data: Dict[str, Any],
        url: str = None
    ) -> Dict[str, Any]:
        """
        Belirli kullanıcılara bildirim gönder (external_user_id kullanarak)
        
        Args:
            notification_type: Bildirim tipi
            user_ids: Kullanıcı ID listesi (external_user_id olarak kaydedilmiş)
            data: Şablon değişkenleri
            url: Tıklandığında açılacak URL
        
        Returns:
            Gönderim sonuçları
        """
        logger.info(f"[OneSignal] send_to_users called: type={notification_type}, users={user_ids}")
        
        if not self.enabled:
            logger.error("[OneSignal] Service not enabled - check ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY")
            return {"success": False, "error": "OneSignal not configured", "detail": "Missing API credentials"}
        
        if not user_ids:
            logger.warning("[OneSignal] No user IDs provided")
            return {"success": False, "error": "No user IDs provided"}
        
        template = NOTIFICATION_TEMPLATES.get(notification_type)
        if not template:
            logger.warning(f"[OneSignal] Template not found: {notification_type}")
            return {"success": False, "error": f"Template not found for {notification_type}"}
        
        title = self._format_template(template.get("title", ""), data)
        body = self._format_template(template.get("body", ""), data)
        
        # OneSignal payload
        payload = {
            "app_id": ONESIGNAL_APP_ID,
            "include_external_user_ids": user_ids,
            "headings": {"en": title, "tr": title},
            "contents": {"en": body, "tr": body},
            "data": {
                "type": notification_type.value,
                "timestamp": datetime.utcnow().isoformat(),
                **data
            }
        }
        
        # URL varsa ekle
        if url:
            payload["url"] = url
            payload["web_url"] = url
        
        # Priority ayarla
        priority = template.get("priority", "normal")
        if priority == "high" or priority == "urgent":
            payload["priority"] = 10
            payload["android_channel_id"] = "healmedy_high_priority"
        
        # Chrome/Firefox için web push ayarları
        payload["chrome_web_icon"] = "https://healmedy.com/logo192.png"
        payload["chrome_web_badge"] = "https://healmedy.com/badge.png"
        
        try:
            logger.info(f"[OneSignal] Sending to external_user_ids: {user_ids}")
            logger.debug(f"[OneSignal] Payload: {json.dumps(payload, indent=2, default=str)}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{ONESIGNAL_API_URL}/notifications",
                    headers={
                        "Authorization": f"Basic {ONESIGNAL_REST_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                result = response.json()
                
                logger.info(f"[OneSignal] Response status: {response.status_code}")
                logger.info(f"[OneSignal] Response body: {result}")
                
                if response.status_code in [200, 201]:
                    recipients = result.get("recipients", 0)
                    if recipients == 0:
                        logger.warning(f"[OneSignal] Notification sent but 0 recipients - users may not be subscribed")
                    else:
                        logger.info(f"[OneSignal] Successfully sent to {recipients} recipients")
                    
                    return {
                        "success": True,
                        "notification_id": result.get("id"),
                        "recipients": recipients,
                        "warning": "No recipients - users may not be subscribed" if recipients == 0 else None
                    }
                else:
                    logger.error(f"[OneSignal] API Error: {result}")
                    return {
                        "success": False,
                        "error": result.get("errors", [result]),
                        "status_code": response.status_code
                    }
                    
        except Exception as e:
            logger.error(f"[OneSignal] Request exception: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_to_segments(
        self,
        notification_type: NotificationType,
        segments: List[str],
        data: Dict[str, Any],
        url: str = None
    ) -> Dict[str, Any]:
        """
        Segment'lere bildirim gönder (örn: tüm kullanıcılar, belirli roller)
        
        Args:
            notification_type: Bildirim tipi
            segments: Segment listesi (örn: ["All", "Subscribed Users"])
            data: Şablon değişkenleri
            url: Tıklandığında açılacak URL
        """
        if not self.enabled:
            return {"success": False, "error": "OneSignal not configured"}
        
        template = NOTIFICATION_TEMPLATES.get(notification_type)
        if not template:
            return {"success": False, "error": f"Template not found for {notification_type}"}
        
        title = self._format_template(template.get("title", ""), data)
        body = self._format_template(template.get("body", ""), data)
        
        payload = {
            "app_id": ONESIGNAL_APP_ID,
            "included_segments": segments,
            "headings": {"en": title, "tr": title},
            "contents": {"en": body, "tr": body},
            "data": {
                "type": notification_type.value,
                "timestamp": datetime.utcnow().isoformat(),
                **data
            }
        }
        
        if url:
            payload["url"] = url
            payload["web_url"] = url
        
        payload["chrome_web_icon"] = "https://healmedy.com/logo192.png"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{ONESIGNAL_API_URL}/notifications",
                    headers={
                        "Authorization": f"Basic {ONESIGNAL_REST_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code in [200, 201]:
                    return {
                        "success": True,
                        "notification_id": result.get("id"),
                        "recipients": result.get("recipients", 0)
                    }
                else:
                    return {"success": False, "error": result.get("errors", [result])}
                    
        except Exception as e:
            logger.error(f"OneSignal request error: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_to_tags(
        self,
        notification_type: NotificationType,
        tags: Dict[str, str],
        data: Dict[str, Any],
        url: str = None
    ) -> Dict[str, Any]:
        """
        Tag filtresi ile bildirim gönder (örn: role=doktor)
        
        Args:
            notification_type: Bildirim tipi
            tags: Tag filtreleri (örn: {"role": "doktor"})
            data: Şablon değişkenleri
        """
        if not self.enabled:
            return {"success": False, "error": "OneSignal not configured"}
        
        template = NOTIFICATION_TEMPLATES.get(notification_type)
        if not template:
            return {"success": False, "error": f"Template not found for {notification_type}"}
        
        title = self._format_template(template.get("title", ""), data)
        body = self._format_template(template.get("body", ""), data)
        
        # Tag filtrelerini oluştur
        filters = []
        for key, value in tags.items():
            if filters:
                filters.append({"operator": "AND"})
            filters.append({"field": "tag", "key": key, "relation": "=", "value": value})
        
        payload = {
            "app_id": ONESIGNAL_APP_ID,
            "filters": filters,
            "headings": {"en": title, "tr": title},
            "contents": {"en": body, "tr": body},
            "data": {
                "type": notification_type.value,
                "timestamp": datetime.utcnow().isoformat(),
                **data
            }
        }
        
        if url:
            payload["url"] = url
            payload["web_url"] = url
        
        payload["chrome_web_icon"] = "https://healmedy.com/logo192.png"
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{ONESIGNAL_API_URL}/notifications",
                    headers={
                        "Authorization": f"Basic {ONESIGNAL_REST_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                result = response.json()
                
                if response.status_code in [200, 201]:
                    return {
                        "success": True,
                        "notification_id": result.get("id"),
                        "recipients": result.get("recipients", 0)
                    }
                else:
                    return {"success": False, "error": result.get("errors", [result])}
                    
        except Exception as e:
            logger.error(f"OneSignal request error: {e}")
            return {"success": False, "error": str(e)}
    
    async def save_in_app_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """In-app bildirim kaydet (veritabanına)"""
        from database import notifications_collection
        
        template = NOTIFICATION_TEMPLATES.get(notification_type, {})
        title = self._format_template(template.get("title", "Bildirim"), data)
        body = self._format_template(template.get("body", ""), data)
        
        notification = {
            "_id": f"notif-{datetime.utcnow().timestamp()}-{user_id}",
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
        user_ids: List[str],
        data: Dict[str, Any],
        url: str = None,
        save_in_app: bool = True
    ) -> Dict[str, Any]:
        """
        Birleşik bildirim gönderme (push + in-app)
        
        Args:
            notification_type: Bildirim tipi
            user_ids: Kullanıcı ID listesi
            data: Şablon değişkenleri
            url: Tıklandığında açılacak URL
            save_in_app: In-app bildirim olarak da kaydet
        """
        results = {
            "push": None,
            "in_app": []
        }
        
        # Push bildirimi gönder
        push_result = await self.send_to_users(notification_type, user_ids, data, url)
        results["push"] = push_result
        
        # In-app bildirimleri kaydet
        if save_in_app:
            for user_id in user_ids:
                in_app_result = await self.save_in_app_notification(user_id, notification_type, data)
                results["in_app"].append(in_app_result)
        
        return {
            "success": push_result.get("success", False) or len(results["in_app"]) > 0,
            "results": results
        }


# Singleton instance
onesignal_service = OneSignalService()


# Yardımcı fonksiyonlar
async def send_case_notification(case_data: Dict, user_ids: List[str]):
    """Vaka bildirimi gönder"""
    return await onesignal_service.send_notification(
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
    return await onesignal_service.send_notification(
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
    return await onesignal_service.send_notification(
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
    return await onesignal_service.send_notification(
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
    return await onesignal_service.send_notification(
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
    results = []
    for role in roles:
        result = await onesignal_service.send_to_tags(
            notification_type,
            {"role": role},
            data,
            url
        )
        results.append({"role": role, **result})
    return results

