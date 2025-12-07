import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def create_test_users():
    # MongoDB connection
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    
    print(f"Connecting to MongoDB...")
    print(f"URL: {mongo_url[:50]}...")
    print(f"Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Password: test123
    password_hash = bcrypt.hashpw("test123".encode(), bcrypt.gensalt()).decode()
    
    test_users = [
        {
            "_id": "test-merkez-ofis",
            "email": "merkez@healmedy.com",
            "name": "Ahmet Yilmaz",
            "role": "merkez_ofis",
            "password_hash": password_hash,
            "phone": "0532 111 1111",
            "tc_no": "11111111111",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-operasyon-muduru",
            "email": "operasyon@healmedy.com",
            "name": "Mehmet Demir",
            "role": "operasyon_muduru",
            "password_hash": password_hash,
            "phone": "0532 222 2222",
            "tc_no": "22222222222",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-doktor",
            "email": "doktor@healmedy.com",
            "name": "Dr. Ayse Kaya",
            "role": "doktor",
            "password_hash": password_hash,
            "phone": "0532 333 3333",
            "tc_no": "33333333333",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-hemsire",
            "email": "hemsire@healmedy.com",
            "name": "Fatma Sahin",
            "role": "hemsire",
            "password_hash": password_hash,
            "phone": "0532 444 4444",
            "tc_no": "44444444444",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-paramedik",
            "email": "paramedik@healmedy.com",
            "name": "Can Ozturk",
            "role": "paramedik",
            "password_hash": password_hash,
            "phone": "0532 555 5555",
            "tc_no": "55555555555",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-att",
            "email": "att@healmedy.com",
            "name": "Emre Yildiz",
            "role": "att",
            "password_hash": password_hash,
            "phone": "0532 666 6666",
            "tc_no": "66666666666",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-bas-sofor",
            "email": "bassofor@healmedy.com",
            "name": "Ali Celik",
            "role": "bas_sofor",
            "password_hash": password_hash,
            "phone": "0532 777 7777",
            "tc_no": "77777777777",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-sofor",
            "email": "sofor@healmedy.com",
            "name": "Hasan Aydin",
            "role": "sofor",
            "password_hash": password_hash,
            "phone": "0532 888 8888",
            "tc_no": "88888888888",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-cagri-merkezi",
            "email": "cagri@healmedy.com",
            "name": "Zeynep Arslan",
            "role": "cagri_merkezi",
            "password_hash": password_hash,
            "phone": "0532 999 9999",
            "tc_no": "99999999999",
            "temp_roles": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    print(f"\nClearing existing test users...")
    # Clear existing test users
    delete_result = await db.users.delete_many({"_id": {"$regex": "^test-"}})
    print(f"Deleted {delete_result.deleted_count} existing test users")
    
    print(f"\nInserting {len(test_users)} new test users...")
    # Insert test users
    result = await db.users.insert_many(test_users)
    
    print("\n" + "="*70)
    print("[OK] Test users created successfully!")
    print(f"Created user count: {len(result.inserted_ids)}")
    print("\nLOGIN CREDENTIALS:")
    print("="*70)
    for user in test_users:
        print(f"\n{user['name']} ({user['role']})")
        print(f"  Email: {user['email']}")
        print(f"  Password: test123")
    print("\n" + "="*70)
    
    client.close()
    print("\nMongoDB connection closed.")

if __name__ == "__main__":
    asyncio.run(create_test_users())

