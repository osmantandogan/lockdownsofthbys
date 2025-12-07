"""
HEALMEDY Bildirim Servisi
SMS, WhatsApp, Web Push, Mobile Push entegrasyonu
Infobip API kullanımı
"""

import os
import httpx
import json
import logging
import asyncio
from datetime import datetime, timedelta
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

# Infobip Configuration
INFOBIP_API_KEY = os.environ.get("INFOBIP_API_KEY", "")
INFOBIP_BASE_URL = os.environ.get("INFOBIP_BASE_URL", "")  # örn: xxxxx.api.infobip.com
INFOBIP_SENDER = os.environ.get("INFOBIP_SENDER", "HEALMEDY")
INFOBIP_WHATSAPP_SENDER = os.environ.get("INFOBIP_WHATSAPP_SENDER", "")

# Web Push Configuration
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_EMAIL = os.environ.get("VAPID_EMAIL", "info@healmedy.com")

# Firebase Cloud Messaging Configuration
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_PRIVATE_KEY = os.environ.get("FIREBASE_PRIVATE_KEY", "").replace("\\n", "\n")
FIREBASE_CLIENT_EMAIL = os.environ.get("FIREBASE_CLIENT_EMAIL", "")
FIREBASE_CREDENTIALS_PATH = os.environ.get("FIREBASE_CREDENTIALS_PATH", "")


class NotificationType(str, Enum):
    """Bildirim tipleri"""
    CASE_CREATED = "case_created"                    # Vaka oluşturuldu
    CASE_ASSIGNED = "case_assigned"                  # Vaka ekibe atandı
    CASE_DOCTOR_APPROVAL = "case_doctor_approval"    # Doktor onayı verildi
    CASE_CLOSED = "case_closed"                      # Vaka kapandı
    CASE_FILE_ACCESS = "case_file_access"            # Kapanmış dosyaya erişim istendi
    
    SHIFT_REMINDER = "shift_reminder"                # Vardiya hatırlatması
    SHIFT_START_ALERT = "shift_start_alert"          # Vardiya başlatma uyarısı
    SHIFT_MASTER_CODE = "shift_master_code"          # Master code ile başlatma
    
    HANDOVER_APPROVAL = "handover_approval"          # Devir teslim onayı
    
    STOCK_CRITICAL = "stock_critical"                # Kritik stok uyarısı
    
    SYSTEM_ALERT = "system_alert"                    # Sistem uyarısı
    EMERGENCY = "emergency"                          # Acil durum


class NotificationChannel(str, Enum):
    """Bildirim kanalları"""
    SMS = "sms"
    WHATSAPP = "whatsapp"
    WEB_PUSH = "web_push"
    MOBILE_PUSH = "mobile_push"
    EMAIL = "email"
    IN_APP = "in_app"


