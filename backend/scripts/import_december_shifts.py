"""
Aralik 2024 Nobet Listesi Import Script
Tum personeli ve vardiyalari sisteme ekler
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "healmedy")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]
users_collection = db.users
vehicles_collection = db.vehicles
shift_assignments_collection = db.shift_assignments

# Rol eslesmeleri
ROLE_MAPPING = {
    "Dr.": "doktor",
    "Prm": "paramedik",
    "Prm.": "paramedik",
    "Tek.": "att",
    "Tek": "att",
    "S.P.": "att",
    "Src.": "sofor",
    "Src": "sofor",
    "Hem.": "hemsire",
    "Hem": "hemsire",
    "C.M.": "cagri_merkezi",
    "Ç.M.": "cagri_merkezi",
    "T.G.": "temizlik",
    "Asist.": "asistan",
    "D.A.": "asistan"
}

# Aralik 2024 nobet listesi (resimlerden cikarildi)
DECEMBER_SCHEDULE = {
    # SAGLIK MERKEZI
    "saglik_merkezi": {
        "vehicle_plate": None,  # Saglik merkezi - arac yok
        "location_type": "saglik_merkezi",
        "personnel": [
            {"role": "Dr.", "name": "Cansel Petek SAHIN", "shifts": [1,2,3,4,5,8,9,10,11,12,15,16,17,18,19,22,23,24,25,26,29,30,31]},
            {"role": "Dr.", "name": "Irem HODULLAR", "shifts": [1,2,3,4,5,8,9,10,11,12,15,16,17,18,19,22,23,24,25,26,29,30,31]},
            {"role": "Dr.", "name": "Baris VATANSEVER", "shifts": [6,7,13,14,20,21,27,28]},
            {"role": "Hem.", "name": "Umutcan OZDAL", "shifts": [1,2,5,6,9,10,13,14,17,18,21,22,25,26,29,30]},
            {"role": "Hem.", "name": "Nese VERIMCIK", "shifts": [3,4,7,8,11,12,15,16,19,20,23,24,27,28,31]},
            {"role": "Hem.", "name": "Emine KACAR", "shifts": [1,2,5,6,9,10,13,14,17,18,21,22,25,26,29,30]},
            {"role": "Hem.", "name": "Elif YILDIRIM", "shifts": [3,4,7,8,11,12,15,16,19,20,23,24,27,28,31]},
            {"role": "Hem.", "name": "Irem OZDEDE", "shifts": [1,2,5,6,9,10,13,14,17,18,21,22,25,26,29,30]},
            {"role": "Hem.", "name": "Muharrem Can CETINKAYA", "shifts": [3,4,7,8,11,12,15,16,19,20,23,24,27,28,31]},
            {"role": "Ç.M.", "name": "Merve GIRGIN", "shifts": [1,2,3,4,5,8,9,10,11,12,15,16,17,18,19,22,23,24,25,26,29,30,31]},
            {"role": "Ç.M.", "name": "Yasemin BASTURK", "shifts": [1,2,3,4,5,8,9,10,11,12,15,16,17,18,19,22,23,24,25,26,29,30,31]},
            {"role": "T.G.", "name": "Seniz KANDEMIR", "shifts": list(range(1,32))},
            {"role": "T.G.", "name": "Nuri ISIK", "shifts": list(range(1,32))},
        ]
    },
    
    # 06 CHZ 142 (9365)
    "06_CHZ_142": {
        "vehicle_plate": "06 CHZ 142",
        "station_code": "9365",
        "location_type": "arac",
        "personnel": [
            {"role": "Prm", "name": "Hatice Acar CANBAZ", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Prm", "name": "Aleyna OZDEMIR", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Prm", "name": "Hasan GUNEY", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Tek.", "name": "Mustafa KARAGOL", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Tek.", "name": "ATT1", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Tek.", "name": "Derya GOMLEKSIZOGLU", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Src.", "name": "Gorkem GURPUZER", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Src.", "name": "Mert CINAR", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Src.", "name": "Talha Dogukan KARTAL", "shifts": [3,6,9,12,15,18,21,24,27,30]},
        ]
    },
    
    # 06 CHZ 146 (9370)
    "06_CHZ_146": {
        "vehicle_plate": "06 CHZ 146",
        "station_code": "9370",
        "location_type": "arac",
        "personnel": [
            {"role": "Prm", "name": "Elif KURBAN", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Prm", "name": "Burak ILIK", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Prm", "name": "Busra Bahtiyar GUZEL", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Tek.", "name": "Berkecan TURPCU", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Tek.", "name": "Rumeysa UZUNAY", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Tek.", "name": "Serkan KAMIT", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Src.", "name": "Kubilay ELICORA", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Src.", "name": "Samet KOCAPINAR", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Src.", "name": "Oktay TUTUNCUOGLU", "shifts": [3,6,9,12,15,18,21,24,27,30]},
        ]
    },
    
    # 06 CHZ 149 (9375)
    "06_CHZ_149": {
        "vehicle_plate": "06 CHZ 149",
        "station_code": "9375",
        "location_type": "arac",
        "personnel": [
            {"role": "Prm", "name": "Aysegul Beyza YILMAZ", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Prm", "name": "Ugur VAR", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Prm", "name": "Mervenur GEDIK", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Tek.", "name": "Efe Talha AKKAS", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Tek.", "name": "Mugenur SOYKAN", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Tek.", "name": "Tayfun KOCAMAN", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Src.", "name": "Kadirhan ALKAN", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Src.", "name": "Emirhan DOGAN", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Src.", "name": "Melihcan DOGAN", "shifts": [3,6,9,12,15,18,21,24,27,30]},
        ]
    },
    
    # 34 FTU 336 (9360)
    "34_FTU_336": {
        "vehicle_plate": "34 FTU 336",
        "station_code": "9360",
        "location_type": "arac",
        "personnel": [
            {"role": "Prm", "name": "Nesrin TUYSUZ", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Prm", "name": "Gamze Hande BOZ", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Prm", "name": "Alican TULUBAS", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Tek.", "name": "Muzaffer OZCAN", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Tek.", "name": "Fatih MEKIKCI", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Tek.", "name": "Aysegul ORAL", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Src.", "name": "Serkna Bilal BATTAL", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Src.", "name": "Burak TIRYAKIOGLU", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Src.", "name": "Feyzi FIDAN", "shifts": [3,6,9,12,15,18,21,24,27,30]},
        ]
    },
    
    # 34 KMP 224 (9355)
    "34_KMP_224": {
        "vehicle_plate": "34 KMP 224",
        "station_code": "9355",
        "location_type": "arac",
        "personnel": [
            {"role": "Prm", "name": "Murat KESER", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Prm", "name": "Melike KARATEPE", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Prm", "name": "Burakcan SAHINTURK", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Tek.", "name": "Busra AYDEMIR", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Tek.", "name": "Muhammet BILICI", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Tek.", "name": "Asli KOCOGLU", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Src.", "name": "Onur YALIN", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Src.", "name": "Mehmetcan SAVLI", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Src.", "name": "Tuegay KOSE", "shifts": [3,6,9,12,15,18,21,24,27,30]},
        ]
    },
    
    # 34 MHA 112 (9356)
    "34_MHA_112": {
        "vehicle_plate": "34 MHA 112",
        "station_code": "9356",
        "location_type": "arac",
        "personnel": [
            {"role": "Prm", "name": "Kadir ARTAR", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Prm", "name": "Hamza Tarik ERMIS", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Prm", "name": "Buse TOPCU", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Tek.", "name": "Sule SATICI", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Tek.", "name": "Ceren YIGIT", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Tek.", "name": "Cem BALAT", "shifts": [3,6,9,12,15,18,21,24,27,30]},
            {"role": "Src.", "name": "Murat GULSEN", "shifts": [1,4,7,10,13,16,19,22,25,28,31]},
            {"role": "Src.", "name": "Anil BALCI", "shifts": [2,5,8,11,14,17,20,23,26,29]},
            {"role": "Src.", "name": "Mesut CINKAVUK", "shifts": [3,6,9,12,15,18,21,24,27,30]},
        ]
    },
}


def generate_email(name):
    """Isimden email olustur"""
    # Turkce karakterleri degistir
    tr_chars = {"ş": "s", "ğ": "g", "ü": "u", "ı": "i", "ö": "o", "ç": "c",
                "Ş": "S", "Ğ": "G", "Ü": "U", "İ": "I", "Ö": "O", "Ç": "C"}
    
    clean_name = name.lower()
    for tr, en in tr_chars.items():
        clean_name = clean_name.replace(tr, en)
    
    # Bosluk ve ozel karakterleri kaldir
    parts = clean_name.split()
    if len(parts) >= 2:
        email = f"{parts[0]}.{parts[-1]}@healmedy.com"
    else:
        email = f"{parts[0]}@healmedy.com"
    
    return email.replace(" ", "").lower()


def generate_password_hash():
    """Varsayilan sifre hash'i (123456)"""
    import hashlib
    return hashlib.sha256("123456".encode()).hexdigest()


