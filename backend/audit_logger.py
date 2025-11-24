from database import audit_logs_collection
from datetime import datetime
import uuid

async def log_action(user_id: str, action: str, entity_type: str, entity_id: str, details: dict = None, ip_address: str = None):
    """Log an action to audit logs"""
    try:
        log_entry = {
            "_id": str(uuid.uuid4()),
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "details": details or {},
            "ip_address": ip_address,
            "created_at": datetime.utcnow()
        }
        
        await audit_logs_collection.insert_one(log_entry)
    except Exception as e:
        # Don't fail the request if logging fails
        print(f"Audit log error: {str(e)}")
