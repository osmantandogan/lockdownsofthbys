"""
Türkiye Saati (UTC+3) Utility Fonksiyonları
Sistemin tamamı Türkiye saati ile çalışır
"""
from datetime import datetime, timedelta
from typing import Optional

# Türkiye timezone offset (UTC+3)
TURKEY_OFFSET = timedelta(hours=3)


def get_turkey_time() -> datetime:
    """
    Türkiye saati döndürür (UTC+3)
    Tüm sistem bu fonksiyonu kullanmalı
    """
    return datetime.utcnow() + TURKEY_OFFSET


def to_turkey_time(utc_dt: datetime) -> datetime:
    """
    UTC datetime'ı Türkiye saatine çevir
    """
    if utc_dt is None:
        return None
    return utc_dt + TURKEY_OFFSET


def from_turkey_time(turkey_dt: datetime) -> datetime:
    """
    Türkiye saatini UTC'ye çevir (veritabanına kaydetmek için)
    """
    if turkey_dt is None:
        return None
    return turkey_dt - TURKEY_OFFSET


def get_turkey_date() -> str:
    """
    Bugünün tarihini Türkiye saatine göre YYYY-MM-DD formatında döndür
    """
    return get_turkey_time().date().isoformat()


def get_turkey_datetime_str() -> str:
    """
    Türkiye saatini ISO format string olarak döndür
    """
    return get_turkey_time().isoformat()

