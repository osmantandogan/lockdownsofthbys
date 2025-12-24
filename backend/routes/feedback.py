"""Feedback Routes - Geliştiriciye Bildir"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from database import db
from auth_utils import get_current_user
from utils.timezone import get_turkey_time
import logging, uuid

router = APIRouter(prefix="/feedback", tags=["Feedback"])
logger = logging.getLogger(__name__)
feedback_collection = db["feedback"]

class ScreenshotData(BaseModel):
    name: str
    data: str
    type: str

class UserInfo(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None

class FeedbackCreate(BaseModel):
    category: str
    title: str
    description: str
    priority: str = "normal"
    screenshots: List[ScreenshotData] = []
    user_info: Optional[UserInfo] = None
    user_agent: Optional[str] = None
    screen_size: Optional[str] = None
    timestamp: Optional[str] = None

class FeedbackStatusUpdate(BaseModel):
    status: str

@router.post("")
async def create_feedback(data: FeedbackCreate, request: Request):
    try:
        user = await get_current_user(request)
    except:
        user = None
    
    feedback_id = str(uuid.uuid4())
    feedback_doc = {
        "_id": feedback_id,
        "category": data.category,
        "title": data.title,
        "description": data.description,
        "priority": data.priority,
        "screenshots": [s.dict() for s in data.screenshots],
        "user_info": data.user_info.dict() if data.user_info else {
            "id": user.id if user else None,
            "name": f"{user.name} {user.surname}".strip() if user else "Anonim",
            "role": user.role if user else None,
            "email": user.email if user else None
        },
        "user_agent": data.user_agent,
        "screen_size": data.screen_size,
        "status": "pending",
        "admin_notes": [],
        "created_at": get_turkey_time(),
        "updated_at": get_turkey_time()
    }
    await feedback_collection.insert_one(feedback_doc)
    logger.info(f"New feedback: {feedback_id} - {data.category}: {data.title}")
    return {"message": "Geri bildirim başarıyla oluşturuldu", "id": feedback_id}

@router.get("")
async def get_all_feedback(request: Request, status: Optional[str] = None, category: Optional[str] = None, limit: int = 50, skip: int = 0):
    user = await get_current_user(request)
    if user.role not in ['operasyon_muduru', 'merkez_ofis', 'admin']:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    query = {}
    if status: query["status"] = status
    if category: query["category"] = category
    cursor = feedback_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    feedbacks = await cursor.to_list(length=limit)
    for fb in feedbacks: fb["id"] = fb.pop("_id")
    total = await feedback_collection.count_documents(query)
    return {"items": feedbacks, "total": total}

@router.get("/{feedback_id}")
async def get_feedback_by_id(feedback_id: str, request: Request):
    user = await get_current_user(request)
    feedback = await feedback_collection.find_one({"_id": feedback_id})
    if not feedback: raise HTTPException(status_code=404, detail="Bulunamadı")
    feedback["id"] = feedback.pop("_id")
    return feedback

@router.patch("/{feedback_id}/status")
async def update_feedback_status(feedback_id: str, data: FeedbackStatusUpdate, request: Request):
    user = await get_current_user(request)
    if user.role not in ['operasyon_muduru', 'merkez_ofis', 'admin']:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    await feedback_collection.update_one({"_id": feedback_id}, {"$set": {"status": data.status, "updated_at": get_turkey_time()}})
    return {"message": "Durum güncellendi"}

@router.delete("/{feedback_id}")
async def delete_feedback(feedback_id: str, request: Request):
    user = await get_current_user(request)
    if user.role not in ['operasyon_muduru', 'merkez_ofis', 'admin']:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    await feedback_collection.delete_one({"_id": feedback_id})
    return {"message": "Silindi"}

