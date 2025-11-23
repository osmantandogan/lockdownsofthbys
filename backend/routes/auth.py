from fastapi import APIRouter, HTTPException, Response, Request, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
import aiohttp
import os
from database import users_collection, user_sessions_collection
from models import User, UserRole
from auth_utils import create_access_token, get_current_user
import bcrypt

router = APIRouter()

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

# JWT Auth Models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SessionResponse(BaseModel):
    user: User
    session_token: str

# Emergent Google Auth
@router.get("/session")
async def process_session(request: Request, response: Response):
    """Process Emergent Auth session_id and create user session"""
    session_id = request.headers.get("X-Session-ID")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="X-Session-ID header required")
    
    # Fetch user data from Emergent
    async with aiohttp.ClientSession() as session:
        async with session.get(
            EMERGENT_AUTH_URL,
            headers={"X-Session-ID": session_id}
        ) as resp:
            if resp.status != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            
            data = await resp.json()
    
    # Check if user exists
    existing_user = await users_collection.find_one({"email": data["email"]})
    
    if existing_user:
        user_id = existing_user["_id"]
        user_doc = existing_user
        user_doc["id"] = user_doc.pop("_id")
        user = User(**user_doc)
    else:
        # Create new user
        new_user = User(
            email=data["email"],
            name=data["name"],
            picture=data.get("picture")
        )
        user_dict = new_user.model_dump(by_alias=True)
        await users_collection.insert_one(user_dict)
        user_id = new_user.id
        user = new_user
    
    # Create session
    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await user_sessions_collection.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set httpOnly cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {"user": user, "session_token": session_token}

# JWT-based Registration
@router.post("/register")
async def register(data: RegisterRequest, response: Response):
    """Register new user with email/password"""
    # Check if user exists
    existing_user = await users_collection.find_one({"email": data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt())
    
    # Create user
    new_user = User(
        email=data.email,
        name=data.name,
        role=data.role
    )
    user_dict = new_user.model_dump(by_alias=True)
    user_dict["password_hash"] = password_hash.decode()
    
    await users_collection.insert_one(user_dict)
    
    # Create JWT token
    access_token = create_access_token({"sub": new_user.id})
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return {"user": new_user, "session_token": access_token}

# JWT-based Login
@router.post("/login")
async def login(data: LoginRequest, response: Response):
    """Login with email/password"""
    # Find user
    user_doc = await users_collection.find_one({"email": data.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Check password
    password_hash = user_doc.get("password_hash")
    if not password_hash or not bcrypt.checkpw(data.password.encode(), password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create JWT token
    access_token = create_access_token({"sub": user_doc["_id"]})
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_doc["id"] = user_doc.pop("_id")
    user = User(**user_doc)
    
    return {"user": user, "session_token": access_token}

# Get current user
@router.get("/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user

# Logout
@router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Delete session from database
        await user_sessions_collection.delete_many({"session_token": session_token})
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}

# Password Reset
@router.post("/forgot-password")
async def forgot_password(email: str):
    """Request password reset"""
    user_doc = await users_collection.find_one({"email": email})
    if not user_doc:
        # Don't reveal if user exists
        return {"message": "If email exists, reset link sent"}
    
    # Generate reset token (simplified - should use JWT with expiry)
    reset_token = str(uuid.uuid4())
    
    # Store token (in production, use separate collection with expiry)
    await users_collection.update_one(
        {"email": email},
        {"$set": {"reset_token": reset_token, "reset_token_expires": datetime.now(timezone.utc) + timedelta(hours=1)}}
    )
    
    # Send email (simplified - add email service call here)
    reset_link = f"https://projem-sistemi.preview.emergentagent.com/reset-password?token={reset_token}"
    
    return {"message": "Reset link sent", "reset_link": reset_link}

@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """Reset password with token"""
    user_doc = await users_collection.find_one({
        "reset_token": token,
        "reset_token_expires": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not user_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Hash new password
    password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    
    # Update password and clear token
    await users_collection.update_one(
        {"_id": user_doc["_id"]},
        {
            "$set": {"password_hash": password_hash},
            "$unset": {"reset_token": "", "reset_token_expires": ""}
        }
    )
    
    return {"message": "Password reset successful"}
