from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from database import document_metadata_collection, forms_collection
from models import DocumentMetadata, DocumentMetadataCreate, DocumentMetadataUpdate
from auth_utils import get_current_user, require_roles
from datetime import datetime

router = APIRouter()

@router.post("/metadata", response_model=DocumentMetadata)
async def create_document_metadata(data: DocumentMetadataCreate, request: Request):
    """Create document metadata (Admin only)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    new_doc = DocumentMetadata(
        **data.model_dump(),
        created_by=user.id
    )
    
    doc_dict = new_doc.model_dump(by_alias=True)
    await document_metadata_collection.insert_one(doc_dict)
    
    return new_doc

@router.get("/metadata", response_model=List[DocumentMetadata])
async def get_all_document_metadata(request: Request):
    """Get all document metadata"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    docs = await document_metadata_collection.find({}).sort("created_at", -1).to_list(1000)
    
    for doc in docs:
        doc["id"] = doc.pop("_id")
    
    return docs

@router.get("/metadata/{form_type}")
async def get_document_metadata_by_type(form_type: str, request: Request):
    """Get document metadata for specific form type"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    doc = await document_metadata_collection.find_one({"form_type": form_type})
    
    if not doc:
        # Return default if not set
        return {
            "form_type": form_type,
            "doc_no": "DOC-001",
            "publish_date": datetime.utcnow().isoformat(),
            "page_count": 1,
            "page_no": "1",
            "revision_no": 1
        }
    
    doc["id"] = doc.pop("_id")
    return DocumentMetadata(**doc)

@router.patch("/metadata/{metadata_id}", response_model=DocumentMetadata)
async def update_document_metadata(
    metadata_id: str, 
    data: DocumentMetadataUpdate, 
    request: Request
):
    """Update document metadata"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await document_metadata_collection.find_one_and_update(
        {"_id": metadata_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Document metadata not found")
    
    result["id"] = result.pop("_id")
    return DocumentMetadata(**result)

@router.get("/archive")
async def get_archive(
    request: Request,
    form_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    case_id: Optional[str] = None,
    submitted_by: Optional[str] = None
):
    """Get forms archive with filters"""
    await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    query = {}
    
    if form_type:
        query["form_type"] = form_type
    
    if start_date:
        query["created_at"] = {"$gte": datetime.fromisoformat(start_date)}
    
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(end_date)}
    
    if case_id:
        query["case_id"] = case_id
    
    if submitted_by:
        query["submitted_by"] = submitted_by
    
    forms = await forms_collection.find(query).sort("created_at", -1).to_list(1000)
    
    # Enrich with user and case data
    from database import users_collection, cases_collection
    
    for form in forms:
        form["id"] = form.pop("_id")
        
        # Get submitter info
        if form.get("submitted_by"):
            user = await users_collection.find_one({"_id": form["submitted_by"]}, {"password_hash": 0})
            if user:
                form["submitter_name"] = user.get("name")
                form["submitter_role"] = user.get("role")
        
        # Get case info if exists
        if form.get("case_id"):
            case = await cases_collection.find_one({"_id": form["case_id"]})
            if case:
                form["case_number"] = case.get("case_number")
                form["case_status"] = case.get("status")
    
    return forms

