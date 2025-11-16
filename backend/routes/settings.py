from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import users_collection
from models import User, UserUpdate
from auth_utils import get_current_user
from datetime import datetime

router = APIRouter()

class NotificationSettings(BaseModel):
    sms_enabled: bool = True
    email_enabled: bool = True
    push_enabled: bool = True

class SettingsUpdate(BaseModel):
    notification_settings: Optional[NotificationSettings] = None

@router.get("/profile", response_model=User)
async def get_profile(request: Request):
    """Get user profile"""
    user = await get_current_user(request)
    return user

@router.patch("/profile", response_model=User)
async def update_profile(data: UserUpdate, request: Request):
    """Update user profile"""
    user = await get_current_user(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await users_collection.find_one_and_update(
        {"_id": user.id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    result["id"] = result.pop("_id")
    return User(**result)

@router.get("/system")
async def get_system_info(request: Request):
    """Get system information"""
    await get_current_user(request)
    
    return {
        "version": "1.0.0",
        "environment": "production",
        "last_update": "2025-01-15"
    }
