"""
PDF Şablon Yönetimi Route'ları
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import pdf_templates_collection
from models import PdfTemplate, PdfTemplateCreate, PdfTemplateUpdate, PdfBlockType
from auth_utils import get_current_user, require_roles
from datetime import datetime
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


# Kutucuk tipleri ve varsayılan alanları
BLOCK_DEFINITIONS = {
    "hasta_zaman": {
        "title": "Hasta ve Zaman Bilgileri",
        "fields": [
            {"field_id": "case_number", "label": "Vaka No"},
            {"field_id": "case_date", "label": "Tarih"},
            {"field_id": "case_time", "label": "Saat"},
            {"field_id": "patient_name", "label": "Hasta Adı"},
            {"field_id": "patient_surname", "label": "Hasta Soyadı"},
            {"field_id": "patient_tc", "label": "TC Kimlik No"},
            {"field_id": "patient_age", "label": "Yaş"},
            {"field_id": "patient_gender", "label": "Cinsiyet"},
            {"field_id": "patient_phone", "label": "Telefon"},
        ]
    },
    "tibbi_bilgiler": {
        "title": "Tıbbi Bilgiler",
        "fields": [
            {"field_id": "complaint", "label": "Şikayet"},
            {"field_id": "chronic_diseases", "label": "Kronik Hastalıklar"},
            {"field_id": "allergies", "label": "Alerjiler"},
            {"field_id": "medications", "label": "Kullandığı İlaçlar"},
            {"field_id": "blood_type", "label": "Kan Grubu"},
        ]
    },
    "nakil_hastanesi": {
        "title": "Nakil Hastanesi",
        "fields": [
            {"field_id": "hospital_name", "label": "Hastane Adı"},
            {"field_id": "hospital_type", "label": "Hastane Tipi"},
            {"field_id": "hospital_address", "label": "Adres"},
            {"field_id": "transfer_reason", "label": "Nakil Nedeni"},
        ]
    },
    "vitaller": {
        "title": "Vital Bulgular",
        "fields": [
            {"field_id": "blood_pressure", "label": "Tansiyon"},
            {"field_id": "pulse", "label": "Nabız"},
            {"field_id": "spo2", "label": "SpO2"},
            {"field_id": "temperature", "label": "Ateş"},
            {"field_id": "respiratory_rate", "label": "Solunum"},
            {"field_id": "blood_sugar", "label": "Kan Şekeri"},
            {"field_id": "gcs_total", "label": "GKS Toplam"},
        ]
    },
    "klinik_gozlemler": {
        "title": "Klinik Gözlemler",
        "fields": [
            {"field_id": "consciousness", "label": "Bilinç"},
            {"field_id": "pupil_response", "label": "Pupil Yanıtı"},
            {"field_id": "skin_status", "label": "Cilt Durumu"},
            {"field_id": "motor_response", "label": "Motor Yanıt"},
            {"field_id": "verbal_response", "label": "Sözel Yanıt"},
            {"field_id": "eye_opening", "label": "Göz Açma"},
        ]
    },
    "anamnez": {
        "title": "Anamnez",
        "fields": [
            {"field_id": "anamnez_text", "label": "Anamnez"},
            {"field_id": "history", "label": "Öykü"},
            {"field_id": "current_complaint", "label": "Mevcut Şikayet"},
        ]
    },
    "fizik_muayene": {
        "title": "Fizik Muayene",
        "fields": [
            {"field_id": "general_status", "label": "Genel Durum"},
            {"field_id": "head_neck", "label": "Baş-Boyun"},
            {"field_id": "chest", "label": "Göğüs"},
            {"field_id": "abdomen", "label": "Karın"},
            {"field_id": "extremities", "label": "Ekstremiteler"},
            {"field_id": "neurological", "label": "Nörolojik"},
        ]
    },
    "uygulamalar": {
        "title": "Yapılan Uygulamalar",
        "fields": [
            {"field_id": "procedures_list", "label": "Uygulama Listesi"},
            {"field_id": "iv_access", "label": "Damar Yolu"},
            {"field_id": "airway", "label": "Hava Yolu"},
            {"field_id": "cpr", "label": "CPR"},
            {"field_id": "other_procedures", "label": "Diğer"},
        ]
    },
    "genel_notlar": {
        "title": "Genel Notlar",
        "fields": [
            {"field_id": "notes", "label": "Notlar"},
            {"field_id": "special_notes", "label": "Özel Notlar"},
        ]
    },
    "ilaclar_malzemeler": {
        "title": "Kullanılan İlaçlar ve Malzemeler",
        "fields": [
            {"field_id": "medications_used", "label": "İlaçlar"},
            {"field_id": "materials_used", "label": "Malzemeler"},
            {"field_id": "quantities", "label": "Miktarlar"},
        ]
    },
    "transfer_durumu": {
        "title": "Transfer Durumu",
        "fields": [
            {"field_id": "transfer_status", "label": "Durum"},
            {"field_id": "transfer_time", "label": "Transfer Saati"},
            {"field_id": "arrival_time", "label": "Varış Saati"},
            {"field_id": "outcome", "label": "Sonuç"},
        ]
    },
    "tasit_protokol": {
        "title": "Taşıt ve Protokol Bilgileri",
        "fields": [
            {"field_id": "vehicle_plate", "label": "Plaka"},
            {"field_id": "vehicle_type", "label": "Araç Tipi"},
            {"field_id": "protocol_number", "label": "Protokol No"},
            {"field_id": "driver_name", "label": "Şoför"},
            {"field_id": "team_members", "label": "Ekip"},
        ]
    },
    "onam_bilgilendirme": {
        "title": "Hasta Bilgilendirme Onamı",
        "fields": [
            {"field_id": "consent_text", "label": "Onam Metni"},
            {"field_id": "patient_signature", "label": "Hasta İmzası"},
            {"field_id": "consent_date", "label": "Tarih"},
        ]
    },
    "onam_hastane_reddi": {
        "title": "Hastanenin Hasta Reddi",
        "fields": [
            {"field_id": "rejection_reason", "label": "Red Nedeni"},
            {"field_id": "hospital_signature", "label": "Hastane İmzası"},
            {"field_id": "rejection_date", "label": "Tarih"},
        ]
    },
    "onam_hasta_reddi": {
        "title": "Hastanın Hizmet Reddi",
        "fields": [
            {"field_id": "service_rejection_reason", "label": "Red Nedeni"},
            {"field_id": "patient_rejection_signature", "label": "Hasta İmzası"},
            {"field_id": "rejection_date", "label": "Tarih"},
        ]
    },
    "teslim_imzalari": {
        "title": "Teslim İmzaları",
        "fields": [
            {"field_id": "receiver_name", "label": "Teslim Alan"},
            {"field_id": "receiver_signature", "label": "Teslim Alan İmza"},
            {"field_id": "doctor_signature", "label": "Doktor İmza"},
            {"field_id": "paramedic_signature", "label": "Paramedik İmza"},
            {"field_id": "driver_signature", "label": "Şoför İmza"},
        ]
    },
    "resim": {
        "title": "Resim",
        "fields": []
    },
    "metin": {
        "title": "Metin",
        "fields": []
    },
    "bos": {
        "title": "Boş Alan",
        "fields": []
    }
}


@router.get("/block-definitions")
async def get_block_definitions(request: Request):
    """Kutucuk tanımlarını getir (sol bar için)"""
    await get_current_user(request)
    
    result = []
    for block_type, definition in BLOCK_DEFINITIONS.items():
        result.append({
            "type": block_type,
            "title": definition["title"],
            "fields": [
                {"field_id": f["field_id"], "label": f["label"], "visible": True, "order": i}
                for i, f in enumerate(definition["fields"])
            ]
        })
    
    return result


@router.get("")
async def get_templates(
    request: Request,
    usage_type: Optional[str] = None,
    is_active: bool = True
):
    """Şablonları listele"""
    await get_current_user(request)
    
    query = {"is_active": is_active}
    if usage_type:
        query["usage_types"] = usage_type
    
    templates = await pdf_templates_collection.find(query).sort("created_at", -1).to_list(100)
    
    for t in templates:
        t["id"] = t.pop("_id")
    
    return templates


@router.get("/default/{usage_type}")
async def get_default_template(usage_type: str, request: Request):
    """Belirli kullanım tipi için varsayılan şablonu getir"""
    await get_current_user(request)
    
    template = await pdf_templates_collection.find_one({
        "usage_types": usage_type,
        "is_default": True,
        "is_active": True
    })
    
    if not template:
        # Varsayılan yoksa ilk aktif şablonu döndür
        template = await pdf_templates_collection.find_one({
            "usage_types": usage_type,
            "is_active": True
        })
    
    if template:
        template["id"] = template.pop("_id")
        return template
    
    return None


@router.get("/{template_id}")
async def get_template(template_id: str, request: Request):
    """Şablon detayı getir"""
    await get_current_user(request)
    
    template = await pdf_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    template["id"] = template.pop("_id")
    return template


@router.post("")
async def create_template(data: PdfTemplateCreate, request: Request):
    """Yeni şablon oluştur"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    # Eğer varsayılan olarak işaretlendiyse, aynı kullanım tipindeki diğerlerini kaldır
    if data.is_default and data.usage_types:
        for usage_type in data.usage_types:
            await pdf_templates_collection.update_many(
                {"usage_types": usage_type, "is_default": True},
                {"$set": {"is_default": False}}
            )
    
    template = PdfTemplate(
        **data.model_dump(),
        created_by=user.id,
        created_by_name=user.name
    )
    
    template_dict = template.model_dump(by_alias=True)
    await pdf_templates_collection.insert_one(template_dict)
    
    logger.info(f"PDF şablonu oluşturuldu: {template.name} by {user.name}")
    
    template_dict["id"] = template_dict.pop("_id")
    return template_dict


