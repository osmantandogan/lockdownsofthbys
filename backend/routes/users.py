from fastapi import APIRouter, HTTPException, Request, Depends
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from database import users_collection, shifts_collection, cases_collection, forms_collection
from models import User, UserUpdate, UserRole
from auth_utils import get_current_user, require_roles
from datetime import datetime
import bcrypt
import uuid

router = APIRouter()

# ============ ADMIN KULLANICI OLUŞTURMA ============

class CreateUserRequest(BaseModel):
    """Admin tarafından kullanıcı oluşturma"""
    email: EmailStr
    password: str
    name: str
    role: UserRole
    phone: Optional[str] = None
    tc_no: Optional[str] = None

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

@router.post("/create", response_model=User)
async def create_user(data: CreateUserRequest, request: Request):
    """
    Admin tarafından yeni kullanıcı oluştur
    Sadece merkez_ofis, operasyon_muduru ve mesul_mudur oluşturabilir
    """
    current_user = await require_roles(["merkez_ofis", "operasyon_muduru", "mesul_mudur"])(request)
    
    # Email kontrolü
    existing_user = await users_collection.find_one({"email": data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")
    
    # İsim kontrolü (aynı isimde kullanıcı varsa uyar ama engelleme)
    existing_name = await users_collection.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}})
    if existing_name:
        # Sadece uyarı, engelleme yok
        pass
    
    # Şifreyi hashle
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt())
    
    # Kullanıcı oluştur
    new_user = User(
        email=data.email.lower(),
        name=data.name,
        role=data.role,
        phone=data.phone,
        tc_no=data.tc_no
    )
    
    user_dict = new_user.model_dump(by_alias=True)
    user_dict["password_hash"] = password_hash.decode()
    user_dict["created_by"] = current_user.id
    user_dict["created_at"] = datetime.utcnow()
    
    await users_collection.insert_one(user_dict)
    
    return new_user


@router.get("")
async def get_users(request: Request):
    """Get all users (accessible by all authenticated users)"""
    # Tüm giriş yapmış kullanıcılar görebilir (vaka atama, ekip seçimi vb. için gerekli)
    user = await get_current_user(request)
    
    users = await users_collection.find({}, {"password_hash": 0}).to_list(1000)
    
    # Role doğrulaması olmadan dön (DB'de geçersiz roller olabilir)
    valid_roles = ["merkez_ofis", "operasyon_muduru", "doktor", "hemsire", "paramedik", "att", "bas_sofor", "sofor", "cagri_merkezi", "personel", "temizlik"]
    for u in users:
        u["id"] = u.pop("_id")
        # Geçersiz role varsa "personel" olarak düzelt
        if u.get("role") and u.get("role") not in valid_roles:
            u["role"] = "personel"
    
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

# ============ TOPLU İŞLEMLER ============

class BulkUserCreate(BaseModel):
    """Toplu kullanıcı oluşturma için tek kullanıcı"""
    email: str
    password: str
    name: str
    role: str
    phone: Optional[str] = None

class BulkDeleteRequest(BaseModel):
    """Seçili kullanıcıları silme"""
    user_ids: List[str]

@router.post("/bulk-create")
async def bulk_create_users(users_data: List[BulkUserCreate], request: Request):
    """Toplu kullanıcı oluşturma"""
    try:
        await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    except:
        pass  # Debug için geçici
    
    results = {"created": 0, "skipped": 0, "errors": [], "created_users": []}
    
    for u in users_data:
        try:
            # Email kontrolü
            existing = await users_collection.find_one({"email": u.email.lower().strip()})
            if existing:
                results["skipped"] += 1
                results["errors"].append(f"{u.email}: Zaten mevcut")
                continue
            
            # Şifre hash'le
            import hashlib
            password_hash = hashlib.sha256(u.password.encode()).hexdigest()
            
            user_doc = {
                "_id": str(uuid.uuid4()),
                "email": u.email.lower().strip(),
                "password_hash": password_hash,
                "name": u.name.strip(),
                "role": u.role,
                "phone": u.phone,
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            
            await users_collection.insert_one(user_doc)
            results["created"] += 1
            results["created_users"].append({"email": u.email, "name": u.name})
            
        except Exception as e:
            results["errors"].append(f"{u.email}: {str(e)}")
    
    return results

@router.post("/bulk-delete")
async def bulk_delete_users(data: BulkDeleteRequest, request: Request):
    """Seçili kullanıcıları toplu sil"""
    try:
        current_user = await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    except:
        current_user = None
    
    results = {"deleted": 0, "skipped": 0, "errors": [], "deleted_names": []}
    protected_roles = ["operasyon_muduru", "merkez_ofis"]
    
    for user_id in data.user_ids:
        try:
            user_doc = await users_collection.find_one({"_id": user_id})
            if not user_doc:
                results["skipped"] += 1
                continue
            
            # Korumalı rolleri silme
            if user_doc.get("role") in protected_roles:
                results["errors"].append(f"{user_doc.get('name')}: Korumalı rol")
                results["skipped"] += 1
                continue
            
            # Kendini silme kontrolü
            if current_user and user_id == current_user.id:
                results["errors"].append(f"{user_doc.get('name')}: Kendinizi silemezsiniz")
                results["skipped"] += 1
                continue
            
            await users_collection.delete_one({"_id": user_id})
            results["deleted"] += 1
            results["deleted_names"].append(user_doc.get("name"))
            
        except Exception as e:
            results["errors"].append(f"{user_id}: {str(e)}")
    
    return results

@router.delete("/delete-all-except")
async def delete_all_except(request: Request, keep_ids: str = ""):
    """Belirtilen ID'ler hariç tüm kullanıcıları sil"""
    try:
        await require_roles(["merkez_ofis", "operasyon_muduru"])(request)
    except:
        pass
    
    keep_list = [x.strip() for x in keep_ids.split(",") if x.strip()]
    protected_roles = ["operasyon_muduru", "merkez_ofis"]
    
    # Korumalı kullanıcıları ve keep listesini hariç tut
    query = {
        "_id": {"$nin": keep_list},
        "role": {"$nin": protected_roles}
    }
    
    # Test kullanıcıları da koru (ID'si test- ile başlayanlar)
    all_users = await users_collection.find(query).to_list(1000)
    delete_ids = [u["_id"] for u in all_users if not str(u["_id"]).startswith("test-")]
    
    if not delete_ids:
        return {"deleted": 0, "message": "Silinecek kullanıcı yok"}
    
    result = await users_collection.delete_many({"_id": {"$in": delete_ids}})
    
    return {
        "deleted": result.deleted_count,
        "kept_protected": len([u for u in all_users if u["role"] in protected_roles]),
        "message": f"{result.deleted_count} kullanıcı silindi"
    }