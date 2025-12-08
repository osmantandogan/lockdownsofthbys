"""
Internal OTP Service - Google Authenticator tarzı TOTP sistemi
Her 30 saniyede bir değişen onay kodu üretir
"""

import hmac
import hashlib
import struct
import time
import base64
import secrets
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# OTP ayarları
OTP_INTERVAL = 30  # 30 saniyede bir değişir
OTP_DIGITS = 6     # 6 haneli kod
OTP_SECRET_LENGTH = 32  # Secret key uzunluğu

class OTPService:
    """TOTP (Time-based One-Time Password) servisi"""
    
    @staticmethod
    def generate_secret() -> str:
        """Kullanıcı için yeni secret key oluştur"""
        # 32 byte random data, base32 encoded
        random_bytes = secrets.token_bytes(OTP_SECRET_LENGTH)
        return base64.b32encode(random_bytes).decode('utf-8').rstrip('=')
    
    @staticmethod
    def get_current_time_step() -> int:
        """Mevcut zaman dilimini hesapla"""
        return int(time.time() // OTP_INTERVAL)
    
    @staticmethod
    def get_time_remaining() -> int:
        """Mevcut OTP'nin geçerlilik süresi (saniye)"""
        return OTP_INTERVAL - int(time.time() % OTP_INTERVAL)
    
    @staticmethod
    def generate_totp(secret: str, time_step: Optional[int] = None) -> str:
        """
        TOTP kodu üret
        RFC 6238 standardına uygun
        """
        if time_step is None:
            time_step = OTPService.get_current_time_step()
        
        # Secret'ı decode et
        try:
            # Padding ekle
            padded_secret = secret + '=' * (8 - len(secret) % 8) if len(secret) % 8 else secret
            key = base64.b32decode(padded_secret.upper())
        except Exception as e:
            logger.error(f"OTP secret decode error: {e}")
            # Fallback: hash kullan
            key = hashlib.sha256(secret.encode()).digest()[:20]
        
        # Time step'i 8-byte big-endian'a çevir
        time_bytes = struct.pack('>Q', time_step)
        
        # HMAC-SHA1 hesapla
        hmac_hash = hmac.new(key, time_bytes, hashlib.sha1).digest()
        
        # Dynamic truncation (RFC 4226)
        offset = hmac_hash[-1] & 0x0F
        code = struct.unpack('>I', hmac_hash[offset:offset + 4])[0]
        code = (code & 0x7FFFFFFF) % (10 ** OTP_DIGITS)
        
        # Zero padding ile format
        return str(code).zfill(OTP_DIGITS)
    
    @staticmethod
    def verify_totp(secret: str, code: str, window: int = 1) -> bool:
        """
        TOTP kodunu doğrula
        window: önceki/sonraki zaman dilimlerini de kontrol et (gecikme toleransı)
        """
        if not code or len(code) != OTP_DIGITS:
            return False
            
        current_step = OTPService.get_current_time_step()
        
        # Mevcut ve komşu zaman dilimlerini kontrol et
        for step_offset in range(-window, window + 1):
            expected_code = OTPService.generate_totp(secret, current_step + step_offset)
            if hmac.compare_digest(expected_code, code):
                return True
        
        return False
    
    @staticmethod
    def get_otp_info(secret: str) -> dict:
        """
        Kullanıcı için mevcut OTP bilgisini döndür
        Frontend'de gösterim için
        """
        current_code = OTPService.generate_totp(secret)
        remaining = OTPService.get_time_remaining()
        
        return {
            "code": current_code,
            "remaining_seconds": remaining,
            "interval": OTP_INTERVAL
        }


# Global instance
otp_service = OTPService()


# Yardımcı fonksiyonlar
def generate_user_otp_secret() -> str:
    """Yeni kullanıcı için OTP secret oluştur"""
    return otp_service.generate_secret()

def get_user_otp(secret: str) -> dict:
    """Kullanıcının mevcut OTP bilgisini al"""
    return otp_service.get_otp_info(secret)

def verify_user_otp(secret: str, code: str) -> bool:
    """Kullanıcının OTP kodunu doğrula"""
    return otp_service.verify_totp(secret, code)

