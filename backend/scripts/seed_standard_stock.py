"""
Standart Stok Listesi Seed Script
Tüm ambulans ve bekleme noktalarına standart stok listesi ekler.
"""

import json
import os
from datetime import datetime, timedelta
import uuid
from database import db, vehicles_collection

# Collections
stock_collection = db.stock
stock_locations_collection = db.stock_locations

# JSON dosyasını yükle
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, '..', 'data', 'standard_stock_list.json')


def load_standard_stock_list():
    """JSON'dan standart stok listesini yükle"""
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


async def get_all_locations():
    """Tüm lokasyonları getir (araçlar + bekleme noktaları)"""
    locations = []
    
    # Araçları al
    vehicles = await vehicles_collection.find({"type": "ambulans"}).to_list(100)
    for v in vehicles:
        locations.append({
            "id": f"vehicle_{v.get('_id')}",
            "name": v.get("plate", ""),
            "type": "vehicle",
            "vehicle_id": v.get("_id")
        })
    
    # Bekleme noktaları (stock_locations'tan)
    stock_locs = await stock_locations_collection.find({
        "is_active": True,
        "type": {"$in": ["waiting_point", "healmedy"]}
    }).to_list(100)
    
    for loc in stock_locs:
        locations.append({
            "id": loc.get("_id"),
            "name": loc.get("name", ""),
            "type": "waiting_point"
        })
    
    # Merkez Depo ekle
    locations.append({
        "id": "merkez_depo",
        "name": "Merkez Depo",
        "type": "warehouse"
    })
    
    return locations


async def add_stock_to_location(location, items, user_id="system"):
    """Bir lokasyona stok listesi ekle"""
    turkey_now = datetime.utcnow() + timedelta(hours=3)
    added_count = 0
    updated_count = 0
    
    for item in items:
        # Aynı ürün bu lokasyonda var mı kontrol et
        existing = await stock_collection.find_one({
            "name": item["name"],
            "location": location["name"]
        })
        
        if existing:
            # Varsa miktarı güncelle (sadece min_quantity'den az ise)
            current_qty = existing.get("quantity", 0)
            if current_qty < item["quantity"]:
                await stock_collection.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "quantity": item["quantity"],
                        "min_quantity": item["quantity"],
                        "updated_at": turkey_now
                    }}
                )
                updated_count += 1
        else:
            # Yoksa yeni ekle
            stock_item = {
                "_id": str(uuid.uuid4()),
                "name": item["name"],
                "quantity": item["quantity"],
                "min_quantity": item["quantity"],  # Standart miktar aynı zamanda minimum
                "unit": item.get("unit", "ADET"),
                "category": item.get("category", "sarf"),
                "location": location["name"],
                "location_type": location["type"],
                "vehicle_id": location.get("vehicle_id"),
                "is_standard_item": True,  # Standart listeden geldiğini işaretle
                "created_at": turkey_now,
                "created_by": user_id
            }
            await stock_collection.insert_one(stock_item)
            added_count += 1
    
    return added_count, updated_count


async def seed_standard_stock():
    """Ana seed fonksiyonu"""
    # Standart stok listesini yükle
    stock_data = load_standard_stock_list()
    
    # Tüm lokasyonları al
    locations = await get_all_locations()
    
    results = {
        "locations_processed": 0,
        "items_added": 0,
        "items_updated": 0,
        "details": []
    }
    
    for location in locations:
        loc_name = location["name"]
        loc_type = location["type"]
        
        # Lokasyon tipine göre hangi stok listesini kullanacağını belirle
        items_to_add = []
        
        if loc_type == "vehicle":
            # Ambulanslara: ambulans_stok + canlandirma_cantasi + ilac_cantasi
            items_to_add.extend(stock_data.get("ambulans_stok", []))
            items_to_add.extend(stock_data.get("canlandirma_cantasi", []))
            items_to_add.extend(stock_data.get("ilac_cantasi", []))
        elif loc_type in ["waiting_point", "healmedy"]:
            # Bekleme noktaları/Revir: revir_stok + revir_ilac
            items_to_add.extend(stock_data.get("revir_stok", []))
            items_to_add.extend(stock_data.get("revir_ilac", []))
        elif loc_type == "warehouse":
            # Merkez Depo: Tüm liste (daha yüksek miktarlarla)
            all_items = []
            for key in ["revir_stok", "revir_ilac", "ambulans_stok", "canlandirma_cantasi", "ilac_cantasi"]:
                for item in stock_data.get(key, []):
                    # Depo için miktarları 3 katına çıkar
                    warehouse_item = item.copy()
                    warehouse_item["quantity"] = item["quantity"] * 3
                    all_items.append(warehouse_item)
            
            # Benzersiz ürünleri birleştir (aynı isimli ürünlerin miktarlarını topla)
            unique_items = {}
            for item in all_items:
                name = item["name"]
                if name in unique_items:
                    unique_items[name]["quantity"] += item["quantity"]
                else:
                    unique_items[name] = item.copy()
            
            items_to_add = list(unique_items.values())
        
        if items_to_add:
            added, updated = await add_stock_to_location(location, items_to_add)
            results["items_added"] += added
            results["items_updated"] += updated
            results["locations_processed"] += 1
            results["details"].append({
                "location": loc_name,
                "type": loc_type,
                "added": added,
                "updated": updated
            })
    
    return results


# Standalone çalıştırma için
if __name__ == "__main__":
    import asyncio
    
    async def main():
        print("Standart stok listesi yükleniyor...")
        result = await seed_standard_stock()
        print(f"Sonuç: {result}")
    
    asyncio.run(main())
