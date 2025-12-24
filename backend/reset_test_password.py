"""Test kullanıcısı için şifre sıfırla"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

async def reset_password(email_or_name: str, new_password: str = "test123"):
    mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
    db_name = os.environ.get('DB_NAME', 'healmedy_hbys')
    
    try:
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        
        # Email veya isim ile ara
        is_email = '@' in email_or_name
        if is_email:
            user_doc = await db.users.find_one({"email": email_or_name.lower()})
        else:
            user_doc = await db.users.find_one({"name": {"$regex": f"^{email_or_name}$", "$options": "i"}})
        
        if not user_doc:
            print(f"[HATA] Kullanici bulunamadi: {email_or_name}")
            return False
        
        # Yeni şifreyi hashle
        password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        
        # Şifreyi güncelle
        await db.users.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"password_hash": password_hash}}
        )
        
        print(f"[OK] Sifre basariyla sifirlandi!")
        print(f"Kullanici: {user_doc.get('name')} ({user_doc.get('email')})")
        print(f"Yeni sifre: {new_password}")
        print(f"\nGiris bilgileri:")
        print(f"  Email: {user_doc.get('email')}")
        print(f"  veya Isim: {user_doc.get('name')}")
        print(f"  Sifre: {new_password}")
        
        client.close()
        return True
    except Exception as e:
        print(f"[HATA] {e}")
        return False

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Kullanim: python reset_test_password.py <email_veya_isim> [yeni_sifre]")
        print("\nOrnek:")
        print("  python reset_test_password.py merkez@healmedy.com test123")
        print("  python reset_test_password.py 'Ahmet Yilmaz' test123")
        sys.exit(1)
    
    email_or_name = sys.argv[1]
    new_password = sys.argv[2] if len(sys.argv) > 2 else "test123"
    
    asyncio.run(reset_password(email_or_name, new_password))




