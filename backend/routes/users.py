from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List, Optional
from database import users_collection, shifts_collection, cases_collection, forms_collection
from models import User, UserUpdate, UserRole
from auth_utils import get_current_user, require_roles
from datetime import datetime

router = APIRouter()

@router.get("/staff-performance")
async def get_staff_performance(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get staff performance metrics"""
    await require_roles(["merkez_ofis", "operasyon_muduru", "bas_sofor"])(request)
    
    users = await users_collection.find({}, {"password_hash": 0}).to_list(1000)
    
    # Date filters
    date_filter = {}
    if start_date:
        date_filter["start_time"] = {"$gte": datetime.fromisoformat(start_date)}
    if end_date:
        if "start_time" in date_filter:
            date_filter["start_time"]["$lte"] = datetime.fromisoformat(end_date)
        else:
            date_filter["start_time"] = {"$lte": datetime.fromisoformat(end_date)}
    
    performance = []
    
    for user in users:
        # Get user's shifts
        shift_query = {"user_id": user["_id"]}
        if date_filter:
            shift_query.update(date_filter)
        
        shifts = await shifts_collection.find(shift_query).to_list(1000)
        
        # Get user's assigned cases
        case_query = {
            "$or": [
                {"assigned_team.driver_id": user["_id"]},
                {"assigned_team.paramedic_id": user["_id"]},
                {"assigned_team.att_id": user["_id"]},
                {"assigned_team.nurse_id": user["_id"]}
            ]
        }
        
        cases = await cases_collection.find(case_query).to_list(1000)
        
        # Calculate shift metrics
        total_shifts = len(shifts)
        completed_shifts = [s for s in shifts if s.get("end_time")]
        total_minutes = sum(shift.get("duration_minutes", 0) for shift in completed_shifts)
        total_hours = round(total_minutes / 60, 2) if total_minutes > 0 else 0
        
        # Calculate case metrics
        total_cases = len(cases)
        completed_cases = len([c for c in cases if c.get("status") == "tamamlandi"])
        
        # Calculate KM metrics from forms
        case_km = 0
        shift_km = 0
        
        # Get ambulance case forms submitted by this user
        ambulance_forms = await forms_collection.find({
            "form_type": "ambulance_case",
            "submitted_by": user["_id"]
        }).to_list(1000)
        
        for form in ambulance_forms:
            form_data = form.get("form_data", {})
            if form_data.get("startKm") and form_data.get("endKm"):
                try:
                    start = int(form_data["startKm"])
                    end = int(form_data["endKm"])
                    case_km += (end - start)
                except (ValueError, TypeError):
                    pass
        
        # Calculate shift KM from handover forms
        for shift in completed_shifts:
            handover = shift.get("handover_form")
            if handover and isinstance(handover, dict):
                if handover.get("teslimAlinanKm") and handover.get("currentKm"):
                    try:
                        start = int(handover["teslimAlinanKm"])
                        end = int(handover.get("currentKm", start))
                        shift_km += (end - start)
                    except (ValueError, TypeError):
                        pass
        
        non_case_km = shift_km - case_km if shift_km > case_km else 0
        efficiency_rate = round((case_km / shift_km * 100) if shift_km > 0 else 0, 2)
        
        performance.append({
            "user_id": user["_id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "phone": user.get("phone"),
            "total_shifts": total_shifts,
            "completed_shifts": len(completed_shifts),
            "total_hours": total_hours,
            "total_cases": total_cases,
            "completed_cases": completed_cases,
            "total_shift_km": shift_km,
            "case_km": case_km,
            "non_case_km": non_case_km,
            "efficiency_rate": efficiency_rate,
            "is_active": user.get("is_active", True)
        })
    
    # Sort by total hours (most active first)
    performance.sort(key=lambda x: x["total_hours"], reverse=True)
    
    return performance

@router.get("", response_model=List[User])
async def get_users(request: Request):
    """Get all users (accessible by all authenticated users)"""
    # Tüm giriş yapmış kullanıcılar görebilir (vaka atama, ekip seçimi vb. için gerekli)
    user = await get_current_user(request)
    
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


# ============ PROFİL FOTOĞRAFI ============

from pydantic import BaseModel

class ProfilePhotoUpload(BaseModel):
    """Profil fotoğrafı yükleme"""
    photo_base64: str  # Base64 encoded image data


@router.post("/me/photo")
async def upload_profile_photo(data: ProfilePhotoUpload, request: Request):
    """
    Kullanıcının profil fotoğrafını yükle
    Base64 formatında resim alır
    """
    user = await get_current_user(request)
    
    # Fotoğrafı kontrol et (max 2MB base64 ~ 2.7MB string)
    if len(data.photo_base64) > 3000000:
        raise HTTPException(status_code=400, detail="Fotoğraf çok büyük (max 2MB)")
    
    # Base64 formatını kontrol et
    if not data.photo_base64.startswith('data:image/'):
        raise HTTPException(status_code=400, detail="Geçersiz fotoğraf formatı")
    
    await users_collection.update_one(
        {"_id": user.id},
        {"$set": {
            "profile_photo": data.photo_base64,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "Profil fotoğrafı güncellendi"}


@router.delete("/me/photo")
async def delete_profile_photo(request: Request):
    """Kullanıcının profil fotoğrafını sil"""
    user = await get_current_user(request)
    
    await users_collection.update_one(
        {"_id": user.id},
        {"$unset": {"profile_photo": ""}}
    )
    
    return {"message": "Profil fotoğrafı silindi"}


@router.get("/me/photo")
async def get_profile_photo(request: Request):
    """Kullanıcının profil fotoğrafını getir"""
    user = await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user.id})
    
    return {
        "photo": user_doc.get("profile_photo"),
        "has_photo": bool(user_doc.get("profile_photo"))
    }


@router.get("/{user_id}/photo")
async def get_user_photo(user_id: str, request: Request):
    """Başka bir kullanıcının profil fotoğrafını getir"""
    await get_current_user(request)
    
    user_doc = await users_collection.find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    return {
        "user_id": user_id,
        "name": user_doc.get("name"),
        "photo": user_doc.get("profile_photo"),
        "has_photo": bool(user_doc.get("profile_photo"))
    }


# ============ PERSONEL SİLME ============

@router.delete("/{user_id}")
async def delete_user(user_id: str, request: Request):
    """
    Personeli sistemden sil
    Sadece Operasyon Müdürü ve Merkez Ofis yetkilidir
    """
    current_user = await require_roles(["operasyon_muduru", "merkez_ofis"])(request)
    
    # Kullanıcıyı bul
    user_doc = await users_collection.find_one({"_id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Kendini silmeye çalışıyor mu kontrol et
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    
    # Operasyon müdürü veya merkez ofisi silmeye çalışıyor mu kontrol et
    protected_roles = ["operasyon_muduru", "merkez_ofis"]
    if user_doc.get("role") in protected_roles:
        raise HTTPException(
            status_code=403, 
            detail="Operasyon Müdürü veya Merkez Ofis kullanıcıları silinemez"
        )
    
    # Kullanıcıyı sil
    result = await users_collection.delete_one({"_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Silme işlemi başarısız oldu")
    
    return {
        "message": f"Kullanıcı '{user_doc.get('name')}' başarıyla silindi",
        "deleted_user_id": user_id,
        "deleted_by": current_user.id
    }
