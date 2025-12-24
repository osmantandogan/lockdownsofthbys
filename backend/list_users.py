"""Veritabanındaki kullanıcıları listele"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

async def list_users():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
    db_name = os.environ.get('DB_NAME', 'healmedy_hbys')
    
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # İlk 20 kullanıcıyı listele
        users = await db.users.find({}).limit(20).to_list(length=20)
        
        print(f"\nVeritabaninda {len(users)} kullanici bulundu (ilk 20):\n")
        print("-" * 80)
        print(f"{'Isim':<30} {'Email':<30} {'Rol':<20}")
        print("-" * 80)
        
        for user in users:
            name = user.get('name', 'N/A')
            email = user.get('email', 'N/A')
            role = user.get('role', 'N/A')
            has_password = 'password_hash' in user and user['password_hash'] is not None
            password_status = "Sifre var" if has_password else "SIFRE YOK!"
            
            print(f"{name:<30} {email:<30} {role:<20} [{password_status}]")
        
        print("-" * 80)
        print(f"\nToplam kullanici sayisi: {await db.users.count_documents({})}")
        print("\nGiris yapmak icin yukaridaki email veya isim kullanilabilir.")
        print("Sifre yoksa, sifre sifirlama gerekir.")
        
        client.close()
    except Exception as e:
        print(f"Hata: {e}")

if __name__ == "__main__":
    asyncio.run(list_users())




