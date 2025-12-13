#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Araclara istasyon kodlarini ekleyen script
06 CHZ 142 (9365), 06 CHZ 146 (9370), 06 CHZ 149 (9375), 
34 FTU 336 (9360), 34 KMP 224 (9355), 34 MHA 112 (9356)
"""

import asyncio
import sys
import os

# Backend root'a ekle
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import vehicles_collection

# Istasyon kodlari - plaka: istasyon kodu
STATION_CODES = {
    "06 CHZ 142": "9365",
    "06 CHZ 146": "9370", 
    "06 CHZ 149": "9375",
    "34 FTU 336": "9360",
    "34 KMP 224": "9355",
    "34 MHA 112": "9356"
}

async def update_station_codes():
    print("Arac istasyon kodlari guncelleniyor...")
    
    updated = 0
    not_found = []
    
    for plate, station_code in STATION_CODES.items():
        result = await vehicles_collection.find_one_and_update(
            {"plate": plate},
            {"$set": {"station_code": station_code}},
            return_document=True
        )
        
        if result:
            print(f"  Guncellendi: {plate} -> {station_code}")
            updated += 1
        else:
            not_found.append(plate)
            print(f"  Bulunamadi: {plate}")
    
    print(f"\nToplam guncellenen: {updated}")
    
    if not_found:
        print(f"Bulunamayan araclar: {', '.join(not_found)}")
        print("\nBulunamayan araclar ekleniyor...")
        
        for plate in not_found:
            station_code = STATION_CODES[plate]
            import uuid
            new_vehicle = {
                "_id": str(uuid.uuid4()),
                "plate": plate,
                "type": "ambulans",
                "status": "musait",
                "km": 0,
                "station_code": station_code,
                "qr_code": str(uuid.uuid4())
            }
            await vehicles_collection.insert_one(new_vehicle)
            print(f"  Eklendi: {plate} ({station_code})")
    
    print("\nIslem tamamlandi!")

if __name__ == "__main__":
    asyncio.run(update_station_codes())

