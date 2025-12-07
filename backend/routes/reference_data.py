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

# Cache data in memory
ICD_CODES = load_icd_codes()
HOSPITALS = load_hospitals()

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
    return {
        "healmedy": [
            {"name": "HEALMEDY Filyos Sağlık Merkezi", "type": "ÖZEL SAĞLIK MERKEZİ"},
            {"name": "Filyos Sağlık Merkezi Saha Ambulans Bekleme Noktaları", "type": "AMBULANS NOKTASI"}
        ],
        "ozel_hastaneler": [
            {"name": "Özel Level Hospital", "type": "ÖZEL HASTANE"},
            {"name": "Özel Ereğli Echomar Hastanesi", "type": "ÖZEL HASTANE"},
            {"name": "Özel Ereğli Anadolu Hastanesi", "type": "ÖZEL HASTANE"}
        ],
        "devlet_hastaneleri": HOSPITALS.get("zonguldak_all", []),
        "diger_iller": "autocomplete"  # Kullanıcı aratacak
    }

