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
    email: str  # Email veya isim soyisim olabilir
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

# JWT-based Registration - SADECE ADMİN YAPABİLİR
# Dışarıdan kayıt kapatıldı - Kullanıcılar sadece admin tarafından oluşturulabilir
@router.post("/register")
async def register(data: RegisterRequest, response: Response):
    """
    Register new user - DEVRE DIŞI
    Kullanıcılar sadece admin panelinden oluşturulabilir.
    """
    raise HTTPException(
        status_code=403, 
        detail="Dışarıdan kayıt kapatılmıştır. Lütfen yöneticinizle iletişime geçin."
    )

# JWT-based Login
@router.options("/login")
async def login_options(request: Request):
    """Handle OPTIONS for login endpoint"""
    origin = request.headers.get("origin", "")
    from fastapi.responses import Response as FastAPIResponse
    resp = FastAPIResponse(status_code=200)
    if origin and (origin.endswith('.ldserp.com') or 'abro.ldserp.com' in origin):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "*"
    return resp

@router.post("/login")
async def login(data: LoginRequest, response: Response, request: Request):
    """Login with email/password or name/password"""
    import re
    
    # Email mi yoksa isim soyisim mi kontrol et
    is_email = '@' in data.email
    
    if is_email:
        # Email ile ara
        user_doc = await users_collection.find_one({"email": data.email.lower()})
    else:
        # İsim soyisim ile ara (case-insensitive)
        # "Ali Veli" veya "ali veli" gibi aramaya izin ver
        name_regex = re.compile(f"^{re.escape(data.email)}$", re.IGNORECASE)
        user_doc = await users_collection.find_one({"name": name_regex})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    
    # Check password
    password_hash = user_doc.get("password_hash")
    if not password_hash:
        raise HTTPException(status_code=401, detail="Şifre hatalı")
    
    try:
        # Bcrypt hash kontrolü (doğru format: $2a$ veya $2b$ ile başlar)
        if not password_hash.startswith('$2'):
            # Eski SHA256 formatı ile oluşturulmuş kullanıcı - şifre sıfırlanmalı
            raise HTTPException(
                status_code=500, 
                detail="Bu kullanıcının şifresi eski formatta. Lütfen yöneticinize şifre sıfırlama için başvurun."
            )
        
        if not bcrypt.checkpw(data.password.encode(), password_hash.encode()):
            raise HTTPException(status_code=401, detail="Şifre hatalı")
    except ValueError as e:
        # Invalid salt hatası - şifre hash'i bozuk
        raise HTTPException(
            status_code=500, 
            detail="Bu kullanıcının şifresi geçersiz formatta. Lütfen yöneticinize şifre sıfırlama için başvurun."
        )
    
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
    
    # Add CORS headers to response
    origin = request.headers.get("origin", "")
    if origin and (origin.endswith('.ldserp.com') or 'abro.ldserp.com' in origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Expose-Headers"] = "*"
    
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