async def get_or_create_user(name, role_abbr):
    """Kullaniciyi bul veya olustur"""
    role = ROLE_MAPPING.get(role_abbr, "att")
    email = generate_email(name)
    
    # Mevcut kullaniciyi ara
    existing = await users_collection.find_one({"email": email})
    if existing:
        print(f"  [MEVCUT] {name} -> {email}")
        return existing["_id"]
    
    # Yeni kullanici olustur
    user_id = str(uuid.uuid4())
    new_user = {
        "_id": user_id,
        "email": email,
        "name": name,
        "role": role,
        "password_hash": generate_password_hash(),
        "is_active": True,
        "phone": "",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await users_collection.insert_one(new_user)
    print(f"  [YENI] {name} -> {email} (rol: {role})")
    return user_id


async def get_vehicle_id(plate):
    """Arac ID'sini bul veya olustur"""
    if not plate:
        return None
    
    vehicle = await vehicles_collection.find_one({"plate": plate})
    if vehicle:
        return vehicle["_id"]
    
    # Arac yoksa olustur
    vehicle_id = str(uuid.uuid4())
    new_vehicle = {
        "_id": vehicle_id,
        "plate": plate,
        "type": "ambulans",
        "status": "musait",
        "km": 0,
        "qr_code": str(uuid.uuid4()),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    await vehicles_collection.insert_one(new_vehicle)
    print(f"  [YENI ARAC] {plate}")
    return vehicle_id


async def create_shift_assignment(user_id, vehicle_id, shift_date, location_type, health_center_name=None):
    """Vardiya atamasi olustur"""
    assignment_id = str(uuid.uuid4())
    
    # Ayni gun ayni kullanici icin kontrol et
    existing = await shift_assignments_collection.find_one({
        "user_id": user_id,
        "shift_date": shift_date
    })
    
    if existing:
        return False  # Zaten var
    
    assignment = {
        "_id": assignment_id,
        "user_id": user_id,
        "vehicle_id": vehicle_id,
        "shift_date": shift_date,
        "start_time": "08:00",
        "end_time": "20:00",
        "location_type": location_type,
        "health_center_name": health_center_name,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    
    await shift_assignments_collection.insert_one(assignment)
    return True


async def import_december_shifts():
    """Aralik 2024 vardiyalarini import et"""
    print("=" * 60)
    print("ARALIK 2024 NOBET LISTESI IMPORT")
    print("=" * 60)
    
    total_users = 0
    total_shifts = 0
    
    for location_key, location_data in DECEMBER_SCHEDULE.items():
        print(f"\n--- {location_key} ---")
        
        vehicle_plate = location_data.get("vehicle_plate")
        location_type = location_data.get("location_type", "arac")
        health_center_name = None
        
        if location_type == "saglik_merkezi":
            health_center_name = "Filyos Saglik Merkezi"
        
        # Arac ID'sini al
        vehicle_id = await get_vehicle_id(vehicle_plate) if vehicle_plate else None
        
        for person in location_data["personnel"]:
            role = person["role"]
            name = person["name"]
            shifts = person["shifts"]
            
            # Kullaniciyi bul veya olustur
            user_id = await get_or_create_user(name, role)
            total_users += 1
            
            # Her vardiya gunu icin atama olustur
            shift_count = 0
            for day in shifts:
                shift_date = datetime(2024, 12, day)
                created = await create_shift_assignment(
                    user_id=user_id,
                    vehicle_id=vehicle_id,
                    shift_date=shift_date,
                    location_type=location_type,
                    health_center_name=health_center_name
                )
                if created:
                    shift_count += 1
                    total_shifts += 1
            
            if shift_count > 0:
                print(f"    -> {shift_count} vardiya atandi")
    
    print("\n" + "=" * 60)
    print(f"TOPLAM: {total_users} personel, {total_shifts} vardiya atamasi")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(import_december_shifts())

