"""
Vaka Formu Yapılandırması API
Operasyon Müdürü ve Merkez Ofis tarafından düzenlenebilir
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from datetime import datetime
from database import db
from auth_utils import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# ============ PYDANTIC MODELLER ============

class FormFieldItem(BaseModel):
    code: str
    name: str
    active: bool = True

class FormCategory(BaseModel):
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    items: List[FormFieldItem]

class CaseFormConfig(BaseModel):
    # İlaçlar
    medications: List[FormFieldItem]
    
    # İşlemler (kategorili)
    procedures: Dict[str, FormCategory]
    
    # Malzemeler
    materials: List[FormFieldItem]
    
    # Sıvı tedavisi
    fluids: List[FormFieldItem]
    
    # Nakil türleri
    transfers: List[FormFieldItem]
    
    # Çağrı tipleri
    call_types: List[FormFieldItem]
    
    # Triaj kodları
    triage_codes: List[FormFieldItem]
    
    # Sonuç türleri
    result_types: List[FormFieldItem]
    
    # Olay yeri türleri
    scene_types: List[FormFieldItem]
    
    # Glasgow skala değerleri
    glasgow_values: Dict[str, List[FormFieldItem]]
    
    # Kronik hastalıklar
    chronic_diseases: List[FormFieldItem]

class ConfigUpdateRequest(BaseModel):
    config: Dict[str, Any]

# ============ VARSAYILAN DEĞERLERİ ============

DEFAULT_CASE_FORM_CONFIG = {
    "medications": [
        {"code": "arveles", "name": "Arveles amp.", "active": True},
        {"code": "dikloron", "name": "Dikloron amp.", "active": True},
        {"code": "spazmolitik", "name": "Spazmolitik amp.", "active": True},
        {"code": "adrenalin_05", "name": "Adrenalin 0,5 mg amp.", "active": True},
        {"code": "adrenalin_1", "name": "Adrenalin 1 mg amp.", "active": True},
        {"code": "atropin", "name": "Atropin 0,5 mg amp.", "active": True},
        {"code": "flumazenil", "name": "Flumazenil amp.", "active": True},
        {"code": "dopamin", "name": "Dopamin amp.", "active": True},
        {"code": "citanest", "name": "Citanest flk. (Priloc)", "active": True},
        {"code": "nahco3", "name": "NaHCO3 amp.", "active": True},
        {"code": "magnezyum", "name": "Magnezyum sülfat amp.", "active": True},
        {"code": "kalsiyum", "name": "Kalsiyum amp.", "active": True},
        {"code": "steroid", "name": "Steroid amp.", "active": True},
        {"code": "feniramin", "name": "Feniramin amp.", "active": True},
        {"code": "ranitab", "name": "Ranitab amp.", "active": True},
        {"code": "metpamid", "name": "Metpamid amp.", "active": True},
        {"code": "diazem", "name": "Diazem amp.", "active": True},
        {"code": "midazolam", "name": "Midozalam amp.", "active": True},
        {"code": "morphine", "name": "Morfin HCI amp.", "active": True},
        {"code": "fentanyl", "name": "Fentanyl amp.", "active": True},
        {"code": "ketamin", "name": "Ketamin amp.", "active": True},
        {"code": "furosemid", "name": "Lasix amp.", "active": True},
        {"code": "nitrogliserin", "name": "Nitro/Perlinganit", "active": True},
        {"code": "amiodaron", "name": "Amiodaron amp.", "active": True},
        {"code": "adenosin", "name": "Adenozin amp.", "active": True},
        {"code": "metoprolol", "name": "Beloc amp.", "active": True},
        {"code": "diltiazem", "name": "Diltiazem amp.", "active": True},
        {"code": "oksitoksin", "name": "Oksitosin amp.", "active": True},
        {"code": "tranexamic", "name": "Transamin amp.", "active": True},
        {"code": "vitamin_k", "name": "K Vitamini amp.", "active": True},
        {"code": "dramamine", "name": "Dramamine ampul", "active": True},
        {"code": "rotapamid", "name": "Rotapamid amp.", "active": True},
    ],
    
    "procedures": {
        "genel_mudahale": {
            "name": "Genel Müdahale",
            "color": "blue",
            "icon": "Stethoscope",
            "items": [
                {"code": "muayene_acil", "name": "Muayene (Acil)", "active": True},
                {"code": "muayene_ileri", "name": "Muayene (İleri)", "active": True},
                {"code": "yara_bakimi", "name": "Yara Bakımı", "active": True},
                {"code": "pansuman", "name": "Pansuman", "active": True},
                {"code": "atel_uygulama", "name": "Atel Uygulama", "active": True},
                {"code": "spinal_tespiti", "name": "Spinal Tespiti", "active": True},
                {"code": "sogutucu_uygulama", "name": "Soğutucu Uygulama", "active": True},
                {"code": "kvc_12_derivasyon", "name": "KVC 12 Derivasyon", "active": True},
                {"code": "vital_bulgu_takip", "name": "Vital Bulgu Takip", "active": True},
            ]
        },
        "dolasim_destegi": {
            "name": "Dolaşım Desteği",
            "color": "red",
            "icon": "Heart",
            "items": [
                {"code": "cpr", "name": "CPR", "active": True},
                {"code": "defibrilasyon", "name": "Defibrilasyon", "active": True},
                {"code": "kardiyoversiyon", "name": "Kardiyoversiyon", "active": True},
                {"code": "transkutan_pil", "name": "Transkutan Pil", "active": True},
                {"code": "damar_yolu_acma", "name": "Damar Yolu Açma", "active": True},
                {"code": "io_erisim", "name": "IO Erişim", "active": True},
                {"code": "sivi_resusitasyonu", "name": "Sıvı Resüsitasyonu", "active": True},
            ]
        },
        "hava_yolu": {
            "name": "Hava Yolu",
            "color": "cyan",
            "icon": "Wind",
            "items": [
                {"code": "oksijen_tedavisi", "name": "Oksijen Tedavisi", "active": True},
                {"code": "nebulizor", "name": "Nebulizör", "active": True},
                {"code": "aspirasyon", "name": "Aspirasyon", "active": True},
                {"code": "airway_opa", "name": "Airway (OPA)", "active": True},
                {"code": "airway_npa", "name": "Airway (NPA)", "active": True},
                {"code": "bvm", "name": "BVM", "active": True},
                {"code": "entübasyon", "name": "Entübasyon", "active": True},
                {"code": "supraglottik", "name": "Supraglottik Airway", "active": True},
                {"code": "krikotirotomi", "name": "Krikotirotomi", "active": True},
            ]
        },
        "diger_islemler": {
            "name": "Diğer İşlemler",
            "color": "gray",
            "icon": "Settings",
            "items": [
                {"code": "ng_sonda", "name": "NG Sonda", "active": True},
                {"code": "foley_sonda", "name": "Foley Sonda", "active": True},
                {"code": "goz_yikama", "name": "Göz Yıkama", "active": True},
                {"code": "mide_yikama", "name": "Mide Yıkama", "active": True},
                {"code": "dekontaminasyon", "name": "Dekontaminasyon", "active": True},
                {"code": "toraks_drenaji", "name": "Toraks Drenajı", "active": True},
                {"code": "perikardiyosentez", "name": "Perikardiyosentez", "active": True},
            ]
        },
        "yenidogan": {
            "name": "Yenidoğan İşlemleri",
            "color": "pink",
            "icon": "Baby",
            "items": [
                {"code": "bebek_teslim", "name": "Bebek Teslim", "active": True},
                {"code": "kordon_kesimi", "name": "Kordon Kesimi", "active": True},
                {"code": "bebek_kurutma", "name": "Bebek Kurutma", "active": True},
                {"code": "apgar_degerlendirme", "name": "APGAR Değerlendirme", "active": True},
                {"code": "yenidogan_canlandirma", "name": "Yenidoğan Canlandırma", "active": True},
            ]
        }
    },
    
    "materials": [
        {"code": "enjektor_1_2", "name": "Enjektör 1-2 cc", "active": True},
        {"code": "enjektor_5", "name": "Enjektör 5 cc", "active": True},
        {"code": "enjektor_10_20", "name": "Enjektör 10-20 cc", "active": True},
        {"code": "monitor_pedi", "name": "Monitör pedi", "active": True},
        {"code": "iv_kateter_14_22", "name": "I.V. katater 14-22", "active": True},
        {"code": "iv_kateter_24", "name": "I.V. katater 24", "active": True},
        {"code": "serum_seti", "name": "Serum seti", "active": True},
        {"code": "steril_eldiven", "name": "Steril eldiven", "active": True},
        {"code": "cerrahi_eldiven", "name": "Cerrahi eldiven", "active": True},
        {"code": "sponc", "name": "Sponç", "active": True},
        {"code": "sargi_bezi", "name": "Sargı bezi", "active": True},
        {"code": "idrar_torbasi", "name": "İdrar torbası", "active": True},
        {"code": "bisturi_ucu", "name": "Bistüri ucu", "active": True},
        {"code": "lavman_seti", "name": "Lavman seti", "active": True},
        {"code": "airway_set", "name": "Airway set", "active": True},
        {"code": "umblikal_kateter", "name": "Umblikal kateter", "active": True},
        {"code": "endotrakeal_tup", "name": "Endotrakeal tüp", "active": True},
        {"code": "laringoskop_blade", "name": "Laringoskop blade", "active": True},
        {"code": "ambu_maske", "name": "Ambu/Maske", "active": True},
        {"code": "oksijen_maske", "name": "Oksijen maske", "active": True},
        {"code": "nazal_kanul", "name": "Nazal kanül", "active": True},
        {"code": "defib_pedi", "name": "Defibrilatör pedi", "active": True},
    ],
    
    "fluids": [
        {"code": "sf_100", "name": "SF 100ml", "active": True},
        {"code": "sf_250", "name": "SF 250ml", "active": True},
        {"code": "sf_500", "name": "SF 500ml", "active": True},
        {"code": "sf_1000", "name": "SF 1000ml", "active": True},
        {"code": "rl_500", "name": "Ringer Laktat 500ml", "active": True},
        {"code": "rl_1000", "name": "Ringer Laktat 1000ml", "active": True},
        {"code": "dextroz_5_500", "name": "Dextroz %5 500ml", "active": True},
        {"code": "dextroz_10_500", "name": "Dextroz %10 500ml", "active": True},
        {"code": "isolyte", "name": "Isolyte-S", "active": True},
        {"code": "hes", "name": "HES (Voluven)", "active": True},
        {"code": "jelatin", "name": "Jelatin (Gelofusine)", "active": True},
    ],
    
    "transfers": [
        {"code": "evde_muayene", "name": "Evde Muayene", "active": True},
        {"code": "yerinde_muayene", "name": "Yerinde Muayene", "active": True},
        {"code": "hastaneye_nakil", "name": "Hastaneye Nakil", "active": True},
        {"code": "hastaneler_arasi", "name": "Hastaneler Arası Nakil", "active": True},
        {"code": "tibbi_tetkik", "name": "Tıbbi Tetkik İçin Nakil", "active": True},
        {"code": "eve_nakil", "name": "Eve Nakil", "active": True},
        {"code": "sehirler_arasi", "name": "Şehirler Arası Nakil", "active": True},
        {"code": "uluslar_arasi", "name": "Uluslar Arası Nakil", "active": True},
        {"code": "ilce_disi", "name": "İlçe Dışı Transport", "active": True},
        {"code": "ilce_ici", "name": "İlçe İçi Transfer", "active": True},
        {"code": "ex", "name": "EX (Yerinde Bırakıldı)", "active": True},
        {"code": "baska_aracla", "name": "Başka Araçla Nakil", "active": True},
        {"code": "saglik_tedbir", "name": "Sağlık Tedbir", "active": True},
        {"code": "diger", "name": "Diğer", "active": True},
    ],
    
    "call_types": [
        {"code": "telsiz", "name": "Telsiz", "active": True},
        {"code": "telefon", "name": "Telefon", "active": True},
        {"code": "diger", "name": "Diğer", "active": True},
    ],
    
    "triage_codes": [
        {"code": "kirmizi", "name": "Kırmızı (Acil)", "active": True},
        {"code": "sari", "name": "Sarı (Ciddi)", "active": True},
        {"code": "yesil", "name": "Yeşil (Hafif)", "active": True},
        {"code": "siyah", "name": "Siyah (Ex)", "active": True},
    ],
    
    "result_types": [
        {"code": "hastaneye_sevk", "name": "Hastaneye Sevk", "active": True},
        {"code": "ayaktan_tedavi", "name": "Ayaktan Tedavi", "active": True},
        {"code": "tedavi_ret", "name": "Tedavi Ret", "active": True},
        {"code": "nakil_ret", "name": "Nakil Ret", "active": True},
        {"code": "hasta_bulunamadi", "name": "Hasta Bulunamadı", "active": True},
        {"code": "ex", "name": "EX (Ölüm)", "active": True},
    ],
    
    "scene_types": [
        {"code": "ev", "name": "Ev", "active": True},
        {"code": "isyeri", "name": "İşyeri", "active": True},
        {"code": "sokak", "name": "Sokak", "active": True},
        {"code": "arac", "name": "Araç", "active": True},
        {"code": "okul", "name": "Okul", "active": True},
        {"code": "hastane", "name": "Hastane", "active": True},
        {"code": "diger", "name": "Diğer", "active": True},
    ],
    
    "glasgow_values": {
        "eye": [
            {"code": "4", "name": "Spontan (4)", "active": True},
            {"code": "3", "name": "Sesli uyarı (3)", "active": True},
            {"code": "2", "name": "Ağrılı uyarı (2)", "active": True},
            {"code": "1", "name": "Yok (1)", "active": True},
        ],
        "verbal": [
            {"code": "5", "name": "Oryante (5)", "active": True},
            {"code": "4", "name": "Konfüze (4)", "active": True},
            {"code": "3", "name": "Uygunsuz (3)", "active": True},
            {"code": "2", "name": "Anlamsız ses (2)", "active": True},
            {"code": "1", "name": "Yok (1)", "active": True},
        ],
        "motor": [
            {"code": "6", "name": "Emirlere uyar (6)", "active": True},
            {"code": "5", "name": "Ağrıyı lokalize (5)", "active": True},
            {"code": "4", "name": "Fleksiyon (4)", "active": True},
            {"code": "3", "name": "Anormal fleksiyon (3)", "active": True},
            {"code": "2", "name": "Ekstansiyon (2)", "active": True},
            {"code": "1", "name": "Yok (1)", "active": True},
        ]
    },
    
    "chronic_diseases": [
        {"code": "hipertansiyon", "name": "Hipertansiyon", "active": True},
        {"code": "diyabet", "name": "Diyabet", "active": True},
        {"code": "kalp_hastaligi", "name": "Kalp Hastalığı", "active": True},
        {"code": "astim", "name": "Astım", "active": True},
        {"code": "koah", "name": "KOAH", "active": True},
        {"code": "bocrek_yetmezligi", "name": "Böbrek Yetmezliği", "active": True},
        {"code": "karaciger_hastaligi", "name": "Karaciğer Hastalığı", "active": True},
        {"code": "epilepsi", "name": "Epilepsi", "active": True},
        {"code": "kanser", "name": "Kanser", "active": True},
        {"code": "alzheimer", "name": "Alzheimer/Demans", "active": True},
        {"code": "diger", "name": "Diğer", "active": True},
    ]
}

# ============ API ENDPOINTS ============

@router.get("/case-form-fields")
async def get_case_form_config():
    """Vaka formu yapılandırmasını getir"""
    try:
        config = await db.form_configurations.find_one({"config_id": "case_form_fields"})
        
        if not config:
            # Varsayılan değerleri döndür
            return {
                "config_id": "case_form_fields",
                "version": 1,
                "updated_at": None,
                "updated_by": None,
                "config": DEFAULT_CASE_FORM_CONFIG
            }
        
        # _id'yi kaldır
        config.pop("_id", None)
        return config
        
    except Exception as e:
        logger.error(f"Form config getirme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/case-form-fields")
async def update_case_form_config(
    request: Request,
    data: ConfigUpdateRequest
):
    """Vaka formu yapılandırmasını güncelle (Sadece Merkez Ofis ve Operasyon Müdürü)"""
    current_user = await get_current_user(request)
    
    # Yetki kontrolü
    allowed_roles = ["merkez_ofis", "operasyon_muduru", "admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    try:
        # Mevcut config'i al
        existing = await db.form_configurations.find_one({"config_id": "case_form_fields"})
        current_version = existing.get("version", 0) if existing else 0
        
        # Yeni versiyon oluştur
        new_config = {
            "config_id": "case_form_fields",
            "version": current_version + 1,
            "updated_at": datetime.utcnow(),
            "updated_by": current_user.get("id") or current_user.get("_id"),
            "updated_by_name": current_user.get("name", "Bilinmiyor"),
            "config": data.config
        }
        
        # Güncelle veya oluştur
        await db.form_configurations.update_one(
            {"config_id": "case_form_fields"},
            {"$set": new_config},
            upsert=True
        )
        
        # Geçmişe kaydet
        await db.form_configuration_history.insert_one({
            "config_id": "case_form_fields",
            "version": new_config["version"],
            "config": data.config,
            "updated_at": new_config["updated_at"],
            "updated_by": new_config["updated_by"],
            "updated_by_name": new_config["updated_by_name"]
        })
        
        logger.info(f"Form config güncellendi: v{new_config['version']} by {new_config['updated_by_name']}")
        
        return {"success": True, "version": new_config["version"]}
        
    except Exception as e:
        logger.error(f"Form config güncelleme hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/case-form-fields/reset")
async def reset_case_form_config(request: Request):
    """Vaka formu yapılandırmasını varsayılana döndür"""
    current_user = await get_current_user(request)
    
    # Yetki kontrolü
    allowed_roles = ["merkez_ofis", "operasyon_muduru", "admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    try:
        # Mevcut config'i al
        existing = await db.form_configurations.find_one({"config_id": "case_form_fields"})
        current_version = existing.get("version", 0) if existing else 0
        
        # Varsayılan değerlerle güncelle
        new_config = {
            "config_id": "case_form_fields",
            "version": current_version + 1,
            "updated_at": datetime.utcnow(),
            "updated_by": current_user.get("id") or current_user.get("_id"),
            "updated_by_name": current_user.get("name", "Bilinmiyor"),
            "config": DEFAULT_CASE_FORM_CONFIG,
            "reset_to_default": True
        }
        
        await db.form_configurations.update_one(
            {"config_id": "case_form_fields"},
            {"$set": new_config},
            upsert=True
        )
        
        logger.info(f"Form config varsayılana döndürüldü: v{new_config['version']}")
        
        return {"success": True, "version": new_config["version"], "message": "Varsayılan değerler yüklendi"}
        
    except Exception as e:
        logger.error(f"Form config reset hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/case-form-fields/history")
async def get_config_history(
    request: Request,
    limit: int = 10
):
    """Yapılandırma geçmişini getir"""
    current_user = await get_current_user(request)
    
    allowed_roles = ["merkez_ofis", "operasyon_muduru", "admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    try:
        history = await db.form_configuration_history.find(
            {"config_id": "case_form_fields"}
        ).sort("version", -1).limit(limit).to_list(length=limit)
        
        for item in history:
            item.pop("_id", None)
            # Config'i çıkar (çok büyük)
            item.pop("config", None)
        
        return history
        
    except Exception as e:
        logger.error(f"Config history hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/case-form-fields/version/{version}")
async def get_config_version(
    request: Request,
    version: int
):
    """Belirli bir versiyondaki yapılandırmayı getir"""
    current_user = await get_current_user(request)
    
    allowed_roles = ["merkez_ofis", "operasyon_muduru", "admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    try:
        config = await db.form_configuration_history.find_one({
            "config_id": "case_form_fields",
            "version": version
        })
        
        if not config:
            raise HTTPException(status_code=404, detail="Versiyon bulunamadı")
        
        config.pop("_id", None)
        return config
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Config version hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))

