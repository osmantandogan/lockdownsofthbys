from fastapi import APIRouter, HTTPException, Request, Query
from typing import List, Optional
import json
import os
from pathlib import Path

router = APIRouter()

# Load data files
DATA_DIR = Path(__file__).parent.parent / "data"

def load_icd_codes():
    """Load ICD codes from JSON file"""
    try:
        with open(DATA_DIR / "icd_codes.json", "r", encoding="utf-8") as f:
            codes = json.load(f)
            # İlk satır header olduğu için atla
            return [c for c in codes if c.get("code") != "ICD KODU"]
    except Exception as e:
        print(f"Error loading ICD codes: {e}")
        return []

def load_hospitals():
    """Load hospitals from JSON file"""
    try:
        with open(DATA_DIR / "hospitals.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading hospitals: {e}")
        return {"custom": [], "zonguldak_all": [], "all": []}

def load_hospitals_turkey():
    """Load all Turkey hospitals from JSON file"""
    try:
        with open(DATA_DIR / "hospitals_turkey.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading Turkey hospitals: {e}")
        return {"provinces": [], "hospitals_by_province": {}, "total_hospitals": 0}

# Cache data in memory
ICD_CODES = load_icd_codes()
HOSPITALS = load_hospitals()
HOSPITALS_TURKEY = load_hospitals_turkey()

@router.get("/icd-codes")
async def search_icd_codes(
    q: str = Query("", description="Search query for ICD code or name"),
    limit: int = Query(20, description="Maximum number of results")
):
    """Search ICD codes by code or name"""
    if not q:
        return []
    
    q_lower = q.lower()
    results = []
    
    for code in ICD_CODES:
        code_match = q_lower in code.get("code", "").lower()
        name_match = q_lower in code.get("name", "").lower()
        
        if code_match or name_match:
            results.append(code)
            if len(results) >= limit:
                break
    
    return results

@router.get("/hospitals")
async def get_hospitals(
    q: str = Query("", description="Search query for hospital name"),
    il: str = Query("", description="Filter by province (il)"),
    category: str = Query("all", description="Category: custom, zonguldak, all")
):
    """Get hospitals with optional filtering"""
    
    if category == "custom":
        # Özel hastaneler ve sağlık merkezleri
        return HOSPITALS.get("custom", [])
    
    elif category == "zonguldak":
        # Zonguldak devlet hastaneleri + custom
        custom = HOSPITALS.get("custom", [])
        zonguldak = HOSPITALS.get("zonguldak_all", [])
        return custom + zonguldak
    
    elif q:
        # Autocomplete arama - tüm hastanelerde
        q_lower = q.lower()
        results = []
        
        # Önce custom (öncelikli)
        for h in HOSPITALS.get("custom", []):
            if q_lower in h.get("name", "").lower():
                results.append(h)
        
        # Sonra Zonguldak
        for h in HOSPITALS.get("zonguldak_all", []):
            if q_lower in h.get("name", "").lower():
                results.append(h)
        
        # Son olarak diğer iller
        if len(results) < 20:
            for h in HOSPITALS.get("all", []):
                if q_lower in h.get("name", "").lower():
                    if h not in results:  # Duplicate kontrolü
                        results.append(h)
                        if len(results) >= 20:
                            break
        
        return results[:20]
    
    else:
        # Varsayılan: Zonguldak hastaneleri
        custom = HOSPITALS.get("custom", [])
        zonguldak = HOSPITALS.get("zonguldak_all", [])
        return custom + zonguldak

@router.get("/hospitals/grouped")
async def get_hospitals_grouped():
    """Get hospitals grouped by category for dropdown"""
    
    # Zonguldak hastanelerini Turkey veritabanından al
    zonguldak_hospitals = HOSPITALS_TURKEY.get("hospitals_by_province", {}).get("Zonguldak", {})
    zonguldak_kamu = [{"name": h["name"], "type": h["original_type"]} for h in zonguldak_hospitals.get("kamu_universite", [])]
    zonguldak_ozel = [{"name": h["name"], "type": h["original_type"]} for h in zonguldak_hospitals.get("ozel", [])]
    
    return {
        "healmedy": [
            {"name": "HEALMEDY Filyos Sağlık Merkezi", "type": "ÖZEL SAĞLIK MERKEZİ"},
        ],
        "healmedy_bekleme_noktalari": [
            {"name": "Osman Gazi/FPU", "type": "BEKLEME NOKTASI"},
            {"name": "Green Zone/Rönesans", "type": "BEKLEME NOKTASI"},
            {"name": "Batı-Kuzey/İSG BİNA", "type": "BEKLEME NOKTASI"},
            {"name": "Red Zone/Kara Tesisleri", "type": "BEKLEME NOKTASI"},
            {"name": "Doğu Rıhtımı", "type": "BEKLEME NOKTASI"}
        ],
        "zonguldak_devlet": zonguldak_kamu,
        "zonguldak_ozel": zonguldak_ozel,
        "diger_iller": "autocomplete",  # Kullanıcı aratacak
        "provinces": HOSPITALS_TURKEY.get("provinces", []),
        "total_hospitals": HOSPITALS_TURKEY.get("total_hospitals", 0)
    }


@router.get("/hospitals/turkey/provinces")
async def get_turkey_provinces():
    """Tüm illeri listele"""
    return HOSPITALS_TURKEY.get("provinces", [])


@router.get("/hospitals/turkey/by-province/{province}")
async def get_hospitals_by_province(province: str, hospital_type: str = "all"):
    """
    Belirli bir ilin hastanelerini getir
    hospital_type: all, kamu_universite, ozel
    """
    hospitals_by_province = HOSPITALS_TURKEY.get("hospitals_by_province", {})
    province_hospitals = hospitals_by_province.get(province, {})
    
    if hospital_type == "kamu_universite":
        return province_hospitals.get("kamu_universite", [])
    elif hospital_type == "ozel":
        return province_hospitals.get("ozel", [])
    else:
        # Tümü
        kamu = province_hospitals.get("kamu_universite", [])
        ozel = province_hospitals.get("ozel", [])
        return kamu + ozel


@router.get("/hospitals/turkey/search")
async def search_turkey_hospitals(
    q: str = Query("", description="Hastane adı araması"),
    province: str = Query("", description="İl filtresi"),
    limit: int = Query(30, description="Maksimum sonuç sayısı")
):
    """
    Tüm Türkiye hastanelerinde arama yap
    """
    if len(q) < 2 and not province:
        return []
    
    q_lower = q.lower() if q else ""
    results = []
    hospitals_by_province = HOSPITALS_TURKEY.get("hospitals_by_province", {})
    
    # Belirli il seçildiyse sadece o ilde ara
    provinces_to_search = [province] if province else hospitals_by_province.keys()
    
    for prov in provinces_to_search:
        if prov not in hospitals_by_province:
            continue
            
        prov_hospitals = hospitals_by_province[prov]
        
        for h in prov_hospitals.get("kamu_universite", []):
            if q_lower in h["name"].lower():
                results.append({
                    "name": h["name"],
                    "type": h["original_type"],
                    "province": prov,
                    "category": "kamu_universite"
                })
                if len(results) >= limit:
                    return results
        
        for h in prov_hospitals.get("ozel", []):
            if q_lower in h["name"].lower():
                results.append({
                    "name": h["name"],
                    "type": h["original_type"],
                    "province": prov,
                    "category": "ozel"
                })
                if len(results) >= limit:
                    return results
    
    return results

