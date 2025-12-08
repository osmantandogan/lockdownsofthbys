"""
SMS Service - OneSignal SMS Gateway entegrasyonu
"""
import os
import httpx
import logging
from typing import Optional, List, Dict, Any
import json

logger = logging.getLogger(__name__)

# OneSignal SMS Configuration
ONESIGNAL_SMS_CONFIG = {
    "app_id": os.getenv("ONESIGNAL_APP_ID", "fe1b8c93-06e7-4eb1-a06c-84a05d2f2dde"),
    "rest_api_key": os.getenv("ONESIGNAL_REST_API_KEY", ""),
    "sms_from": os.getenv("ONESIGNAL_SMS_FROM", "+16592168935"),
    "api_url": "https://onesignal.com/api/v1"
}


class SMSService:
    def __init__(self):
        self.config = ONESIGNAL_SMS_CONFIG
        self.headers = {
            "Authorization": f"Basic {self.config['rest_api_key']}",
            "Content-Type": "application/json"
        }
    
    def _format_phone(self, phone: str) -> str:
        """Format phone number to international format"""
        # Remove spaces, dashes, parentheses
        phone = phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        
        # If starts with 0, assume Turkey (+90)
        if phone.startswith("0"):
            phone = "+90" + phone[1:]
        
        # If doesn't start with +, add +90
        if not phone.startswith("+"):
            if phone.startswith("90"):
                phone = "+" + phone
            else:
                phone = "+90" + phone
        
        return phone
    
    async def send_sms(
        self,
        phone_number: str,
        message: str,
        name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send SMS via OneSignal
        
        Args:
            phone_number: Recipient phone number
            message: SMS message content
            name: Optional recipient name for personalization
            
        Returns:
            Dict with success status and details
        """
        formatted_phone = self._format_phone(phone_number)
        
        payload = {
            "app_id": self.config["app_id"],
            "contents": {"en": message},
            "include_phone_numbers": [formatted_phone],
            "sms_from": self.config["sms_from"],
            "name": name or "HealMedy SMS"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.config['api_url']}/notifications",
                    headers=self.headers,
                    json=payload,
                    timeout=30.0
                )
                
                result = response.json()
                
                if response.status_code == 200:
                    logger.info(f"SMS sent successfully to {formatted_phone}")
                    return {
                        "success": True,
                        "message_id": result.get("id"),
                        "phone": formatted_phone
                    }
                else:
                    logger.error(f"SMS failed: {result}")
                    return {
                        "success": False,
                        "error": result.get("errors", ["Unknown error"]),
                        "phone": formatted_phone
                    }
                    
        except Exception as e:
            logger.error(f"SMS error: {e}")
            return {
                "success": False,
                "error": str(e),
                "phone": formatted_phone
            }
    
    async def send_bulk_sms(
        self,
        recipients: List[Dict[str, str]],
        message_template: str
    ) -> Dict[str, Any]:
        """
        Send SMS to multiple recipients
        
        Args:
            recipients: List of dicts with 'phone' and optional 'name'
            message_template: Message with {{name}} placeholders
            
        Returns:
            Dict with results for each recipient
        """
        results = {}
        
        for recipient in recipients:
            phone = recipient.get("phone")
            if not phone:
                continue
            
            # Personalize message
            message = message_template
            for key, value in recipient.items():
                message = message.replace(f"{{{{{key}}}}}", str(value))
            
            result = await self.send_sms(phone, message, recipient.get("name"))
            results[phone] = result
        
        return {
            "total": len(recipients),
            "sent": sum(1 for r in results.values() if r.get("success")),
            "failed": sum(1 for r in results.values() if not r.get("success")),
            "details": results
        }


# Singleton instance
sms_service = SMSService()


# ============================================================================
# TEMPLATE FUNCTIONS
# ============================================================================

def get_approval_code_sms(code: str, context: str) -> str:
    """Onay kodu SMS şablonu"""
    return f"HealMedy: {context} için onay kodunuz: {code}. Bu kodu kimseyle paylaşmayın."


def get_shift_handover_sms(
    giver_name: str,
    vehicle_plate: str,
    code: str
) -> str:
    """Vardiya devir teslim SMS şablonu"""
    return f"HealMedy: {giver_name}, {vehicle_plate} plakalı aracı size teslim etmek istiyor. Onay kodu: {code}"


def get_manager_approval_sms(
    requester_name: str,
    action: str,
    code: str
) -> str:
    """Yönetici onay SMS şablonu"""
    return f"HealMedy: {requester_name}, {action} için onayınızı bekliyor. Onay kodu: {code}"


def get_shift_start_reminder_sms(
    vehicle_plate: str,
    shift_time: str
) -> str:
    """Vardiya başlangıç hatırlatma SMS"""
    return f"HealMedy: {shift_time} için {vehicle_plate} aracında vardiya göreviniz bulunmaktadır."