@router.patch("/{template_id}")
async def update_template(template_id: str, data: PdfTemplateUpdate, request: Request):
    """Şablonu güncelle"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    template = await pdf_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Varsayılan olarak işaretleniyorsa
    if data.is_default and data.usage_types:
        for usage_type in data.usage_types:
            await pdf_templates_collection.update_many(
                {"_id": {"$ne": template_id}, "usage_types": usage_type, "is_default": True},
                {"$set": {"is_default": False}}
            )
    
    await pdf_templates_collection.update_one(
        {"_id": template_id},
        {"$set": update_data}
    )
    
    updated = await pdf_templates_collection.find_one({"_id": template_id})
    updated["id"] = updated.pop("_id")
    
    logger.info(f"PDF şablonu güncellendi: {template_id} by {user.name}")
    
    return updated


@router.delete("/{template_id}")
async def delete_template(template_id: str, request: Request):
    """Şablonu sil (soft delete)"""
    await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    result = await pdf_templates_collection.update_one(
        {"_id": template_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    return {"message": "Şablon silindi"}


@router.post("/{template_id}/set-default")
async def set_default_template(template_id: str, request: Request):
    """Şablonu varsayılan olarak ayarla"""
    await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    template = await pdf_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    # Aynı kullanım tipindeki diğer varsayılanları kaldır
    for usage_type in template.get("usage_types", []):
        await pdf_templates_collection.update_many(
            {"usage_types": usage_type, "is_default": True},
            {"$set": {"is_default": False}}
        )
    
    # Bu şablonu varsayılan yap
    await pdf_templates_collection.update_one(
        {"_id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Şablon varsayılan olarak ayarlandı"}


@router.post("/{template_id}/duplicate")
async def duplicate_template(template_id: str, request: Request):
    """Şablonu kopyala"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    template = await pdf_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    # Yeni şablon oluştur
    import uuid
    new_id = str(uuid.uuid4())
    template["_id"] = new_id
    template["name"] = f"{template['name']} (Kopya)"
    template["is_default"] = False
    template["created_by"] = user.id
    template["created_by_name"] = user.name
    template["created_at"] = datetime.utcnow()
    template["updated_at"] = datetime.utcnow()
    
    await pdf_templates_collection.insert_one(template)
    
    template["id"] = template.pop("_id")
    return template

