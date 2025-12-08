"""
Approval Service - Onay Kodu Yönetimi
SMS, Email, Push bildirimleri ile birleşik onay sistemi
"""
import os
import random
import string
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from database import approvals_collection, users_collection
from .email_service import (
    email_service, 
    get_approval_code_email_template,
    get_shift_handover_email_template,
    get_manager_approval_email_template
)
from .sms_service import (
    sms_service,
    get_approval_code_sms,
    get_shift_handover_sms,
    get_manager_approval_sms
)
from .onesignal_service import onesignal_service

logger = logging.getLogger(__name__)


class ApprovalService:
    """Birleşik onay kodu servisi"""
    
    def __init__(self):
        self.code_length = 6
        self.code_expiry_minutes = 5
    
    def _generate_code(self) -> str:
        """6 haneli onay kodu oluştur"""
        return ''.join(random.choices(string.digits, k=self.code_length))
    
    async def create_approval(
        self,
        approval_type: str,
        requester_id: str,
        target_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        notify_user_ids: Optional[List[str]] = None,
        expiry_minutes: int = 5
    ) -> Dict[str, Any]:
        """
        Onay kodu oluştur ve bildirim gönder
        
        Args:
            approval_type: Onay tipi (shift_handover, manager_approval, case_reopen vb.)
            requester_id: Talep eden kullanıcı ID
            target_id: Hedef kayıt ID (vardiya, vaka vb.)
            metadata: Ek bilgiler
            notify_user_ids: Bildirim gönderilecek kullanıcı ID'leri
            expiry_minutes: Kodun geçerlilik süresi (dakika)
            
        Returns:
            Approval kaydı
        """
        code = self._generate_code()
        expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
        
        approval = {
            "_id": f"APR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{code}",
            "type": approval_type,
            "code": code,
            "requester_id": requester_id,
            "target_id": target_id,
            "metadata": metadata or {},
            "status": "pending",
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "verified_at": None,
            "verified_by": None,
            "notified_users": notify_user_ids or []
        }
        
        await approvals_collection.insert_one(approval)
        
        # Bildirimleri gönder
        if notify_user_ids:
            await self._send_notifications(approval, notify_user_ids)
        
        return {
            "approval_id": approval["_id"],
            "code": code,
            "expires_at": expires_at.isoformat(),
            "type": approval_type
        }
    
    async def _send_notifications(
        self,
        approval: Dict,
        user_ids: List[str]
    ):
        """Onay bildirimleri gönder (SMS, Email, Push)"""
        for user_id in user_ids:
            user = await users_collection.find_one({"_id": user_id})
            if not user:
                continue
            
            user_name = user.get("name", "Kullanıcı")
            user_email = user.get("email")
            user_phone = user.get("phone")
            
            approval_type = approval["type"]
            code = approval["code"]
            metadata = approval.get("metadata", {})
            
            # Context mesajı oluştur
            context_map = {
                "shift_handover": "Vardiya Devir Teslim",
                "shift_start_approval": "Vardiya Başlatma",
                "manager_approval": "Yönetici Onayı",
                "case_reopen": "Vaka Yeniden Açma",
                "medication_approval": "İlaç Kullanım Onayı"
            }
            context = context_map.get(approval_type, "İşlem Onayı")
            
            # 1. EMAIL GÖNDERİMİ
            if user_email:
                try:
                    if approval_type == "shift_handover":
                        email_html = get_shift_handover_email_template(
                            receiver_name=user_name,
                            giver_name=metadata.get("giver_name", "Personel"),
                            vehicle_plate=metadata.get("vehicle_plate", ""),
                            code=code,
                            shift_date=metadata.get("date", datetime.utcnow().strftime("%d.%m.%Y")),
                            shift_time=metadata.get("time", datetime.utcnow().strftime("%H:%M"))
                        )
                    elif approval_type in ["manager_approval", "shift_start_approval"]:
                        email_html = get_manager_approval_email_template(
                            manager_name=user_name,
                            requester_name=metadata.get("requester_name", "Personel"),
                            action=metadata.get("action", context),
                            vehicle_plate=metadata.get("vehicle_plate", ""),
                            code=code,
                            details=metadata.get("details", "")
                        )
                    else:
                        email_html = get_approval_code_email_template(
                            user_name=user_name,
                            code=code,
                            context=context,
                            expires_in="5 dakika"
                        )
                    
                    await email_service.send_email_async(
                        to_email=user_email,
                        subject=f"HealMedy - {context} Onay Kodu",
                        body_html=email_html
                    )
                    logger.info(f"Approval email sent to {user_email}")
                except Exception as e:
                    logger.error(f"Failed to send approval email: {e}")
            
            # 2. SMS GÖNDERİMİ
            if user_phone:
                try:
                    if approval_type == "shift_handover":
                        sms_text = get_shift_handover_sms(
                            giver_name=metadata.get("giver_name", "Personel"),
                            vehicle_plate=metadata.get("vehicle_plate", ""),
                            code=code
                        )
                    elif approval_type in ["manager_approval", "shift_start_approval"]:
                        sms_text = get_manager_approval_sms(
                            requester_name=metadata.get("requester_name", "Personel"),
                            action=metadata.get("action", context),
                            code=code
                        )
                    else:
                        sms_text = get_approval_code_sms(code, context)
                    
                    await sms_service.send_sms(user_phone, sms_text)
                    logger.info(f"Approval SMS sent to {user_phone}")
                except Exception as e:
                    logger.error(f"Failed to send approval SMS: {e}")
            
            # 3. PUSH BİLDİRİMİ GÖNDERİMİ
            try:
                await onesignal_service.send_to_user(
                    user_id=user_id,
                    title=f"🔐 {context}",
                    message=f"Onay kodunuz: {code}",
                    data={
                        "type": "approval_code",
                        "approval_type": approval_type,
                        "approval_id": approval["_id"]
                    }
                )
                logger.info(f"Approval push sent to user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send approval push: {e}")
    
    async def verify_code(
        self,
        code: str,
        approval_type: Optional[str] = None,
        verifier_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Onay kodunu doğrula
        
        Args:
            code: Doğrulanacak kod
            approval_type: Onay tipi (opsiyonel filtre)
            verifier_id: Doğrulayan kullanıcı ID
            
        Returns:
            Doğrulama sonucu
        """
        query = {
            "code": code,
            "status": "pending",
            "expires_at": {"$gt": datetime.utcnow()}
        }
        
        if approval_type:
            query["type"] = approval_type
        
        approval = await approvals_collection.find_one(query)
        
        if not approval:
            # Süresi geçmiş mi kontrol et
            expired = await approvals_collection.find_one({
                "code": code,
                "status": "pending",
                "expires_at": {"$lte": datetime.utcnow()}
            })
            
            if expired:
                return {
                    "valid": False,
                    "error": "Onay kodunun süresi dolmuş",
                    "code": "EXPIRED"
                }
            
            return {
                "valid": False,
                "error": "Geçersiz onay kodu",
                "code": "INVALID"
            }
        
        # Kodu doğrulandı olarak işaretle
        await approvals_collection.update_one(
            {"_id": approval["_id"]},
            {
                "$set": {
                    "status": "verified",
                    "verified_at": datetime.utcnow(),
                    "verified_by": verifier_id
                }
            }
        )
        
        return {
            "valid": True,
            "approval_id": approval["_id"],
            "type": approval["type"],
            "metadata": approval.get("metadata", {}),
            "target_id": approval.get("target_id")
        }
    
    async def get_pending_approvals(
        self,
        user_id: str,
        approval_type: Optional[str] = None
    ) -> List[Dict]:
        """Kullanıcının bekleyen onaylarını getir"""
        query = {
            "notified_users": user_id,
            "status": "pending",
            "expires_at": {"$gt": datetime.utcnow()}
        }
        
        if approval_type:
            query["type"] = approval_type
        
        approvals = await approvals_collection.find(query).to_list(100)
        
        result = []
        for a in approvals:
            a["id"] = a.pop("_id")
            if isinstance(a.get("created_at"), datetime):
                a["created_at"] = a["created_at"].isoformat()
            if isinstance(a.get("expires_at"), datetime):
                a["expires_at"] = a["expires_at"].isoformat()
            result.append(a)
        
        return result


# Singleton instance
approval_service = ApprovalService()


# ============================================================================
# SHIFT HANDOVER HELPERS
# ============================================================================

async def create_shift_handover_approval(
    giver_id: str,
    giver_name: str,
    receiver_id: str,
    vehicle_plate: str,
    vehicle_id: str
) -> Dict[str, Any]:
    """Vardiya devir teslim onayı oluştur"""
    now = datetime.utcnow()
    
    return await approval_service.create_approval(
        approval_type="shift_handover",
        requester_id=giver_id,
        target_id=vehicle_id,
        metadata={
            "giver_id": giver_id,
            "giver_name": giver_name,
            "receiver_id": receiver_id,
            "vehicle_plate": vehicle_plate,
            "vehicle_id": vehicle_id,
            "date": now.strftime("%d.%m.%Y"),
            "time": now.strftime("%H:%M")
        },
        notify_user_ids=[receiver_id],
        expiry_minutes=30  # Devir teslim için 30 dakika süre
    )


async def create_manager_shift_approval(
    requester_id: str,
    requester_name: str,
    vehicle_plate: str,
    vehicle_id: str,
    action: str = "Vardiya Başlatma"
) -> Dict[str, Any]:
    """Yönetici vardiya onayı oluştur - Baş Şoför ve Op. Müdürüne gönder"""
    # Baş şoför ve operasyon müdürlerini bul
    managers = await users_collection.find({
        "role": {"$in": ["bas_sofor", "operasyon_muduru"]}
    }).to_list(100)
    
    manager_ids = [m["_id"] for m in managers]
    
    if not manager_ids:
        logger.warning("No managers found for shift approval")
        return {"error": "Onay gönderilecek yönetici bulunamadı"}
    
    return await approval_service.create_approval(
        approval_type="shift_start_approval",
        requester_id=requester_id,
        target_id=vehicle_id,
        metadata={
            "requester_id": requester_id,
            "requester_name": requester_name,
            "vehicle_plate": vehicle_plate,
            "vehicle_id": vehicle_id,
            "action": action
        },
        notify_user_ids=manager_ids,
        expiry_minutes=30
    )