# Bildirim Şablonları
NOTIFICATION_TEMPLATES = {
    NotificationType.CASE_CREATED: {
        "title": "🚑 Yeni Vaka Oluşturuldu",
        "sms": "HEALMEDY: Yeni vaka #{case_number}. Hasta: {patient_name}, Lokasyon: {location}. Aciliyet: {priority}. Sisteme giriş yapınız.",
        "whatsapp": """🚑 *Yeni Vaka Bildirimi*

📋 *Vaka No:* {case_number}
👤 *Hasta:* {patient_name}
📍 *Lokasyon:* {location}
⚠️ *Aciliyet:* {priority}
🕐 *Tarih:* {created_at}

_Detaylar için sisteme giriş yapınız._""",
        "push": {
            "title": "🚑 Yeni Vaka: {case_number}",
            "body": "Hasta: {patient_name} | Lokasyon: {location} | Aciliyet: {priority}"
        }
    },
    
    NotificationType.CASE_ASSIGNED: {
        "title": "📋 Vaka Atandı",
        "sms": "HEALMEDY: Vaka #{case_number} size atandı. Araç: {vehicle_plate}. Hemen sisteme giriş yapınız.",
        "whatsapp": """📋 *Vaka Ataması*

Vaka *#{case_number}* size atandı.

🚑 *Araç:* {vehicle_plate}
👤 *Hasta:* {patient_name}
📍 *Lokasyon:* {location}

_Detaylar için sisteme giriş yapınız._""",
        "push": {
            "title": "📋 Vaka Atandı: {case_number}",
            "body": "Araç: {vehicle_plate} | {patient_name}"
        }
    },
    
    NotificationType.CASE_DOCTOR_APPROVAL: {
        "title": "✅ Doktor Onayı",
        "sms": "HEALMEDY: Vaka #{case_number} için doktor onayı verildi. Onaylayan: {doctor_name}",
        "whatsapp": """✅ *Doktor Onayı Alındı*

Vaka *#{case_number}* için doktor onayı verildi.

👨‍⚕️ *Onaylayan:* {doctor_name}
🕐 *Tarih:* {approved_at}
📝 *Not:* {approval_note}""",
        "push": {
            "title": "✅ Doktor Onayı: {case_number}",
            "body": "Onaylayan: {doctor_name}"
        }
    },
    
    NotificationType.SHIFT_REMINDER: {
        "title": "⏰ Vardiya Hatırlatması",
        "sms": "HEALMEDY: Yarın {shift_date} tarihinde {shift_time} saatlerinde {location} lokasyonunda vardiyalısınız. Unutmayınız.",
        "whatsapp": """⏰ *Vardiya Hatırlatması*

Yarın vardiyalısınız!

📅 *Tarih:* {shift_date}
🕐 *Saat:* {shift_time}
📍 *Lokasyon:* {location}
🚑 *Araç:* {vehicle_plate}

_Güvenli çalışmalar dileriz._""",
        "push": {
            "title": "⏰ Yarın Vardiyalısınız",
            "body": "{shift_date} | {shift_time} | {location}"
        }
    },
    
    NotificationType.SHIFT_START_ALERT: {
        "title": "⚠️ Vardiya Başlatma Uyarısı",
        "sms": "HEALMEDY UYARI: {employee_name} vardiyasını başlatamadı! Araç: {vehicle_plate}. Acil müdahale gerekebilir.",
        "whatsapp": """⚠️ *Vardiya Başlatma Sorunu*

Personel vardiyasını başlatamadı!

👤 *Personel:* {employee_name}
🚑 *Araç:* {vehicle_plate}
📅 *Tarih:* {shift_date}
🕐 *Beklenen Başlangıç:* {expected_start}

_Acil müdahale gerekebilir._""",
        "push": {
            "title": "⚠️ Vardiya Başlatma Sorunu",
            "body": "{employee_name} vardiyasını başlatamadı!"
        }
    },
    
    NotificationType.SHIFT_MASTER_CODE: {
        "title": "🔐 Master Code Oluşturuldu",
        "sms": "HEALMEDY: Acil vardiya başlatma için Master Code: {master_code}. Personel: {employee_name}. Kod 15 dakika geçerli.",
        "whatsapp": """🔐 *Master Code Bildirimi*

Acil vardiya başlatma için kod oluşturuldu.

🔑 *Kod:* `{master_code}`
👤 *Personel:* {employee_name}
🚑 *Araç:* {vehicle_plate}
⏳ *Geçerlilik:* 15 dakika

_Bu kodu sadece ilgili personelle paylaşınız._""",
        "push": {
            "title": "🔐 Master Code: {master_code}",
            "body": "Personel: {employee_name} | 15 dk geçerli"
        }
    },
    
    NotificationType.HANDOVER_APPROVAL: {
        "title": "🔄 Devir Teslim Onayı Bekliyor",
        "sms": "HEALMEDY: {vehicle_plate} araç devir teslim onayınızı bekliyor. Teslim eden: {from_employee}. Sisteme giriş yapınız.",
        "whatsapp": """🔄 *Devir Teslim Onayı*

Araç devir teslim onayınızı bekliyor.

🚑 *Araç:* {vehicle_plate}
👤 *Teslim Eden:* {from_employee}
📅 *Tarih:* {handover_date}
🕐 *Saat:* {handover_time}

_Onay için sisteme giriş yapınız._""",
        "push": {
            "title": "🔄 Devir Teslim Onayı",
            "body": "Araç: {vehicle_plate} | Teslim Eden: {from_employee}"
        }
    },
    
    NotificationType.STOCK_CRITICAL: {
        "title": "📦 Kritik Stok Uyarısı",
        "sms": "HEALMEDY STOK UYARISI: {item_name} kritik seviyede! Mevcut: {current_qty}, Minimum: {min_qty}. Acil sipariş gerekli.",
        "whatsapp": """📦 *Kritik Stok Uyarısı*

Aşağıdaki ürün kritik seviyede!

📋 *Ürün:* {item_name}
📊 *Mevcut:* {current_qty} adet
⚠️ *Minimum:* {min_qty} adet
📍 *Depo:* {warehouse}

_Acil sipariş oluşturulması önerilir._""",
        "push": {
            "title": "📦 Kritik Stok: {item_name}",
            "body": "Mevcut: {current_qty} | Min: {min_qty}"
        }
    },
    
    NotificationType.CASE_FILE_ACCESS: {
        "title": "🔒 Dosya Erişim Talebi",
        "sms": "HEALMEDY: {requester_name} kapalı vaka dosyasına erişim talep etti. Vaka: #{case_number}. Onay için sisteme giriş yapınız.",
        "whatsapp": """🔒 *Dosya Erişim Talebi*

Kapalı vaka dosyasına erişim talep edildi.

📋 *Vaka No:* {case_number}
👤 *Talep Eden:* {requester_name}
💼 *Rol:* {requester_role}
🕐 *Talep Tarihi:* {request_date}
📝 *Sebep:* {access_reason}

_Onay/Red için sisteme giriş yapınız._""",
        "push": {
            "title": "🔒 Dosya Erişim Talebi",
            "body": "{requester_name} - Vaka #{case_number}"
        }
    },
    
    NotificationType.EMERGENCY: {
        "title": "🚨 ACİL DURUM",
        "sms": "HEALMEDY ACİL: {message}. Derhal sisteme giriş yapınız!",
        "whatsapp": """🚨 *ACİL DURUM BİLDİRİMİ*

{message}

_Derhal gerekli aksiyonu alınız!_""",
        "push": {
            "title": "🚨 ACİL DURUM",
            "body": "{message}"
        }
    }
}


