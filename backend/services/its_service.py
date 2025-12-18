"""
İlaç Takip Sistemi (İTS) Entegrasyonu
=====================================
Sadece ilaç listesi çekme ve GTIN-İlaç Adı eşleştirme için kullanılır.
Bildirim servisleri kullanılmamaktadır.

API Endpoints:
- Token: https://its2.saglik.gov.tr/token/app/token/
- İlaç Listesi: https://its2.saglik.gov.tr/reference/app/drug/
"""

import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
import asyncio

logger = logging.getLogger(__name__)

# İTS API URLs
ITS_BASE_URL = "https://its2.saglik.gov.tr"
ITS_TOKEN_URL = f"{ITS_BASE_URL}/token/app/token/"
ITS_ACCESS_TOKEN_URL = f"{ITS_BASE_URL}/token/app/accesstoken/"
ITS_REFRESH_TOKEN_URL = f"{ITS_BASE_URL}/token/app/refreshtoken/"
ITS_DRUG_LIST_URL = f"{ITS_BASE_URL}/reference/app/drug/"

# Test ortamı URLs (geliştirme için)
ITS_TEST_BASE_URL = "https://itstest2.saglik.gov.tr"
ITS_TEST_TOKEN_URL = f"{ITS_TEST_BASE_URL}/token/app/token/"
ITS_TEST_DRUG_LIST_URL = f"{ITS_TEST_BASE_URL}/reference/app/drug/"


