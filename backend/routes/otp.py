"""
OTP (One-Time Password) Routes
Internal onay kodu sistemi endpoint'leri
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import users_collection
from auth_utils import get_current_user
from services.otp_service import otp_service, generate_user_otp_secret, get_user_otp, verify_user_otp
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class OTPVerifyRequest(BaseModel):
    """OTP doğrulama isteği"""
    code: str
    user_id: Optional[str] = None  # Başka kullanıcı için doğrulama (müdür onayı)


class OTPResponse(BaseModel):
    """OTP bilgisi yanıtı"""
    code: str
    remaining_seconds: int
    interval: int


@router.get("/my-code", response_model=OTPResponse)
async def get_my_otp_code(request: Request):
    """
    Kullanıcının kendi OTP kodunu al
    Bildirim panelinde gösterilecek
    """
    user = await get_current_user(request)
    
    # Kullanıcının OTP secret'ını kontrol et
    user_doc = await users_collection.find_one({"_id": user.id})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    otp_secret = user_doc.get("otp_secret")
    
    # Eğer OTP secret yoksa oluştur
    if not otp_secret:
        otp_secret = generate_user_otp_secret()
        await users_collection.update_one(
            {"_id": user.id},
            {"$set": {"otp_secret": otp_secret}}
        )
        logger.info(f"Generated OTP secret for user {user.id}")
    
    # OTP bilgisini döndür
    otp_info = get_user_otp(otp_secret)
    
    return OTPResponse(
        code=otp_info["code"],
        remaining_seconds=otp_info["remaining_seconds"],
        interval=otp_info["interval"]
    )


@router.post("/verify")
async def verify_otp_code(data: OTPVerifyRequest, request: Request):
    """
    OTP kodunu doğrula
    Kendi kodunu veya başka kullanıcının kodunu doğrulayabilir
    """
    current_user = await get_current_user(request)
    
    # Hangi kullanıcının kodu doğrulanacak?
    target_user_id = data.user_id or current_user.id
    
    # Başka kullanıcının kodunu doğrulamak için yetki kontrolü
    if target_user_id != current_user.id:
        # Sadece müdür ve merkez ofis başkalarının kodunu doğrulayabilir
        if current_user.role not in ['operasyon_muduru', 'merkez_ofis']:
            raise HTTPException(
                status_code=403, 
                detail="Başka kullanıcının kodunu doğrulama yetkiniz yok"
            )
    
    # Hedef kullanıcıyı bul
    user_doc = await users_collection.find_one({"_id": target_user_id})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    otp_secret = user_doc.get("otp_secret")
    
    if not otp_secret:
        raise HTTPException(status_code=400, detail="Kullanıcının OTP'si henüz oluşturulmamış")
    
    # Kodu doğrula
    is_valid = verify_user_otp(otp_secret, data.code)
    
    if is_valid:
        logger.info(f"OTP verified for user {target_user_id} by {current_user.id}")
        return {
            "valid": True,
            "message": "Kod doğrulandı"
        }
    else:
        logger.warning(f"OTP verification failed for user {target_user_id}")
        return {
            "valid": False,
            "message": "Geçersiz kod"
        }


@router.post("/regenerate-secret")
async def regenerate_otp_secret(request: Request):
    """
    Kullanıcının OTP secret'ını yenile
    (Güvenlik için gerekirse)
    """
    user = await get_current_user(request)
    
    new_secret = generate_user_otp_secret()
    
    await users_collection.update_one(
        {"_id": user.id},
        {"$set": {"otp_secret": new_secret, "otp_verified": False}}
    )
    
    logger.info(f"Regenerated OTP secret for user {user.id}")
    
    # Yeni kodu döndür
    otp_info = get_user_otp(new_secret)
    
    return {
        "message": "OTP secret yenilendi",
        "code": otp_info["code"],
        "remaining_seconds": otp_info["remaining_seconds"]
    }


@router.get("/setup")
async def get_otp_setup(request: Request):
    """
    Google Authenticator kurulumu için QR kod ve bilgileri al
    Kullanıcı ayarlar sayfasında bu QR kodu tarayacak
    """
    user = await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    otp_secret = user_doc.get("otp_secret")
    otp_verified = user_doc.get("otp_verified", False)
    
    # Eğer OTP secret yoksa oluştur
    if not otp_secret:
        otp_secret = generate_user_otp_secret()
        await users_collection.update_one(
            {"_id": user.id},
            {"$set": {"otp_secret": otp_secret, "otp_verified": False}}
        )
        otp_verified = False
        logger.info(f"Generated OTP secret for user {user.id} during setup")
    
    # QR kod URI'si oluştur
    user_email = user_doc.get("email", user_doc.get("name", "user"))
    totp_uri = otp_service.get_totp_uri(otp_secret, user_email)
    
    # QR kod base64 olarak oluştur
    qr_code = otp_service.generate_qr_code_base64(totp_uri)
    
    return {
        "qr_code": qr_code,
        "secret": otp_secret,
        "totp_uri": totp_uri,
        "is_verified": otp_verified,
        "user_email": user_email,
        "instructions": [
            "1. Google Authenticator veya benzeri bir uygulama indirin",
            "2. Uygulamada '+' butonuna tıklayın",
            "3. 'QR kod tara' seçeneğini seçin",
            "4. Bu QR kodu tarayın",
            "5. Oluşan 6 haneli kodu aşağıya girin ve doğrulayın"
        ]
    }


@router.post("/verify-setup")
async def verify_otp_setup(data: OTPVerifyRequest, request: Request):
    """
    Google Authenticator kurulumunu doğrula
    Kullanıcı QR kodu taradıktan sonra üretilen kodu girerek doğrular
    """
    user = await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    otp_secret = user_doc.get("otp_secret")
    if not otp_secret:
        raise HTTPException(status_code=400, detail="Önce OTP kurulumu yapılmalı")
    
    # Kodu doğrula
    is_valid = verify_user_otp(otp_secret, data.code)
    
    if is_valid:
        # Doğrulandı olarak işaretle
        await users_collection.update_one(
            {"_id": user.id},
            {"$set": {"otp_verified": True}}
        )
        logger.info(f"OTP setup verified for user {user.id}")
        return {
            "valid": True,
            "message": "Google Authenticator başarıyla kuruldu! Artık onay kodlarını bu uygulama üzerinden alabilirsiniz."
        }
    else:
        logger.warning(f"OTP setup verification failed for user {user.id}")
        return {
            "valid": False,
            "message": "Kod hatalı. Lütfen Google Authenticator'daki güncel kodu girin."
        }


@router.get("/user/{user_id}/code")
async def get_user_otp_code(user_id: str, request: Request):
    """
    Başka bir kullanıcının OTP kodunu al (sadece müdür/merkez ofis)
    36 saat kısıtı için müdür onayında kullanılır
    """
    current_user = await get_current_user(request)
    
    # Yetki kontrolü
    if current_user.role not in ['operasyon_muduru', 'merkez_ofis']:
        raise HTTPException(
            status_code=403, 
            detail="Bu işlem için yetkiniz yok"
        )
    
    user_doc = await users_collection.find_one({"_id": user_id})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    otp_secret = user_doc.get("otp_secret")
    
    if not otp_secret:
        # Secret yoksa oluştur
        otp_secret = generate_user_otp_secret()
        await users_collection.update_one(
            {"_id": user_id},
            {"$set": {"otp_secret": otp_secret}}
        )
    
    otp_info = get_user_otp(otp_secret)
    
    return {
        "user_id": user_id,
        "user_name": user_doc.get("name", "Bilinmeyen"),
        "code": otp_info["code"],
        "remaining_seconds": otp_info["remaining_seconds"]
    }

