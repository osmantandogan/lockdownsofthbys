"""
Tum lokasyonlara ornek stok ekleyen script
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import uuid
import os
import random
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "healmedy")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]
stock_collection = db.stock
stock_locations_collection = db.stock_locations
vehicles_collection = db.vehicles

# Ornek ilaclar
SAMPLE_MEDICATIONS = [
    {"name": "Parasetamol 500mg", "code": "PAR500", "min_quantity": 10, "category": "ilac"},
    {"name": "Ibuprofen 400mg", "code": "IBU400", "min_quantity": 10, "category": "ilac"},
    {"name": "Adrenalin 1mg/ml", "code": "ADR001", "min_quantity": 5, "category": "ilac"},
    {"name": "Serum Fizyolojik 500ml", "code": "SF500", "min_quantity": 20, "category": "ilac"},
    {"name": "Midazolam 5mg/ml", "code": "MID005", "min_quantity": 3, "category": "ilac"},
    {"name": "Morfin 10mg/ml", "code": "MOR010", "min_quantity": 2, "category": "ilac"},
    {"name": "Aspirin 100mg", "code": "ASP100", "min_quantity": 15, "category": "ilac"},
    {"name": "Diklofenak 75mg", "code": "DIK075", "min_quantity": 10, "category": "ilac"},
    {"name": "Ondansetron 4mg", "code": "OND004", "min_quantity": 8, "category": "ilac"},
    {"name": "Metoklopramid 10mg", "code": "MET010", "min_quantity": 10, "category": "ilac"},
]

# Ornek itriyat
SAMPLE_ITRIYAT = [
    {"name": "Eldiven (M)", "code": "ELD-M", "min_quantity": 50, "category": "itriyat"},
    {"name": "Eldiven (L)", "code": "ELD-L", "min_quantity": 50, "category": "itriyat"},
    {"name": "Maske N95", "code": "MSK-N95", "min_quantity": 30, "category": "itriyat"},
    {"name": "Maske Cerrahi", "code": "MSK-CRR", "min_quantity": 100, "category": "itriyat"},
    {"name": "Dezenfektan 500ml", "code": "DEZ500", "min_quantity": 10, "category": "itriyat"},
    {"name": "El Antiseptigi 100ml", "code": "ANT100", "min_quantity": 20, "category": "itriyat"},
]

# Ornek sarf malzeme
SAMPLE_SARF = [
    {"name": "Gazli Bez 10x10", "code": "GZB-10", "min_quantity": 100, "category": "diger"},
    {"name": "Flaster 2.5cm", "code": "FLS-25", "min_quantity": 20, "category": "diger"},
    {"name": "Sargı Bezi 10cm", "code": "SRG-10", "min_quantity": 30, "category": "diger"},
    {"name": "IV Kateter 18G", "code": "IVK-18", "min_quantity": 50, "category": "diger"},
    {"name": "IV Kateter 20G", "code": "IVK-20", "min_quantity": 50, "category": "diger"},
    {"name": "Enjektör 5ml", "code": "ENJ-05", "min_quantity": 100, "category": "diger"},
    {"name": "Enjektör 10ml", "code": "ENJ-10", "min_quantity": 80, "category": "diger"},
    {"name": "Serum Seti", "code": "SRM-SET", "min_quantity": 30, "category": "diger"},
]


async def seed_sample_stock():
    """Tum lokasyonlara ornek stok ekle"""
    print("=" * 60)
    print("ORNEK STOK EKLEME")
    print("=" * 60)
    
    # Onceki stoklari temizle
    delete_result = await stock_collection.delete_many({})
    print(f"Onceki stoklar silindi: {delete_result.deleted_count}")
    
    # Lokasyonlari al
    locations = await stock_locations_collection.find({"is_active": True}).to_list(100)
    print(f"Bulunan lokasyon sayisi: {len(locations)}")
    
    if len(locations) == 0:
        # Lokasyon yoksa olustur
        print("Lokasyon bulunamadi, olusturuluyor...")
        
        # Merkez Depo
        await stock_locations_collection.insert_one({
            "_id": str(uuid.uuid4()),
            "name": "Merkez Depo",
            "type": "warehouse",
            "is_active": True,
            "created_at": datetime.utcnow()
        })
        
        # Araclar
        vehicles = await vehicles_collection.find({}).to_list(100)
        for v in vehicles:
            await stock_locations_collection.insert_one({
                "_id": str(uuid.uuid4()),
                "name": v.get("plate"),
                "type": "vehicle",
                "vehicle_id": v.get("_id"),
                "is_active": True,
                "created_at": datetime.utcnow()
            })
        
        locations = await stock_locations_collection.find({"is_active": True}).to_list(100)
        print(f"Olusturulan lokasyon sayisi: {len(locations)}")
    
    total_stock = 0
    
    for loc in locations:
        loc_name = loc.get("name")
        loc_type = loc.get("type", "unknown")
        
        print(f"\n--- {loc_name} ({loc_type}) ---")
        
        # Her lokasyona rastgele stok ekle
        all_items = SAMPLE_MEDICATIONS + SAMPLE_ITRIYAT + SAMPLE_SARF
        
        # Merkez depoya daha fazla stok
        if loc_type == "warehouse":
            items_to_add = all_items
            quantity_multiplier = 5
        else:
            # Diger lokasyonlara rastgele secim
            items_to_add = random.sample(all_items, min(len(all_items), random.randint(8, 15)))
            quantity_multiplier = 1
        
        for item in items_to_add:
            quantity = random.randint(item["min_quantity"], item["min_quantity"] * 3) * quantity_multiplier
            
            # SKT rastgele (1 ay - 2 yil arasi)
            expiry_days = random.randint(30, 730)
            expiry_date = datetime.utcnow() + timedelta(days=expiry_days)
            
            # Bazi urunlerin SKT'si gecmis olsun (test icin)
            if random.random() < 0.1:  # %10 ihtimalle
                expiry_date = datetime.utcnow() - timedelta(days=random.randint(1, 30))
            
            stock_item = {
                "_id": str(uuid.uuid4()),
                "name": item["name"],
                "code": item["code"],
                "quantity": quantity,
                "min_quantity": item["min_quantity"],
                "location": loc_name,
                "category": item["category"],
                "lot_number": f"LOT{random.randint(10000, 99999)}",
                "expiry_date": expiry_date,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await stock_collection.insert_one(stock_item)
            total_stock += 1
            print(f"  + {item['name']}: {quantity} adet")
    
    print("\n" + "=" * 60)
    print(f"TOPLAM: {total_stock} stok kalemi eklendi")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_sample_stock())

