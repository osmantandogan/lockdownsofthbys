"""
Hasta Kartı Yönetimi API Routes
- TC Kimlik ile hasta kartı oluşturma/arama
- Alerji, kronik hastalık, doktor notu ekleme
- Tıbbi geçmiş görüntüleme
- Erişim kontrolü (Doktor/Müdür direkt, Hemşire OTP ile)
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from database import (
    patients_collection, 
    patient_access_logs_collection,
    cases_collection,
    users_collection
)
from models import (
    PatientCard, PatientCardCreate, PatientCardUpdate,
    Allergy, ChronicDisease, DoctorNote, MedicalHistory,
    EmergencyContact, PatientAccessRequest, PatientAccessLog
)
from auth_utils import get_current_user
from utils.timezone import get_turkey_time

router = APIRouter()
logger = logging.getLogger(__name__)

# Direkt erişim yetkisi olan roller
DIRECT_ACCESS_ROLES = ["doktor", "operasyon_muduru", "merkez_ofis"]
# OTP ile erişim gerektiren roller
OTP_ACCESS_ROLES = ["hemsire", "paramedik", "att"]


async def check_patient_access(user, patient_id: str, access_type: str = "view") -> bool:
    """
    Hasta kartına erişim kontrolü
    - Doktor, Müdür, Merkez: Direkt erişim
    - Hemşire: OTP gerekli (bu fonksiyon sadece True/False döner)
    """
    if user.role in DIRECT_ACCESS_ROLES:
        return True
    return False


async def log_patient_access(
    patient_id: str,
    patient_tc: str,
    user,
    access_type: str,
    access_granted: bool,
    approval_code: Optional[str] = None,
    approved_by: Optional[str] = None,
    request: Optional[Request] = None
):
    """Hasta kartı erişimini logla"""
    log_entry = PatientAccessLog(
        patient_id=patient_id,
        patient_tc=patient_tc,
        user_id=user.id,
        user_name=user.name,
        user_role=user.role,
        access_type=access_type,
        access_granted=access_granted,
        approval_code=approval_code,
        approved_by=approved_by,
        ip_address=request.client.host if request else None
    )
    await patient_access_logs_collection.insert_one(log_entry.model_dump(by_alias=True))


# ==================== HASTA KARTI CRUD ====================

@router.post("", response_model=PatientCard)
async def create_patient_card(data: PatientCardCreate, request: Request):
    """Yeni hasta kartı oluştur"""
    user = await get_current_user(request)
    
    # Sadece yetkili roller oluşturabilir (ATT, Paramedik, Hemşire dahil)
    PATIENT_CREATE_ROLES = DIRECT_ACCESS_ROLES + ["hemsire", "paramedik", "att", "cagri_merkezi"]
    if user.role not in PATIENT_CREATE_ROLES:
        raise HTTPException(status_code=403, detail="Hasta kartı oluşturma yetkiniz yok")
    
    # TC kimlik kontrolü
    if not data.tc_no or len(data.tc_no) != 11:
        raise HTTPException(status_code=400, detail="Geçerli bir TC Kimlik No giriniz (11 haneli)")
    
    # TC ile kayıt var mı kontrol et
    existing = await patients_collection.find_one({"tc_no": data.tc_no})
    if existing:
        raise HTTPException(status_code=400, detail="Bu TC Kimlik No ile kayıtlı hasta kartı zaten mevcut")
    
    # Yeni hasta kartı oluştur
    new_patient = PatientCard(
        tc_no=data.tc_no,
        name=data.name,
        surname=data.surname,
        birth_date=data.birth_date,
        gender=data.gender or "belirtilmemis",
        blood_type=data.blood_type or "Bilinmiyor",
        phone=data.phone,
        email=data.email,
        address=data.address,
        city=data.city,
        district=data.district,
        insurance_type=data.insurance_type,
        insurance_number=data.insurance_number,
        general_notes=data.general_notes,
        created_by=user.id
    )
    
    patient_dict = new_patient.model_dump(by_alias=True)
    await patients_collection.insert_one(patient_dict)
    
    # Erişim logu
    await log_patient_access(
        new_patient.id, data.tc_no, user, "edit", True, request=request
    )
    
    logger.info(f"Yeni hasta kartı oluşturuldu: {data.tc_no} by {user.name}")
    return PatientCard(**patient_dict)


@router.get("/search")
async def search_patient(
    request: Request,
    q: Optional[str] = None,  # Genel arama (TC, ad, soyad)
    tc_no: Optional[str] = None,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    limit: int = 100,
    all_patients: bool = False
):
    """Hasta ara (TC, ad veya telefon ile) - TC olmadan da arama yapılabilir"""
    user = await get_current_user(request)
    
    # Maskeli TC için suffix search flag
    suffix_search_digits = None
    
    # q parametresi varsa, TC veya isim olarak ara
    if q:
        # Asteriskleri temizle (maskeli TC için)
        clean_q = q.replace('*', '')
        
        # Eğer temizlenmiş q sadece rakamlardan oluşuyorsa TC olarak ara
        if clean_q.isdigit() and len(clean_q) >= 2:
            # Maskeli TC ise (örn: *******3612) son rakamlarla suffix search yap
            if '*' in q:
                # Son rakamlarla ara (suffix match)
                suffix_search_digits = clean_q
            else:
                tc_no = clean_q
        elif clean_q:  # En az bir karakter varsa
            name = clean_q
    
    # Arama kriteri gerekli (TC artık zorunlu değil)
    if not tc_no and not name and not phone and not suffix_search_digits:
        # Eğer hiçbir kriter yoksa, tüm hasta kartlarını listele (sadece yetkili roller için)
        if user.role in DIRECT_ACCESS_ROLES or all_patients:
            query = {}
            # Yetkili roller için daha yüksek limit
            if user.role in DIRECT_ACCESS_ROLES:
                limit = max(limit, 500)
        else:
            # Yetkisiz roller için boş liste döndür
            return []
    else:
        query = {}
        if suffix_search_digits:
            # Maskeli TC için suffix match (TC son hanelerle bitiyor mu?)
            import re
            escaped_digits = re.escape(suffix_search_digits)
            query["tc_no"] = {"$regex": f"{escaped_digits}$"}
        elif tc_no:
            # TC ile başlayanları ara (prefix match)
            import re
            escaped_tc = re.escape(tc_no)
            query["tc_no"] = {"$regex": f"^{escaped_tc}"}
        if name:
            # Ad veya soyad içinde ara (case insensitive)
            import re
            escaped_name = re.escape(name)
            if "$or" not in query:
                query["$or"] = []
            query["$or"].extend([
                {"name": {"$regex": escaped_name, "$options": "i"}},
                {"surname": {"$regex": escaped_name, "$options": "i"}}
            ])
        if phone:
            import re
            escaped_phone = re.escape(phone)
            query["phone"] = {"$regex": escaped_phone}
    
    patients = await patients_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Hemşire ise sadece temel bilgileri göster
    if user.role in OTP_ACCESS_ROLES:
        return [
            {
                "id": p["_id"],
                "tc_no": p["tc_no"][-4:].rjust(11, '*') if p.get("tc_no") else "***********",  # Son 4 hane görünür
                "name": p["name"],
                "surname": p["surname"],
                "birth_date": p.get("birth_date"),
                "has_allergies": len(p.get("allergies", [])) > 0,
                "has_chronic_diseases": len(p.get("chronic_diseases", [])) > 0,
                "requires_approval": True
            }
            for p in patients
        ]
    
    # Yetkili roller için tam bilgi
    result = []
    for p in patients:
        p["id"] = p.pop("_id")
        result.append(p)
    return result


@router.get("/by-tc/{tc_no}")
async def get_patient_by_tc(tc_no: str, request: Request):
    """TC Kimlik No ile hasta kartı getir"""
    user = await get_current_user(request)
    
    patient = await patients_collection.find_one({"tc_no": tc_no})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    # Erişim kontrolü
    has_access = await check_patient_access(user, patient["_id"])
    
    if not has_access:
        # Hemşire için kısıtlı bilgi döndür
        await log_patient_access(
            patient["_id"], tc_no, user, "view", False, request=request
        )
        return {
            "id": patient["_id"],
            "tc_no": tc_no[-4:].rjust(11, '*'),
            "name": patient["name"],
            "surname": patient["surname"],
            "has_allergies": len(patient.get("allergies", [])) > 0,
            "has_critical_info": any(
                a.get("severity") in ["siddetli", "anafilaksi"] 
                for a in patient.get("allergies", [])
            ),
            "requires_approval": True,
            "message": "Detaylı bilgi için doktor/müdür onayı gerekli"
        }
    
    # Tam erişim
    await log_patient_access(
        patient["_id"], tc_no, user, "view", True, request=request
    )
    
    patient["id"] = patient.pop("_id")
    
    # Son erişim bilgisini güncelle
    await patients_collection.update_one(
        {"tc_no": tc_no},
        {"$set": {
            "last_accessed_at": get_turkey_time(),
            "last_accessed_by": user.id
        }}
    )
    
    return patient


@router.get("/{patient_id}")
async def get_patient(patient_id: str, request: Request):
    """ID ile hasta kartı getir"""
    user = await get_current_user(request)
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    # Erişim kontrolü
    has_access = await check_patient_access(user, patient_id)
    
    if not has_access:
        await log_patient_access(
            patient_id, patient["tc_no"], user, "view", False, request=request
        )
        raise HTTPException(
            status_code=403, 
            detail="Bu hasta kartına erişim için doktor/müdür onayı gerekli"
        )
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "view", True, request=request
    )
    
    patient["id"] = patient.pop("_id")
    return patient


@router.post("/{patient_id}/request-access")
async def request_patient_access(
    patient_id: str,
    data: PatientAccessRequest,
    request: Request
):
    """Hemşire için hasta kartı erişim isteği (OTP doğrulama)"""
    user = await get_current_user(request)
    
    if user.role not in OTP_ACCESS_ROLES:
        raise HTTPException(status_code=400, detail="Bu endpoint sadece hemşireler içindir")
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    # OTP doğrulama - Doktor veya müdürün OTP'si ile
    from services.otp_service import verify_any_manager_otp
    
    verification = await verify_any_manager_otp(data.approval_code, DIRECT_ACCESS_ROLES)
    
    if not verification["valid"]:
        await log_patient_access(
            patient_id, patient["tc_no"], user, "view", False,
            approval_code=data.approval_code, request=request
        )
        raise HTTPException(status_code=403, detail="Geçersiz onay kodu")
    
    # Erişim onaylandı
    await log_patient_access(
        patient_id, patient["tc_no"], user, "view", True,
        approval_code=data.approval_code,
        approved_by=verification.get("approver_id"),
        request=request
    )
    
    patient["id"] = patient.pop("_id")
    
    logger.info(f"Hemşire {user.name} hasta kartına erişti: {patient['tc_no']} (onay: {verification.get('approver_name')})")
    
    return patient


@router.patch("/{patient_id}")
async def update_patient(patient_id: str, data: PatientCardUpdate, request: Request):
    """Hasta kartı güncelle"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Hasta kartı güncelleme yetkiniz yok")
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = get_turkey_time()
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {"$set": update_data}
    )
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "edit", True, request=request
    )
    
    updated = await patients_collection.find_one({"_id": patient_id})
    updated["id"] = updated.pop("_id")
    return updated


