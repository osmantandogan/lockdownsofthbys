from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import forms_collection, users_collection, cases_collection
from models import FormSubmission, FormSubmissionCreate
from auth_utils import get_current_user
from datetime import datetime

router = APIRouter()

# Rol çevirisi
ROLE_LABELS = {
    "doktor": "Doktor",
    "hemsire": "Hemşire",
    "paramedik": "Paramedik",
    "att": "ATT",
    "sofor": "Şoför",
    "bas_sofor": "Baş Şoför",
    "merkez_ofis": "Merkez Ofis",
    "operasyon_muduru": "Operasyon Müdürü",
    "cagri_merkezi": "Çağrı Merkezi"
}

@router.post("/", response_model=FormSubmission)
async def submit_form(data: FormSubmissionCreate, request: Request):
    """Submit a new form"""
    user = await get_current_user(request)
    
    new_form = FormSubmission(
        form_type=data.form_type,
        form_data=data.form_data,
        patient_name=data.patient_name,
        vehicle_plate=data.vehicle_plate,
        case_id=data.case_id,
        submitted_by=user.id
    )
    
    form_dict = new_form.model_dump(by_alias=True)
    await forms_collection.insert_one(form_dict)
    
    return new_form

@router.get("/")
async def get_forms(
    request: Request,
    form_type: Optional[str] = None,
    patient_name: Optional[str] = None,
    vehicle_plate: Optional[str] = None,
    case_id: Optional[str] = None,
    limit: int = 100
):
    """Get form submissions with user and case details"""
    user = await get_current_user(request)
    
    query = {}
    
    if form_type:
        query["form_type"] = form_type
    
    if patient_name:
        query["patient_name"] = {"$regex": patient_name, "$options": "i"}
    
    if vehicle_plate:
        query["vehicle_plate"] = {"$regex": vehicle_plate, "$options": "i"}
    
    if case_id:
        query["case_id"] = case_id
    
    # Non-admin users only see their own submissions
    if user.role not in ["merkez_ofis", "operasyon_muduru", "doktor"]:
        query["submitted_by"] = user.id
    
    forms = await forms_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Kullanıcı ve vaka bilgilerini ekle
    for form in forms:
        form["id"] = form.pop("_id")
        
        # Gönderen kullanıcı bilgilerini al
        submitter = await users_collection.find_one({"_id": form.get("submitted_by")})
        if submitter:
            form["submitter_name"] = submitter.get("name", "Bilinmiyor")
            form["submitter_role"] = ROLE_LABELS.get(submitter.get("role"), submitter.get("role", ""))
        else:
            form["submitter_name"] = form.get("submitted_by", "Bilinmiyor")
            form["submitter_role"] = ""
        
        # Vaka bilgilerini al
        if form.get("case_id"):
            case_doc = await cases_collection.find_one({"_id": form["case_id"]})
            if case_doc:
                form["case_number"] = case_doc.get("case_number", "")
                form["case_patient_name"] = case_doc.get("patient_name", "")
    
    return forms

@router.get("/{form_id}", response_model=FormSubmission)
async def get_form(form_id: str, request: Request):
    """Get single form submission"""
    await get_current_user(request)
    
    form_doc = await forms_collection.find_one({"_id": form_id})
    if not form_doc:
        raise HTTPException(status_code=404, detail="Form not found")
    
    form_doc["id"] = form_doc.pop("_id")
    return FormSubmission(**form_doc)

@router.delete("/{form_id}")
async def delete_form(form_id: str, request: Request):
    """Delete form submission"""
    user = await get_current_user(request)
    
    form_doc = await forms_collection.find_one({"_id": form_id})
    if not form_doc:
        raise HTTPException(status_code=404, detail="Form not found")
    
    # Only admin or form submitter can delete
    if user.role not in ["merkez_ofis", "operasyon_muduru"] and form_doc["submitted_by"] != user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await forms_collection.delete_one({"_id": form_id})
    
    return {"message": "Form deleted successfully"}

@router.get("/stats/summary")
async def get_form_stats(request: Request):
    """Get form statistics"""
    await get_current_user(request)
    
    total = await forms_collection.count_documents({})
    
    # By type
    consent_forms = await forms_collection.count_documents({
        "form_type": {"$in": ["kvkk", "injection", "puncture", "minor_surgery", "general_consent"]}
    })
    
    request_forms = await forms_collection.count_documents({
        "form_type": {"$in": ["medicine_request", "material_request", "medical_gas_request"]}
    })
    
    ambulance_forms = await forms_collection.count_documents({
        "form_type": {"$in": ["ambulance_equipment", "pre_case_check", "ambulance_case", "daily_control", "handover"]}
    })
    
    return {
        "total": total,
        "consent_forms": consent_forms,
        "request_forms": request_forms,
        "ambulance_forms": ambulance_forms
    }
