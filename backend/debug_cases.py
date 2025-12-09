import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.resolve()
load_dotenv(ROOT_DIR / '.env', override=True)

mongo_url = os.environ.get('MONGO_URL', 'mongodb+srv://healmedy_user:H3alm3dy2024!@abro.lwzasyg.mongodb.net/')
db_name = os.environ.get('DB_NAME', 'healmedy_hbys')

async def debug():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("SON 3 VAKA:")
    print("=" * 60)
    
    cases = await db.cases.find({}).sort("created_at", -1).limit(3).to_list(3)
    for case in cases:
        print(f"\nVaka: {case.get('case_number')}")
        print(f"  ID: {case.get('_id')}")
        print(f"  Status: {case.get('status')}")
        print(f"  Assigned Team: {case.get('assigned_team')}")
        if case.get('assigned_team'):
            at = case['assigned_team']
            print(f"    - vehicle_id: {at.get('vehicle_id')}")
            print(f"    - driver_id: {at.get('driver_id')}")
            print(f"    - paramedic_id: {at.get('paramedic_id')}")
            print(f"    - att_id: {at.get('att_id')}")
            print(f"    - nurse_id: {at.get('nurse_id')}")
    
    print("\n" + "=" * 60)
    print("BUGÜNKÜ VARDİYA ATAMALARI:")
    print("=" * 60)
    
    assignments = await db.shift_assignments.find({
        "status": {"$in": ["pending", "started"]}
    }).to_list(100)
    
    for a in assignments:
        user = await db.users.find_one({"_id": a.get("user_id")})
        user_name = user.get("name") if user else "?"
        user_role = user.get("role") if user else "?"
        print(f"\n  User: {user_name} ({user_role})")
        print(f"    ID: {a.get('user_id')}")
        print(f"    Vehicle ID: {a.get('vehicle_id')}")
        print(f"    Location Type: {a.get('location_type')}")
        print(f"    Status: {a.get('status')}")
    
    print("\n" + "=" * 60)
    print("TEST KULLANICILARI:")
    print("=" * 60)
    
    users = await db.users.find({}).to_list(100)
    for u in users:
        print(f"  {u.get('name')} - {u.get('role')} - ID: {u.get('_id')}")
    
    client.close()

asyncio.run(debug())