class NotificationService:
    """Bildirim servisi ana sınıfı"""
    
    def __init__(self):
        self.infobip_enabled = bool(INFOBIP_API_KEY and INFOBIP_BASE_URL)
        self.web_push_enabled = bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)
        self.fcm_enabled = False
        self.fcm_app = None
        
        # Debug logging - always print to console
        print(f"[NotificationService] Infobip API Key: {'***' + INFOBIP_API_KEY[-10:] if INFOBIP_API_KEY else 'NOT SET'}")
        print(f"[NotificationService] Infobip Base URL: {INFOBIP_BASE_URL or 'NOT SET'}")
        print(f"[NotificationService] Infobip Sender: {INFOBIP_SENDER}")
        print(f"[NotificationService] Infobip Enabled: {self.infobip_enabled}")
        print(f"[NotificationService] Web Push Enabled: {self.web_push_enabled}")
        
        if not self.infobip_enabled:
            print("[NotificationService] WARNING: Infobip credentials not found. SMS/WhatsApp disabled.")
        else:
            print("[NotificationService] Infobip SMS/WhatsApp enabled.")
        if not self.web_push_enabled:
            print("[NotificationService] WARNING: VAPID keys not found. Web Push disabled.")
        
        # Firebase Admin SDK initialization
        self._init_firebase()
    
    def _init_firebase(self):
        """Firebase Admin SDK'yı başlat"""
        try:
            import firebase_admin
            from firebase_admin import credentials, messaging
            
            # Firebase zaten initialize edilmiş mi kontrol et
            try:
                self.fcm_app = firebase_admin.get_app()
                self.fcm_enabled = True
                logger.info("Firebase Admin SDK already initialized")
                return
            except ValueError:
                # Henüz initialize edilmemiş
                pass
            
            # Credentials dosyası varsa onu kullan
            if FIREBASE_CREDENTIALS_PATH:
                # Relative path'i absolute path'e çevir
                cred_path = FIREBASE_CREDENTIALS_PATH
                if not os.path.isabs(cred_path):
                    # Backend klasörüne göre path
                    backend_dir = Path(__file__).parent.parent.resolve()
                    cred_path = backend_dir / cred_path
                else:
                    cred_path = Path(cred_path)
                
                if cred_path.exists():
                    cred = credentials.Certificate(str(cred_path))
                    self.fcm_app = firebase_admin.initialize_app(cred)
                    self.fcm_enabled = True
                    print(f"[NotificationService] Firebase Admin SDK initialized from credentials file: {cred_path}")
                    print(f"[NotificationService] FCM Enabled: {self.fcm_enabled}")
                    return
                else:
                    print(f"[NotificationService] WARNING: Firebase credentials file not found: {cred_path}")
            
            # Environment variables'dan credentials oluştur
            if FIREBASE_PROJECT_ID and FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL:
                cred_dict = {
                    "type": "service_account",
                    "project_id": FIREBASE_PROJECT_ID,
                    "private_key_id": "",
                    "private_key": FIREBASE_PRIVATE_KEY,
                    "client_email": FIREBASE_CLIENT_EMAIL,
                    "client_id": "",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{FIREBASE_CLIENT_EMAIL}"
                }
                cred = credentials.Certificate(cred_dict)
                self.fcm_app = firebase_admin.initialize_app(cred)
                self.fcm_enabled = True
                logger.info("Firebase Admin SDK initialized from environment variables")
                logger.info(f"FCM Project ID: {FIREBASE_PROJECT_ID}")
            else:
                logger.warning("Firebase credentials not found. FCM disabled.")
                
        except ImportError:
            logger.warning("firebase-admin not installed. FCM disabled. Install with: pip install firebase-admin")
        except Exception as e:
            logger.error(f"Error initializing Firebase: {e}", exc_info=True)
    
    async def send_notification(
        self,
        notification_type: NotificationType,
        recipients: List[Dict[str, Any]],
        data: Dict[str, Any],
        channels: List[NotificationChannel] = None,
        priority: str = "normal"
    ) -> Dict[str, Any]:
        """
        Bildirim gönder
        
        Args:
            notification_type: Bildirim tipi
            recipients: Alıcı listesi [{"user_id": "...", "phone": "...", "email": "...", "push_token": "..."}]
            data: Şablon değişkenleri
            channels: Hangi kanallardan gönderilecek (None ise kullanıcı tercihlerine göre)
            priority: Öncelik (normal, high, critical)
        
        Returns:
            Gönderim sonuçları
        """
        results = {
            "success": True,
            "sent_count": 0,
            "failed_count": 0,
            "details": []
        }
        
        template = NOTIFICATION_TEMPLATES.get(notification_type)
        if not template:
            logger.error(f"Template not found for {notification_type}")
            return {"success": False, "error": "Template not found"}
        
        for recipient in recipients:
            recipient_results = []
            
            # Kullanıcı tercihlerine göre kanalları belirle
            user_channels = channels or self._get_user_channels(recipient, notification_type)
            
            for channel in user_channels:
                try:
                    if channel == NotificationChannel.SMS:
                        result = await self._send_sms(recipient.get("phone"), template, data)
                    elif channel == NotificationChannel.WHATSAPP:
                        result = await self._send_whatsapp(recipient.get("phone"), template, data)
                    elif channel == NotificationChannel.WEB_PUSH:
                        # Web Push için FCM token varsa FCM kullan, yoksa VAPID kullan
                        fcm_token = recipient.get("fcm_token")
                        if fcm_token and self.fcm_enabled:
                            result = await self._send_mobile_push(fcm_token, template, data)
                        else:
                            result = await self._send_web_push(recipient.get("push_subscriptions", []), template, data)
                    elif channel == NotificationChannel.MOBILE_PUSH:
                        result = await self._send_mobile_push(recipient.get("fcm_token"), template, data)
                    elif channel == NotificationChannel.IN_APP:
                        result = await self._save_in_app_notification(recipient.get("user_id"), notification_type, template, data)
                    else:
                        continue
                    
                    recipient_results.append({"channel": channel.value, **result})
                    
                    if result.get("success"):
                        results["sent_count"] += 1
                    else:
                        results["failed_count"] += 1
                        
                except Exception as e:
                    logger.error(f"Error sending {channel} to {recipient}: {e}")
                    results["failed_count"] += 1
                    recipient_results.append({"channel": channel.value, "success": False, "error": str(e)})
            
            results["details"].append({
                "user_id": recipient.get("user_id"),
                "results": recipient_results
            })
        
        results["success"] = results["failed_count"] == 0
        return results
    
    def _get_user_channels(self, recipient: Dict, notification_type: NotificationType) -> List[NotificationChannel]:
        """Kullanıcı tercihlerine göre kanalları döndür"""
        # Default: tüm kanallar aktif
        preferences = recipient.get("notification_preferences", {})
        type_prefs = preferences.get(notification_type.value, {})
        
        channels = []
        phone = recipient.get("phone")
        
        # SMS kanalı
        if type_prefs.get("sms", True) and phone:
            logger.info(f"Adding SMS channel for user {recipient.get('user_id')} with phone {phone}")
            channels.append(NotificationChannel.SMS)
        elif type_prefs.get("sms", True) and not phone:
            logger.warning(f"SMS enabled but no phone for user {recipient.get('user_id')}")
        
        # WhatsApp kanalı
        if type_prefs.get("whatsapp", True) and phone:
            channels.append(NotificationChannel.WHATSAPP)
        
        # Web Push kanalı
        if type_prefs.get("web_push", True) and recipient.get("push_subscriptions"):
            channels.append(NotificationChannel.WEB_PUSH)
        
        # Mobile Push kanalı
        if type_prefs.get("mobile_push", True) and recipient.get("fcm_token"):
            channels.append(NotificationChannel.MOBILE_PUSH)
        
        # Her zaman in-app bildirim
        channels.append(NotificationChannel.IN_APP)
        
        logger.info(f"Channels for user {recipient.get('user_id')}: {[c.value for c in channels]}")
        return channels
    
    def _format_template(self, template: str, data: Dict[str, Any]) -> str:
        """Şablonu verilerle doldur"""
        try:
            return template.format(**data)
        except KeyError as e:
            logger.warning(f"Missing template variable: {e}")
            return template
    
    async def _send_sms(self, phone: str, template: Dict, data: Dict) -> Dict:
        """Infobip SMS gönder"""
        if not phone or not self.infobip_enabled:
            logger.warning(f"SMS not configured: phone={bool(phone)}, infobip_enabled={self.infobip_enabled}")
            return {"success": False, "error": "SMS not configured or phone missing"}
        
        message = self._format_template(template.get("sms", ""), data)
        formatted_phone = self._format_phone(phone)
        
        logger.info(f"Sending SMS to {formatted_phone} via {INFOBIP_BASE_URL}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = f"https://{INFOBIP_BASE_URL}/sms/2/text/advanced"
                payload = {
                    "messages": [{
                        "from": INFOBIP_SENDER,
                        "destinations": [{"to": formatted_phone}],
                        "text": message
                    }]
                }
                
                logger.debug(f"SMS Request URL: {url}")
                logger.debug(f"SMS Request Payload: {payload}")
                
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"App {INFOBIP_API_KEY}",
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    json=payload
                )
                
                logger.info(f"SMS Response Status: {response.status_code}")
                logger.debug(f"SMS Response Text: {response.text}")
                
                if response.status_code == 200:
                    try:
                        result = response.json()
                        logger.info(f"SMS API Response: {result}")
                        
                        # Infobip response format: {"bulkId": "...", "messages": [{"messageId": "...", "status": {...}}]}
                        messages = result.get("messages", [])
                        if messages:
                            message_info = messages[0]
                            message_id = message_info.get("messageId")
                            status = message_info.get("status", {})
                            status_name = status.get("name", "UNKNOWN")
                            
                            # Infobip başarılı durumları: PENDING, PENDING_ACCEPTED, MESSAGE_ACCEPTED, DELIVERED
                            success_statuses = ["PENDING", "PENDING_ACCEPTED", "PENDING_WAITING", "MESSAGE_ACCEPTED", "DELIVERED", "SENT"]
                            
                            if status_name in success_statuses:
                                logger.info(f"SMS sent successfully. Message ID: {message_id}, Status: {status_name}")
                                print(f"[NotificationService] SMS SENT! Message ID: {message_id}, Status: {status_name}")
                                return {"success": True, "message_id": message_id, "status": status_name}
                            else:
                                logger.warning(f"SMS status: {status_name}, Message ID: {message_id}")
                                print(f"[NotificationService] SMS STATUS: {status_name}, Message ID: {message_id}")
                                return {"success": False, "error": f"Status: {status_name}", "message_id": message_id}
                        else:
                            logger.error(f"SMS response has no messages: {result}")
                            return {"success": False, "error": "No messages in response"}
                    except Exception as json_error:
                        logger.error(f"SMS JSON parse error: {json_error}, Response: {response.text}")
                        return {"success": False, "error": f"JSON parse error: {json_error}"}
                else:
                    error_text = response.text
                    logger.error(f"SMS API error: Status {response.status_code}, Response: {error_text}")
                    try:
                        error_json = response.json()
                        error_message = error_json.get("requestError", {}).get("serviceException", {}).get("text", error_text)
                        return {"success": False, "error": f"API Error {response.status_code}: {error_message}"}
                    except:
                        return {"success": False, "error": f"API Error {response.status_code}: {error_text}"}
                    
        except httpx.TimeoutException as e:
            logger.error(f"SMS timeout error: {e}")
            return {"success": False, "error": f"Timeout: {str(e)}"}
        except Exception as e:
            logger.error(f"SMS error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _send_whatsapp(self, phone: str, template: Dict, data: Dict) -> Dict:
        """Infobip WhatsApp gönder"""
        if not phone or not self.infobip_enabled or not INFOBIP_WHATSAPP_SENDER:
            return {"success": False, "error": "WhatsApp not configured or phone missing"}
        
        message = self._format_template(template.get("whatsapp", ""), data)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://{INFOBIP_BASE_URL}/whatsapp/1/message/text",
                    headers={
                        "Authorization": f"App {INFOBIP_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": INFOBIP_WHATSAPP_SENDER,
                        "to": self._format_phone(phone),
                        "content": {
                            "text": message
                        }
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return {"success": True, "message_id": result.get("messageId")}
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.error(f"WhatsApp error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _send_web_push(self, subscriptions: List[Dict], template: Dict, data: Dict) -> Dict:
        """Web Push bildirimi gönder"""
        if not subscriptions or not self.web_push_enabled:
            return {"success": False, "error": "Web Push not configured"}
        
        push_data = template.get("push", {})
        title = self._format_template(push_data.get("title", ""), data)
        body = self._format_template(push_data.get("body", ""), data)
        
        sent = 0
        failed = 0
        
        try:
            from pywebpush import webpush, WebPushException
            
            for subscription in subscriptions:
                try:
                    webpush(
                        subscription_info=subscription,
                        data=json.dumps({
                            "title": title,
                            "body": body,
                            "icon": "/logo192.png",
                            "badge": "/badge.png",
                            "url": data.get("url", "/dashboard")
                        }),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims={"sub": f"mailto:{VAPID_EMAIL}"}
                    )
                    sent += 1
                except WebPushException as e:
                    logger.error(f"Web push failed: {e}")
                    failed += 1
            
            return {"success": sent > 0, "sent": sent, "failed": failed}
            
        except ImportError:
            logger.warning("pywebpush not installed")
            return {"success": False, "error": "pywebpush not installed"}
        except Exception as e:
            logger.error(f"Web Push error: {e}")
            return {"success": False, "error": str(e)}
    
    async def _send_mobile_push(self, fcm_token: str, template: Dict, data: Dict) -> Dict:
        """Firebase Cloud Messaging (FCM) gönder - Hem web hem mobil"""
        if not fcm_token:
            return {"success": False, "error": "FCM token missing"}
        
        if not self.fcm_enabled:
            return {"success": False, "error": "FCM not configured"}
        
        push_data = template.get("push", {})
        title = self._format_template(push_data.get("title", ""), data)
        body = self._format_template(push_data.get("body", ""), data)
        
        try:
            from firebase_admin import messaging
            
            # FCM mesajı oluştur
            message = messaging.Message(
                token=fcm_token,
                notification=messaging.Notification(
                    title=title,
                    body=body
                ),
                data={
                    "type": data.get("notification_type", "general"),
                    "case_id": str(data.get("case_id", "")),
                    "case_number": data.get("case_number", ""),
                    "url": data.get("url", "/dashboard"),
                    "priority": data.get("priority", "normal"),
                    "timestamp": str(int(datetime.utcnow().timestamp()))
                },
                android=messaging.AndroidConfig(
                    priority="high" if data.get("priority") in ["high", "critical"] else "normal",
                    notification=messaging.AndroidNotification(
                        sound="default",
                        channel_id="healmedy_notifications",
                        priority="high" if data.get("priority") in ["high", "critical"] else "default"
                    )
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            sound="default",
                            badge=1,
                            alert=messaging.ApsAlert(
                                title=title,
                                body=body
                            )
                        )
                    )
                ),
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon="/logo192.png",
                        badge="/badge.png",
                        require_interaction=data.get("priority") in ["high", "critical"]
                    ),
                    fcm_options=messaging.WebpushFCMOptions(
                        link=data.get("url", "/dashboard")
                    )
                )
            )
            
            # Mesajı gönder
            response = await asyncio.to_thread(messaging.send, message)
            logger.info(f"FCM message sent successfully. Message ID: {response}")
            
            return {"success": True, "message_id": response}
            
        except Exception as e:
            logger.error(f"FCM error: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    async def _save_in_app_notification(
        self, 
        user_id: str, 
        notification_type: NotificationType,
        template: Dict, 
        data: Dict
    ) -> Dict:
        """In-app bildirim kaydet"""
        from database import notifications_collection
        
        push_data = template.get("push", {})
        title = self._format_template(push_data.get("title", template.get("title", "")), data)
        body = self._format_template(push_data.get("body", ""), data)
        
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
    
    def _format_phone(self, phone: str) -> str:
        """Telefon numarasını uluslararası formata çevir"""
        phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        if phone.startswith("0"):
            phone = "90" + phone[1:]
        elif not phone.startswith("90") and not phone.startswith("+90"):
            phone = "90" + phone
        
        phone = phone.replace("+", "")
        return phone


