"""
Seed script for adding 111 medications/materials to stock
Run: python seed_medications.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
db_name = os.environ.get('DB_NAME', 'healmedy_hbys')

# 111 medications/materials list
MEDICATIONS = [
    "HEKSOBEN SPREY/OROHEKS",
    "PLANOR TABLET/OPİREL",
    "DOPASEL",
    "COVİD-19 TEST",
    "ATA FLOR",
    "PAROL ŞURUP/CARPOL",
    "DOLVEN ŞURUP",
    "GAVİSCON ŞURUP/PRONAT",
    "RONKOTOL NEBÜL",
    "CORTAİR NEBÜL",
    "İPRASAL",
    "ASİST PLUS",
    "DİGOXİN",
    "TOBRASED--OBRAMIS",
    "SİPROGUT",
    "GENTAGUT DAMLA",
    "İESPOR/BEFAZOL",
    "PRİCAİN",
    "PULCET/PROTAZ FLAKON",
    "MACROL/KLAMAXİN/KLAROMİN",
    "PREDNOL-METİCURE-TREDISON",
    "JETOKAİN",
    "VENTOLİN PUF",
    "ATROPİN",
    "SERUM FİZYOLİJİK",
    "MAGNEZYUM SÜLFAT",
    "CALCİUM",
    "SODYUM BİKARBONAT",
    "ADRENALİN 1 ML",
    "ADRENALİN 0,5 ML",
    "METLOC",
    "DEKORT",
    "NEVPARİN/POLİPARİN",
    "LEVETAM",
    "ARİTMAL",
    "LARGACTİL",
    "FUROJECT-FUROSEMİD-URADEX-LASİX",
    "DİLTİZEM",
    "XEMOL",
    "RİF",
    "DİKLORAN AMPUL",
    "METPAMİD AMPUL/VOMEPRAM",
    "AVİL AMPUL/CAUPHE",
    "BEMİKS",
    "MUSCOFLEX AMPUL",
    "VERAPAMİL--İSOPTİN AMPUL",
    "İBURAMİN ZERO TABLET",
    "CİPRO TABLET/CİPRASİD",
    "FLAGYL TABLET",
    "BETASERC 24 MG TABLET",
    "NOOTROPİL AMPUL",
    "OKSAMEN-L/TEXONİM FLAKON",
    "ZOFER AMPUL/OSETRON",
    "PARANOX-S FİTİL",
    "ALLERGODİL GÖZ DAMLASI",
    "NOVALGİN AMPUL",
    "ARVELES AMPUL/LEODEX",
    "DİKLORAN TABLET/ZERO-P/DEXOFEN",
    "KLAVUNAT/CROXİLEX/AMOKLAVİN/KLAMOKS",
    "RENNİE/GAVİSCON TAB.",
    "AVİL TABLET",
    "CORASPİN TABLET",
    "NORVASC TABLET/VAZKOR",
    "KAPRİL TABLET/KAPTORİL",
    "TYLOL TABLET--PAROL",
    "PANTO TABLET/PANOCER",
    "METPAMİD TABLET",
    "MUSCOFLEX TABLET",
    "THERAFLU TABLET/COLDAWAY",
    "İSORDİL TABLET",
    "NİTROLİNGUAL SPRAY",
    "DEXTROCİN KREM/FUROCİN/BACMİRPİ-ANTİMİKROBİYAL",
    "SİLVERDİN KREM",
    "REDEKAİN KREM",
    "AVİL MERHEM",
    "MADECASSOL POMAD",
    "DİCLATİVE KREM/ANALJEZİK",
    "GLUCAGEN/HUMULİN-R",
    "ENOX",
    "SEDOZOLAM",
    "ANESED-R/ANEXATE",
    "DİAZEM",
    "NORODOL",
    "PAROL FLAKON",
    "500 CC İZOTONİK",
    "250 CC İZOTONİK",
    "1000 CC İZOTONİK",
    "150 CC İZOTONİK",
    "100 CC İZOTONİK",
    "LAKTATLI RİNGER",
    "İZOLEN DENGELİ 500 cc",
    "MANNİTOL 500 cc",
    "İZOLEN S 500 cc",
    "TEOSEL",
    "%20 DEKSTROZ 150 CC",
    "%10 DEKSTROZ 250 CC",
    "%5 DEKSTROZ 150 CC",
    "AMİODARON",
    "NALOKSAN AMPUL",
    "KARBETOSİN FLAKON",
    "NİFEDİPİN KAPSÜL/NİDİCARD",
    "FENTANİL AMPUL",
    "ADENOZİN AMPUL",
    "TD-VAC/TETANOZ",
    "İZOLEKS-P 500 cc",
    "%10 DEKSTROZ 500 CC",
    "%20 DEKSTROZ 500 CC",
    "DRAMAMİNE",
    "ANTİOKSİ-C",
    "TRANSEMİNE AMPUL"
]

async def seed_medications():
    """Add all medications to stock collection"""
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    stock_collection = db.stock
    
    print(f"Connected to database: {db_name}")
    print(f"Adding {len(MEDICATIONS)} medications...")
    
    added = 0
    skipped = 0
    
    for med_name in MEDICATIONS:
        # Check if already exists
        existing = await stock_collection.find_one({"name": med_name})
        if existing:
            print(f"  [SKIP] {med_name} already exists")
            skipped += 1
            continue
        
        # Generate code from name
        code = med_name[:8].upper().replace("/", "").replace("-", "").replace(" ", "")[:8]
        
        # Determine unit based on name
        unit = "adet"
        if "TABLET" in med_name or "TAB" in med_name:
            unit = "tablet"
        elif "AMPUL" in med_name:
            unit = "ampul"
        elif "FLAKON" in med_name:
            unit = "flakon"
        elif "SPREY" in med_name or "SPRAY" in med_name:
            unit = "sprey"
        elif "ŞURUP" in med_name:
            unit = "ml"
        elif "KREM" in med_name or "MERHEM" in med_name or "POMAD" in med_name:
            unit = "tup"
        elif "CC" in med_name or "cc" in med_name:
            unit = "cc"
        elif "DAMLA" in med_name:
            unit = "ml"
        elif "FİTİL" in med_name:
            unit = "adet"
        elif "NEBÜL" in med_name:
            unit = "adet"
        elif "PUF" in med_name:
            unit = "adet"
        
        item = {
            "_id": str(uuid.uuid4()),
            "name": med_name,
            "code": code,
            "gtin": None,
            "quantity": 10,  # Default starting quantity
            "min_quantity": 5,  # Default minimum
            "location": "merkez_depo",  # Default location
            "location_detail": None,
            "lot_number": None,
            "serial_number": None,
            "expiry_date": None,
            "qr_code": str(uuid.uuid4()),
            "unit": unit,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        await stock_collection.insert_one(item)
        print(f"  [ADD] {med_name} ({unit})")
        added += 1
    
    print(f"\nDone! Added: {added}, Skipped: {skipped}")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_medications())

