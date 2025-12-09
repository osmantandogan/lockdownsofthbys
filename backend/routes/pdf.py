from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
import sys
import os

# Add parent directory to path to import excel_to_pdf_with_data
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from excel_to_pdf_with_data import excel_form_to_pdf_with_data
from auth_utils import get_current_user
from database import cases_collection

router = APIRouter(prefix="/pdf", tags=["pdf"])

@router.get("/case/{case_id}")
async def generate_case_pdf(case_id: str, request: Request):
    """Generate PDF for a specific case"""
    
    # Authenticate user
    user = await get_current_user(request)
    
    # Fetch case data from database
    case = await cases_collection.find_one({"_id": case_id})
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Get path to project root (three levels up: routes -> backend -> project_root)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    excel_template = os.path.join(project_root, "ambulans_vaka_formu.xlsx")
    
    if not os.path.exists(excel_template):
        raise HTTPException(status_code=500, detail=f"Excel template not found at: {excel_template}")
    
    # Create temp directory in project root
    temp_dir = os.path.join(project_root, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Generate unique PDF filename
    pdf_path = os.path.join(temp_dir, f"case_{case_id}.pdf")
    
    # Prepare form data from case (you can extend this based on what data is available)
    form_data = case.get('form_data', {})
    
    try:
        # Generate PDF
        result_path = excel_form_to_pdf_with_data(
            excel_path=excel_template,
            pdf_path=pdf_path,
            case_data=case,
            form_data=form_data
        )
        
        # Return PDF as download
        filename = f"Ambulans_Vaka_Formu_{case.get('case_number', case_id)}.pdf"
        
        return FileResponse(
            result_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        # Clean up partial file if exists
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except:
                pass
        
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
    
    # Get path to project root (three levels up: routes -> backend -> project_root)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    excel_template = os.path.join(project_root, "ambulans_vaka_formu.xlsx")
    
    if not os.path.exists(excel_template):
        raise HTTPException(status_code=500, detail=f"Excel template not found at: {excel_template}")
    
    # Create temp directory in project root
    temp_dir = os.path.join(project_root, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Generate unique PDF filename
    pdf_path = os.path.join(temp_dir, f"case_{case_id}.pdf")
    
    try:
        # Generate PDF
        result_path = excel_form_to_pdf_with_data(
            excel_path=excel_template,
            pdf_path=pdf_path,
            case_data=case,
            form_data=form_data
        )
        
        # Return PDF as download
        filename = f"Ambulans_Vaka_Formu_{case.get('case_number', case_id)}.pdf"
        
        return FileResponse(
            result_path,
            media_type="application/pdf",
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        # Clean up partial file if exists
        if os.path.exists(pdf_path):
            try:
                os.remove(pdf_path)
            except:
                pass
        
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")

