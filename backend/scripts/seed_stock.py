# -*- coding: utf-8 -*-
"""
Stok Test Verisi Seed Script
- Tum stoklari sil
- Lokasyonlara rastgele urun ekle (hem kutu hem adet bazli)
"""
import asyncio
import sys
import os
import random
from datetime import datetime, timedelta
import uuid

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db

# Collections
barcode_stock_collection = db["barcode_stock"]
stock_collection = db["stock"]
unit_stock_collection = db["unit_stock"]  # Adet bazli stok

# Lokasyonlar - Gercek sistem lokasyonlari
LOCATIONS = [
    # Sabit Lokasyonlar
    {"id": "merkez_depo", "name": "Merkez Depo", "type": "depo"},
    {"id": "saglik_merkezi", "name": "Saglik Merkezi", "type": "saglik_merkezi"},
    
    # Araclar (gercek plakalar)
    {"id": "ambulans_34_mha_112", "name": "34 MHA 112", "type": "ambulans"},
    {"id": "ambulans_34_ftu_336", "name": "34 FTU 336", "type": "ambulans"},
    {"id": "ambulans_06_chz_146", "name": "06 CHZ 146", "type": "ambulans"},
    
    # Saha Ici Noktalar (Healmedy lokasyonlari)
    {"id": "osman_gazi_fpu", "name": "Osman Gazi/FPU", "type": "saha"},
    {"id": "green_zone_ronesans", "name": "Green Zone/Ronesans", "type": "saha"},
    {"id": "bati_kuzey_isg", "name": "Bati-Kuzey/ISG BINA", "type": "saha"},
    {"id": "red_zone_kara", "name": "Red Zone/Kara Tesisleri", "type": "saha"},
    {"id": "dogu_rihtimi", "name": "Dogu Rihtimi", "type": "saha"},
    {"id": "filyos_saglik_merkezi", "name": "Filyos Saglik Merkezi", "type": "saha"},
]

# Ilaclar (Kutu bazli - karekodlu)
MEDICATIONS = [
    {"name": "Adrenalin 1mg/1ml Ampul", "gtin": "8699508090123", "manufacturer": "Adeka", "category": "ilac", "unit_count": 10},
    {"name": "Parol 500mg Tablet", "gtin": "8699502011234", "manufacturer": "Atabay", "category": "ilac", "unit_count": 20},
    {"name": "Majezik 100mg Film Tablet", "gtin": "8699536090234", "manufacturer": "Sanovel", "category": "ilac", "unit_count": 30},
    {"name": "Novalgin 500mg Ampul", "gtin": "8699508095678", "manufacturer": "Sanofi", "category": "ilac", "unit_count": 5},
    {"name": "Lasix 20mg Ampul", "gtin": "8699508091234", "manufacturer": "Sanofi", "category": "ilac", "unit_count": 5},
    {"name": "Atropin 0.5mg Ampul", "gtin": "8699508092345", "manufacturer": "Adeka", "category": "ilac", "unit_count": 10},
    {"name": "Diazem 10mg Ampul", "gtin": "8699508093456", "manufacturer": "Deva", "category": "ilac", "unit_count": 5},
    {"name": "Ventolin Nebul", "gtin": "8699522094567", "manufacturer": "GSK", "category": "ilac", "unit_count": 20},
    {"name": "Ketalar 500mg Flakon", "gtin": "8699508095678", "manufacturer": "Pfizer", "category": "ilac", "unit_count": 1},
    {"name": "Morphine 10mg Ampul", "gtin": "8699508096789", "manufacturer": "Galen", "category": "ilac", "unit_count": 10},
    {"name": "Lidocaine 2% Ampul", "gtin": "8699508097890", "manufacturer": "Adeka", "category": "ilac", "unit_count": 10},
    {"name": "Serum Fizyolojik 1000ml", "gtin": "8699508098901", "manufacturer": "Polifarma", "category": "ilac", "unit_count": 1},
    {"name": "Serum Fizyolojik 100ml", "gtin": "8699508099012", "manufacturer": "Polifarma", "category": "ilac", "unit_count": 1},
    {"name": "Dextrose %5 500ml", "gtin": "8699508100123", "manufacturer": "Eczacibasi", "category": "ilac", "unit_count": 1},
]

