from fastapi import HTTPException, Request, status
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
import os
from database import user_sessions_collection, users_collection
from models import User

# Fallback secret key for development - CHANGE THIS IN PRODUCTION!
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "healmedy_super_secret_key_2024_dev_only")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_DAYS", 7))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request) -> User:
    # Try to get token from cookie first
    session_token = request.cookies.get("session_token")
    
    # If not in cookie, try Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Check if it's an Emergent session token (from session storage)
    session = await user_sessions_collection.find_one({
        "session_token": session_token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if session:
        # Find user by session
        user_doc = await users_collection.find_one({"_id": session["user_id"]})
        if user_doc:
            user_doc["id"] = user_doc.pop("_id")
            return User(**user_doc)
    
    # If not Emergent session, try JWT token
    try:
        payload = jwt.decode(session_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        user_doc = await users_collection.find_one({"_id": user_id})
        if user_doc:
            user_doc["id"] = user_doc.pop("_id")
            return User(**user_doc)
    except JWTError:
        pass
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials"
    )

def require_roles(allowed_roles: list):
    async def role_checker(request: Request) -> User:
        user = await get_current_user(request)
        
        # Check if user has the required role (including temp roles)
        all_roles = [user.role] + user.temp_roles if user.role else user.temp_roles
        
        if not any(role in allowed_roles for role in all_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource"
            )
        
        return user
    
    return role_checker
