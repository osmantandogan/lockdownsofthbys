from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
import os
import logging

from services.excel_to_pdf_with_data import excel_form_to_pdf_with_data
from services.template_pdf_generator import generate_pdf_from_template
from services.libreoffice_pdf import generate_case_pdf_with_libreoffice, check_libreoffice_installed
from auth_utils import get_current_user
from database import cases_collection, pdf_templates_collection

router = APIRouter(prefix="/pdf", tags=["pdf"])
logger = logging.getLogger(__name__)

# LibreOffice kurulu mu kontrol et
LIBREOFFICE_AVAILABLE = check_libreoffice_installed()
logger.info(f"LibreOffice available: {LIBREOFFICE_AVAILABLE}")


@router.get("/case/{case_id}")
async def generate_case_pdf(case_id: str, request: Request):
    """Generate PDF for a specific case using LibreOffice (if available) or fallback"""
    
    # Authenticate user
    user = await get_current_user(request)
    
    # Fetch case data from database
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get path to templates directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    excel_template = os.path.join(backend_dir, "templates", "VAKA_FORMU_TEMPLATE.xlsx")
    
    if not os.path.exists(excel_template):
        logger.error(f"Excel template not found at: {excel_template}")
        raise HTTPException(status_code=500, detail=f"Excel template not found")
    
    # Prepare form data from case
    form_data = case.get('form_data', {})
    
    # Generate filename
    filename = f"Ambulans_Vaka_Formu_{case.get('case_number', case_id)}.pdf"
    
    try:
        # Use LibreOffice if available (better quality)
        if LIBREOFFICE_AVAILABLE:
            logger.info(f"Using LibreOffice for case {case_id}")
            result_path = generate_case_pdf_with_libreoffice(
                template_path=excel_template,
                case_data=case,
                form_data=form_data,
                output_filename=f"case_{case_id}.pdf"
            )
        else:
            # Fallback to ReportLab method
            logger.info(f"LibreOffice not available, using fallback for case {case_id}")
            temp_dir = os.path.join(backend_dir, "temp")
            os.makedirs(temp_dir, exist_ok=True)
            pdf_path = os.path.join(temp_dir, f"case_{case_id}.pdf")
            
            result_path = excel_form_to_pdf_with_data(
                excel_path=excel_template,
                pdf_path=pdf_path,
                case_data=case,
                form_data=form_data
            )
        
        # Return PDF as download
        return FileResponse(
            result_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF for case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")


@router.post("/case/{case_id}/with-form-data")
async def generate_case_pdf_with_form_data(
    case_id: str, 
    form_data: dict,
    request: Request
):
    """Generate PDF for a specific case with additional form data from frontend"""
    
    # Authenticate user
    user = await get_current_user(request)
    
    # Fetch case data from database
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get path to templates directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    excel_template = os.path.join(backend_dir, "templates", "VAKA_FORMU_TEMPLATE.xlsx")
    
    if not os.path.exists(excel_template):
        logger.error(f"Excel template not found at: {excel_template}")
        raise HTTPException(status_code=500, detail=f"Excel template not found")
    
    # Generate filename
    filename = f"Ambulans_Vaka_Formu_{case.get('case_number', case_id)}.pdf"
    
    try:
        # Use LibreOffice if available (better quality)
        if LIBREOFFICE_AVAILABLE:
            logger.info(f"Using LibreOffice for case {case_id} with form data")
            result_path = generate_case_pdf_with_libreoffice(
                template_path=excel_template,
                case_data=case,
                form_data=form_data,
                output_filename=f"case_{case_id}.pdf"
            )
        else:
            # Fallback to ReportLab method
            logger.info(f"LibreOffice not available, using fallback for case {case_id}")
            temp_dir = os.path.join(backend_dir, "temp")
            os.makedirs(temp_dir, exist_ok=True)
            pdf_path = os.path.join(temp_dir, f"case_{case_id}.pdf")
            
            result_path = excel_form_to_pdf_with_data(
                excel_path=excel_template,
                pdf_path=pdf_path,
                case_data=case,
                form_data=form_data
            )
        
        # Return PDF as download
        return FileResponse(
            result_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating PDF for case {case_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")