# Itriyat
ITRIYAT = [
    {"name": "El Dezenfektani 500ml", "code": "ITR001", "category": "itriyat"},
    {"name": "Yara Bakim Seti", "code": "ITR002", "category": "itriyat"},
    {"name": "Steril Gazli Bez 10x10", "code": "ITR003", "category": "itriyat"},
    {"name": "Flaster 5mx2.5cm", "code": "ITR004", "category": "itriyat"},
    {"name": "Pamuk 100gr", "code": "ITR005", "category": "itriyat"},
    {"name": "Alkol 100ml", "code": "ITR006", "category": "itriyat"},
    {"name": "Batikon 100ml", "code": "ITR007", "category": "itriyat"},
    {"name": "Oksijenli Su 100ml", "code": "ITR008", "category": "itriyat"},
]

# Sarf Malzemeleri
SARF = [
    {"name": "Eldiven (M) 100lu", "code": "SRF001", "category": "sarf"},
    {"name": "Eldiven (L) 100lu", "code": "SRF002", "category": "sarf"},
    {"name": "Maske N95", "code": "SRF003", "category": "sarf"},
    {"name": "Cerrahi Maske 50li", "code": "SRF004", "category": "sarf"},
    {"name": "Enjektör 5ml", "code": "SRF005", "category": "sarf"},
    {"name": "Enjektör 10ml", "code": "SRF006", "category": "sarf"},
    {"name": "IV Kateter 20G", "code": "SRF007", "category": "sarf"},
    {"name": "IV Kateter 22G", "code": "SRF008", "category": "sarf"},
    {"name": "Serum Seti", "code": "SRF009", "category": "sarf"},
    {"name": "Oksijen Maskesi", "code": "SRF010", "category": "sarf"},
    {"name": "Ambu Balon", "code": "SRF011", "category": "sarf"},
    {"name": "Laringoskop Blade", "code": "SRF012", "category": "sarf"},
]


def generate_serial():
    """Benzersiz seri numarasi olustur"""
    return f"SN{datetime.now().strftime('%Y%m%d')}{random.randint(100000, 999999)}"


def generate_lot():
    """Lot numarasi olustur"""
    return f"LOT{random.randint(1000, 9999)}"


def generate_expiry():
    """Son kullanma tarihi olustur (1-24 ay arasi)"""
    months = random.randint(1, 24)
    return datetime.now() + timedelta(days=months * 30)


async def clear_all_stock():
    """Tum stoklari sil"""
    result1 = await barcode_stock_collection.delete_many({})
    result2 = await stock_collection.delete_many({})
    result3 = await unit_stock_collection.delete_many({})
    
    print(f"Silinen karekod stok: {result1.deleted_count}")
    print(f"Silinen genel stok: {result2.deleted_count}")
    print(f"Silinen adet bazli stok: {result3.deleted_count}")


async def seed_barcode_stock():
    """Karekod bazli ilac stoku ekle"""
    count = 0
    
    for location in LOCATIONS:
        # Her lokasyona 3-8 farkli ilac
        selected_meds = random.sample(MEDICATIONS, random.randint(3, min(8, len(MEDICATIONS))))
        
        for med in selected_meds:
            # Her ilactan 1-5 kutu
            box_count = random.randint(1, 5)
            
            for _ in range(box_count):
                stock_id = str(uuid.uuid4())
                expiry = generate_expiry()
                
                stock_item = {
                    "_id": stock_id,
                    "gtin": med["gtin"],
                    "serial_number": generate_serial(),
                    "lot_number": generate_lot(),
                    "expiry_date": expiry,
                    "expiry_date_str": expiry.strftime("%y%m%d"),
                    "name": med["name"],
                    "manufacturer_name": med["manufacturer"],
                    "category": med["category"],
                    "unit_count": med["unit_count"],  # Kutudaki adet
                    "remaining_units": med["unit_count"],  # Kalan adet
                    "is_opened": False,  # Kutu acildi mi
                    "location": location["id"],
                    "location_name": location["name"],
                    "location_type": location["type"],
                    "status": "available",
                    "added_at": datetime.utcnow(),
                    "added_by": "system_seed",
                    "added_by_name": "Sistem",
                    "raw_barcode": f"01{med['gtin']}21{generate_serial()}10{generate_lot()}17{expiry.strftime('%y%m%d')}"
                }
                
                await barcode_stock_collection.insert_one(stock_item)
                count += 1
    
    print(f"Eklenen karekod stok (kutu): {count}")
    return count


