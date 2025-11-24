from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List
from database import users_collection
from models import User, UserUpdate, UserRole
from auth_utils import get_current_user, require_roles
from datetime import datetime

router = APIRouter()

@router.get("", response_model=List[User])
async def get_users(request: Request):
    """Get all users (admin only)"""
    user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    
    users = await users_collection.find({}, {"password_hash": 0}).to_list(1000)
    
    for u in users:
        u["id"] = u.pop("_id")
    
    return users

@router.get("/{user_id}", response_model=User)
async def get_user(user_id: str, request: Request):
    """Get user by ID"""
    await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user_id}, {"password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_doc["id"] = user_doc.pop("_id")
    return User(**user_doc)

@router.patch("/{user_id}", response_model=User)
async def update_user(user_id: str, data: UserUpdate, request: Request):
    """Update user"""
    current_user = await get_current_user(request)
    
    # Only admin or self can update
    if current_user.id != user_id and current_user.role not in ["merkez_ofis", "operasyon_muduru"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await users_collection.find_one_and_update(
        {"_id": user_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    result["id"] = result.pop("_id")
    return User(**result)

@router.post("/{user_id}/assign-temp-role")
async def assign_temp_role(user_id: str, role: UserRole, duration_days: int, request: Request):
    """Assign temporary role to user (Operation Manager only)"""
    current_user = await require_roles(["operasyon_muduru"])(request)
    
    user_doc = await users_collection.find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add temp role
    await users_collection.update_one(
        {"_id": user_id},
        {"$addToSet": {"temp_roles": role}}
    )
    
    return {"message": f"Temporary role '{role}' assigned for {duration_days} days"}

@router.delete("/{user_id}/remove-temp-role")
async def remove_temp_role(user_id: str, role: UserRole, request: Request):
    """Remove temporary role from user"""
    current_user = await require_roles(["operasyon_muduru"])(request)
    
    await users_collection.update_one(
        {"_id": user_id},
        {"$pull": {"temp_roles": role}}
    )
    
    return {"message": f"Temporary role '{role}' removed"}
