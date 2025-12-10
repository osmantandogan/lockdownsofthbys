"""
Şablon Bazlı PDF Oluşturma Routes
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import logging
from datetime import datetime

from services.template_pdf_generator import generate_pdf_from_template
from services.full_case_pdf_generator import generate_full_case_pdf
from auth_utils import get_current_user
from database import cases_collection, pdf_templates_collection, db

router = APIRouter(tags=["PDF Template"])
logger = logging.getLogger(__name__)

# Yeni form_templates collection
form_templates_collection = db["form_templates"]


@router.get("/case/{case_id}")
async def generate_case_pdf_with_template(
    case_id: str, 
    request: Request,
    template_id: str = None
):
    """
    Özel şablon kullanarak vaka PDF'i oluştur.
    template_id verilmezse varsayılan şablon kullanılır.
    """
    user = await get_current_user(request)
    
    # Vaka verilerini al
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    # Şablonu al - önce form_templates, sonra pdf_templates
    template = None
    
    # 1. Belirli template_id varsa onu bul (her iki collection'da ara)
    if template_id:
        template = await form_templates_collection.find_one({"_id": template_id})
        if not template:
            template = await pdf_templates_collection.find_one({"_id": template_id})
        logger.info(f"Template by ID: {template_id} -> {template is not None}")
    
    # 2. form_templates'ten varsayılan ve aktif PDF şablonunu bul
    if not template:
        template = await form_templates_collection.find_one({
            "is_default": True,
            "is_active": True,
            "template_type": "pdf"
        })
        logger.info(f"Default active PDF template from form_templates -> {template is not None}")
    
    # 3. form_templates'ten varsayılan Tablo şablonunu bul (PDF olarak da kullanılabilir)
    if not template:
        template = await form_templates_collection.find_one({
            "is_default": True,
            "is_active": True,
            "template_type": "table"
        })
        logger.info(f"Default active Table template from form_templates -> {template is not None}")
    
    # 4. form_templates'ten herhangi varsayılan şablon
    if not template:
        template = await form_templates_collection.find_one({
            "is_default": True
        })
        logger.info(f"Any default template from form_templates -> {template is not None}")
    
    # 5. form_templates'ten herhangi aktif şablon
    if not template:
        template = await form_templates_collection.find_one({
            "is_active": True
        })
        logger.info(f"Any active template from form_templates -> {template is not None}")
    
    # 6. Eski pdf_templates'ten varsayılan ve aktif
    if not template:
        template = await pdf_templates_collection.find_one({
            "is_default": True,
            "is_active": True
        })
        logger.info(f"Default active template from pdf_templates -> {template is not None}")
    
    # 7. Eski pdf_templates'ten herhangi aktif
    if not template:
        template = await pdf_templates_collection.find_one({
            "is_active": True
        })
        logger.info(f"Any active template from pdf_templates -> {template is not None}")
    
    # 8. Herhangi bir şablon (son çare)
    if not template:
        template = await form_templates_collection.find_one()
        if not template:
            template = await pdf_templates_collection.find_one()
        logger.info(f"Any template at all -> {template is not None}")
    
    if not template:
        raise HTTPException(
            status_code=404, 
            detail="Kullanılabilir şablon bulunamadı. Lütfen önce bir şablon oluşturun."
        )
    
    logger.info(f"Using template: {template.get('name')} (id: {template.get('_id')})")
    
    try:
        # Medical form verilerini al
        medical_form = case.get("medical_form", {})
        
        # PDF oluştur
        pdf_buffer = generate_pdf_from_template(template, case, medical_form)
        
        # Dosya adı - Türkçe karakterleri ASCII'ye dönüştür
        def sanitize_filename(text):
            """Dosya adı için Türkçe karakterleri temizle"""
            if not text:
                return ""
            text = str(text)
            tr_map = {
                'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
                'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
                'ü': 'u', 'Ü': 'U', 'ç': 'c', 'Ç': 'C'
            }
            for tr, ascii_c in tr_map.items():
                text = text.replace(tr, ascii_c)
            # Sadece alfanumerik ve alt çizgi karakterleri tut
            return ''.join(c if c.isalnum() or c in '-_' else '_' for c in text)
        
        case_number = sanitize_filename(case.get('case_number', case_id))
        template_name = sanitize_filename(template.get('name', 'Form'))
        filename = f"Vaka_{case_number}_{template_name}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF with template for case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF oluşturma hatası: {str(e)}")


@router.get("/case/{case_id}/full")
async def generate_full_case_pdf_endpoint(case_id: str, request: Request):
    """
    Vaka formundaki TÜM verileri içeren PDF oluştur.
    Şablondan bağımsız, sabit formatta tüm verileri döker.
    """
    user = await get_current_user(request)
    
    # Vaka verilerini al
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Vaka bulunamadı")
    
    try:
        # Medical form verilerini al
        medical_form = case.get("medical_form", {})
        
        # Tam PDF oluştur
        pdf_buffer = generate_full_case_pdf(case, medical_form)
        
        # Dosya adı
        def sanitize_filename(text):
            if not text:
                return ""
            text = str(text)
            tr_map = {
                'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G',
                'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O',
                'ü': 'u', 'Ü': 'U', 'ç': 'c', 'Ç': 'C'
            }
            for tr, ascii_c in tr_map.items():
                text = text.replace(tr, ascii_c)
            return ''.join(c if c.isalnum() or c in '-_' else '_' for c in text)
        
        case_number = sanitize_filename(case.get('case_number', case_id))
        filename = f"Vaka_Tam_{case_number}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating full PDF for case {case_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF oluşturma hatası: {str(e)}")


@router.get("/available")
async def get_available_templates(request: Request, usage_type: str = "vaka_formu"):
    """Kullanılabilir şablonları listele - hem form_templates hem pdf_templates"""
    await get_current_user(request)
    
    result = []
    
    # Önce form_templates'ten al
    form_templates = await form_templates_collection.find({
        "is_active": {"$ne": False}
    }).to_list(100)
    
    for t in form_templates:
        result.append({
            "id": t["_id"],
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "is_default": t.get("is_default", False),
            "page_count": t.get("page_count", 1),
            "usage_types": t.get("usage_types", []),
            "template_type": t.get("template_type", "pdf"),
            "source": "form_templates"
        })
    
    # Sonra eski pdf_templates'ten al
    pdf_templates = await pdf_templates_collection.find({
        "is_active": {"$ne": False}
    }).to_list(100)
    
    for t in pdf_templates:
        result.append({
            "id": t["_id"],
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "is_default": t.get("is_default", False),
            "page_count": t.get("page_count", 1),
            "usage_types": t.get("usage_types", []),
            "template_type": "pdf",
            "source": "pdf_templates"
        })
    
    return result


@router.get("/debug/case/{case_id}")
async def debug_case_data(case_id: str, request: Request):
    """Debug: Vaka verisinin yapısını göster"""
    await get_current_user(request)
    
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        return {"error": "Vaka bulunamadı"}
    
    # Datetime objeleri string'e çevir
    def serialize(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, dict):
            return {k: serialize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [serialize(v) for v in obj]
        return obj
    
    return {
        "case_id": case_id,
        "case_keys": list(case.keys()),
        "patient": serialize(case.get("patient", {})),
        "caller": serialize(case.get("caller", {})),
        "location": serialize(case.get("location", {})),
        "vehicle_info": serialize(case.get("vehicle_info", {})),
        "vehicle": serialize(case.get("vehicle", {})),
        "team": serialize(case.get("team", {})),
        "assigned_team": serialize(case.get("assigned_team", {})),
        "case_details": serialize(case.get("case_details", {})),
        "case_details_keys": list(case.get("case_details", {}).keys()) if case.get("case_details") else [],
        "medical_form": serialize(case.get("medical_form", {})),
        "medical_form_keys": list(case.get("medical_form", {}).keys()) if case.get("medical_form") else [],
        "status": case.get("status"),
        "case_number": case.get("case_number"),
        "protocol_112": case.get("protocol_112"),
        "last_form_update": serialize(case.get("last_form_update")),
        "last_form_updater": case.get("last_form_updater"),
    }


@router.get("/debug")
async def debug_templates(request: Request):
    """Debug: Tüm şablonları listele (her iki collection'dan)"""
    await get_current_user(request)
    
    # form_templates
    form_temps = await form_templates_collection.find({}).to_list(100)
    # pdf_templates
    pdf_temps = await pdf_templates_collection.find({}).to_list(100)
    
    return {
        "form_templates_count": len(form_temps),
        "pdf_templates_count": len(pdf_temps),
        "form_templates": [
            {
                "id": t.get("_id"),
                "name": t.get("name"),
                "template_type": t.get("template_type"),
                "usage_types": t.get("usage_types"),
                "is_default": t.get("is_default"),
                "is_active": t.get("is_active"),
                "blocks_count": len(t.get("blocks", [])),
                "cells_count": len(t.get("cells", []))
            }
            for t in form_temps
        ],
        "pdf_templates": [
            {
                "id": t.get("_id"),
                "name": t.get("name"),
                "usage_types": t.get("usage_types"),
                "is_default": t.get("is_default"),
                "is_active": t.get("is_active"),
                "blocks_count": len(t.get("blocks", []))
            }
            for t in pdf_temps
        ]
    }

