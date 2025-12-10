"""
Şablon Bazlı PDF Oluşturma Routes
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
import logging

from services.template_pdf_generator import generate_pdf_from_template
from auth_utils import get_current_user
from database import cases_collection, pdf_templates_collection

router = APIRouter(tags=["PDF Template"])
logger = logging.getLogger(__name__)


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
    
    # Şablonu al
    template = None
    
    # 1. Belirli template_id varsa onu bul
    if template_id:
        template = await pdf_templates_collection.find_one({"_id": template_id})
        logger.info(f"Template by ID: {template_id} -> {template is not None}")
    
    # 2. Varsayılan ve aktif şablonu bul
    if not template:
        template = await pdf_templates_collection.find_one({
            "is_default": True,
            "is_active": True
        })
        logger.info(f"Default active template -> {template is not None}")
    
    # 3. Sadece varsayılan şablon (aktif olmasa da)
    if not template:
        template = await pdf_templates_collection.find_one({
            "is_default": True
        })
        logger.info(f"Default template (any) -> {template is not None}")
    
    # 4. Herhangi bir aktif şablon
    if not template:
        template = await pdf_templates_collection.find_one({
            "is_active": True
        })
        logger.info(f"Any active template -> {template is not None}")
    
    # 5. Herhangi bir şablon (son çare)
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
        
        # Dosya adı
        filename = f"Vaka_{case.get('case_number', case_id)}_{template.get('name', 'Form')}.pdf"
        
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


@router.get("/available")
async def get_available_templates(request: Request, usage_type: str = "vaka_formu"):
    """Kullanılabilir şablonları listele"""
    await get_current_user(request)
    
    # Daha esnek sorgu
    templates = await pdf_templates_collection.find({
        "$or": [
            {"usage_types": usage_type},
            {"usage_types": {"$in": [usage_type]}},
            {}  # Fallback: tüm şablonlar
        ]
    }).to_list(100)
    
    result = []
    for t in templates:
        result.append({
            "id": t["_id"],
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "is_default": t.get("is_default", False),
            "page_count": t.get("page_count", 1),
            "usage_types": t.get("usage_types", [])
        })
    
    return result


@router.get("/debug")
async def debug_templates(request: Request):
    """Debug: Tüm şablonları listele"""
    await get_current_user(request)
    
    templates = await pdf_templates_collection.find({}).to_list(100)
    
    return {
        "count": len(templates),
        "templates": [
            {
                "id": t.get("_id"),
                "name": t.get("name"),
                "usage_types": t.get("usage_types"),
                "is_default": t.get("is_default"),
                "is_active": t.get("is_active"),
                "blocks_count": len(t.get("blocks", []))
            }
            for t in templates
        ]
    }

