"""
Form Şablonları Route'ları (PDF + Tablo)
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional
from database import db
from auth_utils import get_current_user, require_roles
from datetime import datetime
import logging
import uuid
import io

router = APIRouter()
logger = logging.getLogger(__name__)

# Collection
form_templates_collection = db["form_templates"]


# Hazır kutucuk tanımları - Vaka formundan
BLOCK_DEFINITIONS = [
    {
        "id": "hasta_bilgileri",
        "name": "Hasta Bilgileri",
        "icon": "User",
        "color": "bg-blue-100 text-blue-700 border-blue-300",
        "fields": ["TC Kimlik No", "Ad", "Soyad", "Yaş", "Doğum Tarihi", "Cinsiyet"],
        "defaultHeight": 2,
        "defaultWidth": 2
    },
    {
        "id": "cagri_bilgileri",
        "name": "Çağrı Bilgileri",
        "icon": "Phone",
        "color": "bg-purple-100 text-purple-700 border-purple-300",
        "fields": ["Çağrı Zamanı", "Çağrı Tipi", "Çağrı Nedeni", "Vakayı Veren Kurum"],
        "defaultHeight": 2,
        "defaultWidth": 2
    },
    {
        "id": "zaman_bilgileri",
        "name": "Zaman Bilgileri",
        "icon": "Clock",
        "color": "bg-amber-100 text-amber-700 border-amber-300",
        "fields": ["Çağrı Saati", "Olay Yerine Varış", "Hastaya Varış", "Olay Yerinden Ayrılış", "Hastaneye Varış", "İstasyona Dönüş"],
        "defaultHeight": 2,
        "defaultWidth": 3
    },
    {
        "id": "vital_bulgular_1",
        "name": "Vital Bulgular 1",
        "icon": "Heart",
        "color": "bg-red-100 text-red-700 border-red-300",
        "fields": ["Saat", "Tansiyon", "Nabız", "SpO2", "Solunum", "Ateş"],
        "defaultHeight": 1,
        "defaultWidth": 3
    },
    {
        "id": "vital_bulgular_2",
        "name": "Vital Bulgular 2",
        "icon": "Heart",
        "color": "bg-red-100 text-red-700 border-red-300",
        "fields": ["Saat", "Tansiyon", "Nabız", "SpO2", "Solunum", "Ateş"],
        "defaultHeight": 1,
        "defaultWidth": 3
    },
    {
        "id": "vital_bulgular_3",
        "name": "Vital Bulgular 3",
        "icon": "Heart",
        "color": "bg-red-100 text-red-700 border-red-300",
        "fields": ["Saat", "Tansiyon", "Nabız", "SpO2", "Solunum", "Ateş"],
        "defaultHeight": 1,
        "defaultWidth": 3
    },
    {
        "id": "klinik_gozlemler",
        "name": "Klinik Gözlemler",
        "icon": "Eye",
        "color": "bg-indigo-100 text-indigo-700 border-indigo-300",
        "fields": ["Bilinç Durumu", "Duygu Durumu", "Pupil", "Cilt", "Solunum Tipi", "Nabız Tipi"],
        "defaultHeight": 2,
        "defaultWidth": 2
    },
    {
        "id": "gks_skorlari",
        "name": "GKS (Glasgow)",
        "icon": "AlertCircle",
        "color": "bg-orange-100 text-orange-700 border-orange-300",
        "fields": ["Motor Yanıt", "Verbal Yanıt", "Göz Açma", "Toplam Skor"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "anamnez",
        "name": "Anamnez/Şikayet",
        "icon": "FileText",
        "color": "bg-teal-100 text-teal-700 border-teal-300",
        "fields": ["Başvuru Şikayeti", "Öykü", "Kronik Hastalıklar"],
        "defaultHeight": 2,
        "defaultWidth": 3
    },
    {
        "id": "fizik_muayene",
        "name": "Fizik Muayene",
        "icon": "Stethoscope",
        "color": "bg-cyan-100 text-cyan-700 border-cyan-300",
        "fields": ["Fizik Muayene Bulguları"],
        "defaultHeight": 2,
        "defaultWidth": 3
    },
    {
        "id": "uygulanan_islemler",
        "name": "Uygulanan İşlemler",
        "icon": "Settings",
        "color": "bg-violet-100 text-violet-700 border-violet-300",
        "fields": ["Maske ile hava yolu", "Airway", "Entübasyon", "LMA", "CPR", "Defibrilasyon", "Monitörizasyon", "Kanama kontrolü", "Atel uygulaması", "Servical collar", "Sırt tahtası", "Diğer"],
        "defaultHeight": 3,
        "defaultWidth": 3
    },
    {
        "id": "cpr_bilgileri",
        "name": "CPR Bilgileri",
        "icon": "Heart",
        "color": "bg-pink-100 text-pink-700 border-pink-300",
        "fields": ["CPR Uygulayan", "CPR Başlangıç", "CPR Bitiş", "CPR Nedeni"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "nakil_durumu",
        "name": "Nakil Durumu",
        "icon": "Truck",
        "color": "bg-emerald-100 text-emerald-700 border-emerald-300",
        "fields": ["Nakil Tipi", "Transfer Tipi"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "nakil_hastanesi",
        "name": "Nakil Hastanesi",
        "icon": "MapPin",
        "color": "bg-lime-100 text-lime-700 border-lime-300",
        "fields": ["Hastane Adı", "Hastane Protokol No"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "healmedy_lokasyonu",
        "name": "Healmedy Lokasyonu",
        "icon": "MapPin",
        "color": "bg-sky-100 text-sky-700 border-sky-300",
        "fields": ["Osman Gazi/FPU", "Green Zone", "Batı-Kuzey", "Red Zone", "Doğu Rıhtımı"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "arac_bilgileri",
        "name": "Araç Bilgileri",
        "icon": "Truck",
        "color": "bg-gray-100 text-gray-700 border-gray-300",
        "fields": ["Plaka", "Başlangıç KM", "Bitiş KM", "112 Protokol No"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "ekip_bilgileri",
        "name": "Ekip Bilgileri",
        "icon": "Users",
        "color": "bg-blue-100 text-blue-700 border-blue-300",
        "fields": ["Şoför", "Paramedik", "ATT", "Hemşire"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "kullanilan_ilaclar",
        "name": "Kullanılan İlaçlar",
        "icon": "Pill",
        "color": "bg-green-100 text-green-700 border-green-300",
        "fields": ["İlaç Adı", "Doz", "Uygulama Yolu", "Saat"],
        "defaultHeight": 2,
        "defaultWidth": 3
    },
    {
        "id": "kullanilan_malzemeler",
        "name": "Kullanılan Malzemeler",
        "icon": "Package",
        "color": "bg-yellow-100 text-yellow-700 border-yellow-300",
        "fields": ["Malzeme Listesi"],
        "defaultHeight": 2,
        "defaultWidth": 2
    },
    {
        "id": "tani_icd10",
        "name": "Tanı (ICD-10)",
        "icon": "FileText",
        "color": "bg-rose-100 text-rose-700 border-rose-300",
        "fields": ["ICD-10 Kodu", "Tanı Açıklaması"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "imza_hasta",
        "name": "İmza - Hasta/Yakını",
        "icon": "PenTool",
        "color": "bg-slate-100 text-slate-700 border-slate-300",
        "fields": ["Ad Soyad", "İmza"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "imza_doktor",
        "name": "İmza - Doktor/Paramedik",
        "icon": "PenTool",
        "color": "bg-slate-100 text-slate-700 border-slate-300",
        "fields": ["Ad Soyad", "İmza"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "imza_saglik_personeli",
        "name": "İmza - Sağlık Personeli",
        "icon": "PenTool",
        "color": "bg-slate-100 text-slate-700 border-slate-300",
        "fields": ["Ad Soyad", "İmza"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "imza_sofor",
        "name": "İmza - Şoför/Pilot",
        "icon": "PenTool",
        "color": "bg-slate-100 text-slate-700 border-slate-300",
        "fields": ["Ad Soyad", "İmza"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "imza_teslim_alan",
        "name": "İmza - Teslim Alan",
        "icon": "PenTool",
        "color": "bg-slate-100 text-slate-700 border-slate-300",
        "fields": ["Ad Soyad", "İmza"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "adli_vaka",
        "name": "Adli Vaka",
        "icon": "AlertCircle",
        "color": "bg-red-100 text-red-700 border-red-300",
        "fields": ["Adli Vaka mı?"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "vaka_sonucu",
        "name": "Vaka Sonucu",
        "icon": "FileText",
        "color": "bg-green-100 text-green-700 border-green-300",
        "fields": ["Sonuç Açıklaması"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "genel_notlar",
        "name": "Genel Notlar",
        "icon": "FileText",
        "color": "bg-gray-100 text-gray-700 border-gray-300",
        "fields": ["Serbest not alanı"],
        "defaultHeight": 2,
        "defaultWidth": 3
    },
    {
        "id": "kaza_bilgileri",
        "name": "Kaza Bilgileri",
        "icon": "AlertCircle",
        "color": "bg-orange-100 text-orange-700 border-orange-300",
        "fields": ["Araç Plaka 1", "Araç Plaka 2", "Araç Plaka 3", "Araç Plaka 4"],
        "defaultHeight": 1,
        "defaultWidth": 2
    },
    {
        "id": "izolasyon",
        "name": "İzolasyon",
        "icon": "AlertCircle",
        "color": "bg-amber-100 text-amber-700 border-amber-300",
        "fields": ["İzolasyon Gereksinimleri"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "kan_sekeri",
        "name": "Kan Şekeri",
        "icon": "Heart",
        "color": "bg-pink-100 text-pink-700 border-pink-300",
        "fields": ["Kan Şekeri (mg/dL)"],
        "defaultHeight": 1,
        "defaultWidth": 1
    },
    {
        "id": "logo_baslik",
        "name": "Logo/Başlık",
        "icon": "Image",
        "color": "bg-indigo-100 text-indigo-700 border-indigo-300",
        "fields": ["Logo", "Form Başlığı", "Alt Başlık"],
        "defaultHeight": 1,
        "defaultWidth": 4
    }
]


@router.get("/block-definitions")
async def get_block_definitions(request: Request):
    """Kutucuk tanımlarını getir"""
    await get_current_user(request)
    return BLOCK_DEFINITIONS


@router.get("")
async def get_templates(
    request: Request,
    template_type: Optional[str] = None,
    usage_type: Optional[str] = None,
    is_active: bool = True
):
    """Şablonları listele"""
    await get_current_user(request)
    
    query = {"is_active": is_active}
    if template_type:
        query["template_type"] = template_type
    if usage_type:
        query["usage_types"] = usage_type
    
    templates = await form_templates_collection.find(query).sort("created_at", -1).to_list(100)
    
    for t in templates:
        t["id"] = t.pop("_id")
    
    return templates


@router.get("/default/{usage_type}")
async def get_default_template(usage_type: str, request: Request, template_type: str = None):
    """Belirli kullanım tipi için varsayılan şablonu getir"""
    await get_current_user(request)
    
    query = {
        "usage_types": usage_type,
        "is_default": True,
        "is_active": True
    }
    if template_type:
        query["template_type"] = template_type
    
    template = await form_templates_collection.find_one(query)
    
    if not template:
        query.pop("is_default")
        template = await form_templates_collection.find_one(query)
    
    if template:
        template["id"] = template.pop("_id")
        return template
    
    return None


@router.get("/{template_id}")
async def get_template(template_id: str, request: Request):
    """Şablon detayı getir"""
    await get_current_user(request)
    
    template = await form_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    template["id"] = template.pop("_id")
    return template


@router.post("")
async def create_template(request: Request):
    """Yeni şablon oluştur"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    
    template_type = data.get("template_type", "pdf")
    
    # Eğer varsayılan olarak işaretlendiyse
    if data.get("is_default") and data.get("usage_types"):
        for usage_type in data.get("usage_types", []):
            await form_templates_collection.update_many(
                {
                    "usage_types": usage_type, 
                    "is_default": True,
                    "template_type": template_type
                },
                {"$set": {"is_default": False}}
            )
    
    template_id = str(uuid.uuid4())
    
    template_dict = {
        "_id": template_id,
        "name": data.get("name", "Yeni Şablon"),
        "description": data.get("description", ""),
        "template_type": template_type,  # 'pdf' veya 'table'
        # PDF şablon alanları
        "page_count": data.get("page_count", 1),
        "page_size": data.get("page_size", "A4"),
        "orientation": data.get("orientation", "portrait"),
        "blocks": data.get("blocks", []),
        # Tablo şablon alanları
        "rows": data.get("rows", 20),
        "columns": data.get("columns", 6),
        "cells": data.get("cells", {}),
        # Ortak alanlar
        "header": data.get("header", {"enabled": True, "text": "", "height": 60}),
        "footer": data.get("footer", {"enabled": True, "text": "", "height": 40}),
        "usage_types": data.get("usage_types", []),
        "is_default": data.get("is_default", False),
        "created_by": user.id,
        "created_by_name": user.name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }
    
    await form_templates_collection.insert_one(template_dict)
    
    logger.info(f"Form şablonu oluşturuldu: {template_dict['name']} ({template_type}) by {user.name}")
    
    template_dict["id"] = template_dict.pop("_id")
    return template_dict