# ==================== ALERJİ YÖNETİMİ ====================

@router.post("/{patient_id}/allergies")
async def add_allergy(patient_id: str, allergy: Allergy, request: Request):
    """Hasta kartına alerji ekle"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Alerji ekleme yetkiniz yok")
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    allergy.recorded_by = user.id
    allergy.recorded_at = get_turkey_time()
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$push": {"allergies": allergy.model_dump()},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "add_allergy", True, request=request
    )
    
    logger.info(f"Alerji eklendi: {allergy.name} -> Hasta: {patient['tc_no']}")
    return {"message": "Alerji başarıyla eklendi", "allergy": allergy}


@router.delete("/{patient_id}/allergies/{allergy_id}")
async def remove_allergy(patient_id: str, allergy_id: str, request: Request):
    """Hasta kartından alerji sil"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Alerji silme yetkiniz yok")
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$pull": {"allergies": {"id": allergy_id}},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    return {"message": "Alerji silindi"}


# ==================== KRONİK HASTALIK YÖNETİMİ ====================

@router.post("/{patient_id}/chronic-diseases")
async def add_chronic_disease(patient_id: str, disease: ChronicDisease, request: Request):
    """Hasta kartına kronik hastalık ekle"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Kronik hastalık ekleme yetkiniz yok")
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    disease.recorded_by = user.id
    disease.recorded_at = get_turkey_time()
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$push": {"chronic_diseases": disease.model_dump()},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "add_disease", True, request=request
    )
    
    logger.info(f"Kronik hastalık eklendi: {disease.name} -> Hasta: {patient['tc_no']}")
    return {"message": "Kronik hastalık başarıyla eklendi", "disease": disease}


@router.delete("/{patient_id}/chronic-diseases/{disease_id}")
async def remove_chronic_disease(patient_id: str, disease_id: str, request: Request):
    """Hasta kartından kronik hastalık sil"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Kronik hastalık silme yetkiniz yok")
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$pull": {"chronic_diseases": {"id": disease_id}},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    return {"message": "Kronik hastalık silindi"}