# Singleton instance
notification_service = NotificationService()


# Yardımcı fonksiyonlar
async def send_case_notification(case_data: Dict, recipients: List[Dict]):
    """Vaka bildirimi gönder"""
    return await notification_service.send_notification(
        NotificationType.CASE_CREATED,
        recipients,
        {
            "case_number": case_data.get("case_number"),
            "patient_name": case_data.get("patient_name"),
            "location": case_data.get("location"),
            "priority": case_data.get("priority", "Normal"),
            "created_at": datetime.now().strftime("%d.%m.%Y %H:%M")
        }
    )


async def send_shift_reminder(shift_data: Dict, recipient: Dict):
    """Vardiya hatırlatması gönder"""
    return await notification_service.send_notification(
        NotificationType.SHIFT_REMINDER,
        [recipient],
        {
            "shift_date": shift_data.get("shift_date"),
            "shift_time": shift_data.get("shift_time"),
            "location": shift_data.get("location"),
            "vehicle_plate": shift_data.get("vehicle_plate", "-")
        }
    )


async def send_handover_approval(handover_data: Dict, approver: Dict):
    """Devir teslim onayı bildirimi"""
    return await notification_service.send_notification(
        NotificationType.HANDOVER_APPROVAL,
        [approver],
        {
            "vehicle_plate": handover_data.get("vehicle_plate"),
            "from_employee": handover_data.get("from_employee"),
            "handover_date": handover_data.get("date"),
            "handover_time": handover_data.get("time")
        }
    )


