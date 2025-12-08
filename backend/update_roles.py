"""
Rol güncelleme scripti
"""
import asyncio
from database import users_collection

async def update_users():
    # NURİ IŞIK ve ŞENİZ KANDEMİR'i personel rolüne güncelle
    result1 = await users_collection.update_one(
        {"email": "nuri.isik@healmedy.tech"},
        {"$set": {"role": "personel"}}
    )
    result2 = await users_collection.update_one(
        {"email": "seniz.kandemir@healmedy.tech"},
        {"$set": {"role": "personel"}}
    )
    print(f"Nuri Isik: {result1.modified_count} guncellendi")
    print(f"Seniz Kandemir: {result2.modified_count} guncellendi")
    
    # Kontrol et
    user1 = await users_collection.find_one({"email": "nuri.isik@healmedy.tech"})
    user2 = await users_collection.find_one({"email": "seniz.kandemir@healmedy.tech"})
    
    if user1:
        print(f"Nuri Isik - Yeni rol: {user1.get('role')}")
    if user2:
        print(f"Seniz Kandemir - Yeni rol: {user2.get('role')}")

if __name__ == "__main__":
    asyncio.run(update_users())