async def seed_unit_stock():
    """Adet bazli acilmis ilac stoku ekle"""
    count = 0
    
    # Sadece unit_count > 1 olan ilaclari filtrele
    multi_unit_meds = [m for m in MEDICATIONS if m["unit_count"] > 1]
    
    # Bazi lokasyonlara acilmis ilac ekle
    for location in LOCATIONS[:4]:  # Sadece ilk 4 lokasyona
        selected_meds = random.sample(multi_unit_meds, random.randint(2, min(4, len(multi_unit_meds))))
        
        for med in selected_meds:
            # Acilmis kutudan kalan adet
            remaining = random.randint(1, med["unit_count"] - 1)
            
            unit_stock = {
                "_id": str(uuid.uuid4()),
                "gtin": med["gtin"],
                "name": med["name"],
                "manufacturer_name": med["manufacturer"],
                "category": "ilac_adet",  # Adet bazli ilac
                "original_unit_count": med["unit_count"],
                "remaining_units": remaining,
                "lot_number": generate_lot(),
                "expiry_date": generate_expiry(),
                "location": location["id"],
                "location_name": location["name"],
                "location_type": location["type"],
                "status": "opened",  # Acilmis
                "opened_at": datetime.utcnow() - timedelta(days=random.randint(1, 10)),
                "opened_by": "system_seed",
                "opened_by_name": "Sistem",
                "added_at": datetime.utcnow(),
            }
            
            await unit_stock_collection.insert_one(unit_stock)
            count += 1
    
    print(f"Eklenen adet bazli stok: {count}")
    return count


async def seed_itriyat_stock():
    """Itriyat stoku ekle"""
    count = 0
    
    for location in LOCATIONS:
        # Her lokasyona 3-6 itriyat
        selected = random.sample(ITRIYAT, random.randint(3, min(6, len(ITRIYAT))))
        
        for item in selected:
            quantity = random.randint(5, 50)
            
            stock_item = {
                "_id": str(uuid.uuid4()),
                "code": item["code"],
                "name": item["name"],
                "category": "itriyat",
                "quantity": quantity,
                "min_quantity": 5,
                "location": location["id"],
                "location_name": location["name"],
                "location_type": location["type"],
                "status": "available",
                "added_at": datetime.utcnow(),
                "added_by": "system_seed",
            }
            
            await stock_collection.insert_one(stock_item)
            count += 1
    
    print(f"Eklenen itriyat stok: {count}")
    return count


async def seed_sarf_stock():
    """Sarf malzemesi stoku ekle"""
    count = 0
    
    for location in LOCATIONS:
        # Her lokasyona 4-8 sarf malzemesi
        selected = random.sample(SARF, random.randint(4, min(8, len(SARF))))
        
        for item in selected:
            quantity = random.randint(10, 100)
            
            stock_item = {
                "_id": str(uuid.uuid4()),
                "code": item["code"],
                "name": item["name"],
                "category": "sarf",
                "quantity": quantity,
                "min_quantity": 10,
                "location": location["id"],
                "location_name": location["name"],
                "location_type": location["type"],
                "status": "available",
                "added_at": datetime.utcnow(),
                "added_by": "system_seed",
            }
            
            await stock_collection.insert_one(stock_item)
            count += 1
    
    print(f"Eklenen sarf stok: {count}")
    return count


async def main():
    """Ana fonksiyon"""
    print("=" * 50)
    print("STOK SEED SCRIPT BASLATILIYOR")
    print("=" * 50)
    
    # 1. Tum stoklari sil
    print("\n1. Mevcut stoklar siliniyor...")
    await clear_all_stock()
    
    # 2. Karekod bazli ilac stoku ekle
    print("\n2. Karekod bazli ilac stoku ekleniyor...")
    barcode_count = await seed_barcode_stock()
    
    # 3. Adet bazli acilmis ilac stoku ekle
    print("\n3. Adet bazli acilmis ilac stoku ekleniyor...")
    unit_count = await seed_unit_stock()
    
    # 4. Itriyat stoku ekle
    print("\n4. Itriyat stoku ekleniyor...")
    itriyat_count = await seed_itriyat_stock()
    
    # 5. Sarf malzemesi stoku ekle
    print("\n5. Sarf malzemesi stoku ekleniyor...")
    sarf_count = await seed_sarf_stock()
    
    print("\n" + "=" * 50)
    print("SEED TAMAMLANDI")
    print(f"Toplam Karekod Stok (Kutu): {barcode_count}")
    print(f"Toplam Adet Bazli Stok: {unit_count}")
    print(f"Toplam Itriyat Stok: {itriyat_count}")
    print(f"Toplam Sarf Stok: {sarf_count}")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())

