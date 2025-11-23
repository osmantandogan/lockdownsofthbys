from fastapi import APIRouter, Request
from typing import Optional, List
from database import audit_logs_collection
from models import AuditLog
from auth_utils import require_roles
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[AuditLog])
async def get_audit_logs(
    request: Request,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
):
    """Get audit logs (Admin only)"""
    await require_roles(["merkez_ofis"])(request)
    
    query = {}
    
    if user_id:
        query["user_id"] = {"$regex": user_id, "$options": "i"}
    
    if action:
        query["action"] = {"$regex": action, "$options": "i"}
    
    if start_date and end_date:
        query["created_at"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    
    logs = await audit_logs_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log["id"] = log.pop("_id")
    
    return logs
