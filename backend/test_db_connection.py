"""MongoDB bağlantı testi"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

async def test_connection():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
    db_name = os.environ.get('DB_NAME', 'healmedy_hbys')
    
    print(f"MongoDB URL: {mongo_url.replace('H3alm3dy2024!', '***')}")
    print(f"Database: {db_name}")
    print("\nBağlantı test ediliyor...")
    
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        # Bağlantıyı test et
        await client.admin.command('ping')
        print("[OK] MongoDB baglantisi basarili!")
        
        # Veritabanını listele
        db = client[db_name]
        collections = await db.list_collection_names()
        print(f"\nVeritabaninda {len(collections)} koleksiyon bulundu:")
        for col in collections[:10]:  # İlk 10'unu göster
            count = await db[col].count_documents({})
            print(f"  - {col}: {count} dokuman")
        
        # Kullanıcı sayısını kontrol et
        user_count = await db.users.count_documents({})
        print(f"\nToplam kullanici sayisi: {user_count}")
        
        if user_count == 0:
            print("\n[UYARI] Veritabaninda kullanici yok! Giris yapmak icin once kullanici olusturmaniz gerekiyor.")
        
        client.close()
        return True
    except Exception as e:
        print(f"[HATA] MongoDB baglanti hatasi: {e}")
        print("\nOlası nedenler:")
        print("1. İnternet bağlantısı yok")
        print("2. MongoDB Atlas IP whitelist ayarları")
        print("3. MongoDB kullanıcı adı/şifre yanlış")
        print("4. MongoDB cluster'ı çalışmıyor")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())