@router.patch("/{template_id}")
async def update_template(template_id: str, request: Request):
    """Şablonu güncelle"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    try:
        data = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {str(e)}")
    
    template = await form_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    update_data = {k: v for k, v in data.items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Varsayılan olarak işaretleniyorsa
    if data.get("is_default") and data.get("usage_types"):
        template_type = data.get("template_type", template.get("template_type", "pdf"))
        for usage_type in data.get("usage_types", []):
            await form_templates_collection.update_many(
                {
                    "_id": {"$ne": template_id}, 
                    "usage_types": usage_type, 
                    "is_default": True,
                    "template_type": template_type
                },
                {"$set": {"is_default": False}}
            )
    
    await form_templates_collection.update_one(
        {"_id": template_id},
        {"$set": update_data}
    )
    
    updated = await form_templates_collection.find_one({"_id": template_id})
    updated["id"] = updated.pop("_id")
    
    logger.info(f"Form şablonu güncellendi: {template_id} by {user.name}")
    
    return updated


@router.delete("/{template_id}")
async def delete_template(template_id: str, request: Request):
    """Şablonu sil (soft delete)"""
    await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    result = await form_templates_collection.update_one(
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
    
    template = await form_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    # Aynı tip ve kullanım tipindeki diğer varsayılanları kaldır
    for usage_type in template.get("usage_types", []):
        await form_templates_collection.update_many(
            {
                "usage_types": usage_type, 
                "is_default": True,
                "template_type": template.get("template_type", "pdf")
            },
            {"$set": {"is_default": False}}
        )
    
    await form_templates_collection.update_one(
        {"_id": template_id},
        {"$set": {"is_default": True, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Şablon varsayılan olarak ayarlandı"}


@router.post("/{template_id}/duplicate")
async def duplicate_template(template_id: str, request: Request):
    """Şablonu kopyala"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    template = await form_templates_collection.find_one({"_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    
    new_id = str(uuid.uuid4())
    template["_id"] = new_id
    template["name"] = f"{template['name']} (Kopya)"
    template["is_default"] = False
    template["created_by"] = user.id
    template["created_by_name"] = user.name
    template["created_at"] = datetime.utcnow()
    template["updated_at"] = datetime.utcnow()
    
    await form_templates_collection.insert_one(template)
    
    template["id"] = template.pop("_id")
    return template