class ITSService:
    """İlaç Takip Sistemi Servis Sınıfı"""
    
    def __init__(self, username: str = None, password: str = None, use_test: bool = True):
        """
        Args:
            username: İTS kullanıcı adı (GLN numarası)
            password: İTS şifresi
            use_test: Test ortamını kullan (varsayılan: True)
        """
        self.username = username
        self.password = password
        self.use_test = use_test
        
        # Token bilgileri
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.refresh_expires_at: Optional[datetime] = None
        
        # İlaç cache'i (GTIN -> İlaç bilgisi)
        self._drug_cache: Dict[str, Dict] = {}
        self._cache_updated_at: Optional[datetime] = None
        self._cache_ttl = timedelta(hours=24)  # Cache 24 saat geçerli
        
        # URL'leri belirle
        if use_test:
            self.token_url = ITS_TEST_TOKEN_URL
            self.drug_list_url = ITS_TEST_DRUG_LIST_URL
        else:
            self.token_url = ITS_TOKEN_URL
            self.drug_list_url = ITS_DRUG_LIST_URL
    
    async def get_token(self) -> Optional[str]:
        """
        İTS'den access token al
        
        Returns:
            Access token string veya None
        """
        if not self.username or not self.password:
            logger.warning("İTS credentials not configured")
            return None
        
        # Mevcut token geçerliyse kullan
        if self.access_token and self.token_expires_at:
            if datetime.utcnow() < self.token_expires_at - timedelta(minutes=5):
                return self.access_token
        
        # Refresh token varsa ve geçerliyse, refresh et
        if self.refresh_token and self.refresh_expires_at:
            if datetime.utcnow() < self.refresh_expires_at - timedelta(minutes=5):
                refreshed = await self._refresh_token()
                if refreshed:
                    return self.access_token
        
        # Yeni token al
        try:
            # Access token URL'ini doğru oluştur
            if self.use_test:
                access_token_url = f"{ITS_TEST_BASE_URL}/token/app/accesstoken/"
            else:
                access_token_url = f"{ITS_BASE_URL}/token/app/accesstoken/"
            
            logger.info(f"İTS token alınıyor: {access_token_url}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    access_token_url,
                    json={
                        "username": self.username,
                        "password": self.password
                    },
                    headers={"Content-Type": "application/json"}
                )
                
                logger.info(f"İTS token response: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    self.access_token = data.get("access_token")
                    self.refresh_token = data.get("refresh_token")
                    
                    # Expiry hesapla
                    expires_in = data.get("expires_in", 3600)
                    refresh_expires_in = data.get("refresh_expires_in", 86400)
                    
                    self.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    self.refresh_expires_at = datetime.utcnow() + timedelta(seconds=refresh_expires_in)
                    
                    logger.info("İTS token alındı başarıyla!")
                    return self.access_token
                else:
                    logger.error("İTS token alınamadı: %s - %s", response.status_code, response.text)
                    return None
                    
        except Exception as e:
            logger.error("İTS token hatası: %s", str(e), exc_info=True)
            return None
    
    async def _refresh_token(self) -> bool:
        """Refresh token kullanarak yeni access token al"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.token_url.replace("/token/", "/refreshtoken/"),
                    json={"token": self.refresh_token},
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.access_token = data.get("access_token")
                    self.refresh_token = data.get("refresh_token")
                    
                    expires_in = data.get("expires_in", 3600)
                    refresh_expires_in = data.get("refresh_expires_in", 86400)
                    
                    self.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    self.refresh_expires_at = datetime.utcnow() + timedelta(seconds=refresh_expires_in)
                    
                    logger.info("İTS token yenilendi")
                    return True
                    
        except Exception as e:
            logger.error("İTS token yenileme hatası: %s", str(e))
        
        return False
    
    async def fetch_drug_list(self, get_all: bool = False) -> List[Dict]:
        """
        İTS'den ilaç listesini çek
        
        Args:
            get_all: True ise aktif ve pasif tüm ilaçlar, False ise sadece aktif ilaçlar
            
        Returns:
            İlaç listesi [{"gtin": "...", "drugName": "...", ...}, ...]
        """
        token = await self.get_token()
        if not token:
            logger.warning("İTS token alınamadı, ilaç listesi çekilemedi")
            return []
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.drug_list_url,
                    json={"getAll": get_all},
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {token}"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    drugs = data.get("drugs", [])
                    
                    # Cache'e kaydet
                    for drug in drugs:
                        gtin = drug.get("gtin")
                        if gtin:
                            self._drug_cache[gtin] = {
                                "gtin": gtin,
                                "name": drug.get("drugName", ""),
                                "manufacturer_gln": drug.get("manufacturerGLN", ""),
                                "manufacturer_name": drug.get("manufacturerName", ""),
                                "is_imported": drug.get("isImported", False),
                                "is_active": drug.get("isActive", True)
                            }
                    
                    self._cache_updated_at = datetime.utcnow()
                    logger.info("İTS'den %d ilaç çekildi", len(drugs))
                    return drugs
                else:
                    logger.error("İTS ilaç listesi hatası: %s - %s", response.status_code, response.text)
                    return []
                    
        except Exception as e:
            logger.error("İTS ilaç listesi çekme hatası: %s", str(e))
            return []
    
    def get_drug_by_gtin(self, gtin: str) -> Optional[Dict]:
        """
        GTIN ile ilaç bilgisi getir (cache'den)
        
        Args:
            gtin: 14 haneli GTIN kodu
            
        Returns:
            İlaç bilgisi dict veya None
        """
        # GTIN formatını düzelt (başında 0 olabilir)
        gtin = gtin.zfill(14)
        return self._drug_cache.get(gtin)
    
    def get_drug_name_by_gtin(self, gtin: str) -> Optional[str]:
        """
        GTIN ile ilaç adı getir
        
        Args:
            gtin: 14 haneli GTIN kodu
            
        Returns:
            İlaç adı veya None
        """
        drug = self.get_drug_by_gtin(gtin)
        return drug.get("name") if drug else None
    
    def search_drugs(self, query: str, limit: int = 20) -> List[Dict]:
        """
        İlaç adına göre arama yap (cache'den)
        
        Args:
            query: Arama terimi
            limit: Maksimum sonuç sayısı
            
        Returns:
            Eşleşen ilaçlar listesi
        """
        query = query.lower()
        results = []
        
        for gtin, drug in self._drug_cache.items():
            name = drug.get("name", "").lower()
            if query in name:
                results.append(drug)
                if len(results) >= limit:
                    break
        
        return results
    
    def is_cache_valid(self) -> bool:
        """Cache'in geçerli olup olmadığını kontrol et"""
        if not self._cache_updated_at:
            return False
        return datetime.utcnow() - self._cache_updated_at < self._cache_ttl
    
    def get_cache_stats(self) -> Dict:
        """Cache istatistiklerini getir"""
        return {
            "total_drugs": len(self._drug_cache),
            "last_updated": self._cache_updated_at.isoformat() if self._cache_updated_at else None,
            "is_valid": self.is_cache_valid(),
            "ttl_hours": self._cache_ttl.total_seconds() / 3600
        }


# Singleton instance
_its_service: Optional[ITSService] = None


def get_its_service() -> ITSService:
    """Global İTS servis instance'ı getir"""
    global _its_service
    if _its_service is None:
        _its_service = ITSService()
    return _its_service


def configure_its_service(username: str, password: str, use_test: bool = True):
    """
    İTS servisini yapılandır
    
    Args:
        username: İTS kullanıcı adı (GLN)
        password: İTS şifresi
        use_test: Test ortamını kullan
    """
    global _its_service
    _its_service = ITSService(username=username, password=password, use_test=use_test)
    logger.info("İTS servisi yapılandırıldı (test=%s)", use_test)


# ============================================================================
# KAREKOD PARSER
# ============================================================================

def parse_datamatrix(barcode: str) -> Dict:
    """
    GS1 DataMatrix karekodunu parse et
    
    Format: (01)GTIN(21)SERI(10)PARTI(17)SKT
    
    AI Kodları:
    - 01: GTIN (14 hane)
    - 21: Seri Numarası (değişken uzunluk)
    - 10: Parti/Lot Numarası (değişken uzunluk)
    - 17: Son Kullanma Tarihi (YYMMDD - 6 hane)
    
    Args:
        barcode: DataMatrix içeriği
        
    Returns:
        {
            "gtin": "08680123456789",
            "serial_number": "ABC123",
            "lot_number": "LOT001",
            "expiry_date": "2026-12-31",
            "raw": "orijinal karekod"
        }
    """
    import re
    
    result = {
        "gtin": None,
        "serial_number": None,
        "lot_number": None,
        "expiry_date": None,
        "quantity": None,  # AI (30) - Kutudaki adet
        "raw": barcode
    }
    
    if not barcode:
        return result
    
    # Kontrol karakterlerini temizle (FNC1, GS, RS, EOT vs.)
    clean_barcode = barcode.replace('\x1d', '|').replace('\x1e', '|').replace('\x04', '|')
    clean_barcode = re.sub(r'[\x00-\x1f]', '|', clean_barcode)
    
    logger.debug(f"Parsing barcode: {repr(barcode)}")
    logger.debug(f"Cleaned barcode: {clean_barcode}")
    
    # Yöntem 1: Parantezli format: (01)GTIN(21)SERI...
    if '(' in clean_barcode:
        # GTIN (01)
        gtin_match = re.search(r'\(01\)(\d{14})', clean_barcode)
        if gtin_match:
            result["gtin"] = gtin_match.group(1)
        
        # Seri Numarası (21)
        serial_match = re.search(r'\(21\)([^\(\)]+)', clean_barcode)
        if serial_match:
            result["serial_number"] = serial_match.group(1).strip()
        
        # Parti/Lot Numarası (10)
        lot_match = re.search(r'\(10\)([^\(\)]+)', clean_barcode)
        if lot_match:
            result["lot_number"] = lot_match.group(1).strip()
        
        # Son Kullanma Tarihi (17)
        exp_match = re.search(r'\(17\)(\d{6})', clean_barcode)
        if exp_match:
            exp_str = exp_match.group(1)
            result["expiry_date"] = _parse_expiry_date(exp_str)
        
        # Kutudaki Adet (30)
        qty_match = re.search(r'\(30\)(\d+)', clean_barcode)
        if qty_match:
            result["quantity"] = int(qty_match.group(1))
    
    # Yöntem 2: GS ayraçlı veya ayraçsız format
    # 01GTIN17SKT10LOT21SERIAL veya 01GTIN|17SKT|10LOT|21SERIAL
    if not result["gtin"]:
        # AI kodlarını bul (01, 10, 17, 21)
        # Önce ayraçlarla dene
        parts = clean_barcode.split('|')
        
        # Tüm parçaları birleştir ve AI'ları bul
        full_data = ''.join(parts)
        
        # GTIN (01) - 14 haneli
        gtin_match = re.search(r'01(\d{14})', full_data)
        if gtin_match:
            result["gtin"] = gtin_match.group(1)
        
        # SKT (17) - 6 haneli tarih
        exp_match = re.search(r'17(\d{6})', full_data)
        if exp_match:
            result["expiry_date"] = _parse_expiry_date(exp_match.group(1))
        
        # Kutudaki Adet (30) - değişken uzunluklu
        # AI (30) dan sonra gelen sayıları al, ama başka AI ile karışmaması için dikkatli ol
        qty_match = re.search(r'(?:^|[^\d])30(\d{1,8})(?:[^\d]|$)', full_data)
        if qty_match:
            result["quantity"] = int(qty_match.group(1))
        
        # Lot (10) ve Seri (21) değişken uzunluklu - daha karmaşık parse
        # Bu AI'lar değişken uzunlukta olduğu için sırayla bakmamız gerekiyor
        
        # Önce sabit uzunluklu AI'ları çıkar
        remaining = full_data
        if result["gtin"]:
            remaining = remaining.replace(f'01{result["gtin"]}', '|')
        if exp_match:
            remaining = remaining.replace(f'17{exp_match.group(1)}', '|')
        
        # Kalan parçalarda 10 ve 21'i ara
        for segment in remaining.split('|'):
            segment = segment.strip()
            if not segment:
                continue
            
            if segment.startswith('21') and not result["serial_number"]:
                # Seri numarasını al (sonraki AI'ya kadar veya sona kadar)
                serial_val = segment[2:]
                # Başka bir AI ile başlayan kısmı kes
                for ai in ['01', '10', '17']:
                    ai_pos = serial_val.find(ai)
                    if ai_pos > 0:
                        serial_val = serial_val[:ai_pos]
                result["serial_number"] = serial_val.strip()
                
            elif segment.startswith('10') and not result["lot_number"]:
                lot_val = segment[2:]
                for ai in ['01', '17', '21']:
                    ai_pos = lot_val.find(ai)
                    if ai_pos > 0:
                        lot_val = lot_val[:ai_pos]
                result["lot_number"] = lot_val.strip()
    
    # Yöntem 3: Ham veriyi pozisyon bazlı parse et
    # Bazı karekodlar şöyle: 01XXXXXXXXXXXXXX17YYMMDD10LOT21SERIAL
    if not result["gtin"] and not result["serial_number"]:
        # 01 ile başlıyorsa
        if clean_barcode.startswith('01') and len(clean_barcode) >= 16:
            result["gtin"] = clean_barcode[2:16]
            rest = clean_barcode[16:]
            
            # 17YYMMDD
            if '17' in rest:
                idx = rest.find('17')
                if idx >= 0 and len(rest) >= idx + 8:
                    result["expiry_date"] = _parse_expiry_date(rest[idx+2:idx+8])
            
            # 10LOT
            if '10' in rest:
                idx = rest.find('10')
                if idx >= 0:
                    # Sonraki AI'ya kadar al
                    lot_end = len(rest)
                    for ai in ['17', '21']:
                        ai_idx = rest.find(ai, idx + 2)
                        if ai_idx > idx and ai_idx < lot_end:
                            lot_end = ai_idx
                    result["lot_number"] = rest[idx+2:lot_end]
            
            # 21SERIAL
            if '21' in rest:
                idx = rest.find('21')
                if idx >= 0:
                    serial_end = len(rest)
                    for ai in ['17', '10']:
                        ai_idx = rest.find(ai, idx + 2)
                        if ai_idx > idx and ai_idx < serial_end:
                            serial_end = ai_idx
                    result["serial_number"] = rest[idx+2:serial_end]
    
    # Son temizlik
    if result["serial_number"]:
        result["serial_number"] = result["serial_number"].strip()
    if result["lot_number"]:
        result["lot_number"] = result["lot_number"].strip()
    
    logger.debug(f"Parse result: {result}")
    
    return result


def _parse_expiry_date(exp_str: str) -> str:
    """YYMMDD formatını YYYY-MM-DD'ye çevir"""
    try:
        year = 2000 + int(exp_str[0:2])
        month = int(exp_str[2:4])
        day = int(exp_str[4:6])
        # Gün 00 ise ayın son günü
        if day == 0:
            day = 28  # Güvenli varsayılan
        return f"{year}-{month:02d}-{day:02d}"
    except:
        return None


def get_drug_info_from_barcode(barcode: str) -> Dict:
    """
    Karekoddan ilaç bilgisi getir
    
    Args:
        barcode: DataMatrix karekod içeriği
        
    Returns:
        {
            "parsed": {...},  # Parse edilmiş karekod
            "drug": {...},    # İTS'den ilaç bilgisi (varsa)
            "drug_name": "..."  # İlaç adı (varsa)
        }
    """
    parsed = parse_datamatrix(barcode)
    
    result = {
        "parsed": parsed,
        "drug": None,
        "drug_name": None
    }
    
    if parsed.get("gtin"):
        service = get_its_service()
        drug = service.get_drug_by_gtin(parsed["gtin"])
        if drug:
            result["drug"] = drug
            result["drug_name"] = drug.get("name")
    
    return result