# ==================== DOKTOR NOTU YÖNETİMİ ====================

@router.post("/{patient_id}/doctor-notes")
async def add_doctor_note(patient_id: str, note_data: dict, request: Request):
    """Hasta kartına doktor notu ekle"""
    user = await get_current_user(request)
    
    if user.role not in ["doktor", "operasyon_muduru", "merkez_ofis"]:
        raise HTTPException(status_code=403, detail="Doktor notu ekleme yetkiniz yok")
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    note = DoctorNote(
        doctor_id=user.id,
        doctor_name=user.name,
        title=note_data.get("title", "Not"),
        content=note_data.get("content", ""),
        priority=note_data.get("priority", "normal"),
        is_alert=note_data.get("is_alert", False)
    )
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$push": {"doctor_notes": note.model_dump()},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "add_note", True, request=request
    )
    
    logger.info(f"Doktor notu eklendi: {note.title} -> Hasta: {patient['tc_no']}")
    return {"message": "Doktor notu başarıyla eklendi", "note": note}


@router.delete("/{patient_id}/doctor-notes/{note_id}")
async def remove_doctor_note(patient_id: str, note_id: str, request: Request):
    """Hasta kartından doktor notu sil"""
    user = await get_current_user(request)
    
    if user.role not in ["doktor", "operasyon_muduru", "merkez_ofis"]:
        raise HTTPException(status_code=403, detail="Doktor notu silme yetkiniz yok")
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$pull": {"doctor_notes": {"id": note_id}},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    return {"message": "Doktor notu silindi"}


