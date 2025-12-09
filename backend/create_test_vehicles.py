import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def create_test_vehicles():
    mongo_url = os.getenv("MONGO_URL")
    db_name = os.getenv("DB_NAME")
    
    print("Creating test vehicles...")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    test_vehicles = [
        {
            "_id": "test-vehicle-1",
            "plate": "34 HM 001",
            "type": "ambulans",
            "status": "musait",
            "km": 125000,
            "fuel_level": 75,
            "qr_code": "qr-vehicle-001",
            "current_case_id": None,
            "last_inspection_date": datetime(2025, 10, 15),
            "next_maintenance_km": 140000,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-vehicle-2",
            "plate": "34 HM 002",
            "type": "ambulans",
            "status": "musait",
            "km": 98000,
            "fuel_level": 60,
            "qr_code": "qr-vehicle-002",
            "current_case_id": None,
            "last_inspection_date": datetime(2025, 9, 20),
            "next_maintenance_km": 120000,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "_id": "test-vehicle-3",
            "plate": "34 HM 003",
            "type": "arac",
            "status": "musait",
            "km": 156000,
            "fuel_level": 45,
            "qr_code": "qr-vehicle-003",
            "current_case_id": None,
            "last_inspection_date": datetime(2025, 8, 10),
            "next_maintenance_km": 160000,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # Clear existing test vehicles
    await db.vehicles.delete_many({"_id": {"$regex": "^test-vehicle"}})
    
    # Insert test vehicles
    result = await db.vehicles.insert_many(test_vehicles)
    
    print(f"\n[OK] {len(result.inserted_ids)} test vehicles created!")
    print("\nTest Vehicles:")
    print("="*60)
    for vehicle in test_vehicles:
        print(f"\nPlate: {vehicle['plate']}")
        print(f"  Type: {vehicle['type']}")
        print(f"  Status: {vehicle['status']}")
        print(f"  KM: {vehicle['km']}")
        print(f"  QR Code: {vehicle['qr_code']}")
    print("\n" + "="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_vehicles())

