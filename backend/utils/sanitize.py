"""
Form verilerini temizleme utility fonksiyonları
"""
from typing import Dict, Any
import re
import logging

logger = logging.getLogger(__name__)


def sanitize_form_data(form_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Form verilerini temizle:
    - JavaScript kodlarını kaldır
    - Geçersiz fotoğraf URL'lerini işaretle
    - Script taglarını kaldır
    """
    if not form_data:
        return form_data
    
    sanitized = {}
    
    for key, value in form_data.items():
        if isinstance(value, str):
            # Script taglarını kaldır
            cleaned = re.sub(r'<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>', '', value, flags=re.IGNORECASE)
            # JavaScript: protokolünü kaldır
            cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
            # Event handler'ları kaldır (onerror, onclick, vb.)
            cleaned = re.sub(r'\s*on\w+\s*=\s*["\'][^"\']*["\']', '', cleaned, flags=re.IGNORECASE)
            
            # Fotoğraf/İmza alanları için validasyon
            if key in ['signature', 'photo', 'image', 'imza'] or 'photo' in key.lower() or 'image' in key.lower():
                # Geçerli base64 veya URL kontrolü
                is_valid = (
                    cleaned.startswith('data:image/') or
                    cleaned.startswith('http://') or
                    cleaned.startswith('https://') or
                    cleaned.startswith('blob:')
                ) and len(cleaned) > 100
                
                if not is_valid:
                    logger.warning(f"Geçersiz fotoğraf/imza alanı: {key}")
                    sanitized[key] = None  # Geçersiz fotoğrafı None yap
                    continue
            
            sanitized[key] = cleaned
        elif isinstance(value, dict):
            # Nested dict için recursive temizleme
            sanitized[key] = sanitize_form_data(value)
        elif isinstance(value, list):
            # List için her elemanı temizle
            sanitized[key] = [
                sanitize_form_data(item) if isinstance(item, dict) else 
                (sanitize_form_data({'value': item})['value'] if isinstance(item, str) else item)
                for item in value
            ]
        else:
            sanitized[key] = value
    
    return sanitized