# ==================== ACİL DURUM İLETİŞİM ====================

@router.post("/{patient_id}/emergency-contacts")
async def add_emergency_contact(patient_id: str, contact: EmergencyContact, request: Request):
    """Acil durum iletişim bilgisi ekle"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES + ["hemsire", "cagri_merkezi"]:
        raise HTTPException(status_code=403, detail="Acil durum iletişimi ekleme yetkiniz yok")
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$push": {"emergency_contacts": contact.model_dump()},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    return {"message": "Acil durum iletişimi eklendi", "contact": contact}


# ==================== TIBBİ GEÇMİŞ ====================

@router.get("/{patient_id}/medical-history")
async def get_medical_history(patient_id: str, request: Request, limit: int = 20):
    """Hastanın tıbbi geçmişini getir (vakalardan)"""
    user = await get_current_user(request)
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    # Erişim kontrolü
    has_access = await check_patient_access(user, patient_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Tıbbi geçmişe erişim için onay gerekli")
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "view", True, request=request
    )
    
    # Hasta kartındaki geçmiş + vakalardan çekilen geçmiş
    history = patient.get("medical_history", [])
    
    # Ayrıca bu TC ile açılmış vakaları da getir
    cases = await cases_collection.find({
        "$or": [
            {"patient.tc_no": patient["tc_no"]},
            {"patient.tcNo": patient["tc_no"]}
        ]
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    case_history = []
    for case in cases:
        case_history.append({
            "case_id": case["_id"],
            "case_number": case.get("case_number"),
            "date": case.get("created_at"),
            "complaint": case.get("patient", {}).get("complaint") or case.get("case_details", {}).get("complaint"),
            "priority": case.get("priority"),
            "status": case.get("status"),
            "outcome": case.get("case_details", {}).get("outcome") if case.get("case_details") else None
        })
    
    return {
        "patient_history": history,
        "case_history": case_history,
        "total_cases": len(case_history)
    }


@router.post("/{patient_id}/medical-history")
async def add_medical_history(patient_id: str, history_data: dict, request: Request):
    """Tıbbi geçmiş kaydı ekle"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Tıbbi geçmiş ekleme yetkiniz yok")
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    history = MedicalHistory(
        case_id=history_data.get("case_id", ""),
        case_number=history_data.get("case_number", ""),
        date=get_turkey_time(),
        complaint=history_data.get("complaint", ""),
        diagnosis=history_data.get("diagnosis"),
        treatment=history_data.get("treatment"),
        medications_given=history_data.get("medications_given"),
        vital_signs=history_data.get("vital_signs"),
        outcome=history_data.get("outcome"),
        notes=history_data.get("notes"),
        attended_by=user.name
    )
    
    await patients_collection.update_one(
        {"_id": patient_id},
        {
            "$push": {"medical_history": history.model_dump()},
            "$set": {"updated_at": get_turkey_time()}
        }
    )
    
    await log_patient_access(
        patient_id, patient["tc_no"], user, "add_history", True, request=request
    )
    
    return {"message": "Tıbbi geçmiş eklendi", "history": history}