async def send_stock_alert(item_data: Dict, manager: Dict):
    """Kritik stok uyarısı"""
    return await notification_service.send_notification(
        NotificationType.STOCK_CRITICAL,
        [manager],
        {
            "item_name": item_data.get("name"),
            "current_qty": item_data.get("current_quantity"),
            "min_qty": item_data.get("min_quantity"),
            "warehouse": item_data.get("warehouse", "Ana Depo")
        },
        priority="high"
    )


async def send_master_code(code: str, employee_name: str, vehicle_plate: str, manager: Dict):
    """Master code bildirimi"""
    return await notification_service.send_notification(
        NotificationType.SHIFT_MASTER_CODE,
        [manager],
        {
            "master_code": code,
            "employee_name": employee_name,
            "vehicle_plate": vehicle_plate
        },
        channels=[NotificationChannel.SMS, NotificationChannel.WHATSAPP, NotificationChannel.IN_APP],
        priority="critical"
    )


# Yardımcı fonksiyonlar - Veritabanı işlemleri
async def get_user_by_id(user_id: str):
    """Kullanıcı bilgilerini getir"""
    from database import users_collection
    user_doc = await users_collection.find_one({"_id": user_id})
    if user_doc:
        user_doc["id"] = user_doc.pop("_id")
    return user_doc


async def get_users_by_role(roles: List[str]):
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