# ============= SAMPLE TEMPLATE (Vaka Formu) =============

@router.post("/create-sample")
async def create_sample_template(request: Request):
    """Örnek vaka formu tablo şablonu oluştur"""
    user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    # Örnek Vaka Formu Tablo Şablonu
    template_id = str(uuid.uuid4())
    
    sample_template = {
        "_id": template_id,
        "name": "Standart Vaka Formu (Tablo)",
        "description": "A4 formatında standart ambulans vaka formu",
        "template_type": "table",
        "rows": 22,
        "columns": 6,
        "cells": {
            # Başlık
            "0-0": {
                "blockId": "logo_baslik",
                "blockName": "Logo/Başlık",
                "rowSpan": 1,
                "colSpan": 6,
                "fields": ["Logo", "Form Başlığı", "Alt Başlık"],
                "color": "bg-indigo-100 text-indigo-700 border-indigo-300"
            },
            # Hasta Bilgileri
            "1-0": {
                "blockId": "hasta_bilgileri",
                "blockName": "Hasta Bilgileri",
                "rowSpan": 2,
                "colSpan": 3,
                "fields": ["TC Kimlik No", "Ad", "Soyad", "Yaş", "Doğum Tarihi", "Cinsiyet"],
                "color": "bg-blue-100 text-blue-700 border-blue-300"
            },
            # Çağrı Bilgileri
            "1-3": {
                "blockId": "cagri_bilgileri",
                "blockName": "Çağrı Bilgileri",
                "rowSpan": 2,
                "colSpan": 3,
                "fields": ["Çağrı Zamanı", "Çağrı Tipi", "Çağrı Nedeni", "Vakayı Veren Kurum"],
                "color": "bg-purple-100 text-purple-700 border-purple-300"
            },
            # Zaman Bilgileri
            "3-0": {
                "blockId": "zaman_bilgileri",
                "blockName": "Zaman Bilgileri",
                "rowSpan": 2,
                "colSpan": 6,
                "fields": ["Çağrı Saati", "Olay Yerine Varış", "Hastaya Varış", "Olay Yerinden Ayrılış", "Hastaneye Varış", "İstasyona Dönüş"],
                "color": "bg-amber-100 text-amber-700 border-amber-300"
            },
            # Vital Bulgular
            "5-0": {
                "blockId": "vital_bulgular_1",
                "blockName": "Vital Bulgular 1",
                "rowSpan": 1,
                "colSpan": 6,
                "fields": ["Saat", "Tansiyon", "Nabız", "SpO2", "Solunum", "Ateş"],
                "color": "bg-red-100 text-red-700 border-red-300"
            },
            "6-0": {
                "blockId": "vital_bulgular_2",
                "blockName": "Vital Bulgular 2",
                "rowSpan": 1,
                "colSpan": 6,
                "fields": ["Saat", "Tansiyon", "Nabız", "SpO2", "Solunum", "Ateş"],
                "color": "bg-red-100 text-red-700 border-red-300"
            },
            "7-0": {
                "blockId": "vital_bulgular_3",
                "blockName": "Vital Bulgular 3",
                "rowSpan": 1,
                "colSpan": 6,
                "fields": ["Saat", "Tansiyon", "Nabız", "SpO2", "Solunum", "Ateş"],
                "color": "bg-red-100 text-red-700 border-red-300"
            },
            # Klinik Gözlemler + GKS
            "8-0": {
                "blockId": "klinik_gozlemler",
                "blockName": "Klinik Gözlemler",
                "rowSpan": 2,
                "colSpan": 4,
                "fields": ["Bilinç Durumu", "Duygu Durumu", "Pupil", "Cilt", "Solunum Tipi", "Nabız Tipi"],
                "color": "bg-indigo-100 text-indigo-700 border-indigo-300"
            },
            "8-4": {
                "blockId": "gks_skorlari",
                "blockName": "GKS (Glasgow)",
                "rowSpan": 2,
                "colSpan": 2,
                "fields": ["Motor Yanıt", "Verbal Yanıt", "Göz Açma", "Toplam Skor"],
                "color": "bg-orange-100 text-orange-700 border-orange-300"
            },
            # Anamnez
            "10-0": {
                "blockId": "anamnez",
                "blockName": "Anamnez/Şikayet",
                "rowSpan": 2,
                "colSpan": 6,
                "fields": ["Başvuru Şikayeti", "Öykü", "Kronik Hastalıklar"],
                "color": "bg-teal-100 text-teal-700 border-teal-300"
            },
            # Fizik Muayene
            "12-0": {
                "blockId": "fizik_muayene",
                "blockName": "Fizik Muayene",
                "rowSpan": 2,
                "colSpan": 6,
                "fields": ["Fizik Muayene Bulguları"],
                "color": "bg-cyan-100 text-cyan-700 border-cyan-300"
            },
            # Uygulanan İşlemler
            "14-0": {
                "blockId": "uygulanan_islemler",
                "blockName": "Uygulanan İşlemler",
                "rowSpan": 2,
                "colSpan": 6,
                "fields": ["Maske ile hava yolu", "Airway", "Entübasyon", "CPR", "Defibrilasyon", "Diğer"],
                "color": "bg-violet-100 text-violet-700 border-violet-300"
            },
            # İlaçlar ve Malzemeler
            "16-0": {
                "blockId": "kullanilan_ilaclar",
                "blockName": "Kullanılan İlaçlar",
                "rowSpan": 2,
                "colSpan": 3,
                "fields": ["İlaç Adı", "Doz", "Uygulama Yolu", "Saat"],
                "color": "bg-green-100 text-green-700 border-green-300"
            },
            "16-3": {
                "blockId": "kullanilan_malzemeler",
                "blockName": "Kullanılan Malzemeler",
                "rowSpan": 2,
                "colSpan": 3,
                "fields": ["Malzeme Listesi"],
                "color": "bg-yellow-100 text-yellow-700 border-yellow-300"
            },
            # Nakil ve Sonuç
            "18-0": {
                "blockId": "nakil_hastanesi",
                "blockName": "Nakil Hastanesi",
                "rowSpan": 1,
                "colSpan": 3,
                "fields": ["Hastane Adı", "Hastane Protokol No"],
                "color": "bg-lime-100 text-lime-700 border-lime-300"
            },
            "18-3": {
                "blockId": "nakil_durumu",
                "blockName": "Nakil Durumu",
                "rowSpan": 1,
                "colSpan": 3,
                "fields": ["Nakil Tipi", "Transfer Tipi"],
                "color": "bg-emerald-100 text-emerald-700 border-emerald-300"
            },
            # Araç ve Ekip
            "19-0": {
                "blockId": "arac_bilgileri",
                "blockName": "Araç Bilgileri",
                "rowSpan": 1,
                "colSpan": 3,
                "fields": ["Plaka", "Başlangıç KM", "Bitiş KM", "112 Protokol No"],
                "color": "bg-gray-100 text-gray-700 border-gray-300"
            },
            "19-3": {
                "blockId": "ekip_bilgileri",
                "blockName": "Ekip Bilgileri",
                "rowSpan": 1,
                "colSpan": 3,
                "fields": ["Şoför", "Paramedik", "ATT"],
                "color": "bg-blue-100 text-blue-700 border-blue-300"
            },
            # İmzalar
            "20-0": {
                "blockId": "imza_hasta",
                "blockName": "İmza - Hasta/Yakını",
                "rowSpan": 2,
                "colSpan": 2,
                "fields": ["Ad Soyad", "İmza"],
                "color": "bg-slate-100 text-slate-700 border-slate-300"
            },
            "20-2": {
                "blockId": "imza_doktor",
                "blockName": "İmza - Doktor/Paramedik",
                "rowSpan": 2,
                "colSpan": 2,
                "fields": ["Ad Soyad", "İmza"],
                "color": "bg-slate-100 text-slate-700 border-slate-300"
            },
            "20-4": {
                "blockId": "imza_sofor",
                "blockName": "İmza - Şoför",
                "rowSpan": 2,
                "colSpan": 2,
                "fields": ["Ad Soyad", "İmza"],
                "color": "bg-slate-100 text-slate-700 border-slate-300"
            }
        },
        "header": {
            "enabled": True,
            "text": "AMBULANS VAKA FORMU",
            "height": 50
        },
        "footer": {
            "enabled": True,
            "text": "Healmedy Sağlık Hizmetleri - Gizlidir",
            "height": 30
        },
        "usage_types": ["vaka_formu"],
        "is_default": True,
        "created_by": user.id,
        "created_by_name": user.name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "is_active": True
    }
    
    # Eğer zaten varsayılan varsa kaldır
    await form_templates_collection.update_many(
        {"usage_types": "vaka_formu", "is_default": True, "template_type": "table"},
        {"$set": {"is_default": False}}
    )
    
    await form_templates_collection.insert_one(sample_template)
    
    logger.info(f"Örnek vaka formu şablonu oluşturuldu: {sample_template['name']} by {user.name}")
    
    sample_template["id"] = sample_template.pop("_id")
    return sample_template