# ==================== ERİŞİM LOGLARI ====================

@router.get("/{patient_id}/access-logs")
async def get_access_logs(patient_id: str, request: Request, limit: int = 50):
    """Hasta kartı erişim loglarını getir"""
    user = await get_current_user(request)
    
    if user.role not in ["operasyon_muduru", "merkez_ofis"]:
        raise HTTPException(status_code=403, detail="Erişim loglarını görme yetkiniz yok")
    
    logs = await patient_access_logs_collection.find(
        {"patient_id": patient_id}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for log in logs:
        log["id"] = log.pop("_id")
    
    return logs


# ==================== İSTATİSTİKLER ====================

@router.get("/{patient_id}/case-count")
async def get_patient_case_count(patient_id: str, request: Request):
    """Hasta için toplam vaka sayısını getir"""
    user = await get_current_user(request)
    
    patient = await patients_collection.find_one({"_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Hasta kartı bulunamadı")
    
    # Erişim kontrolü
    has_access = await check_patient_access(user, patient_id)
    if not has_access:
        raise HTTPException(status_code=403, detail="Bu bilgiye erişim yetkiniz yok")
    
    # TC ile eşleşen vakaları say
    tc_no = patient.get("tc_no")
    if not tc_no:
        return {"case_count": 0}
    
    case_count = await cases_collection.count_documents({
        "patient.tc_no": tc_no
    })
    
    return {"case_count": case_count, "tc_no": tc_no}


@router.get("/stats/summary")
async def get_patient_stats(request: Request):
    """Hasta kartı istatistikleri"""
    user = await get_current_user(request)
    
    if user.role not in DIRECT_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="İstatistik görme yetkiniz yok")
    
    total = await patients_collection.count_documents({})
    with_allergies = await patients_collection.count_documents({"allergies.0": {"$exists": True}})
    with_chronic = await patients_collection.count_documents({"chronic_diseases.0": {"$exists": True}})
    
    # Son 30 günde erişilen
    thirty_days_ago = get_turkey_time() - timedelta(days=30)
    recently_accessed = await patients_collection.count_documents({
        "last_accessed_at": {"$gte": thirty_days_ago}
    })
    
    return {
        "total_patients": total,
        "with_allergies": with_allergies,
        "with_chronic_diseases": with_chronic,
        "recently_accessed_30d": recently_accessed
    }

