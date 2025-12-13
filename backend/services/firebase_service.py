"""
HEALMEDY Firebase Cloud Messaging Servisi
Android push bildirimleri için FCM kullanır
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    logger.warning("firebase-admin not installed. FCM notifications disabled.")
    FIREBASE_AVAILABLE = False

# Firebase initialization flag
_firebase_initialized = False


def initialize_firebase():
    """Firebase Admin SDK'yı başlat"""
    global _firebase_initialized
    
    if not FIREBASE_AVAILABLE:
        logger.warning("Firebase Admin SDK not available")
        return False
    
    if _firebase_initialized:
        return True
    
    try:
        # Service account JSON dosyasını kontrol et
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        
        if service_account_path and os.path.exists(service_account_path):
            # Dosyadan yükle
            cred = credentials.Certificate(service_account_path)
            logger.info(f"Firebase credentials loaded from file: {service_account_path}")
        elif service_account_json:
            # Environment variable'dan yükle
            service_account_dict = json.loads(service_account_json)
            cred = credentials.Certificate(service_account_dict)
            logger.info("Firebase credentials loaded from environment variable")
        else:
            # Default credentials kullan (Google Cloud'da çalışıyorsa)
            try:
                firebase_admin.get_app()
                _firebase_initialized = True
                return True
            except ValueError:
                logger.warning("No Firebase credentials found. FCM notifications disabled.")
                return False
        
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
        return True
        
    except Exception as e:
        logger.error(f"Firebase initialization error: {e}")
        return False


async def send_fcm_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    notification_type: str = "general",
    priority: str = "high"
) -> bool:
    """
    Tek bir cihaza FCM bildirimi gönder
    
    Args:
        token: FCM device token
        title: Bildirim başlığı
        body: Bildirim içeriği
        data: Ek veri (key-value string pairs)
        notification_type: emergency, case, general
        priority: high veya normal
    """
    if not FIREBASE_AVAILABLE:
        logger.warning("Firebase not available, skipping FCM notification")
        return False
    
    if not initialize_firebase():
        return False
    
    try:
        # Android notification ayarları
        android_config = messaging.AndroidConfig(
            priority="high" if priority == "high" else "normal",
            notification=messaging.AndroidNotification(
                title=title,
                body=body,
                icon="ic_notification",
                color="#dc2626",
                channel_id=f"{notification_type}_channel",
                priority="max" if notification_type == "emergency" else "high"
            )
        )
        
        # Data payload
        notification_data = {
            "title": title,
            "body": body,
            "type": notification_type,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat()
        }
        if data:
            notification_data.update(data)
        
        # Mesaj oluştur
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            android=android_config,
            data=notification_data,
            token=token
        )
        
        # Gönder
        response = messaging.send(message)
        logger.info(f"FCM notification sent: {response}")
        return True
        
    except messaging.UnregisteredError:
        logger.warning(f"FCM token expired or invalid: {token[:20]}...")
        return False
    except Exception as e:
        logger.error(f"FCM send error: {e}")
        return False


async def send_fcm_to_multiple(
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    notification_type: str = "general",
    priority: str = "high"
) -> Dict[str, Any]:
    """
    Birden fazla cihaza FCM bildirimi gönder
    
    Returns:
        {"success_count": int, "failure_count": int, "failed_tokens": list}
    """
    if not FIREBASE_AVAILABLE:
        return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}
    
    if not initialize_firebase():
        return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}
    
    if not tokens:
        return {"success_count": 0, "failure_count": 0, "failed_tokens": []}
    
    try:
        # Android notification ayarları
        android_config = messaging.AndroidConfig(
            priority="high" if priority == "high" else "normal",
            notification=messaging.AndroidNotification(
                title=title,
                body=body,
                icon="ic_notification",
                color="#dc2626",
                channel_id=f"{notification_type}_channel",
                priority="max" if notification_type == "emergency" else "high"
            )
        )
        
        # Data payload
        notification_data = {
            "title": title,
            "body": body,
            "type": notification_type,
            "priority": priority,
            "timestamp": datetime.utcnow().isoformat()
        }
        if data:
            notification_data.update(data)
        
        # MulticastMessage oluştur
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            android=android_config,
            data=notification_data,
            tokens=tokens
        )
        
        # Gönder
        response = messaging.send_each_for_multicast(message)
        
        # Başarısız token'ları bul
        failed_tokens = []
        for idx, send_response in enumerate(response.responses):
            if not send_response.success:
                failed_tokens.append(tokens[idx])
                if send_response.exception:
                    logger.warning(f"FCM send failed for token {tokens[idx][:20]}...: {send_response.exception}")
        
        logger.info(f"FCM multicast: {response.success_count} success, {response.failure_count} failed")
        
        return {
            "success_count": response.success_count,
            "failure_count": response.failure_count,
            "failed_tokens": failed_tokens
        }
        
    except Exception as e:
        logger.error(f"FCM multicast error: {e}")
        return {"success_count": 0, "failure_count": len(tokens), "failed_tokens": tokens}


async def send_case_notification_fcm(
    tokens: List[str],
    case_id: str,
    patient_name: str,
    case_type: str,
    priority: str = "normal"
) -> Dict[str, Any]:
    """Yeni vaka bildirimi gönder"""
    
    title = "🚑 Yeni Vaka Atandı"
    body = f"{patient_name} - {case_type}"
    
    data = {
        "case_id": case_id,
        "navigate_to": f"/dashboard/cases/{case_id}"
    }
    
    notification_type = "emergency" if priority in ["acil", "kritik", "critical"] else "case"
    
    return await send_fcm_to_multiple(
        tokens=tokens,
        title=title,
        body=body,
        data=data,
        notification_type=notification_type,
        priority="high"
    )


async def send_emergency_notification_fcm(
    tokens: List[str],
    case_id: str,
    message: str
) -> Dict[str, Any]:
    """Acil durum bildirimi gönder (en yüksek öncelik)"""
    
    title = "🆘 ACİL DURUM"
    body = message
    
    data = {
        "case_id": case_id,
        "navigate_to": f"/dashboard/cases/{case_id}",
        "play_sound": "emergency"
    }
    
    return await send_fcm_to_multiple(
        tokens=tokens,
        title=title,
        body=body,
        data=data,
        notification_type="emergency",
        priority="high"
    )


# Servis instance
class FirebaseService:
    """Firebase Cloud Messaging servisi"""
    
    def __init__(self):
        self.initialized = False
    
    def initialize(self):
        """Servisi başlat"""
        self.initialized = initialize_firebase()
        return self.initialized
    
    async def send_notification(self, token: str, title: str, body: str, **kwargs):
        """Tek cihaza bildirim gönder"""
        return await send_fcm_notification(token, title, body, **kwargs)
    
    async def send_to_multiple(self, tokens: List[str], title: str, body: str, **kwargs):
        """Birden fazla cihaza bildirim gönder"""
        return await send_fcm_to_multiple(tokens, title, body, **kwargs)
    
    async def send_case_notification(self, tokens: List[str], case_id: str, patient_name: str, case_type: str, priority: str = "normal"):
        """Vaka bildirimi gönder"""
        return await send_case_notification_fcm(tokens, case_id, patient_name, case_type, priority)
    
    async def send_emergency(self, tokens: List[str], case_id: str, message: str):
        """Acil durum bildirimi gönder"""
        return await send_emergency_notification_fcm(tokens, case_id, message)


# Global instance
firebase_service = FirebaseService()

