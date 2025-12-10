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
    if template_id:
        template = await pdf_templates_collection.find_one({"_id": template_id, "is_active": True})
    
    if not template:
        # Varsayılan şablonu bul
        template = await pdf_templates_collection.find_one({
            "usage_types": "vaka_formu",
            "is_default": True,
            "is_active": True
        })
    
    if not template:
        # Herhangi bir vaka formu şablonu bul
        template = await pdf_templates_collection.find_one({
            "usage_types": "vaka_formu",
            "is_active": True
        })
    
    if not template:
        raise HTTPException(
            status_code=404, 
            detail="Kullanılabilir şablon bulunamadı. Lütfen önce bir şablon oluşturun."
        )
    
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
    
    templates = await pdf_templates_collection.find({
        "usage_types": usage_type,
        "is_active": True
    }).to_list(100)
    
    result = []
    for t in templates:
        result.append({
            "id": t["_id"],
            "name": t.get("name", ""),
            "description": t.get("description", ""),
            "is_default": t.get("is_default", False),
            "page_count": t.get("page_count", 1)
        })
    
    return result

